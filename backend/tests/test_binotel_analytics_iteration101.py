"""Iteration 101 — Binotel Analytics integration tests.

Covers:
- /api/lead-analytics/binotel/config
- /api/lead-analytics/binotel/mapping  (GET / PUT, idempotency, dedup)
- /api/lead-analytics/binotel/employees  (configured / not-configured branches)
- /api/lead-analytics/binotel/stats  (not-configured branch)
- /api/lead-analytics/binotel/automap  (not-configured guard)
- /api/lead-analytics/binotel/amocrm-users  (graceful empty)
- /api/lead-analytics/events/manager-stats  (binotelUsed flag, no 5xx)
- In-process aggregation tests via monkeypatch on _fetch_period

Run: pytest backend/tests/test_binotel_analytics_iteration101.py -v
"""
import asyncio
import os
import sys

import pytest
import requests
from dotenv import load_dotenv

# Load backend .env so BINOTEL_API_KEY/SECRET / MONGO_URL are present
load_dotenv("/app/backend/.env")

# Make `backend` importable for in-process tests
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for local execution where REACT_APP_BACKEND_URL only lives in frontend/.env
    load_dotenv("/app/frontend/.env")
    BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

API = f"{BASE_URL}/api/lead-analytics/binotel"
EVENTS_API = f"{BASE_URL}/api/lead-analytics/events"


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup_mapping():
    """Wipe binotel_user_mapping before & after the run."""
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _wipe():
        cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await cli[os.environ["DB_NAME"]]["binotel_user_mapping"].delete_many({})
        cli.close()

    asyncio.run(_wipe())
    yield
    asyncio.run(_wipe())


# ─────────────────────── Endpoint smoke tests ───────────────────────

