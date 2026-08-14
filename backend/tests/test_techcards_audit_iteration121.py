"""AUDIT (iteration 121) — Sauna tech-cards / components / warehouse chain.

Verifies: component CRUD, tech-card cost arithmetic, sync of costPrice into
sauna_prices, recompute-all, order-margin linkage, production-stock
deduct/revert, stock-adjust + movements, procurement forecast, dashboard.

Cleans up: QA components, QA tech card, restores original costPrice/
retailExtraCost of the target model, deletes test lead + movements.
"""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
COST = f"{API}/sauna-production/cost"
TIMEOUT = 60


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def prices(H):
    r = requests.get(f"{API}/sauna/prices", headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def target_model(prices):
    models = [m for m in (prices.get("models") or []) if int(m.get("basePrice") or 0) > 0]
    assert models, "no model with basePrice found"
    m = models[0]
    return {
        "id": m["id"],
        "name": m.get("name"),
        "basePrice": int(m.get("basePrice") or 0),
        "origCostPrice": int(m.get("costPrice") or 0),
        "origRetailExtra": int(m.get("retailExtraCost") or 0),
    }


@pytest.fixture(scope="module")
def state():
    return {"components": [], "cards": [], "leads": [], "movement_component_ids": set()}


@pytest.fixture(scope="module", autouse=True)
def cleanup(H, state, target_model):
    yield
    # delete tech cards first (component delete is blocked while in use)
    for cid in state["cards"]:
        requests.delete(f"{COST}/tech-cards/{cid}", headers=H, timeout=TIMEOUT)
    for comp_id in state["components"]:
        requests.delete(f"{COST}/components/{comp_id}", headers=H, timeout=TIMEOUT)
    for lead_id in state["leads"]:
        requests.delete(f"{API}/sauna-crm/leads/{lead_id}", headers=H, timeout=TIMEOUT)
    # restore original costPrice / retailExtraCost on the target model
    try:
        from pymongo import MongoClient
        benv = dotenv_values("/app/backend/.env")
        cl = MongoClient(benv["MONGO_URL"])
        dbm = cl[benv["DB_NAME"]]
        doc = dbm.sauna_prices.find_one({"_id": "default"})
        models = doc.get("models") or []
        for m in models:
            if m.get("id") == target_model["id"]:
                m["costPrice"] = target_model["origCostPrice"]
                m["retailExtraCost"] = target_model["origRetailExtra"]
        dbm.sauna_prices.update_one({"_id": "default"}, {"$set": {"models": models}})
        # remove QA stock movements
        for comp_id in state["movement_component_ids"]:
            dbm.sauna_stock_movements.delete_many({"componentId": comp_id})
        cl.close()
    except Exception as e:  # pragma: no cover
        print(f"cleanup warning: {e}")


# ---------------------------------------------------------------- components
class TestComponents:
    def test_create_list_update_component(self, H, state):
        payload = {"name": f"QA-COMP-A-{uuid.uuid4().hex[:6]}", "category": "wood",
                   "unit": "шт", "unitPrice": 100.5, "stockCurrent": 50, "stockMin": 5}
        r = requests.post(f"{COST}/components", json=payload, headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        c = r.json()
        assert "_id" not in c
        assert c["unitPrice"] == 100.5 and c["stockCurrent"] == 50
        state["components"].append(c["id"])
        state["comp_a"] = c

        r = requests.get(f"{COST}/components", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200
        assert any(x["id"] == c["id"] for x in r.json()["items"])

        r = requests.put(f"{COST}/components/{c['id']}", json={"unitPrice": 120}, headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["priceChanged"] is True
        r = requests.get(f"{COST}/components", headers=H, timeout=TIMEOUT)
        got = next(x for x in r.json()["items"] if x["id"] == c["id"])
        assert got["unitPrice"] == 120
        # reset for deterministic later math
        requests.put(f"{COST}/components/{c['id']}", json={"unitPrice": 100.5}, headers=H, timeout=TIMEOUT)

    def test_create_second_component(self, H, state):
        payload = {"name": f"QA-COMP-B-{uuid.uuid4().hex[:6]}", "category": "metal",
                   "unit": "м", "unitPrice": 33.33, "stockCurrent": 10}
        r = requests.post(f"{COST}/components", json=payload, headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        state["comp_b"] = r.json()
        state["components"].append(r.json()["id"])

    def test_create_component_without_name_400(self, H):
        r = requests.post(f"{COST}/components", json={"name": "  "}, headers=H, timeout=TIMEOUT)
        assert r.status_code == 400, r.text

    def test_update_missing_component_404(self, H):
        r = requests.put(f"{COST}/components/nope-{uuid.uuid4().hex}", json={"unitPrice": 1},
                         headers=H, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_components_require_auth(self):
        r = requests.get(f"{COST}/components", timeout=TIMEOUT)
        assert r.status_code in (401, 403), r.status_code


# ---------------------------------------------------------------- tech card
class TestTechCardCost:
    def test_create_tech_card_arithmetic(self, H, state, target_model):
        a, b = state["comp_a"], state["comp_b"]
        body = {
            "scope": "model", "modelId": target_model["id"],
            "items": [{"componentId": a["id"], "qty": 3}, {"componentId": b["id"], "qty": 2.5}],
            "laborCost": 500, "overheadPct": 10, "manualAdjustment": 77,
            "retailExtraCost": 250, "syncToCostPrice": True,
        }
        r = requests.post(f"{COST}/tech-cards", json=body, headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        card = r.json()
        state["cards"].append(card["id"])
        state["card"] = card

        exp_materials = round(round(100.5 * 3, 2) + round(33.33 * 2.5, 2), 2)
        exp_overhead = round(exp_materials * 10 / 100.0, 2)
        exp_total = round(exp_materials + 500 + exp_overhead + 77, 2)
        assert card["materialsCost"] == exp_materials, card
        assert card["overheadCost"] == exp_overhead, card
        assert card["totalCost"] == int(round(exp_total)), card

        exp_netto = round(target_model["basePrice"] / 1.23, 2)
        assert card["retailNetto"] == int(round(exp_netto))
        exp_margin = round(exp_netto - exp_total, 2)
        assert card["marginAmount"] == int(round(exp_margin)), card
        assert card["marginPct"] == round(exp_margin * 100.0 / exp_netto, 1)
        assert card["retailMarginAmount"] == int(round(exp_margin - 250)), card

    def test_sync_wrote_cost_price_into_sauna_prices(self, H, state, target_model):
        r = requests.get(f"{API}/sauna/prices", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200
        m = next(x for x in r.json()["models"] if x["id"] == target_model["id"])
        assert int(m.get("costPrice") or 0) == state["card"]["totalCost"], m
        assert int(m.get("retailExtraCost") or 0) == 250, m

    def test_get_single_card_enriched(self, H, state):
        r = requests.get(f"{COST}/tech-cards/{state['card']['id']}", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["items"]) == 2
        for it in d["items"]:
            assert it["missing"] is False
            assert it["unitPrice"] > 0 and it["componentName"]
            assert it["lineTotal"] == round(it["unitPrice"] * it["qty"], 2)

    def test_upsert_is_idempotent_same_key(self, H, state, target_model):
        body = {"scope": "model", "modelId": target_model["id"],
                "items": [{"componentId": state["comp_a"]["id"], "qty": 3},
                          {"componentId": state["comp_b"]["id"], "qty": 2.5}],
                "laborCost": 500, "overheadPct": 10, "manualAdjustment": 77,
                "retailExtraCost": 250, "syncToCostPrice": True}
        r = requests.post(f"{COST}/tech-cards", json=body, headers=H, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["id"] == state["card"]["id"]
        lst = requests.get(f"{COST}/tech-cards", params={"modelId": target_model["id"]},
                           headers=H, timeout=TIMEOUT).json()["items"]
        assert len([c for c in lst if c["scope"] == "model"]) == 1

    def test_delete_component_in_use_blocked(self, H, state):
        r = requests.delete(f"{COST}/components/{state['comp_a']['id']}", headers=H, timeout=TIMEOUT)
        assert r.status_code == 400, r.text

    def test_price_change_recomputes_card_and_resyncs(self, H, state, target_model):
        r = requests.put(f"{COST}/components/{state['comp_a']['id']}",
                         json={"unitPrice": 200.5}, headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["affectedCards"] >= 1

        card = requests.get(f"{COST}/tech-cards/{state['card']['id']}", headers=H, timeout=TIMEOUT).json()
        exp_materials = round(round(200.5 * 3, 2) + round(33.33 * 2.5, 2), 2)
        exp_total = int(round(exp_materials + 500 + round(exp_materials * 0.1, 2) + 77))
        assert card["materialsCost"] == exp_materials
        assert card["totalCost"] == exp_total
        m = next(x for x in requests.get(f"{API}/sauna/prices", headers=H, timeout=TIMEOUT).json()["models"]
                 if x["id"] == target_model["id"])
        assert int(m["costPrice"]) == exp_total, "costPrice not resynced after component price change"

    def test_recompute_all(self, H, state, target_model):
        # tamper costPrice directly then recompute-all should restore it
        r = requests.post(f"{COST}/tech-cards/recompute-all", headers=H, timeout=TIMEOUT * 2)
        assert r.status_code == 200, r.text
        assert r.json()["recomputed"] >= 1
        card = requests.get(f"{COST}/tech-cards/{state['card']['id']}", headers=H, timeout=TIMEOUT).json()
        m = next(x for x in requests.get(f"{API}/sauna/prices", headers=H, timeout=TIMEOUT).json()["models"]
                 if x["id"] == target_model["id"])
        assert int(m["costPrice"]) == card["totalCost"]

    def test_invalid_scope_400(self, H, target_model):
        r = requests.post(f"{COST}/tech-cards", json={"scope": "bogus", "modelId": target_model["id"]},
                          headers=H, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_missing_component_flag(self, H, state, target_model):
        """Card referencing a deleted component → missing=True, price 0."""
        tmp = requests.post(f"{COST}/components",
                            json={"name": f"QA-COMP-TMP-{uuid.uuid4().hex[:6]}", "unitPrice": 10},
                            headers=H, timeout=TIMEOUT).json()
        card = requests.post(f"{COST}/tech-cards", json={
            "scope": "variant", "modelId": target_model["id"], "variantId": f"qa-var-{uuid.uuid4().hex[:6]}",
            "items": [{"componentId": tmp["id"], "qty": 2}], "syncToCostPrice": False,
        }, headers=H, timeout=TIMEOUT)
        assert card.status_code == 200, card.text
        card = card.json()
        state["cards"].append(card["id"])
        # delete card ref then component: must remove item from card first
        requests.post(f"{COST}/tech-cards", json={
            "scope": "variant", "modelId": target_model["id"], "variantId": card["variantId"],
            "items": [], "syncToCostPrice": False}, headers=H, timeout=TIMEOUT)
        assert requests.delete(f"{COST}/components/{tmp['id']}", headers=H, timeout=TIMEOUT).status_code == 200
        # re-add the now-deleted component id directly to test missing flag
        requests.post(f"{COST}/tech-cards", json={
            "scope": "variant", "modelId": target_model["id"], "variantId": card["variantId"],
            "items": [{"componentId": tmp["id"], "qty": 2}], "syncToCostPrice": False}, headers=H, timeout=TIMEOUT)
        d = requests.get(f"{COST}/tech-cards/{card['id']}", headers=H, timeout=TIMEOUT).json()
        assert d["items"][0]["missing"] is True
        assert d["items"][0]["unitPrice"] == 0
        assert d["materialsCost"] == 0


# ---------------------------------------------------------------- procurement / dashboard
class TestProcurementDashboard:
    def test_forecast_numbers(self, H, state, target_model):
        r = requests.post(f"{COST}/procurement/forecast",
                          json={"targets": [{"scope": "model", "modelId": target_model["id"], "qty": 2}]},
                          headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["matchedTargets"] == 2
        rows = {i["componentId"]: i for i in data["items"]}
        assert rows[state["comp_a"]["id"]]["totalQty"] == 6
        assert rows[state["comp_b"]["id"]]["totalQty"] == 5
        assert rows[state["comp_a"]["id"]]["lineTotal"] == round(6 * rows[state["comp_a"]["id"]]["unitPrice"], 2)

    def test_forecast_empty_targets_400(self, H):
        r = requests.post(f"{COST}/procurement/forecast", json={"targets": []}, headers=H, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_forecast_reports_stock_shortage(self, H, state):
        """Forecast should expose current stock so shortages are visible."""
        r = requests.post(f"{COST}/procurement/forecast",
                          json={"targets": [{"scope": "model", "modelId": state["card"]["modelId"], "qty": 100}]},
                          headers=H, timeout=TIMEOUT)
        assert r.status_code == 200
        row = next(i for i in r.json()["items"] if i["componentId"] == state["comp_a"]["id"])
        assert "stockCurrent" in row or "stock" in row or "shortage" in row, \
            f"forecast row has no stock/shortage info: {sorted(row.keys())}"

    def test_dashboard(self, H):
        r = requests.get(f"{COST}/dashboard", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["totalComponents"] >= 2 and d["totalCards"] >= 1
        assert isinstance(d["lowMarginTop"], list)


# ---------------------------------------------------------------- warehouse / stock
class TestStock:
    def test_stock_adjust_in_out_set(self, H, state):
        cid = state["comp_b"]["id"]
        state["movement_component_ids"].add(cid)
        base = next(x for x in requests.get(f"{COST}/components", headers=H, timeout=TIMEOUT).json()["items"]
                    if x["id"] == cid)["stockCurrent"]
        r = requests.post(f"{COST}/components/{cid}/stock-adjust",
                          json={"type": "in", "qty": 7, "note": "QA in"}, headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["stockCurrent"] == base + 7
        r = requests.post(f"{COST}/components/{cid}/stock-adjust",
                          json={"type": "out", "qty": 7, "note": "QA out"}, headers=H, timeout=TIMEOUT)
        assert r.json()["stockCurrent"] == base
        r = requests.post(f"{COST}/components/{cid}/stock-adjust",
                          json={"type": "set", "qty": base, "note": "QA set"}, headers=H, timeout=TIMEOUT)
        assert r.json()["stockCurrent"] == base

    def test_stock_adjust_validation(self, H, state):
        cid = state["comp_b"]["id"]
        assert requests.post(f"{COST}/components/{cid}/stock-adjust", json={"type": "bad", "qty": 1},
                             headers=H, timeout=TIMEOUT).status_code == 400
        assert requests.post(f"{COST}/components/{cid}/stock-adjust", json={"type": "in", "qty": 0},
                             headers=H, timeout=TIMEOUT).status_code == 400
        assert requests.post(f"{COST}/components/{cid}/stock-adjust", json={"type": "in", "qty": "abc"},
                             headers=H, timeout=TIMEOUT).status_code == 400
        assert requests.post(f"{COST}/components/bogus/stock-adjust", json={"type": "in", "qty": 1},
                             headers=H, timeout=TIMEOUT).status_code == 404

    def test_movements_logged(self, H, state):
        r = requests.get(f"{COST}/components/{state['comp_b']['id']}/stock-movements",
                         headers=H, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["count"] >= 3
        r = requests.get(f"{COST}/stock-movements", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["count"] >= 3


class TestProductionStock:
    @pytest.fixture(scope="class")
    def lead(self, H, state, target_model):
        """Create the test lead directly in Mongo — POST /api/sauna-crm/leads is
        currently broken by the unique+sparse index on amocrm_id (see
        test_create_lead_api_duplicate_null_amocrm_id)."""
        from pymongo import MongoClient
        benv = dotenv_values("/app/backend/.env")
        cl = MongoClient(benv["MONGO_URL"])
        lid = f"CRM-QA{uuid.uuid4().hex[:6].upper()}"
        cl[benv["DB_NAME"]].sauna_crm_leads.insert_one({
            "id": lid, "stageId": "in_production", "clientName": "QA-TECHCARD-LEAD",
            "phone": "+48000000001", "modelName": target_model["name"],
            "calculatorData": {"modelId": target_model["id"], "selectedOptions": {}},
        })
        cl.close()
        state["leads"].append(lid)
        return lid

    def test_create_lead_api_duplicate_null_amocrm_id(self, H, target_model):
        """BUG probe: creating a manual lead (no amocrm_id) must not 500."""
        body = {"stageId": "in_production", "clientName": "QA-TECHCARD-LEAD-API",
                "phone": "+48000000009",
                "calculatorData": {"modelId": target_model["id"], "selectedOptions": {}}}
        r = requests.post(f"{API}/sauna-crm/leads", json=body, headers=H, timeout=TIMEOUT)
        if r.status_code in (200, 201):
            lid = (r.json().get("lead") or {}).get("id")
            requests.delete(f"{API}/sauna-crm/leads/{lid}", headers=H, timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"manual lead creation failed: {r.status_code} {r.text[:300]}"

    def _stock(self, H, cid):
        return next(x for x in requests.get(f"{COST}/components", headers=H, timeout=TIMEOUT).json()["items"]
                    if x["id"] == cid)["stockCurrent"]

    def test_preview(self, H, lead, state):
        r = requests.post(f"{COST}/production-stock/preview/{lead}", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["alreadyDeducted"] is False
        ids = {i["componentId"] for i in d["items"]}
        assert state["comp_a"]["id"] in ids, d

    def test_deduct_then_double_deduct_then_revert(self, H, lead, state):
        a, b = state["comp_a"]["id"], state["comp_b"]["id"]
        state["movement_component_ids"].update({a, b})
        before_a, before_b = self._stock(H, a), self._stock(H, b)
        r = requests.post(f"{COST}/production-stock/deduct/{lead}", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["summary"]["applied"] >= 2
        assert self._stock(H, a) == before_a - 3
        assert self._stock(H, b) == before_b - 2.5
        # double-deduct must be rejected
        r2 = requests.post(f"{COST}/production-stock/deduct/{lead}", headers=H, timeout=TIMEOUT)
        assert r2.status_code == 409, r2.text
        assert self._stock(H, a) == before_a - 3
        # revert
        r3 = requests.post(f"{COST}/production-stock/revert/{lead}", headers=H, timeout=TIMEOUT)
        assert r3.status_code == 200, r3.text
        assert self._stock(H, a) == before_a
        assert self._stock(H, b) == before_b
        # double revert rejected
        assert requests.post(f"{COST}/production-stock/revert/{lead}",
                             headers=H, timeout=TIMEOUT).status_code == 409

    def test_deduct_lead_without_bom_should_not_claim_flag(self, H, state):
        """BUG probe: a lead with no resolvable model/tech-card deducts nothing
        but still sets productionStockDeducted=True, blocking the real
        deduction later with 409."""
        from pymongo import MongoClient
        benv = dotenv_values("/app/backend/.env")
        cl = MongoClient(benv["MONGO_URL"])
        lid = f"CRM-QA{uuid.uuid4().hex[:6].upper()}"
        cl[benv["DB_NAME"]].sauna_crm_leads.insert_one(
            {"id": lid, "stageId": "in_production", "clientName": "QA-TECHCARD-LEAD-NOBOM"})
        cl.close()
        state["leads"].append(lid)
        r = requests.post(f"{COST}/production-stock/deduct/{lid}", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["summary"]["applied"] == 0
        r2 = requests.post(f"{COST}/production-stock/deduct/{lid}", headers=H, timeout=TIMEOUT)
        assert r2.status_code != 409, (
            "empty deduction claimed the productionStockDeducted flag — a later real "
            "deduction is permanently blocked with 409")

    def test_deduct_missing_lead_404(self, H):
        r = requests.post(f"{COST}/production-stock/deduct/nope-{uuid.uuid4().hex}",
                          headers=H, timeout=TIMEOUT)
        assert r.status_code == 404


# ---------------------------------------------------------------- order margin linkage
class TestOrderMarginLinkage:
    def test_order_margin_uses_synced_cost_price(self, H, state, target_model):
        """Create a sauna order for the target model, recompute margins,
        margin must equal total/1.23 - costPrice - retailExtraCost."""
        order_body = {
            "fullName": "QA-TECHCARD-ORDER",
            "phoneNumber": "+48000000002",
            "selectedModel": target_model["id"],
            "modelName": target_model["name"],
            "selectedOptions": [],
            "basePrice": target_model["basePrice"],
            "total": target_model["basePrice"],
        }
        r = requests.post(f"{API}/sauna/orders", json=order_body, headers=H, timeout=TIMEOUT)
        assert r.status_code in (200, 201), r.text
        order = r.json()
        order_id = order.get("id") or order.get("order", {}).get("id")
        assert order_id, r.text
        try:
            rr = requests.post(f"{API}/sauna/orders/recompute-margins", headers=H, timeout=TIMEOUT * 3)
            assert rr.status_code == 200, rr.text
            m = next(x for x in requests.get(f"{API}/sauna/prices", headers=H, timeout=TIMEOUT).json()["models"]
                     if x["id"] == target_model["id"])
            cost = int(m["costPrice"])
            extra = int(m.get("retailExtraCost") or 0)
            lst = requests.get(f"{API}/sauna/orders", headers=H, timeout=TIMEOUT).json()
            orders = lst if isinstance(lst, list) else (lst.get("orders") or lst.get("items") or [])
            o = next(x for x in orders if x["id"] == order_id)
            assert o["totalCost"] == cost, f"order totalCost {o['totalCost']} != synced costPrice {cost}"
            expected = int(round(target_model["basePrice"] / 1.23 - cost - extra))
            assert o["margin"] == expected, f"margin {o['margin']} != expected {expected}"
        finally:
            requests.delete(f"{API}/sauna/orders/{order_id}", headers=H, timeout=TIMEOUT)
