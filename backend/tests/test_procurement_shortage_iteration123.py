"""Iteration 123 — GET /api/sauna-production/cost/procurement "Нужно докупить" enrichment.

Verifies inStock / toBuy / buyCost per item + totalToBuyCost / shortageCount,
and the no-shortage case. Creates a QA component + tech-card (syncToCostPrice
disabled so sauna_prices is untouched) + one in-production QA lead; cleans up.
"""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

_fenv = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _fenv.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
COST = f"{API}/sauna-production/cost"
TIMEOUT = 60

_benv = dotenv_values("/app/backend/.env")


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=TIMEOUT)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def mongo():
    cl = MongoClient(_benv["MONGO_URL"])
    yield cl[_benv["DB_NAME"]]
    cl.close()


@pytest.fixture(scope="module")
def state():
    return {"components": [], "cards": [], "leads": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(H, state, mongo):
    yield
    for cid in state["cards"]:
        requests.delete(f"{COST}/tech-cards/{cid}", headers=H, timeout=TIMEOUT)
    for lead_id in state["leads"]:
        requests.delete(f"{API}/sauna-crm/leads/{lead_id}", headers=H, timeout=TIMEOUT)
    for comp_id in state["components"]:
        requests.delete(f"{COST}/components/{comp_id}", headers=H, timeout=TIMEOUT)
        mongo.sauna_stock_movements.delete_many({"componentId": comp_id})


@pytest.fixture(scope="module")
def target_model(H, mongo):
    """Pick a real sauna model that has NO existing tech-card, so our upsert
    doesn't overwrite production data."""
    r = requests.get(f"{API}/sauna/prices", headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    models = [m for m in (r.json().get("models") or []) if m.get("id")]
    assert models, "no sauna models found"
    used = {c.get("modelId") for c in mongo.sauna_tech_cards.find({"scope": "model"}, {"modelId": 1})}
    free = [m for m in models if m["id"] not in used]
    assert free, "every model already has a model-scope tech card"
    return free[0]


@pytest.fixture(scope="module")
def setup_chain(H, state, target_model, mongo):
    """QA component (unitPrice 100, stock 3) + tech card qty 5 + in-production lead."""
    comp = {"name": f"QA-SHORTAGE-{uuid.uuid4().hex[:6]}", "category": "wood", "unit": "шт",
            "unitPrice": 100, "stockCurrent": 3, "stockMin": 0}
    r = requests.post(f"{COST}/components", json=comp, headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    c = r.json()
    state["components"].append(c["id"])

    card_body = {"scope": "model", "modelId": target_model["id"], "syncToCostPrice": False,
                 "items": [{"componentId": c["id"], "qty": 5}], "note": "QA iteration123"}
    r = requests.post(f"{COST}/tech-cards", json=card_body, headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    card = r.json()
    state["cards"].append(card["id"])

    # NOTE: amocrm_id must be unique/non-null — known separate bug: the
    # unique index amocrm_id_1 is not sparse, so a second null lead 500s.
    lead_body = {"stageId": "new", "clientName": "QA SHORTAGE TEST",
                 "amocrm_id": f"QA-{uuid.uuid4().hex[:10]}",
                 "modelName": target_model.get("name") or "QA",
                 "calculatorData": {"modelId": target_model["id"]}}
    r = requests.post(f"{API}/sauna-crm/leads", json=lead_body, headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    lead = r.json()["lead"]
    state["leads"].append(lead["id"])
    # Flip to production WITHOUT the stock-deduction side effect of
    # /to-production so arithmetic stays deterministic.
    r = requests.put(f"{API}/sauna-crm/leads/{lead['id']}",
                     json={"inProduction": True, "productionStageId": "accepted"},
                     headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    assert r.json().get("inProduction") is True

    # How many in-production leads target this model (should be 1 = ours)
    n_leads = mongo.sauna_crm_leads.count_documents(
        {"inProduction": True, "$or": [{"modelId": target_model["id"]},
                                       {"calculatorData.modelId": target_model["id"]}]})
    print(f"[setup] in-production leads targeting model {target_model['id']}: {n_leads}")
    return {"comp": c, "card": card, "lead": lead, "expected_required": 5.0 * n_leads,
            "n_leads": n_leads}


def _procurement(H):
    r = requests.get(f"{COST}/procurement", headers=H, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


def _item(data, comp_id):
    for it in data.get("items") or []:
        if it.get("componentId") == comp_id:
            return it
    return None


class TestProcurementShortage:
    def test_shortage_arithmetic(self, H, setup_chain):
        comp_id = setup_chain["comp"]["id"]
        required = setup_chain["expected_required"]
        data = _procurement(H)
        assert "totalToBuyCost" in data and "shortageCount" in data
        it = _item(data, comp_id)
        assert it is not None, f"QA component not aggregated; unmatched={len(data.get('unmatched') or [])}"
        assert it["totalQty"] == required
        assert it["inStock"] == 3
        assert it["toBuy"] == required - 3
        assert it["buyCost"] == round((required - 3) * 100, 2)
        assert data["shortageCount"] >= 1
        # our buyCost must be part of the global total
        assert data["totalToBuyCost"] >= it["buyCost"]
        # global total must equal the sum of positive-toBuy buyCosts
        expected_total = round(sum(x["buyCost"] for x in data["items"] if x["toBuy"] > 0), 2)
        assert abs(data["totalToBuyCost"] - expected_total) < 0.02
        assert data["shortageCount"] == len([x for x in data["items"] if x["toBuy"] > 0])
        # sanity: every item carries the new fields
        for x in data["items"]:
            assert {"inStock", "toBuy", "buyCost"} <= set(x)
            assert x["toBuy"] >= 0

    def test_no_shortage_after_stock_raise(self, H, setup_chain):
        comp_id = setup_chain["comp"]["id"]
        required = setup_chain["expected_required"]
        before = _procurement(H)
        before_item = _item(before, comp_id)
        r = requests.post(f"{COST}/components/{comp_id}/stock-adjust",
                          json={"type": "set", "qty": required + 5, "note": "QA iteration123"},
                          headers=H, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = _procurement(H)
        it = _item(data, comp_id)
        assert it is not None
        assert it["inStock"] == required + 5
        assert it["toBuy"] == 0
        assert it["buyCost"] == 0
        assert comp_id not in [x["componentId"] for x in data["items"] if x["toBuy"] > 0]
        assert data["shortageCount"] == before["shortageCount"] - 1
        assert abs(data["totalToBuyCost"] - (before["totalToBuyCost"] - before_item["buyCost"])) < 0.02

    def test_procurement_requires_auth(self):
        r = requests.get(f"{COST}/procurement", timeout=TIMEOUT)
        assert r.status_code in (401, 403), r.status_code
