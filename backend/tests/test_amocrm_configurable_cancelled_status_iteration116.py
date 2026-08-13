"""amoCRM configurable cancelled stage id (Пункт 4).

Module under test: /app/backend/routes/amocrm.py
 - receive_webhook_section: CANCELLED_STATUS_ID = settings.get("cancelled_status_id") or "73620210"
 - GET/POST /api/integrations/amocrm/settings round-trip of cancelled_status_id
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
SETTINGS_URL = f"{BASE_URL}/api/integrations/amocrm/settings"

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME")

OLD_DEFAULT = "73620210"
CONFIGURED = "88888"
TEST_PREFIX = "QC"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def settings_snapshot(mongo_db):
    """Snapshot the whole amocrm settings doc, force pipeline 9999, restore exactly after."""
    coll = mongo_db["integration_settings"]
    original = coll.find_one({"type": "amocrm"})
    assert original is not None, "integration_settings type=amocrm missing"
    assert original.get("enabled") is True, "amoCRM integration must be enabled"

    coll.update_one({"type": "amocrm"}, {"$set": {"section_pipelines": {"sauna": "9999"}}})
    yield coll
    coll.replace_one({"type": "amocrm"}, original)
    after = coll.find_one({"type": "amocrm"})
    assert after == original, "settings doc not restored to original state"


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(mongo_db, settings_snapshot):
    yield
    rgx = {"$regex": f"^{TEST_PREFIX}"}
    mongo_db["sauna_orders"].delete_many({"amocrm_id": rgx})
    mongo_db["orders"].delete_many({"amocrm_id": rgx})
    mongo_db["webhook_logs"].delete_many({"webhook_lead_id": rgx})
    assert mongo_db["sauna_orders"].count_documents({"amocrm_id": rgx}) == 0
    assert mongo_db["webhook_logs"].count_documents({"webhook_lead_id": rgx}) == 0


def _payload(lead_id, status_id, pipeline_id="9999", event="update", price=1):
    return {
        "leads": {
            event: [
                {
                    "id": lead_id,
                    "name": "TEST_QC Lead",
                    "pipeline_id": pipeline_id,
                    "status_id": status_id,
                    "price": price,
                }
            ]
        }
    }


def _seed_order(mongo_db, lead_id):
    order_id = str(uuid.uuid4())
    mongo_db["sauna_orders"].delete_many({"amocrm_id": lead_id})
    mongo_db["sauna_orders"].insert_one({
        "id": order_id,
        "amocrm_id": lead_id,
        "orderNumber": f"TEST_{lead_id}",
        "clientName": "TEST_QC Client",
        "pipeline_id": "9999",
        "status": "new",
        "deliveryStatus": "pending",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })
    assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead_id}) is not None
    return order_id


def _post(section, payload):
    return requests.post(f"{WEBHOOK}/{section}", json=payload, timeout=60)


class TestCancelledStatusIdConfigurable:
    # 1) DEFAULT PRESERVED: no cancelled_status_id in settings -> 73620210 still cancels
    def test_a_default_preserved_when_unset(self, mongo_db, settings_snapshot):
        settings_snapshot.update_one({"type": "amocrm"}, {"$unset": {"cancelled_status_id": ""}})
        assert "cancelled_status_id" not in settings_snapshot.find_one({"type": "amocrm"})

        lead = f"{TEST_PREFIX}1"
        order_id = _seed_order(mongo_db, lead)

        resp = _post("sauna", _payload(lead, OLD_DEFAULT))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("action") == "deleted", data
        assert data.get("order_id") == order_id, data
        assert data.get("reason") == "Cancelled in amoCRM", data
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None

    # 2a) CONFIGURED value used: cancelled_status_id=88888 -> 88888 cancels
    def test_b_configured_value_cancels(self, mongo_db, settings_snapshot):
        settings_snapshot.update_one({"type": "amocrm"}, {"$set": {"cancelled_status_id": CONFIGURED}})
        assert settings_snapshot.find_one({"type": "amocrm"})["cancelled_status_id"] == CONFIGURED

        lead = f"{TEST_PREFIX}2"
        order_id = _seed_order(mongo_db, lead)

        resp = _post("sauna", _payload(lead, CONFIGURED))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("action") == "deleted", data
        assert data.get("order_id") == order_id, data
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None

        log = mongo_db["webhook_logs"].find_one({"webhook_lead_id": lead, "status": "deleted"})
        assert log is not None and log.get("deleted_order_id") == order_id, log

    # 2b) old hardcoded default no longer cancels once a different value is configured
    def test_c_old_default_not_cancelling_when_configured(self, mongo_db, settings_snapshot):
        assert settings_snapshot.find_one({"type": "amocrm"})["cancelled_status_id"] == CONFIGURED

        lead = f"{TEST_PREFIX}3"
        order_id = _seed_order(mongo_db, lead)

        resp = _post("sauna", _payload(lead, OLD_DEFAULT))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("action") == "updated", data
        assert data.get("order_id") == order_id, data

        doc = mongo_db["sauna_orders"].find_one({"amocrm_id": lead})
        assert doc is not None, "order must NOT be deleted for the old default id"
        assert doc["id"] == order_id

    # 2c) update-fallback guard also honours the configured id (no recreate for configured cancel id)
    def test_d_update_fallback_guard_uses_configured_id(self, mongo_db, settings_snapshot):
        assert settings_snapshot.find_one({"type": "amocrm"})["cancelled_status_id"] == CONFIGURED

        lead = f"{TEST_PREFIX}4"
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead})

        resp = _post("sauna", _payload(lead, CONFIGURED))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("message") == "Cancelled lead, not recreated", data
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None

        # while the OLD default is now a normal stage -> update-fallback recovers the order
        lead2 = f"{TEST_PREFIX}5"
        mongo_db["sauna_orders"].delete_many({"amocrm_id": lead2})
        resp2 = _post("sauna", _payload(lead2, OLD_DEFAULT))
        assert resp2.status_code == 200, resp2.text
        assert resp2.json().get("action") == "created", resp2.json()
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead2}) is not None

    # 3) blank/whitespace configured value falls back to the historical default
    def test_e_blank_value_falls_back_to_default(self, mongo_db, settings_snapshot):
        settings_snapshot.update_one({"type": "amocrm"}, {"$set": {"cancelled_status_id": ""}})

        lead = f"{TEST_PREFIX}6"
        order_id = _seed_order(mongo_db, lead)
        resp = _post("sauna", _payload(lead, OLD_DEFAULT))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("action") == "deleted", data
        assert data.get("order_id") == order_id, data
        assert mongo_db["sauna_orders"].find_one({"amocrm_id": lead}) is None


class TestSettingsApiRoundTrip:
    """POST /settings must persist cancelled_status_id AND GET /settings must return it
    (the UI reads GET to repopulate the input after reload)."""

    def test_f_settings_post_persists_value(self, mongo_db, settings_snapshot):
        current = settings_snapshot.find_one({"type": "amocrm"}, {"_id": 0})
        payload = {k: v for k, v in current.items() if k not in ("type", "updated_at")}
        payload["cancelled_status_id"] = "55555"

        resp = requests.post(SETTINGS_URL, json=payload, timeout=60)
        assert resp.status_code == 200, resp.text

        doc = settings_snapshot.find_one({"type": "amocrm"})
        assert doc.get("cancelled_status_id") == "55555", "value not persisted in DB"

    def test_g_settings_get_returns_value(self, settings_snapshot):
        assert settings_snapshot.find_one({"type": "amocrm"}).get("cancelled_status_id") == "55555"
        resp = requests.get(SETTINGS_URL, timeout=60)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "cancelled_status_id" in data, (
            "GET /api/integrations/amocrm/settings does not return cancelled_status_id -> "
            "UI cannot show the saved value after reload"
        )
        assert data["cancelled_status_id"] == "55555", data

    def test_h_settings_get_returns_pipeline_and_stage_sync(self, settings_snapshot):
        """Related data-loss risk: the UI POSTs back exactly what GET returned, so any key
        missing from GET is silently reset to its default on every save."""
        resp = requests.get(SETTINGS_URL, timeout=60)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        missing = [k for k in ("section_pipelines", "stage_sync", "cancelled_status_id") if k not in data]
        assert not missing, (
            f"GET /settings omits {missing}; saving from the UI wipes these values in DB"
        )