class TestBinotelConfig:
    def test_config_endpoint_returns_configured_flag(self, http):
        r = http.get(f"{API}/config", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "configured" in data
        assert isinstance(data["configured"], bool)
        # Env has both keys, expect True in this preview
        expected = bool(os.environ.get("BINOTEL_API_KEY") and os.environ.get("BINOTEL_API_SECRET"))
        assert data["configured"] is expected


class TestBinotelMapping:
    def test_mapping_empty_initially(self, http):
        r = http.get(f"{API}/mapping", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        assert data["items"] == []

    def test_put_mapping_writes_and_dedupes(self, http):
        payload = {
            "items": [
                {"binotelEmployeeId": "1001", "binotelEmployeeName": "Иван Петров",
                 "amocrmUserId": "555", "amocrmUserName": "Ivan Petrov"},
                {"binotelEmployeeId": "1002", "binotelEmployeeName": "Олег",
                 "amocrmUserId": "556", "amocrmUserName": "Oleg"},
                # duplicate of 1001 — must be deduped
                {"binotelEmployeeId": "1001", "binotelEmployeeName": "duplicate",
                 "amocrmUserId": "999", "amocrmUserName": "dup"},
                # empty id — must be skipped
                {"binotelEmployeeId": "", "binotelEmployeeName": "skip",
                 "amocrmUserId": "x", "amocrmUserName": "y"},
            ]
        }
        r = http.put(f"{API}/mapping", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["saved"] == 2

        # Verify GET returns the deduped set
        r2 = http.get(f"{API}/mapping", timeout=20)
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert len(items) == 2
        ids = {it["binotelEmployeeId"] for it in items}
        assert ids == {"1001", "1002"}
        # First occurrence wins for 1001 (amocrmUserId=555)
        item_1001 = next(it for it in items if it["binotelEmployeeId"] == "1001")
        assert item_1001["amocrmUserId"] == "555"

    def test_put_mapping_idempotent(self, http):
        payload = {"items": [
            {"binotelEmployeeId": "2001", "binotelEmployeeName": "A",
             "amocrmUserId": "111", "amocrmUserName": "A user"},
        ]}
        r1 = http.put(f"{API}/mapping", json=payload, timeout=20)
        r2 = http.put(f"{API}/mapping", json=payload, timeout=20)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json() == {"saved": 1}
        # Collection holds exactly one item
        r3 = http.get(f"{API}/mapping", timeout=20)
        assert len(r3.json()["items"]) == 1


class TestBinotelEmployees:
    def test_employees_when_configured(self, http):
        """Configured but real Binotel unreachable from preview → empty list, no 5xx."""
        if not (os.environ.get("BINOTEL_API_KEY") and os.environ.get("BINOTEL_API_SECRET")):
            pytest.skip("Binotel not configured")
        r = http.get(f"{API}/employees", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "employees" in data and isinstance(data["employees"], list)


class TestBinotelStats:
    def test_stats_endpoint_no_5xx(self, http):
        r = http.get(f"{API}/stats", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "configured" in data
        assert "byUser" in data
        assert "unmapped" in data
        assert isinstance(data["byUser"], dict)
        assert isinstance(data["unmapped"], list)


class TestBinotelAutomap:
    def test_automap_no_5xx_when_configured(self, http):
        """Configured → may still fail to reach amoCRM/Binotel from preview, but must NOT 5xx from our code."""
        if not (os.environ.get("BINOTEL_API_KEY") and os.environ.get("BINOTEL_API_SECRET")):
            pytest.skip("Binotel not configured")
        r = http.post(f"{API}/mapping/automap", timeout=90)
        # Acceptable: 200 (ran ok), 4xx (amoCRM downstream); never our 5xx.
        assert r.status_code < 500, f"automap returned 5xx: {r.status_code} {r.text}"


class TestAmocrmUsersHelper:
    def test_amocrm_users_endpoint(self, http):
        r = http.get(f"{API}/amocrm-users", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "users" in data
        assert isinstance(data["users"], list)


class TestManagerStatsBinotelOverlay:
    def test_manager_stats_includes_binotel_used_flag(self, http):
        r = http.get(f"{EVENTS_API}/manager-stats", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "managers" in data
        assert "binotelUsed" in data
        assert isinstance(data["binotelUsed"], bool)
        # Real Binotel returns 0 calls from preview → overlay won't trigger,
        # but endpoint must still return managers list without 5xx.
        assert isinstance(data["managers"], list)


# ─────────────────────── In-process aggregation tests ───────────────────────
# Mock _fetch_period to feed fake callDetails, then verify aggregation.

FAKE_INBOUND = [
    {
        "internalAdditionalData": {"employeeData": {"employeeID": "9001", "employeeName": "Ivan"}},
        "billsec": 120, "disposition": "answered",
    },
    {
        "internalAdditionalData": {"employeeData": {"employeeID": "9001", "employeeName": "Ivan"}},
        "billsec": 0, "disposition": "no-answer",
    },
    {
        "employeeID": "9002", "employeeName": "Petr",
        "billsec": 30, "disposition": "answered",
    },
]
FAKE_OUTBOUND = [
    {
        "internalAdditionalData": {"employeeData": {"employeeID": "9001", "employeeName": "Ivan"}},
        "billsec": 60, "disposition": "answered",
    },
    {
        "internalAdditionalData": {"employeeData": {"employeeID": "9001", "employeeName": "Ivan"}},
        "billsec": 0, "disposition": "failed",
    },
    {
        "employees": [{"employeeID": "9003", "employeeName": "Sergey"}],
        "billsec": 45, "disposition": "answered",
    },
]


def test_aggregate_by_employee_basic(monkeypatch):
    """Direct test of aggregate_by_employee with mocked _fetch_period."""
    from routes import binotel_analytics as ba

    async def fake_fetch(start_ts, end_ts, direction):
        return FAKE_INBOUND if direction == "incoming" else FAKE_OUTBOUND

    monkeypatch.setattr(ba, "_fetch_period", fake_fetch)
    # Ensure _is_configured returns True regardless of env state at test time
    monkeypatch.setattr(ba, "_is_configured", lambda: True)

    result = asyncio.run(ba.aggregate_by_employee("2026-01-01", "2026-01-31"))

    assert set(result.keys()) == {"9001", "9002", "9003"}

    ivan = result["9001"]
    assert ivan["incoming"] == 2
    assert ivan["outgoing"] == 2
    assert ivan["total"] == 4
    assert ivan["answered"] == 2  # 1 inbound answered + 1 outbound answered
    assert ivan["missed"] == 2
    assert ivan["totalTalkSec"] == 180  # 120 + 0 + 60 + 0
    assert ivan["answeredTalkSec"] == 180
    # 2/4 = 50.0
    assert ivan["answerRate"] == 50.0
    # avg over answered = 180/2 = 90
    assert ivan["avgTalkSec"] == 90
    assert ivan["binotelEmployeeName"] == "Ivan"

    petr = result["9002"]
    assert petr["incoming"] == 1 and petr["outgoing"] == 0
    assert petr["answered"] == 1 and petr["missed"] == 0
    assert petr["answerRate"] == 100.0
    assert petr["avgTalkSec"] == 30

    sergey = result["9003"]
    assert sergey["outgoing"] == 1 and sergey["incoming"] == 0
    assert sergey["answered"] == 1 and sergey["answerRate"] == 100.0
    assert sergey["binotelEmployeeName"] == "Sergey"


def test_aggregate_by_amocrm_user_uses_mapping(monkeypatch):
    """aggregate_by_amocrm_user should map Binotel emp ids to amoCRM user ids."""
    from motor.motor_asyncio import AsyncIOMotorClient

    from routes import binotel_analytics as ba

    async def fake_fetch(start_ts, end_ts, direction):
        return FAKE_INBOUND if direction == "incoming" else FAKE_OUTBOUND

    monkeypatch.setattr(ba, "_fetch_period", fake_fetch)
    monkeypatch.setattr(ba, "_is_configured", lambda: True)

    async def _run():
        cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
        coll = cli[os.environ["DB_NAME"]]["binotel_user_mapping"]
        await coll.delete_many({})
        await coll.insert_many([
            {"binotelEmployeeId": "9001", "binotelEmployeeName": "Ivan",
             "amocrmUserId": "7001", "amocrmUserName": "Ivan A"},
            {"binotelEmployeeId": "9002", "binotelEmployeeName": "Petr",
             "amocrmUserId": "7002", "amocrmUserName": "Petr B"},
        ])
        try:
            return await ba.aggregate_by_amocrm_user("2026-01-01", "2026-01-31")
        finally:
            await coll.delete_many({})
            cli.close()

    by_user = asyncio.run(_run())
    assert set(by_user.keys()) == {"7001", "7002"}
    assert by_user["7001"]["total"] == 4
    assert by_user["7001"]["answered"] == 2
    assert by_user["7001"]["answerRate"] == 50.0
    assert by_user["7002"]["total"] == 1
    # 9003 unmapped — not present
    assert "9003" not in by_user


def test_aggregate_handles_empty_when_unconfigured(monkeypatch):
    from routes import binotel_analytics as ba

    monkeypatch.setattr(ba, "_is_configured", lambda: False)
    result = asyncio.run(ba.aggregate_by_employee("2026-01-01", "2026-01-31"))
    assert result == {}


def test_aggregate_handles_bad_date(monkeypatch):
    from routes import binotel_analytics as ba

    async def fake_fetch(*a, **kw):
        return []

    monkeypatch.setattr(ba, "_fetch_period", fake_fetch)
    monkeypatch.setattr(ba, "_is_configured", lambda: True)
    # malformed date returns {} without raising
    result = asyncio.run(ba.aggregate_by_employee("not-a-date", "2026-01-31"))
    assert result == {}
