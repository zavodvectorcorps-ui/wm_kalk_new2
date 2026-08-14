"""Iteration 122 — verify the production-stock deduct flag-release bug fix.

BUG (found in iteration 121): POST /api/sauna-production/cost/production-stock/deduct/{lead_id}
claimed productionStockDeducted BEFORE aggregating the BOM, so a lead with no
resolvable model/tech-card (applied==0) got permanently marked as deducted and
every later retry returned 409.

FIX: release the flag and return {ok:false} when summary.applied == 0.

Also re-verifies (regression): real deduct works + 409 on repeat, revert
restores stock exactly + 409 on double revert, and the tech-card ->
sauna_prices.costPrice sync chain.

Cleanup: QA components / tech cards / leads / stock movements deleted, target
model costPrice + retailExtraCost restored to their original values.
"""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

_env = dotenv_values("/app/frontend/.env")
_benv = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env.get("REACT_APP_BACKEND_URL"))
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
COST = f"{API}/sauna-production/cost"
TIMEOUT = 60


@pytest.fixture(scope="module")
def mongo():
    cl = MongoClient(_benv["MONGO_URL"])
    yield cl[_benv["DB_NAME"]]
    cl.close()


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login",
                      json={"username": "admin", "password": "admin123"}, timeout=TIMEOUT)
    if r.status_code != 200:
        pytest.fail(f"admin login failed: {r.status_code} {r.text[:300]}")
    token = r.json().get("token")
    assert token, r.text
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def target_model(H):
    r = requests.get(f"{API}/sauna/prices", headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    models = [m for m in (r.json().get("models") or []) if int(m.get("basePrice") or 0) > 0]
    assert models, "no model with basePrice"
    m = models[0]
    return {"id": m["id"], "name": m.get("name"), "basePrice": int(m.get("basePrice") or 0),
            "origCostPrice": int(m.get("costPrice") or 0),
            "origRetailExtra": int(m.get("retailExtraCost") or 0)}


@pytest.fixture(scope="module")
def state():
    return {"components": [], "cards": [], "leads": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(H, state, target_model, mongo):
    yield
    for cid in state["cards"]:
        requests.delete(f"{COST}/tech-cards/{cid}", headers=H, timeout=TIMEOUT)
    for comp_id in state["components"]:
        requests.delete(f"{COST}/components/{comp_id}", headers=H, timeout=TIMEOUT)
        mongo.sauna_stock_movements.delete_many({"componentId": comp_id})
    for lead_id in state["leads"]:
        requests.delete(f"{API}/sauna-crm/leads/{lead_id}", headers=H, timeout=TIMEOUT)
        mongo.sauna_crm_leads.delete_many({"id": lead_id})
        mongo.sauna_stock_movements.delete_many({"leadId": lead_id})
    doc = mongo.sauna_prices.find_one({"_id": "default"}) or {}
    models = doc.get("models") or []
    for m in models:
        if m.get("id") == target_model["id"]:
            m["costPrice"] = target_model["origCostPrice"]
            m["retailExtraCost"] = target_model["origRetailExtra"]
    if models:
        mongo.sauna_prices.update_one({"_id": "default"}, {"$set": {"models": models}})


def _mk_lead(mongo, state, payload):
    """Insert a lead directly (POST /api/sauna-crm/leads is broken by the
    amocrm_id unique+sparse index — tracked separately)."""
    lid = f"CRM-QA{uuid.uuid4().hex[:6].upper()}"
    doc = {"id": lid, "stageId": "in_production", "phone": "+48000000001"}
    doc.update(payload)
    mongo.sauna_crm_leads.insert_one(doc)
    state["leads"].append(lid)
    return lid


def _stock(H, cid):
    r = requests.get(f"{COST}/components", headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return next(x for x in r.json()["items"] if x["id"] == cid)["stockCurrent"]


def _flag(mongo, lid):
    d = mongo.sauna_crm_leads.find_one({"id": lid}, {"_id": 0, "productionStockDeducted": 1})
    return bool((d or {}).get("productionStockDeducted"))


# --------------------------------------------------------------- setup: BOM
class TestSetupCostChain:
    """Regression: components -> tech card -> sauna_prices.costPrice sync."""

    def test_create_components(self, H, state):
        for key, price, stock, unit in (("comp_a", 100.5, 50, "шт"), ("comp_b", 33.33, 10, "м")):
            r = requests.post(f"{COST}/components", json={
                "name": f"QA122-{key}-{uuid.uuid4().hex[:6]}", "category": "wood",
                "unit": unit, "unitPrice": price, "stockCurrent": stock, "stockMin": 1,
            }, headers=H, timeout=TIMEOUT)
            assert r.status_code == 200, r.text
            c = r.json()
            assert "_id" not in c
            assert c["unitPrice"] == price and c["stockCurrent"] == stock
            state[key] = c
            state["components"].append(c["id"])

    def test_create_tech_card_and_sync_cost_price(self, H, state, target_model):
        body = {"scope": "model", "modelId": target_model["id"],
                "items": [{"componentId": state["comp_a"]["id"], "qty": 3},
                          {"componentId": state["comp_b"]["id"], "qty": 2.5}],
                "laborCost": 500, "overheadPct": 10, "manualAdjustment": 77,
                "retailExtraCost": 250, "syncToCostPrice": True}
        r = requests.post(f"{COST}/tech-cards", json=body, headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        card = r.json()
        state["cards"].append(card["id"])
        state["card"] = card

        exp_materials = round(round(100.5 * 3, 2) + round(33.33 * 2.5, 2), 2)
        exp_total = int(round(exp_materials + 500 + round(exp_materials * 0.1, 2) + 77))
        assert card["materialsCost"] == exp_materials, card
        assert card["totalCost"] == exp_total, card

        # sync landed in sauna_prices
        m = next(x for x in requests.get(f"{API}/sauna/prices", headers=H, timeout=TIMEOUT)
                 .json()["models"] if x["id"] == target_model["id"])
        assert int(m.get("costPrice") or 0) == exp_total, m
        assert int(m.get("retailExtraCost") or 0) == 250, m


# ------------------------------------------------------- THE FIX under test
class TestDeductFlagRelease:
    def test_deduct_with_nothing_to_apply_releases_flag(self, H, state, mongo):
        lid = _mk_lead(mongo, state, {"clientName": "QA122-NOBOM"})
        assert _flag(mongo, lid) is False

        r = requests.post(f"{COST}/production-stock/deduct/{lid}", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is False, body
        assert body["summary"]["applied"] == 0, body
        assert body.get("message"), body
        # flag must NOT be stuck
        assert _flag(mongo, lid) is False, "productionStockDeducted stuck True after empty deduct"

        # second attempt must still be attemptable (not 409-locked)
        r2 = requests.post(f"{COST}/production-stock/deduct/{lid}", headers=H, timeout=TIMEOUT)
        assert r2.status_code == 200, f"retry blocked: {r2.status_code} {r2.text[:300]}"
        assert r2.json().get("ok") is False
        assert _flag(mongo, lid) is False

    def test_retry_after_model_added_actually_deducts(self, H, state, mongo, target_model):
        """The real point of the fix: once the lead gets a resolvable model,
        the previously-empty deduct must now succeed."""
        lid = _mk_lead(mongo, state, {"clientName": "QA122-NOBOM-THEN-MODEL"})
        r = requests.post(f"{COST}/production-stock/deduct/{lid}", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["summary"]["applied"] == 0

        mongo.sauna_crm_leads.update_one({"id": lid}, {"$set": {
            "modelName": target_model["name"],
            "calculatorData": {"modelId": target_model["id"], "selectedOptions": {}}}})

        a, b = state["comp_a"]["id"], state["comp_b"]["id"]
        before_a, before_b = _stock(H, a), _stock(H, b)
        r2 = requests.post(f"{COST}/production-stock/deduct/{lid}", headers=H, timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("ok") is True, r2.text
        assert r2.json()["summary"]["applied"] >= 2, r2.text
        assert _stock(H, a) == before_a - 3
        assert _stock(H, b) == before_b - 2.5
        assert _flag(mongo, lid) is True
        # restore
        assert requests.post(f"{COST}/production-stock/revert/{lid}",
                             headers=H, timeout=TIMEOUT).status_code == 200
        assert _stock(H, a) == before_a and _stock(H, b) == before_b


class TestDeductRevertRegression:
    def test_deduct_double_deduct_revert_double_revert(self, H, state, mongo, target_model):
        lid = _mk_lead(mongo, state, {
            "clientName": "QA122-REAL", "modelName": target_model["name"],
            "calculatorData": {"modelId": target_model["id"], "selectedOptions": {}}})

        pv = requests.post(f"{COST}/production-stock/preview/{lid}", headers=H, timeout=TIMEOUT)
        assert pv.status_code == 200, pv.text
        assert pv.json()["alreadyDeducted"] is False
        assert state["comp_a"]["id"] in {i["componentId"] for i in pv.json()["items"]}

        a, b = state["comp_a"]["id"], state["comp_b"]["id"]
        before_a, before_b = _stock(H, a), _stock(H, b)

        r = requests.post(f"{COST}/production-stock/deduct/{lid}", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        summary = r.json()["summary"]
        assert summary["applied"] >= 2 and summary["totalQty"] > 0
        assert _stock(H, a) == before_a - 3
        assert _stock(H, b) == before_b - 2.5
        assert _flag(mongo, lid) is True

        # repeat deduct -> 409, stock untouched
        r2 = requests.post(f"{COST}/production-stock/deduct/{lid}", headers=H, timeout=TIMEOUT)
        assert r2.status_code == 409, r2.text
        assert _stock(H, a) == before_a - 3

        # revert restores exactly
        r3 = requests.post(f"{COST}/production-stock/revert/{lid}", headers=H, timeout=TIMEOUT)
        assert r3.status_code == 200, r3.text
        assert _stock(H, a) == before_a
        assert _stock(H, b) == before_b
        assert _flag(mongo, lid) is False

        # double revert -> 409
        r4 = requests.post(f"{COST}/production-stock/revert/{lid}", headers=H, timeout=TIMEOUT)
        assert r4.status_code == 409, r4.text

    def test_deduct_missing_lead_404(self, H):
        r = requests.post(f"{COST}/production-stock/deduct/nope-{uuid.uuid4().hex}",
                          headers=H, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_deduct_requires_auth(self, state, mongo):
        r = requests.post(f"{COST}/production-stock/deduct/whatever", timeout=TIMEOUT)
        assert r.status_code in (401, 403), r.status_code
