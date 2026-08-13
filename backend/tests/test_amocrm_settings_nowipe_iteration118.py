"""
Iteration 118 — amoCRM GET /settings must return section_pipelines + stage_sync
so that a UI save round-trip does not wipe them (data loss fix).
"""
import os

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
SETTINGS_URL = f"{BASE_URL}/api/integrations/amocrm/settings"

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME")

SEED_SECTION_PIPELINES = {"greenhouse": "", "balia": "", "sauna": "9999"}
SEED_STAGE_SYNC = {
    "sauna": {"pipeline_id": "9999", "status_id": "321"},
    "balia": {"pipeline_id": "", "status_id": ""},
    "greenhouse": {"pipeline_id": "", "status_id": ""},
}


@pytest.fixture(scope="module")
def coll():
    client = MongoClient(MONGO_URL)
    c = client[DB_NAME]["integration_settings"]
    yield c
    client.close()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def seed_and_cleanup(coll):
    original = coll.find_one({"type": "amocrm"})
    coll.update_one(
        {"type": "amocrm"},
        {"$set": {"section_pipelines": SEED_SECTION_PIPELINES, "stage_sync": SEED_STAGE_SYNC}},
        upsert=True,
    )
    yield
    # Cleanup: restore neutral state
    coll.update_one(
        {"type": "amocrm"},
        {
            "$unset": {"section_pipelines": "", "stage_sync": ""},
            "$set": {"cancelled_status_id": "73620210"},
        },
    )
    if original is not None:
        # restore any originally-present values verbatim
        restore = {}
        for k in ("section_pipelines", "stage_sync", "cancelled_status_id"):
            if k in original:
                restore[k] = original[k]
        if restore:
            coll.update_one({"type": "amocrm"}, {"$set": restore})


# --- (1) GET returns both fields ---
def test_get_returns_section_pipelines_and_stage_sync(api):
    r = api.get(SETTINGS_URL)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "section_pipelines" in d, "section_pipelines missing from GET response"
    assert "stage_sync" in d, "stage_sync missing from GET response"
    assert d["section_pipelines"].get("sauna") == "9999"
    assert d["stage_sync"].get("sauna", {}).get("pipeline_id") == "9999"
    assert d["stage_sync"].get("sauna", {}).get("status_id") == "321"


# --- (2) cancelled_status_id still returned with default ---
def test_get_returns_cancelled_status_id(api):
    d = api.get(SETTINGS_URL).json()
    assert "cancelled_status_id" in d
    assert isinstance(d["cancelled_status_id"], str)
    assert d["cancelled_status_id"] == "73620210"


# --- (3) POST-back round trip does not wipe ---
def test_post_back_roundtrip_preserves(api, coll):
    payload = api.get(SETTINGS_URL).json()
    payload.pop("webhook_urls", None)
    post = api.post(SETTINGS_URL, json=payload)
    assert post.status_code == 200, post.text

    d = api.get(SETTINGS_URL).json()
    assert d["section_pipelines"].get("sauna") == "9999", f"WIPED: {d['section_pipelines']}"
    assert d["stage_sync"].get("sauna", {}).get("pipeline_id") == "9999", f"WIPED: {d['stage_sync']}"
    assert d["stage_sync"].get("sauna", {}).get("status_id") == "321"

    # verify persisted in DB too
    doc = coll.find_one({"type": "amocrm"})
    assert doc["section_pipelines"]["sauna"] == "9999"
    assert doc["stage_sync"]["sauna"]["pipeline_id"] == "9999"


# --- (4) POST with new values updates them ---
def test_post_updates_values(api):
    payload = api.get(SETTINGS_URL).json()
    payload.pop("webhook_urls", None)
    payload["cancelled_status_id"] = "55555"
    payload["section_pipelines"]["sauna"] = "8888"
    assert api.post(SETTINGS_URL, json=payload).status_code == 200

    d = api.get(SETTINGS_URL).json()
    assert d["cancelled_status_id"] == "55555"
    assert d["section_pipelines"]["sauna"] == "8888"

    # restore seed values for other tests / cleanup
    payload = d
    payload.pop("webhook_urls", None)
    payload["cancelled_status_id"] = "73620210"
    payload["section_pipelines"]["sauna"] = "9999"
    assert api.post(SETTINGS_URL, json=payload).status_code == 200
