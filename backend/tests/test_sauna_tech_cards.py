"""Backend tests for Sauna Tech Cards & Components (BOM cost-price)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sauna-config-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
COST = f"{API}/sauna-production/cost"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def model_ctx(H):
    """Pick first model + first variant + first option (flat or in category) from sauna_prices."""
    r = requests.get(f"{API}/sauna/prices", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    p = r.json()
    models = p.get("models") or []
    assert models, "Need at least one model in sauna_prices for tests"
    model = models[0]
    variant = (model.get("variants") or [None])[0]
    # find any option (flat or under categories)
    opt = None
    for o in (p.get("options") or []):
        opt = o; break
    if not opt:
        for cat in (p.get("categories") or []):
            for o in (cat.get("options") or []):
                opt = o; break
            if opt:
                break
    opt_variant = None
    if opt and opt.get("variants"):
        opt_variant = opt["variants"][0]
    return {"model": model, "variant": variant, "option": opt, "option_variant": opt_variant, "prices": p}


# ============================================================
# AUTH
# ============================================================
class TestAuth:
    def test_components_requires_auth(self):
        r = requests.get(f"{COST}/components", timeout=10)
        assert r.status_code in (401, 403)

    def test_tech_cards_requires_auth(self):
        r = requests.get(f"{COST}/tech-cards", timeout=10)
        assert r.status_code in (401, 403)

    def test_dashboard_requires_auth(self):
        r = requests.get(f"{COST}/dashboard", timeout=10)
        assert r.status_code in (401, 403)


# ============================================================
# COMPONENTS
# ============================================================
class TestComponents:
    created_ids = []

    def test_list_components(self, H):
        r = requests.get(f"{COST}/components", headers=H, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and isinstance(body["items"], list)
        assert "count" in body

    def test_create_component_minimal(self, H):
        r = requests.post(f"{COST}/components", json={"name": "TEST_Брус 50x50"}, headers=H, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Брус 50x50"
        assert d["category"] == "other"
        assert d["unit"] == "шт"
        assert d["unitPrice"] == 0
        assert "id" in d
        TestComponents.created_ids.append(d["id"])

    def test_create_component_missing_name(self, H):
        r = requests.post(f"{COST}/components", json={"name": ""}, headers=H, timeout=10)
        assert r.status_code == 400

    def test_create_component_full(self, H):
        r = requests.post(f"{COST}/components", json={
            "name": "TEST_Доска_обрезная",
            "category": "wood",
            "unit": "м",
            "unitPrice": 35.0,
            "supplier": "Lesprom",
        }, headers=H, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["unitPrice"] == 35.0
        assert d["category"] == "wood"
        TestComponents.created_ids.append(d["id"])

    def test_categories_endpoint(self, H):
        r = requests.get(f"{COST}/categories", headers=H, timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(c["id"] == "wood" for c in items)

    def test_update_component_no_price_change(self, H):
        cid = TestComponents.created_ids[0]
        r = requests.put(f"{COST}/components/{cid}", json={"supplier": "TEST_NewSup"}, headers=H, timeout=10)
        assert r.status_code == 200
        assert r.json()["priceChanged"] is False
        assert r.json()["affectedCards"] == 0

    def test_update_component_not_found(self, H):
        r = requests.put(f"{COST}/components/nonexistent-id", json={"unitPrice": 100}, headers=H, timeout=10)
        assert r.status_code == 404

    def test_delete_component_unused(self, H):
        # create a throwaway and delete it
        r = requests.post(f"{COST}/components", json={"name": "TEST_throwaway"}, headers=H, timeout=10)
        cid = r.json()["id"]
        r = requests.delete(f"{COST}/components/{cid}", headers=H, timeout=10)
        assert r.status_code == 200


# ============================================================
# TECH CARDS — happy path + scopes + sync
# ============================================================
class TestTechCards:
    state = {}

    def test_create_component_for_card(self, H):
        r = requests.post(f"{COST}/components", json={
            "name": "TEST_BomBrus", "category": "wood", "unit": "м", "unitPrice": 35.0,
        }, headers=H, timeout=10)
        assert r.status_code == 200
        self.state["component"] = r.json()

    def test_list_tech_cards_initial(self, H):
        r = requests.get(f"{COST}/tech-cards", headers=H, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json()["items"], list)

    def test_invalid_scope(self, H):
        r = requests.post(f"{COST}/tech-cards", json={"scope": "foobar"}, headers=H, timeout=10)
        assert r.status_code == 400

    def test_model_scope_missing_modelId(self, H):
        r = requests.post(f"{COST}/tech-cards", json={"scope": "model"}, headers=H, timeout=10)
        assert r.status_code == 400

    def test_option_scope_missing_optionId(self, H):
        r = requests.post(f"{COST}/tech-cards", json={"scope": "option"}, headers=H, timeout=10)
        assert r.status_code == 400

    def test_create_model_card_and_compute(self, H, model_ctx):
        comp = self.state["component"]
        model = model_ctx["model"]
        payload = {
            "scope": "model",
            "modelId": model["id"],
            "items": [{"componentId": comp["id"], "qty": 100}],
            "laborCost": 2500,
            "overheadPct": 10,
            "manualAdjustment": 0,
            "syncToCostPrice": True,
        }
        r = requests.post(f"{COST}/tech-cards", json=payload, headers=H, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # materials = 35*100 = 3500; overhead = 350; labor 2500; total = 6350
        assert d["materialsCost"] == 3500
        assert d["overheadCost"] == 350
        assert d["totalCost"] == 6350
        assert d["scope"] == "model"
        self.state["card_id"] = d["id"]
        self.state["model_id"] = model["id"]

    def test_costprice_synced(self, H, model_ctx):
        r = requests.get(f"{API}/sauna/prices", headers=H, timeout=10)
        assert r.status_code == 200
        for m in r.json()["models"]:
            if m["id"] == self.state["model_id"]:
                assert m.get("costPrice") == 6350
                return
        pytest.fail("Model not found in sauna_prices after sync")

    def test_get_enriched(self, H):
        card_id = self.state["card_id"]
        r = requests.get(f"{COST}/tech-cards/{card_id}", headers=H, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["items"][0]["componentName"] == "TEST_BomBrus"
        assert d["items"][0]["unit"] == "м"
        assert d["items"][0]["unitPrice"] == 35.0
        assert d["items"][0]["lineTotal"] == 3500.0
        assert d["items"][0]["missing"] is False

    def test_unit_price_change_auto_recompute(self, H):
        comp = self.state["component"]
        r = requests.put(f"{COST}/components/{comp['id']}", json={"unitPrice": 50.0}, headers=H, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["priceChanged"] is True
        assert body["affectedCards"] >= 1
        # check card recomputed: 50*100=5000 + 500 + 2500 = 8000
        r2 = requests.get(f"{COST}/tech-cards/{self.state['card_id']}", headers=H, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["totalCost"] == 8000
        # check costPrice resynced
        r3 = requests.get(f"{API}/sauna/prices", headers=H, timeout=10)
        for m in r3.json()["models"]:
            if m["id"] == self.state["model_id"]:
                assert m.get("costPrice") == 8000
                return
        pytest.fail("Re-synced model not found")

    def test_delete_component_in_use_blocked(self, H):
        comp = self.state["component"]
        r = requests.delete(f"{COST}/components/{comp['id']}", headers=H, timeout=10)
        assert r.status_code == 400
        assert "используется" in (r.json().get("detail") or "")

    def test_upsert_idempotent(self, H, model_ctx):
        """Re-posting same (scope, modelId, ...) should update the same card."""
        comp = self.state["component"]
        payload = {
            "scope": "model",
            "modelId": model_ctx["model"]["id"],
            "items": [{"componentId": comp["id"], "qty": 100}],
            "laborCost": 2500,
            "overheadPct": 10,
            "syncToCostPrice": True,
        }
        r = requests.post(f"{COST}/tech-cards", json=payload, headers=H, timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == self.state["card_id"]

    def test_list_filter_by_model(self, H):
        r = requests.get(f"{COST}/tech-cards", params={"modelId": self.state["model_id"]}, headers=H, timeout=10)
        assert r.status_code == 200
        assert any(c["id"] == self.state["card_id"] for c in r.json()["items"])

    def test_recompute_all(self, H):
        r = requests.post(f"{COST}/tech-cards/recompute-all", headers=H, timeout=30)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert r.json()["recomputed"] >= 1

    def test_dashboard(self, H):
        r = requests.get(f"{COST}/dashboard", headers=H, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("totalComponents", "totalCards", "avgMarginPct", "lowMarginCards"):
            assert k in d
        assert d["totalCards"] >= 1
        assert d["totalComponents"] >= 1

    # ----- variant scope -----
    def test_variant_scope_sync(self, H, model_ctx):
        if not model_ctx["variant"]:
            pytest.skip("No variant available")
        comp = self.state["component"]
        payload = {
            "scope": "variant",
            "modelId": model_ctx["model"]["id"],
            "variantId": model_ctx["variant"]["id"],
            "items": [{"componentId": comp["id"], "qty": 10}],
            "laborCost": 0,
            "overheadPct": 0,
            "syncToCostPrice": True,
        }
        r = requests.post(f"{COST}/tech-cards", json=payload, headers=H, timeout=15)
        assert r.status_code == 200
        card = r.json()
        # qty=10 * 50 = 500
        assert card["totalCost"] == 500
        self.state["variant_card_id"] = card["id"]
        # verify costPrice synced on variant
        r2 = requests.get(f"{API}/sauna/prices", headers=H, timeout=10)
        for m in r2.json()["models"]:
            if m["id"] == model_ctx["model"]["id"]:
                for v in (m.get("variants") or []):
                    if v["id"] == model_ctx["variant"]["id"]:
                        assert v.get("costPrice") == 500
                        return
        pytest.fail("variant costPrice not synced")

    # ----- option scope -----
    def test_option_scope_sync(self, H, model_ctx):
        if not model_ctx["option"]:
            pytest.skip("No option in prices")
        comp = self.state["component"]
        payload = {
            "scope": "option",
            "optionId": model_ctx["option"]["id"],
            "items": [{"componentId": comp["id"], "qty": 2}],
            "laborCost": 0, "overheadPct": 0,
            "syncToCostPrice": True,
        }
        r = requests.post(f"{COST}/tech-cards", json=payload, headers=H, timeout=15)
        assert r.status_code == 200
        card = r.json()
        assert card["totalCost"] == 100  # 50*2
        self.state["opt_card_id"] = card["id"]
        # verify costPrice on option (flat OR inside categories)
        r2 = requests.get(f"{API}/sauna/prices", headers=H, timeout=10)
        body = r2.json()
        found = False
        for o in (body.get("options") or []):
            if o["id"] == model_ctx["option"]["id"]:
                found = o.get("costPrice") == 100; break
        if not found:
            for cat in (body.get("categories") or []):
                for o in (cat.get("options") or []):
                    if o["id"] == model_ctx["option"]["id"]:
                        found = o.get("costPrice") == 100; break
                if found: break
        assert found, "option costPrice not synced"

    # ----- option_variant scope -----
    def test_option_variant_scope_sync(self, H, model_ctx):
        if not model_ctx["option_variant"]:
            pytest.skip("No option variant available")
        comp = self.state["component"]
        payload = {
            "scope": "option_variant",
            "optionId": model_ctx["option"]["id"],
            "optionVariantId": model_ctx["option_variant"]["id"],
            "items": [{"componentId": comp["id"], "qty": 3}],
            "laborCost": 0, "overheadPct": 0,
            "syncToCostPrice": True,
        }
        r = requests.post(f"{COST}/tech-cards", json=payload, headers=H, timeout=15)
        assert r.status_code == 200
        assert r.json()["totalCost"] == 150
        self.state["opt_var_card_id"] = r.json()["id"]

    def test_get_card_not_found(self, H):
        r = requests.get(f"{COST}/tech-cards/nonexistent", headers=H, timeout=10)
        assert r.status_code == 404


# ============================================================
# CLEANUP
# ============================================================
@pytest.fixture(scope="module", autouse=True)
def cleanup(H):
    yield
    # Delete tech cards created
    for cid_key in ("card_id", "variant_card_id", "opt_card_id", "opt_var_card_id"):
        cid = TestTechCards.state.get(cid_key)
        if cid:
            requests.delete(f"{COST}/tech-cards/{cid}", headers=H, timeout=10)
    # Delete components
    comp = TestTechCards.state.get("component")
    if comp:
        requests.delete(f"{COST}/components/{comp['id']}", headers=H, timeout=10)
    for cid in TestComponents.created_ids:
        requests.delete(f"{COST}/components/{cid}", headers=H, timeout=10)
