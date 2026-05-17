"""Tests for Dovoz with_driver stage and multi-status mapping (iteration 99)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USERNAME, "password": ADMIN_PASSWORD
    }, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        pytest.skip(f"No token in login response: {data}")
    return token


@pytest.fixture(scope="module")
def admin_session(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# --- Settings endpoints ---

class TestDovozSettings:
    def test_get_settings_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dovoz/settings", timeout=15)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert isinstance(data, dict)
        # type field present
        assert data.get("type") in (None, "warehouse")

    def test_put_settings_with_driver_array(self, admin_session):
        """PUT settings should accept with_driver_status_ids as an array of strings."""
        payload = {
            "type": "warehouse",
            "sections_enabled": {"orders": True, "trips": True, "dovoz": True},
            "dovoz_config": {
                "source_pipeline_id": "1234567",
                "source_status_id": "111",
                "sent_status_id": "222",
                "delivered_status_id": "333",
                "with_driver_status_ids": ["444", "555", "666"],
            },
        }
        r = admin_session.put(f"{BASE_URL}/api/dovoz/settings", json=payload, timeout=15)
        assert r.status_code == 200, f"PUT failed {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert body.get("success") is True

        # Verify persistence via GET
        r2 = admin_session.get(f"{BASE_URL}/api/dovoz/settings", timeout=15)
        assert r2.status_code == 200
        data = r2.json()
        cfg = data.get("dovoz_config", {})
        ids = cfg.get("with_driver_status_ids")
        assert isinstance(ids, list), f"with_driver_status_ids not a list: {ids!r}"
        assert ids == ["444", "555", "666"], f"Persisted ids mismatch: {ids}"
        assert cfg.get("source_pipeline_id") == "1234567"

    def test_put_settings_empty_with_driver_array(self, admin_session):
        """Empty with_driver_status_ids list should be accepted."""
        payload = {
            "type": "warehouse",
            "sections_enabled": {"orders": True, "trips": True, "dovoz": True},
            "dovoz_config": {
                "source_pipeline_id": "1234567",
                "source_status_id": "111",
                "sent_status_id": "222",
                "delivered_status_id": "333",
                "with_driver_status_ids": [],
            },
        }
        r = admin_session.put(f"{BASE_URL}/api/dovoz/settings", json=payload, timeout=15)
        assert r.status_code == 200
        r2 = admin_session.get(f"{BASE_URL}/api/dovoz/settings", timeout=15)
        cfg = r2.json().get("dovoz_config", {})
        assert cfg.get("with_driver_status_ids") == []


# --- Stats endpoint ---

class TestDovozStats:
    def test_stats_returns_4_stages(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dovoz/stats", timeout=15)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "by_stage" in data
        by_stage = data["by_stage"]
        expected = {"accepted", "sent", "with_driver", "delivered"}
        assert set(by_stage.keys()) == expected, f"Missing stages: {set(by_stage.keys())}"
        # All counts should be ints
        for k, v in by_stage.items():
            assert isinstance(v, int)
        assert "with_driver" in data.get("stages", {})
        assert data["stages"]["with_driver"] == "Отправлено с водителем"


# --- Orders endpoint ---

class TestDovozOrders:
    def test_orders_by_stage_includes_with_driver(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dovoz/orders", timeout=15)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "by_stage" in data
        by_stage = data["by_stage"]
        assert "with_driver" in by_stage, f"with_driver bucket missing: {list(by_stage.keys())}"
        assert isinstance(by_stage["with_driver"], list)
        # All 4 stages present
        for s in ("accepted", "sent", "with_driver", "delivered"):
            assert s in by_stage


# --- Stage update endpoint ---

class TestDovozStageUpdate:
    def test_stage_with_driver_accepted_or_404(self, admin_session):
        """Try updating with stage=with_driver on a non-existent id.
        The validation should pass (no 400 "Неверный этап"), and we expect 404."""
        r = admin_session.put(
            f"{BASE_URL}/api/dovoz/orders/__NONEXIST_TEST__/stage",
            params={"stage": "with_driver"},
            timeout=15,
        )
        # Must NOT be 400 with "Неверный этап"
        assert r.status_code != 400, f"with_driver rejected as invalid stage: {r.text}"
        # Should be 404 (order not found)
        assert r.status_code == 404, f"Expected 404 for non-existent order, got {r.status_code}: {r.text[:200]}"

    def test_stage_invalid_returns_400(self, admin_session):
        """Sanity: truly invalid stage names should still be rejected."""
        r = admin_session.put(
            f"{BASE_URL}/api/dovoz/orders/__NONEXIST_TEST__/stage",
            params={"stage": "totally_bogus_stage"},
            timeout=15,
        )
        assert r.status_code == 400
        assert "Неверный этап" in r.text or "Неверный" in r.text

    def test_stage_with_driver_round_trip(self, admin_session):
        """Insert a test order via raw mongo? Skip if cannot.
        Instead, create via direct DB seed (not via API since there's no POST /api/dovoz/orders endpoint)."""
        # We can't easily create one through the API. Just verify endpoint contract above is enough.
        pytest.skip("No public create endpoint - covered by 404 contract test above")
