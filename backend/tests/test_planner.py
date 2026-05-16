"""Pytest suite for the Planner module: tasks/comments/checklist/history/dashboard/directions/filter-presets."""
import os
import uuid
import pytest
import requests
from pathlib import Path

# Load env from frontend/.env (REACT_APP_BACKEND_URL)
try:
    from dotenv import dotenv_values
    fenv = dotenv_values(Path("/app/frontend/.env"))
    if not os.environ.get("REACT_APP_BACKEND_URL") and fenv.get("REACT_APP_BACKEND_URL"):
        os.environ["REACT_APP_BACKEND_URL"] = fenv["REACT_APP_BACKEND_URL"]
except Exception:
    pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_user_id(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module")
def test_user(admin_headers):
    """Create a non-admin user to test planner-access value + perms."""
    uname = f"TEST_planneruser_{uuid.uuid4().hex[:6]}"
    payload = {"username": uname, "password": "Test1234!", "role": "employee", "access": ["planner"]}
    r = requests.post(f"{API}/users", headers=admin_headers, json=payload, timeout=10)
    assert r.status_code == 200, f"create user failed: {r.status_code} {r.text}"
    user = r.json()
    yield user
    # cleanup
    requests.delete(f"{API}/users/{user['id']}", headers=admin_headers, timeout=10)


@pytest.fixture
def task_factory(admin_headers):
    created = []

    def _make(**over):
        body = {"title": f"TEST_task_{uuid.uuid4().hex[:6]}", **over}
        r = requests.post(f"{API}/planner/tasks", headers=admin_headers, json=body, timeout=10)
        assert r.status_code == 200, f"create task failed: {r.status_code} {r.text}"
        t = r.json()
        created.append(t["id"])
        return t

    yield _make
    for tid in created:
        requests.delete(f"{API}/planner/tasks/{tid}", headers=admin_headers, timeout=10)


# ---------------- directions ----------------
class TestDirections:
    def test_list_directions_seeds_8(self, admin_headers):
        r = requests.get(f"{API}/planner/directions", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {x["id"] for x in items}
        assert {"sauna", "greenhouse", "wm_finance", "wm_kalkulator", "marketing", "it", "admin", "other"}.issubset(ids)
        assert len(items) >= 8

    def test_directions_admin_only_writes(self, admin_headers, test_user):
        # login as non-admin
        r = requests.post(f"{API}/auth/login", json={"username": test_user["username"], "password": "Test1234!"}, timeout=10)
        assert r.status_code == 200
        nonadmin_headers = {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/planner/directions", headers=nonadmin_headers, json={"name": "TEST_dir"}, timeout=10)
        assert r.status_code == 403

        # admin can add + delete
        r = requests.post(f"{API}/planner/directions", headers=admin_headers, json={"name": "TEST_dir_x"}, timeout=10)
        assert r.status_code == 200
        did = r.json()["id"]
        r = requests.delete(f"{API}/planner/directions/{did}", headers=admin_headers, timeout=10)
        assert r.status_code == 200


# ---------------- tasks ----------------
class TestTasksCRUD:
    def test_create_defaults_and_history(self, task_factory):
        t = task_factory()
        assert t["status"] == "planned"
        assert t["priority"] == "medium"
        assert t["businessDirection"] == "other"
        assert t["archived"] is False
        assert isinstance(t["history"], list) and len(t["history"]) >= 1
        assert t["history"][0]["action"] == "created"

    def test_create_invalid_status_400(self, admin_headers):
        r = requests.post(f"{API}/planner/tasks", headers=admin_headers,
                          json={"title": "TEST_bad_status", "status": "bogus"}, timeout=10)
        assert r.status_code == 400

    def test_create_empty_title_400(self, admin_headers):
        r = requests.post(f"{API}/planner/tasks", headers=admin_headers,
                          json={"title": "   "}, timeout=10)
        assert r.status_code == 400

    def test_update_status_history_and_completedAt(self, task_factory, admin_headers):
        t = task_factory()
        r = requests.put(f"{API}/planner/tasks/{t['id']}", headers=admin_headers,
                         json={"status": "done"}, timeout=10)
        assert r.status_code == 200
        upd = r.json()
        assert upd["status"] == "done"
        assert upd["completedAt"]  # non-empty
        assert any(h["action"] == "status" and h["newValue"] == "done" for h in upd["history"])

        # revert clears completedAt
        r = requests.put(f"{API}/planner/tasks/{t['id']}", headers=admin_headers,
                         json={"status": "in_progress"}, timeout=10)
        assert r.status_code == 200
        upd2 = r.json()
        assert upd2["status"] == "in_progress"
        assert upd2["completedAt"] == ""

    def test_update_multiple_fields_history(self, task_factory, admin_headers, admin_user_id):
        t = task_factory()
        r = requests.put(
            f"{API}/planner/tasks/{t['id']}", headers=admin_headers,
            json={"title": "TEST_new_title", "priority": "high", "businessDirection": "sauna",
                  "dueDate": "2026-01-15", "assigneeUserId": admin_user_id},
            timeout=10,
        )
        assert r.status_code == 200
        u = r.json()
        actions = {h["action"] for h in u["history"]}
        for a in ("title", "priority", "direction", "due_date", "assignee"):
            assert a in actions, f"missing history action {a}: {actions}"

    def test_update_invalid_status_400(self, task_factory, admin_headers):
        t = task_factory()
        r = requests.put(f"{API}/planner/tasks/{t['id']}", headers=admin_headers,
                         json={"status": "garbage"}, timeout=10)
        assert r.status_code == 400

    def test_delete_admin_only(self, admin_headers, test_user, task_factory):
        t = task_factory()
        # non-admin login
        r = requests.post(f"{API}/auth/login", json={"username": test_user["username"], "password": "Test1234!"}, timeout=10)
        nonadmin_headers = {"Authorization": f"Bearer {r.json()['token']}"}
        r = requests.delete(f"{API}/planner/tasks/{t['id']}", headers=nonadmin_headers, timeout=10)
        assert r.status_code == 403
        # admin can
        r = requests.delete(f"{API}/planner/tasks/{t['id']}", headers=admin_headers, timeout=10)
        assert r.status_code == 200


class TestTaskFilters:
    def test_filters(self, task_factory, admin_headers, admin_user_id):
        # seed tasks of various types
        t_ip = task_factory(status="in_progress", priority="high", businessDirection="sauna")
        t_done = task_factory(status="done", priority="low")
        t_overdue = task_factory(status="planned", priority="urgent", dueDate="2020-01-01")
        t_mine = task_factory(assigneeUserId=admin_user_id, status="planned")

        # status filter
        r = requests.get(f"{API}/planner/tasks?status=in_progress", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert t_ip["id"] in ids and t_done["id"] not in ids

        # priority filter
        r = requests.get(f"{API}/planner/tasks?priority=high", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert t_ip["id"] in ids

        # direction filter
        r = requests.get(f"{API}/planner/tasks?direction=sauna", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert t_ip["id"] in ids

        # overdue
        r = requests.get(f"{API}/planner/tasks?overdue=true", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert t_overdue["id"] in ids
        assert t_done["id"] not in ids

        # mine
        r = requests.get(f"{API}/planner/tasks?mine=true", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert t_mine["id"] in ids

        # assignee
        r = requests.get(f"{API}/planner/tasks?assignee={admin_user_id}", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert t_mine["id"] in ids

        # search by title
        r = requests.get(f"{API}/planner/tasks?search={t_ip['title']}", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert t_ip["id"] in ids

        # archived filter
        requests.put(f"{API}/planner/tasks/{t_done['id']}", headers=admin_headers, json={"archived": True}, timeout=10)
        r = requests.get(f"{API}/planner/tasks?archived=true", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert t_done["id"] in ids


# ---------------- comments ----------------
class TestComments:
    def test_add_edit_delete_comment(self, task_factory, admin_headers, admin_user_id, test_user):
        t = task_factory()
        r = requests.post(f"{API}/planner/tasks/{t['id']}/comments", headers=admin_headers,
                          json={"text": "TEST_first_comment"}, timeout=10)
        assert r.status_code == 200
        cid = r.json()["id"]
        # verify history
        r = requests.get(f"{API}/planner/tasks/{t['id']}", headers=admin_headers, timeout=10)
        actions = [h["action"] for h in r.json()["history"]]
        assert "comment" in actions

        # author edits (admin in this case)
        r = requests.put(f"{API}/planner/tasks/{t['id']}/comments/{cid}", headers=admin_headers,
                         json={"text": "TEST_edited"}, timeout=10)
        assert r.status_code == 200
        r = requests.get(f"{API}/planner/tasks/{t['id']}", headers=admin_headers, timeout=10)
        c = next(x for x in r.json()["comments"] if x["id"] == cid)
        assert c["text"] == "TEST_edited"
        assert c.get("editedAt")

        # non-author non-admin cannot edit
        r = requests.post(f"{API}/auth/login", json={"username": test_user["username"], "password": "Test1234!"}, timeout=10)
        non_h = {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}
        r = requests.put(f"{API}/planner/tasks/{t['id']}/comments/{cid}", headers=non_h,
                         json={"text": "TEST_nope"}, timeout=10)
        assert r.status_code == 403
        r = requests.delete(f"{API}/planner/tasks/{t['id']}/comments/{cid}", headers=non_h, timeout=10)
        assert r.status_code == 403

        # admin delete
        r = requests.delete(f"{API}/planner/tasks/{t['id']}/comments/{cid}", headers=admin_headers, timeout=10)
        assert r.status_code == 200


# ---------------- checklist ----------------
class TestChecklist:
    def test_checklist_crud(self, task_factory, admin_headers):
        t = task_factory()
        r = requests.post(f"{API}/planner/tasks/{t['id']}/checklist", headers=admin_headers,
                          json={"text": "TEST_item1"}, timeout=10)
        assert r.status_code == 200
        item_id = r.json()["id"]

        r = requests.patch(f"{API}/planner/tasks/{t['id']}/checklist/{item_id}", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        r = requests.get(f"{API}/planner/tasks/{t['id']}", headers=admin_headers, timeout=10)
        it = next(i for i in r.json()["checklist"] if i["id"] == item_id)
        assert it["done"] is True
        assert it.get("doneByUsername") == "admin"
        assert it.get("doneAt")

        r = requests.delete(f"{API}/planner/tasks/{t['id']}/checklist/{item_id}", headers=admin_headers, timeout=10)
        assert r.status_code == 200


# ---------------- dashboard ----------------
class TestDashboard:
    def test_dashboard_shape(self, admin_headers):
        r = requests.get(f"{API}/planner/dashboard", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ["totalActive", "myActive", "overdue", "completed7d", "urgent", "byStatus", "byDirection", "byAssignee"]:
            assert k in d
        assert isinstance(d["byStatus"], dict)
        assert isinstance(d["byDirection"], dict)
        assert isinstance(d["byAssignee"], list)


# ---------------- filter presets ----------------
class TestFilterPresets:
    def test_preset_crud(self, admin_headers):
        r = requests.post(f"{API}/planner/filter-presets", headers=admin_headers,
                          json={"name": "TEST_preset", "filters": {"status": "in_progress"}, "shared": False}, timeout=10)
        assert r.status_code == 200
        pid = r.json()["id"]
        r = requests.get(f"{API}/planner/filter-presets", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in r.json()["items"]]
        assert pid in ids
        r = requests.delete(f"{API}/planner/filter-presets/{pid}", headers=admin_headers, timeout=10)
        assert r.status_code == 200


# ---------------- access value ----------------
class TestPlannerAccess:
    def test_planner_access_value_accepted(self, admin_headers):
        uname = f"TEST_pl_acc_{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{API}/users", headers=admin_headers,
                          json={"username": uname, "password": "Pa$$1234", "role": "employee", "access": ["planner"]},
                          timeout=10)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        uid = r.json()["id"]
        # update with planner too
        r = requests.put(f"{API}/users/{uid}", headers=admin_headers,
                         json={"access": ["planner", "balia"]}, timeout=10)
        assert r.status_code == 200
        requests.delete(f"{API}/users/{uid}", headers=admin_headers, timeout=10)
