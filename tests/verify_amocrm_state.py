"""Post-test verification: integration_settings(type=amocrm) restored to neutral state."""
import os
from dotenv import dotenv_values
from pymongo import MongoClient

env = dotenv_values("/app/backend/.env")
client = MongoClient((os.environ.get("MONGO_URL") or env["MONGO_URL"]).strip('"'))
db = client[(os.environ.get("DB_NAME") or env["DB_NAME"]).strip('"')]
doc = db["integration_settings"].find_one({"type": "amocrm"}, {"_id": 0}) or {}
print("amocrm_token present:", "amocrm_token" in doc, repr(doc.get("amocrm_token")))
print("amocrm_domain present:", "amocrm_domain" in doc, repr(doc.get("amocrm_domain")))
print("enabled:", doc.get("enabled"))
