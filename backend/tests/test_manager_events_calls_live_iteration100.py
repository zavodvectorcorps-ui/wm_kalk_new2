"""
Test live call counts enrichment for Manager Events Analytics.

Bug fix verification: manager-stats / manager-detail endpoints must compute
outgoingCalls / incomingCalls / callsPerLead / recentCalls live from
`call_analytics_calls` collection (not from stale snapshot in event_manager_stats).
"""
import os
import sys
import pytest
import requests
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta

# Load backend .env so MONGO_URL / DB_NAME are available even when run outside
sys.path.insert(0, "/app/backend")
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-crm-13.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TEST_MANAGER_ID = "999100"  # string – important
TEST_MANAGER_ID_2 = "999101"
TEST_SYNC_ID = "TEST_iter100_sync"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    # teardown: clean test docs
    db.call_analytics_calls.delete_many({"manager_id": {"$in": [TEST_MANAGER_ID, TEST_MANAGER_ID_2]}})
    db.event_manager_stats.delete_many({"sync_id": TEST_SYNC_ID})
    db.event_analytics_sync.delete_many({"sync_id": TEST_SYNC_ID})
    client.close()


@pytest.fixture(scope="module", autouse=True)
def seed_data(mongo_db):
    db = mongo_db
    now = datetime.now(timezone.utc)
    # 1) Mark a completed sync so manager-stats has something to anchor on
    db.event_analytics_sync.delete_many({"sync_id": TEST_SYNC_ID})
    db.event_analytics_sync.insert_one({
        "sync_id": TEST_SYNC_ID,
        "status": "completed",
        "startedAt": (now - timedelta(minutes=10)).isoformat(),
        "completedAt": now.isoformat(),  # latest → will be picked up
        "date_from": None,
        "date_to": None,
        "eventsProcessed": 0,
    })

    # 2) Seed event_manager_stats with snapshot showing 0 calls (the bug case)
    db.event_manager_stats.delete_many({"sync_id": TEST_SYNC_ID})
    db.event_manager_stats.insert_many([
        {
            "sync_id": TEST_SYNC_ID,
            "userId": TEST_MANAGER_ID,
            "userName": "TEST Manager One",
            "rank": 1,
            "performanceScore": 50,
            "totalLeads": 4,
            "outgoingCalls": 0,  # stale snapshot
            "incomingCalls": 0,  # stale snapshot
            "callsPerLead": 0,
            "computedAt": now.isoformat(),
        },
        {
            "sync_id": TEST_SYNC_ID,
            "userId": TEST_MANAGER_ID_2,
            "userName": "TEST Manager Two",
            "rank": 2,
            "performanceScore": 40,
            "totalLeads": 2,
            "outgoingCalls": 0,
            "incomingCalls": 0,
            "callsPerLead": 0,
            "computedAt": now.isoformat(),
        },
    ])

    # 3) Seed call_analytics_calls with live calls
    db.call_analytics_calls.delete_many({"manager_id": {"$in": [TEST_MANAGER_ID, TEST_MANAGER_ID_2]}})
    iso_now = now.isoformat()
    iso_earlier = (now - timedelta(days=1)).isoformat()
    db.call_analytics_calls.insert_many([
        # Manager 1: 3 out + 2 in = 5 total
        {"id": "TEST_call_1", "manager_id": TEST_MANAGER_ID, "direction": "outbound",
         "datetime": iso_now, "duration_seconds": 120, "phone": "+380501112233",
         "client_name": "Client A", "status": "completed", "score": 8.0,
         "has_strong_negative": False, "summary_ru": "Хороший разговор",
         "audio_url": "https://example.com/a.mp3"},
        {"id": "TEST_call_2", "manager_id": TEST_MANAGER_ID, "direction": "outbound",
         "datetime": iso_now, "duration_seconds": 30, "phone": "+380501112244",
         "client_name": "Client B", "status": "completed", "score": 4.0,
         "has_strong_negative": True, "summary_ru": "Сложный звонок",
         "audio_url": ""},   # empty audio - should still appear (no audio_url filter)
        {"id": "TEST_call_3", "manager_id": TEST_MANAGER_ID, "direction": "out",
         "datetime": iso_earlier, "duration_seconds": 60, "phone": "+380501112255",
         "client_name": "Client C", "status": "completed",
         "summary_ru": "Без оценки"},  # no score, no audio_url field at all
        {"id": "TEST_call_4", "manager_id": TEST_MANAGER_ID, "direction": "inbound",
         "datetime": iso_now, "duration_seconds": 45, "phone": "+380501112266",
         "client_name": "Client D", "status": "completed",
         "summary_ru": "Входящий"},
        {"id": "TEST_call_5", "manager_id": TEST_MANAGER_ID, "direction": "in",
         "datetime": iso_now, "duration_seconds": 90, "phone": "+380501112277",
         "client_name": "Client E", "status": "completed",
         "summary_ru": "Ещё один входящий"},
        # Manager 2: 1 out + 0 in
        {"id": "TEST_call_6", "manager_id": TEST_MANAGER_ID_2, "direction": "outgoing",
         "datetime": iso_now, "duration_seconds": 60, "phone": "+380501112288",
         "client_name": "Client F", "status": "completed",
         "summary_ru": "Soft"},
    ])
    yield


