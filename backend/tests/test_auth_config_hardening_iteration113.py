"""Auth regression tests after config.py security hardening (JWT_SECRET/ADMIN_PASSWORD fail-fast).

Modules covered:
- routes/auth.py  : POST /api/auth/login, GET /api/auth/me
- services/auth_service.py : create_token/verify_token
- routes/dealer.py : POST /api/dealer/auth/login, GET /api/dealer/auth/me
"""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")

ACCOUNTS = [
    ("admin", "admin123", "admin"),
    ("marketer", "marketer123", "marketer"),
    ("kladovshchik", "kladovshchik123", "storekeeper"),
]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(client, username, password):
    return client.post(f"{BASE_URL}/api/auth/login",
                       json={"username": username, "password": password}, timeout=45)


# --- MAIN APP LOGIN --------------------------------------------------------
@pytest.mark.parametrize("username,password,expected_role", ACCOUNTS)
def test_login_and_protected_access(client, username, password, expected_role):
    r = _login(client, username, password)
    assert r.status_code == 200, f"login failed for {username}: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert isinstance(token, str) and len(token) > 20, f"no token for {username}: {data}"
    user = data.get("user") or {}
    assert user.get("username") == username
    print(f"{username} role={user.get('role')} (expected ~{expected_role})")

    headers = {"Authorization": f"Bearer {token}"}
    me = client.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=45)
    assert me.status_code == 200, f"/api/auth/me rejected token for {username}: {me.status_code}"
    assert me.json().get("username") == username

    leads = client.get(f"{BASE_URL}/api/sauna-crm/leads", headers=headers, timeout=60)
    assert leads.status_code != 401, f"token rejected (401) on protected GET for {username}"
    assert leads.status_code in (200, 403), f"unexpected {leads.status_code} for {username}: {leads.text[:200]}"


# --- TOKEN VALIDITY -------------------------------------------------------
def test_token_reusable_across_requests(client):
    token = _login(client, "admin", "admin123").json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(3):
        r = client.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=45)
        assert r.status_code == 200


@pytest.mark.parametrize("bad", [
    "garbage.token.value",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIn0.invalidsig",
])
def test_tampered_token_rejected(client, bad):
    r = client.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {bad}"}, timeout=45)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_tampered_signature_of_valid_token_rejected(client):
    token = _login(client, "admin", "admin123").json()["token"]
    parts = token.split(".")
    tampered = ".".join(parts[:2] + ["AAAA" + parts[2][4:]])
    r = client.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tampered}"}, timeout=45)
    assert r.status_code == 401, f"tampered signature accepted! {r.status_code}"


def test_no_token_rejected(client):
    r = client.get(f"{BASE_URL}/api/auth/me", timeout=45)
    assert r.status_code in (401, 403), f"unauthenticated access got {r.status_code}"


# --- WRONG PASSWORD -------------------------------------------------------
def test_wrong_password_rejected(client):
    r = _login(client, "admin", "definitely-wrong-pass")
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_unknown_user_rejected(client):
    r = _login(client, "TEST_nonexistent_user_x", "whatever")
    assert r.status_code == 401


# --- DEALER PORTAL --------------------------------------------------------
def test_dealer_login_and_protected_access(client):
    r = client.post(f"{BASE_URL}/api/dealer/auth/login",
                    json={"username": "testdealer", "password": "dealer123"}, timeout=60)
    assert r.status_code == 200, f"dealer login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("token")
    assert isinstance(token, str) and len(token) > 20
    assert data.get("dealer", {}).get("username") == "testdealer"
    assert "_id" not in data.get("dealer", {}), "MongoDB _id leaked in dealer payload"
    assert "password" not in data.get("dealer", {})

    headers = {"Authorization": f"Bearer {token}"}
    me = client.get(f"{BASE_URL}/api/dealer/auth/me", headers=headers, timeout=45)
    assert me.status_code == 200, f"dealer token rejected: {me.status_code} {me.text[:200]}"
    assert me.json().get("username") == "testdealer"

    stats = client.get(f"{BASE_URL}/api/dealer/stats", headers=headers, timeout=60)
    assert stats.status_code == 200, f"/api/dealer/stats -> {stats.status_code}"


def test_dealer_wrong_password_rejected(client):
    r = client.post(f"{BASE_URL}/api/dealer/auth/login",
                    json={"username": "testdealer", "password": "wrong"}, timeout=45)
    assert r.status_code == 401


def test_dealer_endpoint_rejects_main_app_token(client):
    """Cross-token isolation: admin token should not pass dealer auth."""
    token = _login(client, "admin", "admin123").json()["token"]
    r = client.get(f"{BASE_URL}/api/dealer/auth/me",
                   headers={"Authorization": f"Bearer {token}"}, timeout=45)
    assert r.status_code in (401, 403), f"admin token accepted on dealer endpoint: {r.status_code}"


# --- CONFIG FAIL-FAST -----------------------------------------------------
def test_config_fails_fast_without_jwt_secret():
    import subprocess
    code = (
        "import os\n"
        "os.environ.pop('JWT_SECRET', None)\n"
        "import dotenv\n"
        "dotenv.load_dotenv = lambda *a, **k: None\n"
        "import config\n"
    )
    p = subprocess.run(["python", "-c", code], cwd="/app/backend",
                       capture_output=True, text=True, timeout=60)
    assert p.returncode != 0, "config imported successfully without JWT_SECRET"
    assert "JWT_SECRET is not set" in p.stderr, p.stderr[-500:]
