"""amoCRM webhook resilience: update-fallback create (Пункт 3).

Module under test: /app/backend/routes/amocrm.py :: receive_webhook_section
Endpoint: POST /api/integrations/amocrm/webhook/{section}
"""
import os
import time

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
WEBHOOK = f"{BASE_URL}/api/integrations/amocrm/webhook"

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME")

TEST_PREFIX = "QAFB"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def configured_pipeline(mongo_db):
    """Temporarily configure section_pipelines={'sauna': '9999'} and restore after."""
    coll = mongo_db["integration_settings"]
    doc = coll.find_one({"type": "amocrm"})
    assert doc is not None, "integration_settings type=amocrm missing"
    assert doc.get("enabled") is True, "amoCRM integration must be enabled"
    had_key = "section_pipelines" in doc
    original = doc.get("section_pipelines")

    coll.update_one({"type": "amocrm"}, {"$set": {"section_pipelines": {"sauna": "9999"}}})
    yield
    # restore exactly
    if had_key:
        coll.update_one({"type": "amocrm"}, {"$set": {"section_pipelines": original}})
    else:
        coll.update_one({"type": "amocrm"}, {"$unset": {"section_pipelines": ""}})
    after = coll.find_one({"type": "amocrm"})
    assert ("section_pipelines" in after) == had_key


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(mongo_db, configured_pipeline):
    yield
    rgx = {"$regex": f"^{TEST_PREFIX}"}
    mongo_db["sauna_orders"].delete_many({"amocrm_id": rgx})
    mongo_db["orders"].delete_many({"amocrm_id": rgx})
    mongo_db["webhook_logs"].delete_many({"webhook_lead_id": rgx})
    assert mongo_db["sauna_orders"].count_documents({"amocrm_id": rgx}) == 0
    assert mongo_db["orders"].count_documents({"amocrm_id": rgx}) == 0


def _payload(event, lead_id, pipeline_id, name="TEST_QA Fallback", price=15000, status_id="111"):
    return {
        "leads": {
            event: [
                {
                    "id": lead_id,
                    "name": name,
                    "pipeline_id": pipeline_id,
                    "status_id": status_id,
                    "price": price,
                }
            ]
        }
    }


def _post(section, payload):
    return requests.post(f"{WEBHOOK}/{section}", json=payload, timeout=60)


class TestUpdateFallback:
    # SCENARIO A: update event, no existing order, configured+matching pipeline => create
    def test_a_update_fallback_creates_order(self, mongo_db):
        lead = f"{TEST_PREFIX}1"
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead})

        resp = _post("sauna", _payload("update", lead, "9999"))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("status") == "ok", data
        assert data.get("action") == "created", data
        assert data.get("section") == "sauna"
        assert isinstance(data.get("order_id"), str) and data["order_id"]

        # DB persistence
        doc = mongo_db["sauna_orders"].find_one({"amocrm_id": lead})
        assert doc is not None, "order was not persisted"
        assert doc["id"] == data["order_id"]
        assert doc.get("status") == "new"

        # webhook log with update_fallback flag
        log = mongo_db["webhook_logs"].find_one(
            {"webhook_lead_id": lead, "update_fallback": True}
        )
        assert log is not None, "webhook_logs entry with update_fallback=true missing"
        assert log.get("event_type") == "update"

    # SCENARIO B: section without configured pipeline => strict skip, nothing created
    def test_b_no_configured_pipeline_strict_skip(self, mongo_db):
        lead = f"{TEST_PREFIX}2"
        before = mongo_db["orders"].count_documents({})

        resp = _post("balia", _payload("update", lead, "5555"))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("status") == "ok", data
        assert data.get("message") == "Order not found in this section, update skipped", data
        assert "action" not in data

        assert mongo_db["orders"].find_one({"amocrm_id": lead}) is None
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None
        assert mongo_db["orders"].count_documents({}) == before

        log = mongo_db["webhook_logs"].find_one({"webhook_lead_id": lead})
        assert log is not None
        assert log.get("status") == "skipped"
        assert log.get("update_fallback") is None

    # SCENARIO C: pipeline mismatch => skipped by unchanged pipeline filter
    def test_c_pipeline_mismatch_skip(self, mongo_db):
        lead = f"{TEST_PREFIX}3"
        resp = _post("sauna", _payload("update", lead, "0000"))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("status") == "ok", data
        assert "different pipeline" in data.get("message", ""), data
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None

        log = mongo_db["webhook_logs"].find_one({"webhook_lead_id": lead})
        assert log is not None and log.get("status") == "skipped"
        assert "Pipeline mismatch" in log.get("reason", "")

    # REGRESSION: add creates, subsequent update updates (no duplicate)
    def test_d_add_then_update_no_duplicate(self, mongo_db):
        lead = f"{TEST_PREFIX}4"
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead})

        add_resp = _post("sauna", _payload("add", lead, "9999", name="TEST_QA Add"))
        assert add_resp.status_code == 200, add_resp.text
        add_data = add_resp.json()
        assert add_data.get("action") == "created", add_data
        created_id = add_data["order_id"]

        time.sleep(0.5)
        upd_resp = _post("sauna", _payload("update", lead, "9999", name="TEST_QA Updated", price=22000))
        assert upd_resp.status_code == 200, upd_resp.text
        upd_data = upd_resp.json()
        assert upd_data.get("action") == "updated", upd_data
        assert upd_data.get("order_id") == created_id

        assert mongo_db["sauna_orders"].count_documents({"amocrm_id": lead}) == 1
        doc = mongo_db["sauna_orders"].find_one({"amocrm_id": lead})
        assert doc.get("updatedFromAmo")
        # update webhook log must NOT be flagged as fallback
        logs = list(mongo_db["webhook_logs"].find({"webhook_lead_id": lead, "event_type": "update"}))
        assert logs, "no update log found"
        assert all(lg.get("update_fallback") is None for lg in logs)

    # EDGE: repeated update-fallback must not duplicate the recovered order
    def test_e_repeated_update_fallback_no_duplicate(self, mongo_db):
        lead = f"{TEST_PREFIX}5"
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead})

        r1 = _post("sauna", _payload("update", lead, "9999"))
        assert r1.json().get("action") == "created", r1.text
        r2 = _post("sauna", _payload("update", lead, "9999"))
        assert r2.json().get("action") == "updated", r2.text
        assert mongo_db["sauna_orders"].count_documents({"amocrm_id": lead}) == 1

    # SAFETY: update-fallback must not create in a foreign pipeline for configured section
    def test_f_foreign_pipeline_never_created_in_sauna(self, mongo_db):
        lead = f"{TEST_PREFIX}6"
        resp = _post("sauna", _payload("update", lead, "12345"))
        assert resp.status_code == 200
        assert "different pipeline" in resp.json().get("message", ""), resp.text
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None
