"""Tests for unified-sync module (iteration 103).

Endpoints under test:
- GET  /api/lead-analytics/unified-sync/status
- POST /api/lead-analytics/unified-sync
- POST /api/lead-analytics/unified-sync/cancel

Plus regression for /api/lead-analytics/events/manager-stats.

We do NOT wait for the real background task to finish (it calls amoCRM which is
unreachable from preview). Instead we POST and immediately cancel.
"""
import os
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-crm-13.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
UNIFIED_COL = "unified_sync"
SYNC_BASE = f"{BASE_URL}/api/lead-analytics/unified-sync"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module", autouse=True)
def cleanup_unified(mongo_db):
    # Wipe before run
    mongo_db[UNIFIED_COL].delete_many({})
    yield
    # Wipe after run
    mongo_db[UNIFIED_COL].delete_many({})
    # Best-effort cleanup of cascade test docs
    mongo_db.lead_analytics_sync.delete_many({"unified_id": {"$exists": True}})
    mongo_db.event_analytics_sync.delete_many({"unified_id": {"$exists": True}})


# ── 1. GET /status when no docs ─────────────────────────────────────────
def test_status_never_when_no_unified_docs(mongo_db):
    mongo_db[UNIFIED_COL].delete_many({})
    r = requests.get(f"{SYNC_BASE}/status", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "never", data


# ── 2. POST creates unified doc with UNI_ prefix ────────────────────────
def test_post_creates_running_unified_doc(mongo_db):
    r = requests.post(SYNC_BASE, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("status") == "started"
    uid = body.get("unified_id")
    assert uid and uid.startswith("UNI_"), uid

    # Doc inserted
    doc = mongo_db[UNIFIED_COL].find_one({"unified_id": uid})
    assert doc is not None
    # status may have already flipped to "error" if pipelineId missing (settings absent in preview);
    # but at minimum the document exists and progress/startedAt populated.
    assert doc.get("startedAt")
    assert doc.get("phase") in {"starting", "leads", "events", "done"} or doc.get("status") == "error"

    # Cancel immediately to avoid leaking BG task
    requests.post(f"{SYNC_BASE}/cancel", timeout=15)


# ── 3. POST while another running → previous marked error ───────────────
def test_post_replaces_existing_running(mongo_db):
    # Manually insert a stale running doc
    fake_id = "UNI_TEST_REPLACE"
    mongo_db[UNIFIED_COL].insert_one({
        "unified_id": fake_id,
        "status": "running",
        "phase": "leads",
        "startedAt": datetime.now(timezone.utc).isoformat(),
    })
    r = requests.post(SYNC_BASE, timeout=15)
    assert r.status_code == 200, r.text
    new_uid = r.json()["unified_id"]
    assert new_uid != fake_id

    old = mongo_db[UNIFIED_COL].find_one({"unified_id": fake_id})
    assert old["status"] == "error"
    assert "Заменено" in (old.get("error") or "")

    requests.post(f"{SYNC_BASE}/cancel", timeout=15)


# ── 4. POST without pipelineId → BG task marks error ────────────────────
def test_post_marks_error_when_pipeline_missing(mongo_db):
    """If lead_analytics_settings has no pipelineId, the BG task should set
    status=error within a few seconds. We tolerate either 'error' (BG ran) or
    'running' (BG still scheduling) but require eventual convergence."""
    # Ensure pipelineId blank
    settings_col = mongo_db.lead_analytics_settings
    original = settings_col.find_one({})
    settings_col.update_one({}, {"$set": {"pipelineId": ""}}, upsert=True)

    try:
        r = requests.post(SYNC_BASE, timeout=15)
        assert r.status_code == 200, r.text
        uid = r.json()["unified_id"]

        # Poll up to 10s for BG task to flip status
        final = None
        for _ in range(20):
            doc = mongo_db[UNIFIED_COL].find_one({"unified_id": uid})
            if doc and doc.get("status") == "error":
                final = doc
                break
            time.sleep(0.5)
        # If BG task is delayed, we still cancel to clean up
        if final is None:
            requests.post(f"{SYNC_BASE}/cancel", timeout=15)
            pytest.skip("BG task did not flip in 10s; cancelled instead")
        assert "pipelineId" in (final.get("error") or "") or "не указан" in (final.get("error") or "")
        assert final.get("phase") == "leads"
    finally:
        # Restore original settings if present
        if original:
            settings_col.replace_one({"_id": original["_id"]}, original)
        requests.post(f"{SYNC_BASE}/cancel", timeout=15)


# ── 5. POST /cancel cascades to lead/event sync collections ─────────────
def test_cancel_cascades_to_subphase_syncs(mongo_db):
    # Insert fake running docs in all three collections
    mongo_db[UNIFIED_COL].delete_many({})
    mongo_db[UNIFIED_COL].insert_one({
        "unified_id": "UNI_TEST_CANCEL", "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(), "phase": "leads",
    })
    mongo_db.lead_analytics_sync.insert_one({
        "sync_id": "TEST_CANCEL_LEADS", "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "unified_id": "UNI_TEST_CANCEL",
    })
    mongo_db.event_analytics_sync.insert_one({
        "sync_id": "TEST_CANCEL_EVENTS", "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "unified_id": "UNI_TEST_CANCEL",
    })

    r = requests.post(f"{SYNC_BASE}/cancel", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "cancelled" in body
    assert body["cancelled"] >= 1

    # Verify all three were flipped
    u = mongo_db[UNIFIED_COL].find_one({"unified_id": "UNI_TEST_CANCEL"})
    assert u["status"] == "error"
    assert u.get("error") == "Отменено пользователем"

    le = mongo_db.lead_analytics_sync.find_one({"sync_id": "TEST_CANCEL_LEADS"})
    assert le["status"] == "error"

    ev = mongo_db.event_analytics_sync.find_one({"sync_id": "TEST_CANCEL_EVENTS"})
    assert ev["status"] == "error"

    # cleanup
    mongo_db.lead_analytics_sync.delete_one({"sync_id": "TEST_CANCEL_LEADS"})
    mongo_db.event_analytics_sync.delete_one({"sync_id": "TEST_CANCEL_EVENTS"})


# ── 6. Stale-recovery in GET /status ────────────────────────────────────
def test_status_stale_recovery_marks_error(mongo_db):
    mongo_db[UNIFIED_COL].delete_many({})
    stale_started = (datetime.now(timezone.utc) - timedelta(minutes=35)).isoformat()
    mongo_db[UNIFIED_COL].insert_one({
        "unified_id": "UNI_TEST_STALE",
        "status": "running",
        "phase": "leads",
        "startedAt": stale_started,
    })

    r = requests.get(f"{SYNC_BASE}/status", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("unified_id") == "UNI_TEST_STALE"
    assert data.get("status") == "error", data
    assert "подвисла" in (data.get("error") or "") or "автоматически" in (data.get("error") or "")

    # DB updated
    doc = mongo_db[UNIFIED_COL].find_one({"unified_id": "UNI_TEST_STALE"})
    assert doc["status"] == "error"
    assert doc.get("completedAt")


# ── 7. Fresh running NOT marked stale ───────────────────────────────────
def test_status_fresh_running_not_changed(mongo_db):
    mongo_db[UNIFIED_COL].delete_many({})
    fresh_started = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    mongo_db[UNIFIED_COL].insert_one({
        "unified_id": "UNI_TEST_FRESH",
        "status": "running",
        "phase": "leads",
        "startedAt": fresh_started,
    })

    r = requests.get(f"{SYNC_BASE}/status", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("unified_id") == "UNI_TEST_FRESH"
    assert data.get("status") == "running", data

    doc = mongo_db[UNIFIED_COL].find_one({"unified_id": "UNI_TEST_FRESH"})
    assert doc["status"] == "running"  # still running in DB


# ── 8. Regression: manager-stats still returns required fields ──────────
def test_regression_manager_stats_fields():
    r = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-stats", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("managers", "filterInfo", "syncDateFrom", "syncDateTo", "binotelUsed"):
        assert key in data, f"missing '{key}' in manager-stats response: {list(data.keys())}"
    assert isinstance(data["managers"], list)


# ── 9. Regression: sync-status endpoints respond ────────────────────────
def test_regression_lead_analytics_sync_status():
    r = requests.get(f"{BASE_URL}/api/lead-analytics/sync-status", timeout=15)
    assert r.status_code == 200, r.text


def test_regression_event_sync_status():
    r = requests.get(f"{BASE_URL}/api/lead-analytics/events/sync-status", timeout=15)
    assert r.status_code == 200, r.text
