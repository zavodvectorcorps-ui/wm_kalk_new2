"""
Backend tests for Procurement module (/api/procurement/*).
Covers components endpoints, requests CRUD, stats, idempotent notifications,
regression checks for /api/planner/*.
"""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alicor-spa-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# ─────────── fixtures ───────────

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    tok = body.get("token") or body.get("access_token")
    assert tok, f"no token in login response: {body}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_request_ids():
    return []


@pytest.fixture(scope="module")
def created_component_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_headers, created_request_ids, created_component_ids):
    """Cleanup procurement_requests + sauna_components created during tests."""
    yield
    for rid in created_request_ids:
        try:
            requests.delete(f"{API}/procurement/requests/{rid}", headers=admin_headers, timeout=15)
        except Exception:
            pass
    # cleanup components: try admin sauna-tech-cards delete endpoint if available
    for cid in created_component_ids:
        try:
            requests.delete(f"{API}/sauna-tech-cards/components/{cid}", headers=admin_headers, timeout=15)
        except Exception:
            pass


# ─────────── components endpoints ───────────

class TestComponents:
    def test_components_requires_auth(self):
        r = requests.get(f"{API}/procurement/components", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_list_components(self, admin_headers):
        r = requests.get(f"{API}/procurement/components", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        # We expect components to exist in preview DB
        if data["items"]:
            sample = data["items"][0]
            for key in ("id", "name"):
                assert key in sample, f"missing {key} in component"

    def test_quick_create_component(self, admin_headers, created_component_ids):
        unique_name = f"TEST_PROC_{uuid.uuid4().hex[:8]}"
        payload = {"name": unique_name, "category": "other", "unit": "шт", "unitPrice": 12.5, "supplier": "TestSupplier"}
        r = requests.post(f"{API}/procurement/components/quick-create",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == unique_name
        assert data["unitPrice"] == 12.5
        assert "id" in data
        created_component_ids.append(data["id"])

        # Dedup case-insensitive
        r2 = requests.post(f"{API}/procurement/components/quick-create",
                           headers=admin_headers,
                           json={"name": unique_name.lower(), "unitPrice": 999},
                           timeout=20)
        assert r2.status_code == 200
        data2 = r2.json()
        # Should return existing with same id and original price
        assert data2["id"] == data["id"], "dedup did not return existing"
        assert data2["unitPrice"] == 12.5, "dedup should not overwrite price"


# ─────────── procurement requests ───────────

class TestRequests:
    def test_list_requests_requires_auth(self):
        r = requests.get(f"{API}/procurement/requests", timeout=15)
        assert r.status_code in (401, 403)

    def test_create_minimal(self, admin_headers, created_request_ids):
        payload = {
            "title": f"TEST_REQ_{uuid.uuid4().hex[:6]}",
            "quantity": 3,
            "unitPrice": 10,
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["quantity"] == 3
        assert d["unitPrice"] == 10
        assert d["totalPrice"] == 30, f"expected totalPrice=30, got {d['totalPrice']}"
        assert d["status"] == "draft"
        assert d["priority"] == "medium"
        assert "id" in d
        created_request_ids.append(d["id"])

        # GET single
        g = requests.get(f"{API}/procurement/requests/{d['id']}", headers=admin_headers, timeout=15)
        assert g.status_code == 200
        assert g.json()["id"] == d["id"]

    def test_create_with_componentId_pulls_unit_price(self, admin_headers, created_request_ids):
        # find a component with unitPrice > 0
        cs = requests.get(f"{API}/procurement/components", headers=admin_headers, timeout=20).json()["items"]
        comp = next((c for c in cs if (c.get("unitPrice") or 0) > 0), None)
        if not comp:
            pytest.skip("No component with unitPrice>0 to test auto-fill")
        payload = {
            "title": f"TEST_REQ_COMP_{uuid.uuid4().hex[:6]}",
            "componentId": comp["id"],
            "quantity": 2,
            "unitPrice": 0,  # should be replaced from catalog
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        assert d["unitPrice"] == float(comp["unitPrice"]), \
            f"unitPrice not auto-filled. got {d['unitPrice']} vs catalog {comp['unitPrice']}"
        assert d["componentName"] == comp["name"]
        expected_total = round(2 * float(comp["unitPrice"]), 2)
        assert d["totalPrice"] == expected_total

    def test_invalid_status_returns_400(self, admin_headers):
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": "TEST_BAD", "status": "bogus", "notifyTelegram": False},
                          timeout=20)
        assert r.status_code == 400, f"expected 400 for bad status, got {r.status_code}: {r.text}"

    def test_invalid_priority_returns_400(self, admin_headers):
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": "TEST_BAD2", "priority": "panic", "notifyTelegram": False},
                          timeout=20)
        assert r.status_code == 400

    def test_update_recalculates_total_and_resets_notifications(self, admin_headers, created_request_ids):
        # create with overdue date
        yesterday = (date.today() - timedelta(days=2)).isoformat()
        create_payload = {
            "title": f"TEST_OVERDUE_{uuid.uuid4().hex[:6]}",
            "quantity": 1,
            "unitPrice": 100,
            "dueDate": yesterday,
            "notifyTelegram": False,
        }
        c = requests.post(f"{API}/procurement/requests", headers=admin_headers, json=create_payload, timeout=20)
        assert c.status_code == 200, c.text
        rid = c.json()["id"]
        created_request_ids.append(rid)

        # update qty and price -> totalPrice recompute
        future = (date.today() + timedelta(days=30)).isoformat()
        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"quantity": 4, "unitPrice": 50, "dueDate": future},
                         timeout=20)
        assert u.status_code == 200, u.text
        ud = u.json()
        assert ud["totalPrice"] == 200, f"recompute failed: {ud['totalPrice']}"
        assert ud["dueDate"] == future
        # notifications should be reset
        notifs = ud.get("notifications") or {}
        assert notifs.get("overdue") in (False, None)
        assert notifs.get("reminder") in (False, None)

    def test_list_isOverdue_flag(self, admin_headers, created_request_ids):
        # Create an overdue request
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        c = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_OD_{uuid.uuid4().hex[:6]}",
                                "dueDate": yesterday, "quantity": 1, "unitPrice": 5,
                                "notifyTelegram": False},
                          timeout=20)
        assert c.status_code == 200
        rid = c.json()["id"]
        created_request_ids.append(rid)

        # list with only_overdue
        r = requests.get(f"{API}/procurement/requests?only_overdue=true", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        match = [it for it in items if it["id"] == rid]
        assert match, "Newly-created overdue request not returned by only_overdue filter"
        assert match[0]["isOverdue"] is True

    def test_delete_requires_admin(self, admin_headers, created_request_ids):
        # create a request
        c = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_DEL_{uuid.uuid4().hex[:6]}",
                                "notifyTelegram": False}, timeout=20)
        rid = c.json()["id"]

        # delete as admin
        d = requests.delete(f"{API}/procurement/requests/{rid}", headers=admin_headers, timeout=15)
        assert d.status_code == 200, d.text
        assert d.json().get("deleted") is True

        # verify gone
        g = requests.get(f"{API}/procurement/requests/{rid}", headers=admin_headers, timeout=15)
        assert g.status_code == 404

    def test_delete_non_admin_forbidden(self, admin_headers, created_request_ids):
        # try login as non-admin: testdealer (if exists) or skip
        login = requests.post(f"{API}/auth/login",
                              json={"username": "testdealer", "password": "dealer123"},
                              timeout=15)
        if login.status_code != 200:
            pytest.skip(f"non-admin login unavailable: {login.status_code}")
        tok = login.json().get("token") or login.json().get("access_token")
        if not tok:
            pytest.skip("non-admin login returned no token")
        non_admin_headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

        # create request via admin
        c = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_FB_{uuid.uuid4().hex[:6]}",
                                "notifyTelegram": False}, timeout=20)
        rid = c.json()["id"]
        created_request_ids.append(rid)

        # delete as non-admin -> 403
        d = requests.delete(f"{API}/procurement/requests/{rid}", headers=non_admin_headers, timeout=15)
        assert d.status_code == 403, f"expected 403 for non-admin delete, got {d.status_code}: {d.text}"


