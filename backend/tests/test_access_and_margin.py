"""Backend tests for new access values (analytics/call_analytics/dealers)
and the margin field in dry-run import response."""
import io
import os
import pytest
import requests
import jwt as pyjwt
from openpyxl import Workbook

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return None
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text}"
    return r.json()["token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ----- Access value validation on POST /api/users -----

@pytest.mark.parametrize("access_value", [
    ["analytics"], ["call_analytics"], ["dealers"],
    ["analytics", "call_analytics", "dealers"],
    ["balia", "sauna", "logistics"],   # legacy still ok
])
def test_create_user_accepts_new_access_values(auth_headers, access_value):
    uname = f"TEST_acc_{'_'.join(access_value)[:30]}"
    # cleanup if exists
    users = requests.get(f"{BASE_URL}/api/users", headers=auth_headers).json()
    for u in users:
        if u["username"] == uname:
            requests.delete(f"{BASE_URL}/api/users/{u['id']}", headers=auth_headers)

    payload = {"username": uname, "password": "pw123456",
               "access": access_value, "role": "employee"}
    r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["access"] == access_value
    # cleanup
    requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=auth_headers)


# ----- Access value validation on PUT /api/users/{id} -----

@pytest.mark.parametrize("access_value", [
    ["analytics"], ["call_analytics"], ["dealers"],
    ["analytics", "call_analytics", "dealers"],
    ["call_analytics", "dealers", "sauna"],  # mix new + legacy
])
def test_update_user_accepts_new_access_values(auth_headers, access_value):
    uname = f"TEST_put_acc_{'_'.join(access_value)[:25]}"
    # create
    r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers,
                      json={"username": uname, "password": "pw123456",
                            "access": ["balia"], "role": "employee"})
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    try:
        # update with new access values
        r2 = requests.put(f"{BASE_URL}/api/users/{uid}", headers=auth_headers,
                          json={"access": access_value})
        assert r2.status_code == 200, f"PUT /users with access={access_value} failed: {r2.status_code} {r2.text}"
        # verify persisted
        r3 = requests.get(f"{BASE_URL}/api/users", headers=auth_headers).json()
        u = next((x for x in r3 if x["id"] == uid), None)
        assert u is not None and u["access"] == access_value
    finally:
        requests.delete(f"{BASE_URL}/api/users/{uid}", headers=auth_headers)


# ----- Invalid access value rejected with helpful error mentioning new values -----

def test_update_user_rejects_invalid_access_with_full_list(auth_headers):
    uname = "TEST_put_invalid_access"
    r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers,
                      json={"username": uname, "password": "pw123456",
                            "access": ["balia"], "role": "employee"})
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    try:
        r2 = requests.put(f"{BASE_URL}/api/users/{uid}", headers=auth_headers,
                          json={"access": ["invalid_key"]})
        assert r2.status_code == 400, f"Expected 400, got {r2.status_code}: {r2.text}"
        detail = r2.json().get("detail", "")
        # Must include the new valid keys in the error message
        for k in ("analytics", "call_analytics", "dealers"):
            assert k in detail, f"Error detail must mention '{k}': {detail}"
    finally:
        requests.delete(f"{BASE_URL}/api/users/{uid}", headers=auth_headers)


# ----- PUT role=marketer now accepted (was previously rejected) -----

def test_update_user_accepts_marketer_role(auth_headers):
    uname = "TEST_put_marketer_role"
    r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers,
                      json={"username": uname, "password": "pw123456",
                            "access": ["balia"], "role": "employee"})
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    try:
        r2 = requests.put(f"{BASE_URL}/api/users/{uid}", headers=auth_headers,
                          json={"role": "marketer"})
        assert r2.status_code == 200, f"PUT role=marketer failed: {r2.status_code} {r2.text}"
        assert r2.json()["role"] == "marketer"
        # verify persisted
        users = requests.get(f"{BASE_URL}/api/users", headers=auth_headers).json()
        u = next((x for x in users if x["id"] == uid), None)
        assert u is not None and u["role"] == "marketer"
    finally:
        requests.delete(f"{BASE_URL}/api/users/{uid}", headers=auth_headers)