# --- Tests for manager-stats live enrichment ---

def test_manager_stats_returns_live_call_counts():
    """manager-stats should reflect outgoingCalls=3, incomingCalls=2 even though snapshot has 0."""
    r = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-stats", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "managers" in data
    assert "sync_id" in data
    # Sync_id should be picked from latest completed; could be our test sync
    mgrs = {str(m.get("userId")): m for m in data["managers"]}
    assert TEST_MANAGER_ID in mgrs, f"Expected manager {TEST_MANAGER_ID} in response; got ids: {list(mgrs.keys())}"
    m1 = mgrs[TEST_MANAGER_ID]
    assert m1["outgoingCalls"] == 3, f"Expected 3 outgoing, got {m1['outgoingCalls']} | full: {m1}"
    assert m1["incomingCalls"] == 2, f"Expected 2 incoming, got {m1['incomingCalls']}"
    # callsPerLead = 3 / totalLeads(4) = 0.75
    assert m1["callsPerLead"] == 0.75, f"Expected callsPerLead=0.75, got {m1['callsPerLead']}"

    m2 = mgrs.get(TEST_MANAGER_ID_2)
    assert m2 is not None
    assert m2["outgoingCalls"] == 1
    assert m2["incomingCalls"] == 0


def test_manager_stats_date_range_filter():
    """Date filter should narrow calls to today only (excludes the iso_earlier 'out' call)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = requests.get(
        f"{BASE_URL}/api/lead-analytics/events/manager-stats",
        params={"date_from": today, "date_to": today},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    mgrs = {str(m.get("userId")): m for m in r.json()["managers"]}
    m1 = mgrs.get(TEST_MANAGER_ID)
    assert m1 is not None
    # Only 2 outgoing calls happened today (calls 1 & 2). Call 3 was yesterday.
    assert m1["outgoingCalls"] == 2, f"Expected 2 outgoing (today only), got {m1['outgoingCalls']}"
    assert m1["incomingCalls"] == 2


# --- Tests for manager-detail enrichment ---

def test_manager_detail_recent_calls_no_audio_filter():
    """recentCalls must include calls without audio_url; summary mapped from summary_ru; phone present."""
    r = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-detail/{TEST_MANAGER_ID}", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "recentCalls" in data
    assert "callKpi" in data
    calls = data["recentCalls"]
    # All 5 calls of Manager 1 should be returned (incl. ones with no audio_url)
    test_calls = [c for c in calls if c.get("id", "").startswith("TEST_call_")]
    assert len(test_calls) == 5, f"Expected 5 recent calls, got {len(test_calls)} — calls: {[c.get('id') for c in calls]}"
    # phone field present
    for c in test_calls:
        assert "phone" in c, f"Call {c.get('id')} missing 'phone' field"
        assert c["phone"], f"Call {c.get('id')} has empty 'phone'"
    # summary mapped from summary_ru
    c1 = next(c for c in test_calls if c["id"] == "TEST_call_1")
    assert c1.get("summary") == "Хороший разговор", f"summary not mapped: {c1}"
    # Verify calls without audio_url are present
    call3 = next((c for c in test_calls if c["id"] == "TEST_call_3"), None)
    assert call3 is not None, "Call without audio_url field missing from recentCalls"
    call2 = next((c for c in test_calls if c["id"] == "TEST_call_2"), None)
    assert call2 is not None, "Call with empty audio_url missing from recentCalls"

    # callKpi.total should reflect ALL calls for this manager (5)
    kpi = data["callKpi"]
    assert kpi["total"] == 5, f"Expected callKpi.total=5, got {kpi['total']}"
    # withAi = calls with numeric score (call_1 has 8.0, call_2 has 4.0)
    assert kpi["withAi"] == 2, f"Expected withAi=2, got {kpi['withAi']}"
    # avgScore = (8+4)/2 = 6.0
    assert kpi["avgScore"] == 6.0, f"Expected avgScore=6.0, got {kpi['avgScore']}"
    # critical: score<5 (call_2 has 4.0) or has_strong_negative=True (call_2) → 1
    assert kpi["criticalCount"] == 1, f"Expected criticalCount=1, got {kpi['criticalCount']}"


def test_manager_detail_stats_updated_with_live_calls():
    """stats.outgoingCalls / incomingCalls must be updated from live calls collection."""
    r = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-detail/{TEST_MANAGER_ID}", timeout=30)
    assert r.status_code == 200, r.text
    stats = r.json().get("stats")
    assert stats is not None, "stats missing"
    assert stats["outgoingCalls"] == 3, f"Expected 3 outgoing in stats, got {stats['outgoingCalls']}"
    assert stats["incomingCalls"] == 2, f"Expected 2 incoming in stats, got {stats['incomingCalls']}"
    # callsPerLead = 3 / 4 = 0.75
    assert stats["callsPerLead"] == 0.75


# --- Edge cases: empty/None/missing manager_id ---

def test_manager_detail_unknown_user_does_not_crash():
    """Endpoint must return 200 for non-existent manager."""
    r = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-detail/999999999", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["recentCalls"] == []
    assert data["callKpi"]["total"] == 0
    # stats can be None when no snapshot for this user
    assert "stats" in data


def test_manager_stats_handles_calls_with_empty_manager_id(mongo_db):
    """Calls with manager_id='' or None must not crash the aggregation or pollute the response."""
    db = mongo_db
    # Insert pathological docs
    db.call_analytics_calls.insert_many([
        {"id": "TEST_call_empty_mgr", "manager_id": "", "direction": "outbound",
         "datetime": datetime.now(timezone.utc).isoformat()},
        {"id": "TEST_call_null_mgr", "manager_id": None, "direction": "inbound",
         "datetime": datetime.now(timezone.utc).isoformat()},
    ])
    try:
        r = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-stats", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # No manager with empty/None id should appear
        bad = [m for m in data["managers"] if not m.get("userId")]
        assert not bad, f"Unexpected managers with empty userId: {bad}"
    finally:
        db.call_analytics_calls.delete_many({"id": {"$in": ["TEST_call_empty_mgr", "TEST_call_null_mgr"]}})


def test_endpoint_returns_valid_json_200():
    """Smoke: basic endpoints return 200 valid JSON."""
    for path in [
        "/api/lead-analytics/events/manager-stats",
        "/api/lead-analytics/events/sync-status",
        "/api/lead-analytics/events/settings",
    ]:
        r = requests.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code == 200, f"{path} → {r.status_code}: {r.text}"
        assert isinstance(r.json(), dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
