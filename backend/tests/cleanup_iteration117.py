"""Inspect + cleanup amocrm integration_settings after UI round-trip test (iteration 117)."""
import os
from dotenv import dotenv_values
from pymongo import MongoClient

env = dotenv_values("/app/backend/.env")
client = MongoClient(env["MONGO_URL"])
db = client[env["DB_NAME"]]
col = db["integration_settings"]
doc = col.find_one({"type": "amocrm"}) or {}
print("KEYS:", sorted(k for k in doc if k != "_id"))
for k in ("cancelled_status_id", "amocrm_domain", "amocrm_token", "section_pipelines", "stage_sync", "enabled"):
    v = doc.get(k)
    if k == "amocrm_token" and v:
        v = f"<len {len(v)}>"
    print(f"{k} = {v!r}")

col.update_one({"type": "amocrm"}, {"$set": {"cancelled_status_id": "73620210"}})
print("RESET cancelled_status_id ->", col.find_one({"type": "amocrm"}).get("cancelled_status_id"))