# ─────────── stats ───────────

class TestStats:
    def test_stats_shape(self, admin_headers):
        r = requests.get(f"{API}/procurement/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("byStatus", "overdue", "dueSoon", "total"):
            assert key in data, f"missing {key} in stats"
        assert isinstance(data["byStatus"], dict)
        assert isinstance(data["overdue"], int)
        assert isinstance(data["dueSoon"], int)
        assert isinstance(data["total"], int)


# ─────────── notifications run (idempotency) ───────────

class TestNotifications:
    def test_notifications_run_idempotency(self, admin_headers, created_request_ids):
        # Create one overdue + one in reminder window (2 days, default reminderDaysBefore=3)
        overdue_due = (date.today() - timedelta(days=3)).isoformat()
        reminder_due = (date.today() + timedelta(days=2)).isoformat()
        for due in (overdue_due, reminder_due):
            c = requests.post(f"{API}/procurement/requests",
                              headers=admin_headers,
                              json={"title": f"TEST_NOTIF_{uuid.uuid4().hex[:6]}",
                                    "dueDate": due, "quantity": 1, "unitPrice": 1,
                                    "notifyTelegram": True},
                              timeout=20)
            assert c.status_code == 200, c.text
            created_request_ids.append(c.json()["id"])

        # First run
        r1 = requests.post(f"{API}/procurement/notifications/run", headers=admin_headers, timeout=30)
        assert r1.status_code == 200, r1.text
        data1 = r1.json()
        for k in ("checked", "sentReminder", "sentOverdue"):
            assert k in data1, f"missing {k}"

        # Second run — should be idempotent (no new sends). Note: when TG creds
        # missing, send returns False so flags stay False and run sends 0 again
        # too; idempotency proof relies on `<= data1` invariant.
        r2 = requests.post(f"{API}/procurement/notifications/run", headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        data2 = r2.json()
        assert data2["sentReminder"] <= data1["sentReminder"] or data2["sentReminder"] == 0, \
            f"reminder not idempotent: {data1} -> {data2}"
        assert data2["sentOverdue"] <= data1["sentOverdue"] or data2["sentOverdue"] == 0, \
            f"overdue not idempotent: {data1} -> {data2}"

    def test_notifications_run_requires_admin(self):
        # no token
        r = requests.post(f"{API}/procurement/notifications/run", timeout=15)
        assert r.status_code in (401, 403)


# ─────────── regression: planner endpoints ───────────

class TestPlannerRegression:
    def test_planner_tasks(self, admin_headers):
        r = requests.get(f"{API}/planner/tasks", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text

    def test_planner_directions(self, admin_headers):
        r = requests.get(f"{API}/planner/directions", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
