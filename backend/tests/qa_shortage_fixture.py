"""Setup/teardown helper for the frontend 'Нужно докупить' UI test (iteration 123).

Usage: python qa_shortage_fixture.py setup   -> creates QA component + tech-card + in-production lead
       python qa_shortage_fixture.py teardown -> removes everything created
State stored in /tmp/qa_shortage_state.json
"""
import json
import os
import sys
import uuid

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

_f = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _f.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"
COST = f"{API}/sauna-production/cost"
_b = dotenv_values("/app/backend/.env")
STATE = "/tmp/qa_shortage_state.json"


def headers():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=60)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['token']}"}


def setup():
    H = headers()
    cl = MongoClient(_b["MONGO_URL"])
    dbm = cl[_b["DB_NAME"]]
    prices = requests.get(f"{API}/sauna/prices", headers=H, timeout=60).json()
    used = {c.get("modelId") for c in dbm.sauna_tech_cards.find({"scope": "model"}, {"modelId": 1})}
    model = next(m for m in prices["models"] if m.get("id") and m["id"] not in used)
    comp = requests.post(f"{COST}/components", json={
        "name": f"QA-UI-SHORTAGE-{uuid.uuid4().hex[:5]}", "category": "wood", "unit": "шт",
        "unitPrice": 100, "stockCurrent": 3, "stockMin": 0}, headers=H, timeout=60).json()
    card = requests.post(f"{COST}/tech-cards", json={
        "scope": "model", "modelId": model["id"], "syncToCostPrice": False,
        "items": [{"componentId": comp["id"], "qty": 5}], "note": "QA UI it123"},
        headers=H, timeout=60).json()
    lead = requests.post(f"{API}/sauna-crm/leads", json={
        "stageId": "new", "clientName": "QA UI SHORTAGE", "amocrm_id": f"QAUI-{uuid.uuid4().hex[:10]}",
        "modelName": model.get("name") or "QA", "calculatorData": {"modelId": model["id"]}},
        headers=H, timeout=60).json()["lead"]
    requests.put(f"{API}/sauna-crm/leads/{lead['id']}",
                 json={"inProduction": True, "productionStageId": "accepted"}, headers=H, timeout=60)
    st = {"componentId": comp["id"], "cardId": card["id"], "leadId": lead["id"], "modelId": model["id"]}
    json.dump(st, open(STATE, "w"))
    print("SETUP OK", st)
    cl.close()


def teardown():
    H = headers()
    st = json.load(open(STATE))
    print("tc", requests.delete(f"{COST}/tech-cards/{st['cardId']}", headers=H, timeout=60).status_code)
    print("lead", requests.delete(f"{API}/sauna-crm/leads/{st['leadId']}", headers=H, timeout=60).status_code)
    print("comp", requests.delete(f"{COST}/components/{st['componentId']}", headers=H, timeout=60).status_code)
    cl = MongoClient(_b["MONGO_URL"])
    dbm = cl[_b["DB_NAME"]]
    dbm.sauna_stock_movements.delete_many({"componentId": st["componentId"]})
    print("left components:", dbm.sauna_components.count_documents({"id": st["componentId"]}),
          "cards:", dbm.sauna_tech_cards.count_documents({"id": st["cardId"]}),
          "leads:", dbm.sauna_crm_leads.count_documents({"id": st["leadId"]}))
    cl.close()
    os.remove(STATE)


if __name__ == "__main__":
    {"setup": setup, "teardown": teardown}[sys.argv[1]]()
