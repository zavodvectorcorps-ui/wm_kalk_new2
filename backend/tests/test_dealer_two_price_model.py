"""Iteration 96 — Two-price model (B2B + dealerRetailPrice) backend tests.

Coverage:
1. GET /api/dealer/sauna/prices: basePrice/b2bPrice/baseRetailWm + costPrice stripped.
2. PUT /api/dealer/sauna/overrides: only modifies dealerRetailPrice, preserves admin B2B.
3. PUT /api/admin/dealers/{id}/overrides: only modifies B2B price, preserves dealerRetailPrice.
4. POST /api/dealer/sauna/overrides/bulk-markup: percent markup with base=b2b, scope=models.
5. POST /api/dealer/sauna/orders: auto-computes manufacturerTotal from B2B; order.total preserved.
6. PUT /api/dealer/sauna/orders/{id}: recomputes manufacturerTotal on update.
7. POST /api/dealer/sauna/orders/{id}/confirm: preserves manufacturerTotal.
8. POST /api/admin/dealer-orders/recompute-manufacturer-totals: backfill.
9. POST /api/sauna/orders/recompute-margins: uses manufacturerTotal as brutto baseline.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
pytestmark = pytest.mark.skipif(not BASE, reason="REACT_APP_BACKEND_URL not set")

DEALER_USER = "testdealer"
DEALER_PASS = "dealer123"
DEALER_ID = "2710dcf7-a971-4124-ab3e-1e0a401f5c11"
MODEL_ID = "sauna_kwadro_beczka_235x200_cm"
B2B_PRICE = 15000
RETAIL_PRICE = 20000


def _admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "admin123"}, timeout=10)
    r.raise_for_status()
    return r.json()["token"]


def _dealer_token():
    r = requests.post(f"{BASE}/api/dealer/auth/login", json={"username": DEALER_USER, "password": DEALER_PASS}, timeout=10)
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_admin_token()}"}


@pytest.fixture(scope="module")
def dealer_headers():
    return {"Authorization": f"Bearer {_dealer_token()}"}


@pytest.fixture(scope="module", autouse=True)
def seed_overrides(admin_headers, dealer_headers):
    """Ensure dealer has price=15000 (B2B) and dealerRetailPrice=20000 for MODEL_ID."""
    # 1. Admin upserts B2B price=15000
    r = requests.post(
        f"{BASE}/api/admin/dealers/{DEALER_ID}/overrides/upsert",
        headers=admin_headers,
        json={"overrides": [{"dealerId": DEALER_ID, "kind": "model", "modelId": MODEL_ID, "price": B2B_PRICE}]},
        timeout=10,
    )
    assert r.status_code == 200, r.text

    # 2. Dealer PUTs dealerRetailPrice=20000 (preserves B2B by spec)
    r = requests.put(
        f"{BASE}/api/dealer/sauna/overrides",
        headers=dealer_headers,
        json={"overrides": [{"dealerId": DEALER_ID, "kind": "model", "modelId": MODEL_ID, "dealerRetailPrice": RETAIL_PRICE}]},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    yield


# -------------------- 1. GET prices --------------------

def test_dealer_get_prices_shape(dealer_headers):
    r = requests.get(f"{BASE}/api/dealer/sauna/prices", headers=dealer_headers, timeout=15)
    assert r.status_code == 200
    doc = r.json()
    models = doc.get("models") or []
    target = next((m for m in models if m.get("id") == MODEL_ID), None)
    assert target is not None, f"Model {MODEL_ID} missing in dealer prices"
    # basePrice = dealerRetailPrice (since set)
    assert target["basePrice"] == RETAIL_PRICE, f"basePrice expected {RETAIL_PRICE}, got {target['basePrice']}"
    # b2bPrice = override price (since set)
    assert target["b2bPrice"] == B2B_PRICE, f"b2bPrice expected {B2B_PRICE}, got {target['b2bPrice']}"
    # baseRetailWm preserved (original WM brutto, should be a positive int)
    assert isinstance(target["baseRetailWm"], int) and target["baseRetailWm"] > 0
    # costPrice MUST NOT be present
    assert "costPrice" not in target, "costPrice leaked to dealer response"


def test_dealer_prices_strips_cost_everywhere(dealer_headers):
    r = requests.get(f"{BASE}/api/dealer/sauna/prices", headers=dealer_headers, timeout=15)
    assert r.status_code == 200

    def _walk(obj):
        if isinstance(obj, dict):
            assert "costPrice" not in obj, "costPrice present in dealer prices doc"
            for v in obj.values():
                _walk(v)
        elif isinstance(obj, list):
            for it in obj:
                _walk(it)

    _walk(r.json())


# -------------------- 2. Symmetric PUT (dealer / admin) --------------------

def test_dealer_put_overrides_preserves_admin_b2b(admin_headers, dealer_headers):
    """Re-PUT a different dealerRetailPrice; B2B price=15000 must survive."""
    r = requests.put(
        f"{BASE}/api/dealer/sauna/overrides",
        headers=dealer_headers,
        json={"overrides": [{"dealerId": DEALER_ID, "kind": "model", "modelId": MODEL_ID, "dealerRetailPrice": 21000}]},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE}/api/dealer/sauna/overrides", headers=dealer_headers, timeout=10)
    assert g.status_code == 200
    row = next((o for o in g.json()["overrides"] if o.get("kind") == "model" and o.get("modelId") == MODEL_ID), None)
    assert row is not None
    assert row.get("price") == B2B_PRICE, f"admin B2B price wiped, got {row.get('price')}"
    assert row.get("dealerRetailPrice") == 21000
    # restore
    requests.put(
        f"{BASE}/api/dealer/sauna/overrides",
        headers=dealer_headers,
        json={"overrides": [{"dealerId": DEALER_ID, "kind": "model", "modelId": MODEL_ID, "dealerRetailPrice": RETAIL_PRICE}]},
        timeout=10,
    )


def test_admin_put_overrides_preserves_dealer_retail(admin_headers, dealer_headers):
    """Admin PUT changes B2B; dealer's retail=20000 must survive."""
    new_b2b = 16000
    r = requests.put(
        f"{BASE}/api/admin/dealers/{DEALER_ID}/overrides",
        headers=admin_headers,
        json={"overrides": [{"dealerId": DEALER_ID, "kind": "model", "modelId": MODEL_ID, "price": new_b2b}]},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE}/api/admin/dealers/{DEALER_ID}/overrides", headers=admin_headers, timeout=10)
    row = next((o for o in g.json()["overrides"] if o.get("kind") == "model" and o.get("modelId") == MODEL_ID), None)
    assert row is not None
    assert row.get("price") == new_b2b
    assert row.get("dealerRetailPrice") == RETAIL_PRICE, "dealer retail wiped by admin PUT"
    # restore via upsert (the only endpoint that doesn't wipe other rows)
    requests.post(
        f"{BASE}/api/admin/dealers/{DEALER_ID}/overrides/upsert",
        headers=admin_headers,
        json={"overrides": [{"dealerId": DEALER_ID, "kind": "model", "modelId": MODEL_ID, "price": B2B_PRICE}]},
        timeout=10,
    )


