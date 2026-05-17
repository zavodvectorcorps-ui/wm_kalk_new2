"""Backend tests for VAT-aware tech-card totals (iteration 94).

Validates:
  - _compute_totals now returns retailNetto + vatRate
  - retailNetto = round(retailBrutto / 1.23)
  - marginAmount = retailNetto - totalCost (rounded int)
  - marginPct uses retailNetto denominator
  - GET /tech-cards/{id} returns enriched netto fields
  - Persistence: card document contains retailNetto/vatRate after upsert
  - POST /tech-cards/recompute-all back-fills the netto fields
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://margin-popup-next.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
COST = f"{API}/sauna-production/cost"


# ------------------- Fixtures -------------------

@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def prices(H):
    r = requests.get(f"{API}/sauna/prices", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def model_with_price(prices):
    """Pick the first model with a non-zero retail price (basePrice in sauna_prices)."""
    for m in prices.get("models") or []:
        if int(m.get("basePrice") or m.get("price") or 0) > 0:
            return m
    pytest.skip("No model with non-zero price")


@pytest.fixture(scope="module")
def cheap_component(H):
    """Create a tiny component used for tech-card items."""
    r = requests.post(f"{COST}/components", json={
        "name": "TEST_VAT_BomMaterial",
        "category": "wood",
        "unit": "шт",
        "unitPrice": 100.0,
    }, headers=H, timeout=10)
    assert r.status_code == 200, r.text
    comp = r.json()
    yield comp
    # cleanup (best-effort)
    requests.delete(f"{COST}/components/{comp['id']}", headers=H, timeout=10)


# ------------------- Helpers -------------------

def _expected_netto(brutto: float) -> int:
    return int(round(round(brutto / 1.23, 2)))


# ------------------- Tests -------------------

state = {}


class TestVATEnrichment:

    def test_create_card_returns_retailNetto_and_vatRate(self, H, model_with_price, cheap_component):
        """POST returns retailNetto, vatRate, and a margin computed on netto."""
        # totalCost = 100 * 10.89 = 1089
        payload = {
            "scope": "model",
            "modelId": model_with_price["id"],
            "items": [{"componentId": cheap_component["id"], "qty": 10.89}],
            "laborCost": 0,
            "overheadPct": 0,
            "manualAdjustment": 0,
            "syncToCostPrice": False,
        }
        r = requests.post(f"{COST}/tech-cards", json=payload, headers=H, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()

        # totalCost
        assert d["totalCost"] == 1089, f"totalCost expected 1089, got {d['totalCost']}"

        # vatRate is exactly 0.23 (Poland)
        assert d.get("vatRate") == 0.23

        # retailPrice = brutto (kept as-is from sauna_prices basePrice)
        brutto = float(model_with_price.get("basePrice") or model_with_price.get("price") or 0)
        assert d["retailPrice"] == brutto

        # retailNetto = round(brutto / 1.23)
        exp_netto = _expected_netto(brutto)
        assert d["retailNetto"] == exp_netto, f"retailNetto expected {exp_netto}, got {d['retailNetto']}"

        # margin = netto - cost
        exp_margin = exp_netto - 1089
        assert d["marginAmount"] == exp_margin, f"marginAmount expected {exp_margin}, got {d['marginAmount']}"

        # marginPct
        if exp_netto > 0:
            exp_pct = round((exp_netto - 1089) * 100.0 / exp_netto, 1)
            assert d["marginPct"] == exp_pct

        state["card_id"] = d["id"]
        state["expected_netto"] = exp_netto
        state["expected_margin"] = exp_margin
        state["brutto"] = brutto

    def test_spec_example_19880_1089(self, H, model_with_price, cheap_component):
        """Spec example: retailPrice=19880 → retailNetto=16163, marginAmount=15074, marginPct~93.3.

        We can't easily inject a synthetic retailPrice into sauna_prices, so we *verify the math*
        directly here as a unit-style assertion (algorithm contract).
        """
        brutto = 19880
        cost = 1089
        netto = round(brutto / 1.23, 2)  # 16162.60
        assert int(round(netto)) == 16163
        margin = int(round(netto - cost))  # 16162.60 - 1089 = 15073.60 -> 15074
        assert margin == 15074
        pct = round((netto - cost) * 100.0 / netto, 1)
        assert pct == 93.3, f"margin pct expected 93.3, got {pct}"

    def test_get_card_returns_enriched_netto(self, H):
        card_id = state.get("card_id")
        if not card_id:
            pytest.skip("Card not created in earlier step")
        r = requests.get(f"{COST}/tech-cards/{card_id}", headers=H, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("vatRate") == 0.23
        assert d.get("retailNetto") == state["expected_netto"]
        assert d.get("marginAmount") == state["expected_margin"]
        assert d.get("retailPrice") == state["brutto"]

    def test_persisted_card_contains_netto_fields(self, H):
        """Validate the persisted document (not just the computed response) has retailNetto + vatRate.

        We do this by listing tech-cards and finding ours; the list endpoint returns the raw
        DB document (without recomputing on the fly), so the netto fields must be persisted.
        """
        card_id = state.get("card_id")
        if not card_id:
            pytest.skip("Card not created in earlier step")
        r = requests.get(f"{COST}/tech-cards", headers=H, timeout=10)
        assert r.status_code == 200
        items = r.json().get("items") or []
        ours = next((c for c in items if c.get("id") == card_id), None)
        assert ours is not None, "Created card missing from list"
        assert "retailNetto" in ours, "retailNetto not persisted on card document"
        assert "vatRate" in ours, "vatRate not persisted on card document"
        assert ours["vatRate"] == 0.23
        assert ours["retailNetto"] == state["expected_netto"]

    def test_recompute_all_backfills_netto(self, H):
        """recompute-all should write retailNetto/vatRate onto every card."""
        r = requests.post(f"{COST}/tech-cards/recompute-all", headers=H, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("recomputed", 0) >= 1

        # Verify all cards in the listing have the new fields
        r2 = requests.get(f"{COST}/tech-cards", headers=H, timeout=15)
        assert r2.status_code == 200
        items = r2.json().get("items") or []
        missing = [c["id"] for c in items if "retailNetto" not in c or "vatRate" not in c]
        assert not missing, f"Cards missing netto fields after recompute-all: {missing[:5]}"
        # vatRate should always be 0.23
        for c in items:
            assert c["vatRate"] == 0.23

    def test_margin_formula_consistency_across_cards(self, H):
        """For every card with a non-zero retailPrice: retailNetto ≈ round(retailPrice/1.23)
        and marginAmount == round(retailNetto - totalCost).
        """
        r = requests.get(f"{COST}/tech-cards", headers=H, timeout=15)
        assert r.status_code == 200
        items = r.json().get("items") or []
        checked = 0
        for c in items:
            brutto = float(c.get("retailPrice") or 0)
            if brutto <= 0:
                continue
            exp_netto = _expected_netto(brutto)
            # Allow 1-unit rounding slack
            assert abs(int(c["retailNetto"]) - exp_netto) <= 1, (
                f"card {c.get('id')} retailNetto={c['retailNetto']} vs expected {exp_netto}"
            )
            exp_margin = int(round(c["retailNetto"] - int(c["totalCost"])))
            assert abs(int(c["marginAmount"]) - exp_margin) <= 1
            checked += 1
        assert checked >= 1, "No cards with retail price checked"


# ------------------- Cleanup -------------------

@pytest.fixture(scope="module", autouse=True)
def cleanup(H):
    yield
    cid = state.get("card_id")
    if cid:
        try:
            requests.delete(f"{COST}/tech-cards/{cid}", headers=H, timeout=10)
        except Exception:
            pass
