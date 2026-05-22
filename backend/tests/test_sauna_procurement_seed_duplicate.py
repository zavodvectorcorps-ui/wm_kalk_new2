"""Backend tests for new Sauna features: seed-from-template, duplicate, procurement, forecast, margin top lists."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://modular-pricing-1.preview.emergentagent.com").rstrip("/")
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
    r = requests.get(f"{API}/sauna/prices", headers=H, timeout=15)
    assert r.status_code == 200
    p = r.json()
    models = p.get("models") or []
    assert len(models) >= 2, "Need at least two models for duplicate tests"
    m1 = models[0]
    m2 = models[1]
    v1 = (m1.get("variants") or [None])[0]
    return {"m1": m1, "m2": m2, "v1": v1}


# ---------- AUTH ----------
class TestAuthNew:
    def test_seed_requires_auth(self):
        r = requests.post(f"{COST}/components/seed-from-template", timeout=10)
        assert r.status_code in (401, 403)

    def test_procurement_requires_auth(self):
        r = requests.get(f"{COST}/procurement", timeout=10)
        assert r.status_code in (401, 403)

    def test_forecast_requires_auth(self):
        r = requests.post(f"{COST}/procurement/forecast", json={"targets": []}, timeout=10)
        assert r.status_code in (401, 403)

    def test_duplicate_requires_auth(self):
        r = requests.post(f"{COST}/tech-cards/some-id/duplicate", json={}, timeout=10)
        assert r.status_code in (401, 403)


# ---------- SEED ----------
class TestSeedFromTemplate:
    def test_seed_imports_then_idempotent(self, H):
        # First call: may import many or 0 if previously seeded
        r1 = requests.post(f"{COST}/components/seed-from-template", headers=H, timeout=30)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["ok"] is True
        assert d1["total"] == 49
        assert d1["added"] + d1["skipped"] == 49
        # Second call: must be idempotent (added=0)
        r2 = requests.post(f"{COST}/components/seed-from-template", headers=H, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["added"] == 0
        assert d2["skipped"] == 49

    def test_seed_components_now_present(self, H):
        r = requests.get(f"{COST}/components", headers=H, timeout=15)
        assert r.status_code == 200
        names = {c["name"] for c in r.json()["items"]}
        # A few well-known seed names
        for n in [
            "Лента",
            "Двери: Стеклянная",
            "Окна: Полупанорама",
            "Печи: Электро Харвия 9 квт",
            "Электрика: Кабель",
        ]:
            assert n in names, f"Seed component missing: {n}"


# ---------- DUPLICATE + DASHBOARD TOP LISTS + FORECAST ----------
class TestDuplicateForecast:
    state = {}

    def test_make_source_card(self, H, model_ctx):
        # create a custom component
        r = requests.post(f"{COST}/components", json={
            "name": "TEST_DUP_COMP", "category": "wood", "unit": "м", "unitPrice": 20.0,
        }, headers=H, timeout=10)
        assert r.status_code == 200
        self.state["comp"] = r.json()
        # Create source tech card on model m1
        payload = {
            "scope": "model",
            "modelId": model_ctx["m1"]["id"],
            "items": [{"componentId": self.state["comp"]["id"], "qty": 5}],
            "laborCost": 100,
            "overheadPct": 10,
            "manualAdjustment": 25,
            "syncToCostPrice": False,
        }
        r2 = requests.post(f"{COST}/tech-cards", json=payload, headers=H, timeout=15)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        # 20*5 = 100; overhead 10; labor 100; manual 25 => 235
        assert d["materialsCost"] == 100
        assert d["totalCost"] == 235
        self.state["src_id"] = d["id"]
        self.state["src_card"] = d

    def test_duplicate_to_other_model(self, H, model_ctx):
        body = {"scope": "model", "modelId": model_ctx["m2"]["id"]}
        r = requests.post(f"{COST}/tech-cards/{self.state['src_id']}/duplicate", json=body, headers=H, timeout=15)
        assert r.status_code == 200, r.text
        new = r.json()
        assert new["id"] != self.state["src_id"]
        assert new["scope"] == "model"
        assert new["modelId"] == model_ctx["m2"]["id"]
        assert new["laborCost"] == 100
        assert new["overheadPct"] == 10
        assert new["manualAdjustment"] == 25
        # BOM copied
        assert len(new["items"]) == 1
        assert new["items"][0]["componentId"] == self.state["comp"]["id"]
        assert new["items"][0]["qty"] == 5
        assert new["totalCost"] == 235
        self.state["dup_id"] = new["id"]

    def test_duplicate_upserts_when_same_key(self, H, model_ctx):
        # Calling duplicate to same target again must upsert (not create new)
        body = {"scope": "model", "modelId": model_ctx["m2"]["id"]}
        r = requests.post(f"{COST}/tech-cards/{self.state['src_id']}/duplicate", json=body, headers=H, timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == self.state["dup_id"]

    def test_duplicate_invalid_scope(self, H):
        r = requests.post(f"{COST}/tech-cards/{self.state['src_id']}/duplicate",
                          json={"scope": "garbage", "modelId": "x"}, headers=H, timeout=10)
        assert r.status_code == 400

    def test_duplicate_source_not_found(self, H):
        r = requests.post(f"{COST}/tech-cards/nonexistent/duplicate",
                          json={"scope": "model", "modelId": "x"}, headers=H, timeout=10)
        assert r.status_code == 404

    # ---------- DASHBOARD TOP LISTS ----------
    def test_dashboard_returns_top_lists(self, H):
        r = requests.get(f"{COST}/dashboard", headers=H, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "lowMarginTop" in d and isinstance(d["lowMarginTop"], list)
        assert "highMarginTop" in d and isinstance(d["highMarginTop"], list)
        # If lists are non-empty, low should be ascending and high descending by marginPct
        if len(d["lowMarginTop"]) >= 2:
            pcts = [c["marginPct"] for c in d["lowMarginTop"]]
            assert pcts == sorted(pcts), "lowMarginTop must be ascending"
        if len(d["highMarginTop"]) >= 2:
            pcts = [c["marginPct"] for c in d["highMarginTop"]]
            assert pcts == sorted(pcts, reverse=True), "highMarginTop must be descending"
        # Max 5 per list
        assert len(d["lowMarginTop"]) <= 5
        assert len(d["highMarginTop"]) <= 5

    # ---------- PROCUREMENT (from in-production leads) ----------
    def test_procurement_endpoint_shape(self, H):
        r = requests.get(f"{COST}/procurement", headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("totalOrders", "matchedTargets", "items", "totalMaterials", "unmatched", "orders"):
            assert k in d, f"Missing field: {k}"
        assert isinstance(d["items"], list)
        assert isinstance(d["orders"], list)
        assert isinstance(d["unmatched"], list)
        assert isinstance(d["totalOrders"], int)
        assert isinstance(d["matchedTargets"], int)

    # ---------- FORECAST what-if ----------
    def test_forecast_empty_targets(self, H):
        r = requests.post(f"{COST}/procurement/forecast", json={"targets": []}, headers=H, timeout=10)
        assert r.status_code == 400

    def test_forecast_missing_targets_field(self, H):
        r = requests.post(f"{COST}/procurement/forecast", json={}, headers=H, timeout=10)
        assert r.status_code == 400

    def test_forecast_matches_source_card_qty1(self, H, model_ctx):
        body = {"targets": [{"scope": "model", "modelId": model_ctx["m1"]["id"], "qty": 1}]}
        r = requests.post(f"{COST}/procurement/forecast", json=body, headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["matchedTargets"] == 1
        assert d["unmatched"] == []
        # Find our test component in items
        rows = [it for it in d["items"] if it["componentId"] == self.state["comp"]["id"]]
        assert len(rows) == 1
        row = rows[0]
        assert row["totalQty"] == 5
        assert row["unitPrice"] == 20
        assert row["lineTotal"] == 100
        assert row["unit"] == "м"
        assert row["category"] == "wood"
        assert "sources" in row and len(row["sources"]) >= 1

    def test_forecast_qty_multiplies(self, H, model_ctx):
        body = {"targets": [{"scope": "model", "modelId": model_ctx["m1"]["id"], "qty": 3}]}
        r = requests.post(f"{COST}/procurement/forecast", json=body, headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # matchedTargets is per-card-match across the flat expansion: qty=3 expands to 3 entries
        assert d["matchedTargets"] == 3
        rows = [it for it in d["items"] if it["componentId"] == self.state["comp"]["id"]]
        assert rows
        row = rows[0]
        assert row["totalQty"] == 15  # 5 * 3
        assert row["lineTotal"] == 300

    def test_forecast_aggregates_across_targets(self, H, model_ctx):
        # Two targets pointing to the two cards that contain the same component (src + dup)
        body = {"targets": [
            {"scope": "model", "modelId": model_ctx["m1"]["id"], "qty": 1},
            {"scope": "model", "modelId": model_ctx["m2"]["id"], "qty": 2},
        ]}
        r = requests.post(f"{COST}/procurement/forecast", json=body, headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        rows = [it for it in d["items"] if it["componentId"] == self.state["comp"]["id"]]
        assert rows
        row = rows[0]
        # m1: 5; m2: 5*2 = 10 → 15 total
        assert row["totalQty"] == 15
        assert row["lineTotal"] == 300

    def test_forecast_unmatched(self, H):
        body = {"targets": [{"scope": "model", "modelId": "definitely_not_a_real_model_id_xyz", "qty": 1}]}
        r = requests.post(f"{COST}/procurement/forecast", json=body, headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["matchedTargets"] == 0
        assert len(d["unmatched"]) >= 1
        assert d["items"] == []

    def test_forecast_items_sorted_by_category_then_lineTotal_desc(self, H, model_ctx):
        body = {"targets": [{"scope": "model", "modelId": model_ctx["m1"]["id"], "qty": 1}]}
        r = requests.post(f"{COST}/procurement/forecast", json=body, headers=H, timeout=15)
        d = r.json()
        items = d["items"]
        if len(items) >= 2:
            prev_cat, prev_total = items[0]["category"], items[0]["lineTotal"]
            for it in items[1:]:
                if it["category"] == prev_cat:
                    assert it["lineTotal"] <= prev_total
                else:
                    assert it["category"] >= prev_cat
                prev_cat, prev_total = it["category"], it["lineTotal"]


# ---------- CLEANUP ----------
@pytest.fixture(scope="module", autouse=True)
def cleanup(H):
    yield
    for k in ("src_id", "dup_id"):
        cid = TestDuplicateForecast.state.get(k)
        if cid:
            requests.delete(f"{COST}/tech-cards/{cid}", headers=H, timeout=10)
    comp = TestDuplicateForecast.state.get("comp")
    if comp:
        requests.delete(f"{COST}/components/{comp['id']}", headers=H, timeout=10)