# -------------------- 3. Bulk markup --------------------

def test_bulk_markup_b2b_models_only(dealer_headers):
    r = requests.post(
        f"{BASE}/api/dealer/sauna/overrides/bulk-markup",
        headers=dealer_headers,
        json={"percent": 20, "base": "b2b", "scope": "models", "overwrite": True},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    # After markup, our MODEL_ID with B2B=15000 should have retail=18000
    g = requests.get(f"{BASE}/api/dealer/sauna/overrides", headers=dealer_headers, timeout=10)
    row = next((o for o in g.json()["overrides"] if o.get("kind") == "model" and o.get("modelId") == MODEL_ID), None)
    assert row is not None
    assert row.get("price") == B2B_PRICE
    assert row.get("dealerRetailPrice") == int(round(B2B_PRICE * 1.20)), \
        f"expected retail 18000, got {row.get('dealerRetailPrice')}"
    # Restore retail=20000
    requests.put(
        f"{BASE}/api/dealer/sauna/overrides",
        headers=dealer_headers,
        json={"overrides": [{"dealerId": DEALER_ID, "kind": "model", "modelId": MODEL_ID, "dealerRetailPrice": RETAIL_PRICE}]},
        timeout=10,
    )


# -------------------- 4. Order create computes manufacturerTotal --------------------

@pytest.fixture(scope="module")
def created_order(dealer_headers):
    """Create one dealer order with the seeded MODEL_ID and 1 option. Cleanup at teardown."""
    payload = {
        "selectedModel": MODEL_ID,
        "selectedOptions": [],  # keep simple — at least model only
        "discountPercent": 0,
        "total": RETAIL_PRICE,  # dealer's retail
        "customerName": "TEST_TwoPrice_Client",
        "status": "draft",
    }
    r = requests.post(f"{BASE}/api/dealer/sauna/orders", headers=dealer_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    order = r.json()["order"]
    yield order
    try:
        requests.delete(f"{BASE}/api/dealer/sauna/orders/{order['id']}", headers=dealer_headers, timeout=10)
    except Exception:
        pass


def test_create_order_computes_manufacturer_total(created_order):
    assert created_order.get("manufacturerTotal") == B2B_PRICE, \
        f"expected manufacturerTotal={B2B_PRICE}, got {created_order.get('manufacturerTotal')}"
    assert created_order.get("manufacturerBasePrice") == B2B_PRICE
    # Dealer retail total preserved
    assert created_order.get("total") == RETAIL_PRICE


def test_update_order_recomputes_manufacturer_total(dealer_headers, created_order):
    # Submit an update with same model but new customerName
    update = {
        "selectedModel": MODEL_ID,
        "selectedOptions": [],
        "discountPercent": 0,
        "total": RETAIL_PRICE,
        "customerName": "TEST_TwoPrice_Client_UPDATED",
    }
    r = requests.put(
        f"{BASE}/api/dealer/sauna/orders/{created_order['id']}",
        headers=dealer_headers,
        json=update,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    fresh = r.json()["order"]
    assert fresh.get("manufacturerTotal") == B2B_PRICE
    assert fresh.get("customerName") == "TEST_TwoPrice_Client_UPDATED"


def test_confirm_order_preserves_manufacturer_total(dealer_headers, created_order):
    r = requests.post(
        f"{BASE}/api/dealer/sauna/orders/{created_order['id']}/confirm",
        headers=dealer_headers,
        json={"clientConfirmed": True, "dealerContractNumber": f"TEST-{uuid.uuid4().hex[:6]}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    confirmed = r.json()["order"]
    assert confirmed.get("status") == "confirmed"
    assert confirmed.get("manufacturerTotal") == B2B_PRICE
    assert confirmed.get("total") == RETAIL_PRICE


# -------------------- 5. Admin backfill manufacturer totals --------------------

def test_admin_recompute_manufacturer_totals(admin_headers):
    r = requests.post(
        f"{BASE}/api/admin/dealer-orders/recompute-manufacturer-totals",
        headers=admin_headers,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert isinstance(body.get("updated"), int)
    assert body["updated"] >= 1


# -------------------- 6. recompute-margins uses manufacturerTotal --------------------

def test_recompute_margins_uses_manufacturer_total_for_dealer(admin_headers):
    r = requests.post(f"{BASE}/api/sauna/orders/recompute-margins", headers=admin_headers, timeout=120)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
