"""Iteration 108 — Regression for variant cost double-counting fix in
sauna order margin recompute.

Bug: in `_recompute_one` (routes/sauna_orders.py), the model's costPrice and
the variant's costPrice were being summed, but tech-cards already write the
variant's costPrice as the FULL cost for that variant (scope='variant'), so the
result was double-counted.

Fix: when a variant is selected and variant.costPrice > 0, model_cost is
REPLACED by variant.costPrice (same for retailExtraCost).

These tests directly mutate the `sauna_prices.default` document via MongoDB
to add TEST_ models and variants, create orders through the public API, run
the recompute endpoint, and verify totalCost / margin per the new logic.
All TEST_ prefixed data is cleaned up at the end.
"""
import os
import pytest
import requests
from pymongo import MongoClient


def _load_env_file(path):
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass


_load_env_file('/app/frontend/.env')
_load_env_file('/app/backend/.env')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

VAT_RATE = 0.23

# ---------------- Test constants ----------------
TEST_MODEL_ID = "TEST_MODEL_ITER108"
TEST_VARIANT_FULL = "TEST_VARIANT_FULL_ITER108"      # full cost overrides model
TEST_VARIANT_ZERO = "TEST_VARIANT_ZERO_ITER108"      # cost=0 → falls back
MODEL_COST = 1000
MODEL_RETAIL_EXTRA = 100
VARIANT_FULL_COST = 7946          # like real "Sauna Wiking Lux z tarasem"
VARIANT_FULL_RETAIL_EXTRA = 500
ORDER_TOTAL = 50000               # brutto


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": "admin", "password": "admin123"},
                      timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def seed_prices_and_cleanup(mongo):
    """Inject TEST_ model with two variants into sauna_prices, then clean up."""
    coll = mongo.sauna_prices

    test_model = {
        "id": TEST_MODEL_ID,
        "name": "TEST_ Model Iter108",
        "costPrice": MODEL_COST,
        "retailExtraCost": MODEL_RETAIL_EXTRA,
        "price": 40000,
        "variants": [
            {
                "id": TEST_VARIANT_FULL,
                "name": "TEST_ Variant Full",
                "costPrice": VARIANT_FULL_COST,
                "retailExtraCost": VARIANT_FULL_RETAIL_EXTRA,
                "price": 45000,
            },
            {
                "id": TEST_VARIANT_ZERO,
                "name": "TEST_ Variant Zero",
                "costPrice": 0,
                "retailExtraCost": 0,
                "price": 45000,
            },
        ],
    }

    # Add model (push). Make sure doc exists.
    if coll.find_one({"_id": "default"}) is None:
        coll.insert_one({"_id": "default", "models": [], "options": [], "categories": []})

    coll.update_one(
        {"_id": "default"},
        {"$pull": {"models": {"id": TEST_MODEL_ID}}},
    )
    coll.update_one(
        {"_id": "default"},
        {"$push": {"models": test_model}},
    )

    yield

    # cleanup model
    coll.update_one(
        {"_id": "default"},
        {"$pull": {"models": {"id": TEST_MODEL_ID}}},
    )
    # cleanup any test orders
    mongo.sauna_orders.delete_many({"selectedModel": TEST_MODEL_ID})
    mongo.sauna_orders.delete_many({"id": {"$regex": "^WMS-TEST-"}})


# ---------------- Helpers ----------------
def _create_order(variant_id, headers, suffix):
    payload = {
        "id": f"WMS-TEST-{suffix}",
        "fullName": f"TEST_ Iter108 {suffix}",
        "phoneNumber": "+48000000000",
        "fullAddress": "TEST address",
        "selectedModel": TEST_MODEL_ID,
        "selectedModelVariant": variant_id,
        "modelName": "TEST_ Model Iter108",
        "basePrice": 40000,
        "selectedOptions": [],
        "total": ORDER_TOTAL,
        "subtotal": ORDER_TOTAL,
        "createdBy": "TEST_iter108",
        "source": "manual",
    }
    r = requests.post(f"{BASE_URL}/api/sauna/orders", json=payload, headers=headers, timeout=20)
    assert r.status_code == 200, f"Order create failed ({r.status_code}): {r.text}"
    return payload["id"]


def _get_order(order_id, headers):
    r = requests.get(f"{BASE_URL}/api/sauna/orders/{order_id}", headers=headers, timeout=15)
    assert r.status_code == 200, f"Order GET failed ({r.status_code}): {r.text}"
    return r.json()


