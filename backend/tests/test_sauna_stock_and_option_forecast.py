"""Backend tests for iteration 93 — Sauna stock adjustments, option-scoped
procurement forecast, and regression on tech-cards / components / planner."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sauna-prod-suite.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# --- shared fixtures ---------------------------------------------------------

@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in {data}"
    return tok


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def comp(h):
    """Create a throw-away component for stock-adjust tests."""
    payload = {
        "name": f"TEST_STOCK_{uuid.uuid4().hex[:6]}",
        "category": "other",
        "unit": "шт",
        "unitPrice": 100,
        "stockCurrent": 10,
        "stockMin": 5,
    }
    r = requests.post(f"{API}/sauna-production/cost/components", json=payload, headers=h, timeout=30)
    assert r.status_code in (200, 201), r.text
    c = r.json()
    yield c
    requests.delete(f"{API}/sauna-production/cost/components/{c['id']}", headers=h, timeout=30)


# --- Stock adjust ------------------------------------------------------------

class TestStockAdjust:

    def test_in_adds_to_stock(self, h, comp):
        r = requests.post(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-adjust",
            json={"type": "in", "qty": 7, "note": "TEST_IN"}, headers=h, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["stockCurrent"] == 17  # 10 + 7
        mv = body["movement"]
        assert mv["type"] == "in"
        assert mv["qty"] == 7
        assert mv["before"] == 10
        assert mv["after"] == 17
        assert mv["note"] == "TEST_IN"
        assert mv["componentId"] == comp["id"]
        assert "id" in mv and "at" in mv

    def test_out_subtracts_from_stock(self, h, comp):
        r = requests.post(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-adjust",
            json={"type": "out", "qty": 3}, headers=h, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["stockCurrent"] == 14  # 17 - 3
        assert body["movement"]["before"] == 17
        assert body["movement"]["after"] == 14

    def test_set_overwrites_stock(self, h, comp):
        r = requests.post(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-adjust",
            json={"type": "set", "qty": 50}, headers=h, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["stockCurrent"] == 50
        assert body["movement"]["type"] == "set"
        assert body["movement"]["after"] == 50

    def test_invalid_type_rejected(self, h, comp):
        r = requests.post(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-adjust",
            json={"type": "BAD", "qty": 1}, headers=h, timeout=30,
        )
        assert r.status_code == 400

    def test_in_with_zero_qty_rejected(self, h, comp):
        r = requests.post(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-adjust",
            json={"type": "in", "qty": 0}, headers=h, timeout=30,
        )
        assert r.status_code == 400

    def test_out_with_negative_qty_rejected(self, h, comp):
        r = requests.post(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-adjust",
            json={"type": "out", "qty": -2}, headers=h, timeout=30,
        )
        assert r.status_code == 400

    def test_set_with_negative_qty_rejected(self, h, comp):
        r = requests.post(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-adjust",
            json={"type": "set", "qty": -1}, headers=h, timeout=30,
        )
        assert r.status_code == 400

    def test_unknown_component_404(self, h):
        r = requests.post(
            f"{API}/sauna-production/cost/components/nonexistent-id/stock-adjust",
            json={"type": "in", "qty": 1}, headers=h, timeout=30,
        )
        assert r.status_code == 404

    def test_auth_required(self, comp):
        r = requests.post(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-adjust",
            json={"type": "in", "qty": 1}, timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_persistence_in_components_get(self, h, comp):
        # After 3 adjusts above (in:+7 -> 17, out:-3 -> 14, set:50) stockCurrent == 50
        r = requests.get(f"{API}/sauna-production/cost/components", headers=h, timeout=30)
        assert r.status_code == 200
        rows = [c for c in r.json()["items"] if c["id"] == comp["id"]]
        assert rows, "component should still be in catalog"
        assert rows[0]["stockCurrent"] == 50


# --- Stock movements feeds ---------------------------------------------------

class TestStockMovements:

    def test_per_component_movements_sorted_desc(self, h, comp):
        r = requests.get(
            f"{API}/sauna-production/cost/components/{comp['id']}/stock-movements",
            headers=h, timeout=30,
        )
        assert r.status_code == 200
        body = r.json()
        items = body["items"]
        # We've made 3 successful movements in TestStockAdjust
        assert len(items) >= 3
        ats = [m["at"] for m in items]
        assert ats == sorted(ats, reverse=True), "Movements must be sorted by at DESC"
        # All items must reference this component
        assert all(m["componentId"] == comp["id"] for m in items)
        # Types must be valid
        assert all(m["type"] in ("in", "out", "set") for m in items)

    def test_global_movements_feed_contains_our_movements(self, h, comp):
        r = requests.get(f"{API}/sauna-production/cost/stock-movements", headers=h, timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        mine = [m for m in items if m["componentId"] == comp["id"]]
        assert len(mine) >= 3
        ats = [m["at"] for m in items]
        assert ats == sorted(ats, reverse=True)


# --- Procurement forecast with option / option_variant -----------------------

class TestProcurementForecastOptionScope:

    def test_forecast_accepts_option_scope(self, h):
        # Even with unmatched targets, response should be 200 and well-formed
        payload = {"targets": [
            {"scope": "option", "optionId": "opt_does_not_exist", "qty": 2},
            {"scope": "option_variant", "optionId": "opt_x", "optionVariantId": "var_y", "qty": 1},
            {"scope": "model", "modelId": "model_does_not_exist", "qty": 1},
        ]}
        r = requests.post(
            f"{API}/sauna-production/cost/procurement/forecast",
            json=payload, headers=h, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("items", "totalMaterials", "matchedTargets", "unmatched"):
            assert k in body, f"missing key {k} in forecast response"
        assert isinstance(body["unmatched"], list)
        # Since none of the targets exist as tech-cards, they should all be unmatched
        # qty is multiplied → option qty=2 + option_variant qty=1 + model qty=1 = 4 flat entries
        assert len(body["unmatched"]) == 4
        # Verify scopes survived round-trip
        scopes = sorted([t["scope"] for t in body["unmatched"]])
        assert scopes == sorted(["option", "option", "option_variant", "model"])

    def test_forecast_rejects_empty_targets(self, h):
        r = requests.post(
            f"{API}/sauna-production/cost/procurement/forecast",
            json={"targets": []}, headers=h, timeout=30,
        )
        assert r.status_code == 400


# --- Regression: tech cards / components / planner ---------------------------

class TestRegression:

    def test_list_tech_cards(self, h):
        r = requests.get(f"{API}/sauna-production/cost/tech-cards", headers=h, timeout=30)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_list_components(self, h, comp):
        r = requests.get(f"{API}/sauna-production/cost/components", headers=h, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and isinstance(body["items"], list)
        # Verify freshly-created components carry the new stock fields
        mine = [c for c in body["items"] if c["id"] == comp["id"]]
        assert mine, "newly-created component should be listed"
        assert "stockCurrent" in mine[0]
        assert "stockMin" in mine[0]

    def test_cost_dashboard(self, h):
        r = requests.get(f"{API}/sauna-production/cost/dashboard", headers=h, timeout=30)
        assert r.status_code == 200
        b = r.json()
        for k in ("totalComponents", "totalCards", "lowMarginCards"):
            assert k in b

    def test_planner_tasks_crud_general_task(self, h):
        # POST without assigneeUserId — "Общая задача"
        payload = {
            "title": f"TEST_PLN_{uuid.uuid4().hex[:6]}",
            "businessDirection": "other",
            "status": "planned",
        }
        r = requests.post(f"{API}/planner/tasks", json=payload, headers=h, timeout=30)
        assert r.status_code in (200, 201), r.text
        task = r.json()
        assert task["assigneeUserId"] == ""
        assert task["assigneeUsername"] == ""
        # GET list
        r2 = requests.get(f"{API}/planner/tasks", headers=h, timeout=30)
        assert r2.status_code == 200
        # PUT — change direction (drag-drop equivalent)
        r3 = requests.put(
            f"{API}/planner/tasks/{task['id']}",
            json={"businessDirection": "sauna"}, headers=h, timeout=30,
        )
        assert r3.status_code == 200
        assert r3.json()["businessDirection"] == "sauna"
        # Cleanup
        requests.delete(f"{API}/planner/tasks/{task['id']}", headers=h, timeout=30)

    def test_tech_card_upsert_and_delete(self, h):
        # Create a one-off component
        cr = requests.post(
            f"{API}/sauna-production/cost/components",
            json={"name": f"TEST_REG_{uuid.uuid4().hex[:6]}", "unitPrice": 10},
            headers=h, timeout=30,
        )
        assert cr.status_code in (200, 201)
        c = cr.json()
        try:
            payload = {
                "scope": "model",
                "modelId": f"reg_{uuid.uuid4().hex[:6]}",
                "items": [{"componentId": c["id"], "qty": 2}],
                "laborCost": 100,
                "overheadPct": 10,
                "manualAdjustment": 0,
                "syncToCostPrice": False,
            }
            r = requests.post(f"{API}/sauna-production/cost/tech-cards", json=payload, headers=h, timeout=30)
            assert r.status_code in (200, 201), r.text
            card = r.json()
            assert card.get("totalCost") is not None
            # GET single
            r2 = requests.get(f"{API}/sauna-production/cost/tech-cards/{card['id']}", headers=h, timeout=30)
            assert r2.status_code == 200
            # DELETE
            r3 = requests.delete(f"{API}/sauna-production/cost/tech-cards/{card['id']}", headers=h, timeout=30)
            assert r3.status_code == 200
        finally:
            requests.delete(f"{API}/sauna-production/cost/components/{c['id']}", headers=h, timeout=30)
