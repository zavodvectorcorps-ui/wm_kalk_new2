"""amoCRM webhook update-fallback: cancelled lead must NOT be recreated (Пункт 3 follow-up).

Module under test: /app/backend/routes/amocrm.py :: receive_webhook_section
Endpoint: POST /api/integrations/amocrm/webhook/{section}
"""
import os
import uuid
from datetime import datetime, timezone

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

CANCELLED_STATUS_ID = "73620210"
TEST_PREFIX = "QV"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def configured_pipeline(mongo_db):
    """Temporarily set section_pipelines={'sauna':'9999'}; restore original state after."""
    coll = mongo_db["integration_settings"]
    doc = coll.find_one({"type": "amocrm"})
    assert doc is not None, "integration_settings type=amocrm missing"
    assert doc.get("enabled") is True, "amoCRM integration must be enabled"
    had_key = "section_pipelines" in doc
    original = doc.get("section_pipelines")

    coll.update_one({"type": "amocrm"}, {"$set": {"section_pipelines": {"sauna": "9999"}}})
    yield
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
    assert mongo_db["webhook_logs"].count_documents({"webhook_lead_id": rgx}) == 0


def _payload(event, lead_id, pipeline_id, status_id="111", name="TEST_QV Lead", price=15000):
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


class TestCancelledUpdateFallback:
    # EDGE FIXED: cancelled status on update with no existing order => no create
    def test_a_cancelled_lead_not_recreated(self, mongo_db):
        lead = f"{TEST_PREFIX}CAN1"
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead})
        before_total = mongo_db["sauna_orders"].count_documents({})

        resp = _post("sauna", _payload("update", lead, "9999", status_id=CANCELLED_STATUS_ID))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("status") == "ok", data
        assert data.get("message") == "Cancelled lead, not recreated", data
        assert "action" not in data, data
        assert "order_id" not in data, data

        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None
        assert mongo_db["sauna_orders"].count_documents({}) == before_total

        log = mongo_db["webhook_logs"].find_one({"webhook_lead_id": lead})
        assert log is not None, "webhook log missing"
        assert log.get("status") == "skipped", log
        assert "cancelled stage" in log.get("reason", ""), log
        assert log.get("update_fallback") is None

    # REGRESSION: normal (non-cancelled) update-fallback still creates
    def test_b_normal_update_fallback_creates(self, mongo_db):
        lead = f"{TEST_PREFIX}OK1"
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead})

        resp = _post("sauna", _payload("update", lead, "9999", status_id="111"))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("status") == "ok", data
        assert data.get("action") == "created", data
        assert data.get("section") == "sauna", data
        order_id = data.get("order_id")
        assert isinstance(order_id, str) and order_id

        doc = mongo_db["sauna_orders"].find_one({"amocrm_id": lead})
        assert doc is not None, "order not persisted"
        assert doc["id"] == order_id
        assert doc.get("status") == "new"

        log = mongo_db["webhook_logs"].find_one({"webhook_lead_id": lead, "update_fallback": True})
        assert log is not None, "update_fallback log missing"
        assert log.get("event_type") == "update"

    # REGRESSION: section with no configured pipeline still strict-skips
    def test_c_no_configured_pipeline_strict_skip(self, mongo_db):
        lead = f"{TEST_PREFIX}BAL1"
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

    # REGRESSION: existing order + cancelled status (no trip) => still deleted
    def test_d_existing_cancelled_order_deleted(self, mongo_db):
        lead = f"{TEST_PREFIX}DEL1"
        order_id = str(uuid.uuid4())
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead})
        mongo_db["sauna_orders"].insert_one({
            "id": order_id,
            "amocrm_id": lead,
            "orderNumber": "TEST_QVDEL1",
            "clientName": "TEST_QV Client",
            "status": "new",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is not None

        resp = _post("sauna", _payload("update", lead, "9999", status_id=CANCELLED_STATUS_ID))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("status") == "ok", data
        assert data.get("action") == "deleted", data
        assert data.get("order_id") == order_id, data
        assert data.get("reason") == "Cancelled in amoCRM", data

        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None

        log = mongo_db["webhook_logs"].find_one({"webhook_lead_id": lead, "status": "deleted"})
        assert log is not None, "delete log missing"
        assert log.get("deleted_order_id") == order_id

    # SAFETY: existing order in a trip + cancelled => kept (not deleted)
    def test_e_existing_cancelled_order_in_trip_kept(self, mongo_db):
        lead = f"{TEST_PREFIX}TRIP1"
        order_id = str(uuid.uuid4())
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead})
        mongo_db["sauna_orders"].insert_one({
            "id": order_id,
            "amocrm_id": lead,
            "orderNumber": "TEST_QVTRIP1",
            "clientName": "TEST_QV Client",
            "status": "new",
            "tripId": "TEST_QV_TRIP",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

        resp = _post("sauna", _payload("update", lead, "9999", status_id=CANCELLED_STATUS_ID))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("action") == "skipped", data
        assert data.get("reason") == "Order in trip, not deleted", data
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is not None