def _recompute(headers):
    r = requests.post(f"{BASE_URL}/api/sauna/orders/recompute-margins",
                      headers=headers, timeout=60)
    assert r.status_code == 200, f"recompute failed ({r.status_code}): {r.text}"
    return r.json()


# ---------------- Tests ----------------
class TestRecomputeMarginsEndpoint:
    """Smoke test of the recompute-margins endpoint shape."""

    def test_recompute_response_shape(self, auth_headers):
        body = _recompute(auth_headers)
        assert body.get("ok") is True, body
        for key in ("updated", "unchanged", "skipped", "techcardsSynced"):
            assert key in body, f"Missing key '{key}' in response: {body}"
        # Numeric counts
        for key in ("updated", "unchanged", "skipped"):
            assert isinstance(body[key], int), f"{key} not int: {body[key]!r}"


class TestVariantCostReplacement:
    """Core regression for the double-counting fix."""

    def test_variant_full_cost_replaces_model_cost(self, auth_headers):
        order_id = _create_order(TEST_VARIANT_FULL, auth_headers, "FULL")
        _recompute(auth_headers)
        order = _get_order(order_id, auth_headers)

        # Expected: variant fully replaces model cost AND retailExtra.
        expected_cost = VARIANT_FULL_COST                  # 7946 (NOT 1000+7946=8946)
        expected_retail_extra = VARIANT_FULL_RETAIL_EXTRA  # 500  (NOT 100+500=600)
        netto = ORDER_TOTAL / (1 + VAT_RATE)
        expected_margin = round(netto - expected_cost - expected_retail_extra)

        assert order["totalCost"] == expected_cost, (
            f"Expected totalCost={expected_cost} (variant replaces model), "
            f"got {order['totalCost']}. Double counting? "
            f"(model+variant={MODEL_COST + VARIANT_FULL_COST})"
        )
        assert order.get("retailExtraCost") == expected_retail_extra
        assert abs(order["margin"] - expected_margin) <= 1, (
            f"margin {order['margin']} != expected {expected_margin}"
        )

    def test_variant_zero_cost_falls_back_to_model(self, auth_headers):
        order_id = _create_order(TEST_VARIANT_ZERO, auth_headers, "ZERO")
        _recompute(auth_headers)
        order = _get_order(order_id, auth_headers)

        # variant costPrice==0 → model.costPrice fallback. Same for retailExtra.
        expected_cost = MODEL_COST
        expected_retail_extra = MODEL_RETAIL_EXTRA
        netto = ORDER_TOTAL / (1 + VAT_RATE)
        expected_margin = round(netto - expected_cost - expected_retail_extra)

        assert order["totalCost"] == expected_cost, (
            f"Expected fallback to model cost={expected_cost}, got {order['totalCost']}"
        )
        assert order.get("retailExtraCost") == expected_retail_extra
        assert abs(order["margin"] - expected_margin) <= 1

    def test_no_variant_uses_model_cost(self, auth_headers):
        order_id = _create_order(None, auth_headers, "NOVAR")
        _recompute(auth_headers)
        order = _get_order(order_id, auth_headers)

        expected_cost = MODEL_COST
        expected_retail_extra = MODEL_RETAIL_EXTRA
        netto = ORDER_TOTAL / (1 + VAT_RATE)
        expected_margin = round(netto - expected_cost - expected_retail_extra)

        assert order["totalCost"] == expected_cost
        assert order.get("retailExtraCost") == expected_retail_extra
        assert abs(order["margin"] - expected_margin) <= 1


class TestMarginCalculation:
    """Cross-checks of the VAT-aware netto margin formula."""

    def test_margin_equals_netto_minus_cost_minus_retail_extra(self, auth_headers):
        order_id = _create_order(TEST_VARIANT_FULL, auth_headers, "MARGIN-CHECK")
        _recompute(auth_headers)
        order = _get_order(order_id, auth_headers)

        total = float(order["total"])
        netto = total / (1 + VAT_RATE)
        cost = float(order["totalCost"])
        extra = float(order.get("retailExtraCost") or 0)
        expected = round(netto - cost - extra)
        assert abs(order["margin"] - expected) <= 1, (
            f"margin={order['margin']} netto={netto:.2f} cost={cost} extra={extra}"
        )