# ----- E2E: create non-admin with access=['analytics'], login, decode JWT, verify claim -----

def test_e2e_analytics_user_jwt_contains_access_claim(auth_headers):
    uname = "TEST_e2e_analytics_user"
    pw = "pw123456"
    # cleanup any leftover
    users = requests.get(f"{BASE_URL}/api/users", headers=auth_headers).json()
    for u in users:
        if u["username"] == uname:
            requests.delete(f"{BASE_URL}/api/users/{u['id']}", headers=auth_headers)

    r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers,
                      json={"username": uname, "password": pw,
                            "access": ["analytics"], "role": "employee"})
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    try:
        # Login as new user
        r2 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"username": uname, "password": pw})
        assert r2.status_code == 200, f"Login failed: {r2.status_code} {r2.text}"
        data = r2.json()
        assert "token" in data
        assert data["user"]["access"] == ["analytics"]
        assert data["user"]["role"] == "employee"

        # Decode JWT WITHOUT verification (we only care about claims content)
        payload = pyjwt.decode(data["token"], options={"verify_signature": False})
        assert "access" in payload, f"JWT payload missing 'access' claim: {payload}"
        assert payload["access"] == ["analytics"], f"JWT access claim wrong: {payload['access']}"
        assert payload["username"] == uname
        assert payload["role"] == "employee"

        # /api/auth/me should also report access=['analytics']
        me = requests.get(f"{BASE_URL}/api/auth/me",
                          headers={"Authorization": f"Bearer {data['token']}"})
        assert me.status_code == 200, me.text
        assert me.json()["access"] == ["analytics"]
    finally:
        requests.delete(f"{BASE_URL}/api/users/{uid}", headers=auth_headers)


# ----- Dry-run margin + lowMargin detection -----

def _build_xlsx_with_low_margin_row():
    """Build minimal xlsx import file with one row that has price=13000, costPrice=12500
    (margin = 500, pct ≈ 3.85% → lowMargin)."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Prices"
    headers = ["type", "id", "parentId", "category", "name",
               "price", "costPrice", "description", "isActive", "imageUrl"]
    ws.append(headers)
    # Add new model with low margin
    ws.append(["model", "test_low_margin_model", "", "", "TEST low margin",
               13000, 12500, "", "TRUE", ""])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_dry_run_returns_margin_and_low_margin_flag(auth_headers):
    content = _build_xlsx_with_low_margin_row()
    files = {"file": ("low_margin.xlsx", content,
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r = requests.post(f"{BASE_URL}/api/sauna/prices/import/dry-run",
                      headers=auth_headers, files=files)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = r.json()
    assert "summary" in data
    summary = data["summary"]
    assert "marginAlerts" in summary, "summary must include marginAlerts counter"
    assert summary["marginAlerts"] >= 1, f"expected marginAlerts >=1, got {summary}"
    # Find our row
    rows = data["rows"]
    target = next((r for r in rows if r.get("id") == "test_low_margin_model"), None)
    assert target is not None, f"Test row not found in rows: {[r.get('id') for r in rows]}"
    assert "margin" in target, "row must include margin object"
    m = target["margin"]
    assert m["newAmount"] == 500
    assert m["newPct"] is not None and m["newPct"] < 15.0
    assert target.get("lowMargin") is True
    assert target.get("marginThreshold") == 15.0
    assert target["status"] == "added"


def test_dry_run_unchanged_row_no_low_margin_flag(auth_headers):
    """A row that is unchanged should not be flagged lowMargin (only added/modified)."""
    # Export current prices first
    r = requests.get(f"{BASE_URL}/api/sauna/prices/export?format=xlsx",
                     headers=auth_headers)
    assert r.status_code == 200
    # Re-upload unmodified — all rows unchanged
    files = {"file": ("roundtrip.xlsx", r.content,
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r2 = requests.post(f"{BASE_URL}/api/sauna/prices/import/dry-run",
                       headers=auth_headers, files=files)
    assert r2.status_code == 200, r2.text[:500]
    data = r2.json()
    # marginAlerts should be 0 since nothing is added/modified
    assert data["summary"].get("marginAlerts", 0) == 0
    # Every row should have margin object
    for row in data["rows"][:5]:
        assert "margin" in row
