"""Iteration 102 — Bot filter + stale sync recovery for Manager Events Analytics.

Tests the two bug fixes in /app/backend/routes/manager_events_analytics.py:

1. GET /manager-stats filters out userIds present in lead_analytics_settings.botUserIds
   and (when managerUserIds is non-empty) restricts to that whitelist, then re-ranks
   the remaining managers starting from 1.

2. GET /sync-status auto-recovers a 'running' doc whose startedAt > 15 minutes ago
   (marks it 'error' both in the response and in the DB).

3. POST /sync auto-cancels any pre-existing 'running' sync before inserting the new doc.

4. POST /sync/cancel marks ALL running syncs as error and returns the cancel count.

Plus a regression check that iteration_100/101 live-calls + Binotel overlay still
returns 200 with a managers array.
"""
import os
import sys
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests

# Allow importing backend modules (for direct DB cleanup via Motor)
sys.path.insert(0, "/app/backend")
from database import db  # noqa: E402

# Read from frontend/.env since pytest doesn't inherit the React env automatically.
def _read_backend_url() -> str:
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if val:
        return val.rstrip("/")
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE_URL = _read_backend_url()
EVENTS = f"{BASE_URL}/api/lead-analytics/events"

# Sync IDs we create — all start with this prefix so cleanup is targeted.
TEST_SYNC_PREFIX = "TEST_ITER102_"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _seed(bot_ids, manager_ids, with_stale_sync=False, with_completed_sync=True):
    """Seed lead_analytics settings + sync doc + per-userId stats."""
    # 1. lead_analytics settings with bot + whitelist
    await db.lead_analytics_settings.update_one(
        {"type": "lead_analytics"},
        {"$set": {
            "type": "lead_analytics",
            "botUserIds": bot_ids,
            "managerUserIds": manager_ids,
            "_test_marker": "iter102",
        }},
        upsert=True,
    )

    sync_id = TEST_SYNC_PREFIX + datetime.now(timezone.utc).strftime("%H%M%S%f")

    if with_completed_sync:
        # 2. completed sync doc — needed for GET /manager-stats
        await db.event_analytics_sync.insert_one({
            "sync_id": sync_id,
            "status": "completed",
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "completedAt": datetime.now(timezone.utc).isoformat(),
            "date_from": None, "date_to": None,
            "_test": True,
        })

        # 3. event_manager_stats rows for several userIds (with descending scores
        #    so the original ranking is 100→201→200→101→0)
        rows = [
            ("100", "Bot Alpha", 95),
            ("101", "Bot Beta", 70),
            ("200", "Manager One", 80),
            ("201", "Manager Two", 90),
            ("0",   "Synthetic Bot", 50),
            ("300", "Stranger", 40),  # not in whitelist
        ]
        for uid, name, score in rows:
            await db.event_manager_stats.insert_one({
                "userId": uid, "userName": name, "sync_id": sync_id,
                "performanceScore": score, "rank": 0,
                "totalLeads": 5, "totalEvents": 10,
                "_test": True,
            })

    if with_stale_sync:
        stale_id = TEST_SYNC_PREFIX + "STALE_" + datetime.now(timezone.utc).strftime("%H%M%S%f")
        await db.event_analytics_sync.insert_one({
            "sync_id": stale_id,
            "status": "running",
            "startedAt": (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat(),
            "progress": "Загрузка событий…",
            "_test": True,
        })

    return sync_id


async def _cleanup():
    # Restore settings: remove our marker and reset bot/whitelist to empty so
    # other tests / runtime aren't affected.
    await db.lead_analytics_settings.update_one(
        {"type": "lead_analytics", "_test_marker": "iter102"},
        {"$unset": {"botUserIds": "", "managerUserIds": "", "_test_marker": ""}},
    )
    await db.event_analytics_sync.delete_many({"_test": True})
    await db.event_analytics_sync.delete_many({"sync_id": {"$regex": f"^{TEST_SYNC_PREFIX}"}})
    await db.event_manager_stats.delete_many({"_test": True})


@pytest.fixture(scope="module", autouse=True)
def cleanup_before_after(event_loop):
    event_loop.run_until_complete(_cleanup())
    yield
    event_loop.run_until_complete(_cleanup())


# ---------------------------------------------------------------------------
# Bot filter + whitelist + re-rank
# ---------------------------------------------------------------------------

class TestManagerStatsFiltering:
    """GET /manager-stats must drop bots, restrict to whitelist, and re-rank."""

    def test_bots_excluded_whitelist_applied_and_reranked(self, api_client, event_loop):
        event_loop.run_until_complete(_cleanup())
        event_loop.run_until_complete(
            _seed(bot_ids=["100", "101"], manager_ids=["200", "201"])
        )

        r = api_client.get(f"{EVENTS}/manager-stats")
        assert r.status_code == 200, r.text
        body = r.json()
        managers = body["managers"]

        uids = [m["userId"] for m in managers]
        # Only whitelisted, non-bot managers remain.
        assert set(uids) == {"200", "201"}, f"Unexpected userIds: {uids}"
        # Synthetic bot "0" and stranger "300" filtered too.
        assert "0" not in uids and "100" not in uids and "101" not in uids and "300" not in uids

        # Re-ranked sequentially from 1.
        ranks = [m["rank"] for m in managers]
        assert ranks == list(range(1, len(managers) + 1)), f"Ranks not sequential: {ranks}"
        # Both expected scores are present (order depends on stored rank, not score).
        scores = {m["performanceScore"] for m in managers}
        assert scores == {80, 90}, f"Unexpected score set: {scores}"

    def test_synthetic_bot_zero_always_excluded(self, api_client, event_loop):
        """Even with no botUserIds configured, userId '0' must be filtered."""
        event_loop.run_until_complete(_cleanup())
        event_loop.run_until_complete(
            _seed(bot_ids=[], manager_ids=[])  # no filter -> all should pass except "0"
        )

        r = api_client.get(f"{EVENTS}/manager-stats")
        assert r.status_code == 200
        uids = [m["userId"] for m in r.json()["managers"]]
        assert "0" not in uids, f"Synthetic bot '0' leaked: {uids}"
        # All others remain (no whitelist).
        assert {"100", "101", "200", "201", "300"}.issubset(set(uids))

    def test_empty_whitelist_keeps_everyone_except_bots(self, api_client, event_loop):
        event_loop.run_until_complete(_cleanup())
        event_loop.run_until_complete(
            _seed(bot_ids=["100"], manager_ids=[])
        )
        r = api_client.get(f"{EVENTS}/manager-stats")
        assert r.status_code == 200
        uids = [m["userId"] for m in r.json()["managers"]]
        assert "100" not in uids
        assert "0" not in uids
        # 101, 200, 201, 300 all kept
        assert {"101", "200", "201", "300"}.issubset(set(uids))


# ---------------------------------------------------------------------------
# Stale running sync auto-recovery
# ---------------------------------------------------------------------------

class TestSyncStatusAutoRecover:
    def test_stale_running_sync_is_marked_error(self, api_client, event_loop):
        event_loop.run_until_complete(_cleanup())
        event_loop.run_until_complete(
            _seed(bot_ids=[], manager_ids=[],
                  with_stale_sync=True, with_completed_sync=False)
        )

        r = api_client.get(f"{EVENTS}/sync-status")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "error", f"Expected status=error, got: {body}"
        assert "error" in body and body["error"], "Error message missing"

        # And the DB doc was actually updated (not just the response).
        async def _check():
            doc = await db.event_analytics_sync.find_one(
                {"sync_id": body["sync_id"]}, {"_id": 0}
            )
            return doc
        doc = event_loop.run_until_complete(_check())
        assert doc["status"] == "error", f"DB not updated: {doc}"
        assert "completedAt" in doc

    def test_fresh_running_sync_not_touched(self, api_client, event_loop):
        """A running doc only 1 min old must stay 'running'."""
        event_loop.run_until_complete(_cleanup())

        async def _seed_fresh():
            sid = TEST_SYNC_PREFIX + "FRESH"
            await db.event_analytics_sync.insert_one({
                "sync_id": sid, "status": "running",
                "startedAt": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
                "progress": "Загрузка…", "_test": True,
            })
            return sid

        sid = event_loop.run_until_complete(_seed_fresh())
        r = api_client.get(f"{EVENTS}/sync-status")
        assert r.status_code == 200
        body = r.json()
        assert body["sync_id"] == sid
        assert body["status"] == "running", f"Fresh sync wrongly marked: {body}"


# ---------------------------------------------------------------------------
# POST /sync auto-cancels existing running + POST /sync/cancel
# ---------------------------------------------------------------------------

class TestSyncStartAndCancel:
    def test_start_sync_auto_cancels_existing_running(self, api_client, event_loop):
        event_loop.run_until_complete(_cleanup())

        async def _seed_running():
            sid = TEST_SYNC_PREFIX + "OLD"
            await db.event_analytics_sync.insert_one({
                "sync_id": sid, "status": "running",
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "_test": True,
            })
            return sid

        old_sid = event_loop.run_until_complete(_seed_running())

        r = api_client.post(f"{EVENTS}/sync")
        # Don't fail on amoCRM not configured — we only care about the doc swap.
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "started"
        new_sid = body["sync_id"]
        assert new_sid != old_sid

        # Old doc should be marked error="Заменено новой синхронизацией"
        async def _check_old():
            d = await db.event_analytics_sync.find_one({"sync_id": old_sid}, {"_id": 0})
            return d
        old = event_loop.run_until_complete(_check_old())
        assert old is not None
        assert old["status"] == "error", f"Old sync not cancelled: {old}"
        assert "Заменено" in (old.get("error") or "")

        # New doc has progress='Запуск…'
        async def _check_new():
            d = await db.event_analytics_sync.find_one({"sync_id": new_sid}, {"_id": 0})
            return d
        new = event_loop.run_until_complete(_check_new())
        assert new is not None
        # New doc starts in running state with the initial progress label (it
        # may have already advanced to a later label if the background task is
        # fast enough — accept either).
        assert new["status"] in ("running", "error", "completed")
        assert "progress" in new

        # Cleanup the new doc + cancel any remaining background work for it.
        event_loop.run_until_complete(
            db.event_analytics_sync.update_many(
                {"sync_id": new_sid}, {"$set": {"_test": True}}
            )
        )

    def test_cancel_endpoint_marks_all_running_as_error(self, api_client, event_loop):
        event_loop.run_until_complete(_cleanup())

        async def _seed_two_running():
            for tag in ("A", "B"):
                await db.event_analytics_sync.insert_one({
                    "sync_id": TEST_SYNC_PREFIX + "CANCEL_" + tag,
                    "status": "running",
                    "startedAt": datetime.now(timezone.utc).isoformat(),
                    "_test": True,
                })

        event_loop.run_until_complete(_seed_two_running())

        r = api_client.post(f"{EVENTS}/sync/cancel")
        assert r.status_code == 200
        body = r.json()
        assert "cancelled" in body
        assert body["cancelled"] >= 2, f"Expected ≥2 cancelled, got {body}"

        async def _verify():
            docs = await db.event_analytics_sync.find(
                {"sync_id": {"$regex": f"^{TEST_SYNC_PREFIX}CANCEL_"}}, {"_id": 0}
            ).to_list(length=10)
            return docs

        docs = event_loop.run_until_complete(_verify())
        for d in docs:
            assert d["status"] == "error"
            assert "Отменено пользователем" in (d.get("error") or "")

    def test_cancel_endpoint_returns_zero_when_nothing_running(self, api_client, event_loop):
        # Ensure no running docs exist.
        event_loop.run_until_complete(_cleanup())
        r = api_client.post(f"{EVENTS}/sync/cancel")
        assert r.status_code == 200
        body = r.json()
        assert body == {"cancelled": 0} or body.get("cancelled") == 0


# ---------------------------------------------------------------------------
# Regression: previous iterations still work
# ---------------------------------------------------------------------------

class TestRegression:
    def test_manager_stats_returns_200_and_known_shape(self, api_client, event_loop):
        """Iteration 100/101 contract: managers array + binotelUsed flag."""
        event_loop.run_until_complete(_cleanup())
        event_loop.run_until_complete(
            _seed(bot_ids=[], manager_ids=[])
        )
        r = api_client.get(f"{EVENTS}/manager-stats")
        assert r.status_code == 200
        body = r.json()
        assert "managers" in body
        assert "sync_id" in body
        assert "binotelUsed" in body  # added in iter 101 — must still be present
        assert isinstance(body["managers"], list)

    def test_sync_status_endpoint_reachable(self, api_client):
        r = requests.get(f"{EVENTS}/sync-status")
        assert r.status_code == 200, r.text
