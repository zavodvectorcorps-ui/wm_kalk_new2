"""Tests for iteration 98 — auto-apply markup preset on first dealer login (onboarding).

Covers:
- POST /api/admin/dealers accepts defaultMarkupPercent/Base/Scope; echoes them + onboardedAt=null
- POST /api/dealer/auth/login — first login applies markup and stamps onboardedAt
- Second login returns onboardingApplied=null and does NOT change onboardedAt
- PUT /api/admin/dealers/{id} resetOnboarding=true clears onboardedAt → next login re-applies
- PUT can change defaultMarkup* fields independently
- Edge cases: invalid base/scope coerced to wm/all; no defaultMarkupPercent → onboardingApplied null
- Cleanup via hard-delete
"""
import os
import time
import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    # Fallback: parse frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE_URL = _load_backend_url()
API = BASE_URL + "/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _create_dealer(admin_headers, **overrides):
    suffix = str(int(time.time() * 1000))[-7:]
    body = {
        "username": f"test_ob_{suffix}",
        "password": "ob_pass123",
        "name": f"TEST_Onboarding {suffix}",
        "email": "",
        "phone": "",
        "notes": "",
        "orderPrefix": "",
    }
    body.update(overrides)
    r = requests.post(f"{API}/admin/dealers", json=body, headers=admin_headers, timeout=15)
    assert r.status_code in (200, 201), f"create dealer failed: {r.status_code} {r.text}"
    return r.json(), body


def _hard_delete(admin_headers, dealer_id):
    try:
        requests.delete(
            f"{API}/admin/dealers/{dealer_id}/hard-delete",
            params={"delete_confirmed": "true"},
            headers=admin_headers,
            timeout=15,
        )
    except Exception:
        pass


# ----- POST /api/admin/dealers echoes onboarding fields ---------------------
def test_create_dealer_echoes_default_markup_fields(admin_headers):
    dealer, body = _create_dealer(
        admin_headers,
        defaultMarkupPercent=12.5,
        defaultMarkupBase="wm",
        defaultMarkupScope="all",
    )
    try:
        assert dealer["username"] == body["username"]
        assert dealer.get("defaultMarkupPercent") == 12.5
        assert dealer.get("defaultMarkupBase") == "wm"
        assert dealer.get("defaultMarkupScope") == "all"
        assert dealer.get("onboardedAt") in (None, "")
        assert "password" not in dealer  # never echo hash
    finally:
        _hard_delete(admin_headers, dealer["id"])


# ----- First login applies markup; second login is a no-op -----------------
def test_first_login_applies_onboarding_and_stamps(admin_headers):
    dealer, body = _create_dealer(
        admin_headers,
        defaultMarkupPercent=15,
        defaultMarkupBase="wm",
        defaultMarkupScope="all",
    )
    try:
        # First login
        r1 = requests.post(f"{API}/dealer/auth/login",
                           json={"username": body["username"], "password": body["password"]},
                           timeout=20)
        assert r1.status_code == 200, r1.text
        j1 = r1.json()
        assert j1.get("token")
        ob = j1.get("onboardingApplied")
        assert ob is not None, f"expected onboardingApplied on first login, got {j1}"
        assert ob["percent"] == 15
        assert ob["base"] == "wm"
        assert ob["scope"] == "all"
        assert isinstance(ob.get("touched"), int) and ob["touched"] >= 0
        # onboardedAt must now be set on dealer doc returned in login
        assert j1["dealer"].get("onboardedAt"), "onboardedAt should be stamped after first login"
        first_stamp = j1["dealer"]["onboardedAt"]

        # Second login — must be a no-op
        r2 = requests.post(f"{API}/dealer/auth/login",
                           json={"username": body["username"], "password": body["password"]},
                           timeout=20)
        assert r2.status_code == 200
        j2 = r2.json()
        assert j2.get("onboardingApplied") is None, f"second login should not re-apply: {j2.get('onboardingApplied')}"
        assert j2["dealer"].get("onboardedAt") == first_stamp, "timestamp should be unchanged"
    finally:
        _hard_delete(admin_headers, dealer["id"])


# ----- PUT resetOnboarding=true re-triggers onboarding ---------------------
def test_reset_onboarding_via_put(admin_headers):
    dealer, body = _create_dealer(
        admin_headers,
        defaultMarkupPercent=10,
        defaultMarkupBase="wm",
        defaultMarkupScope="all",
    )
    try:
        # First login → stamps
        r1 = requests.post(f"{API}/dealer/auth/login",
                           json={"username": body["username"], "password": body["password"]},
                           timeout=20)
        assert r1.status_code == 200
        assert r1.json().get("onboardingApplied") is not None

        # PUT resetOnboarding=true
        rp = requests.put(f"{API}/admin/dealers/{dealer['id']}",
                          json={"resetOnboarding": True},
                          headers=admin_headers, timeout=15)
        assert rp.status_code == 200, rp.text
        updated = rp.json()
        assert updated.get("onboardedAt") in (None, ""), f"onboardedAt must be cleared: {updated.get('onboardedAt')}"

        # Next login re-applies
        r2 = requests.post(f"{API}/dealer/auth/login",
                           json={"username": body["username"], "password": body["password"]},
                           timeout=20)
        assert r2.status_code == 200
        ob = r2.json().get("onboardingApplied")
        assert ob is not None, "onboarding must re-trigger after reset"
        assert ob["percent"] == 10
    finally:
        _hard_delete(admin_headers, dealer["id"])


# ----- PUT can change defaultMarkup* fields independently ------------------
def test_put_updates_default_markup_fields(admin_headers):
    dealer, _body = _create_dealer(admin_headers)  # no markup configured initially
    try:
        rp = requests.put(f"{API}/admin/dealers/{dealer['id']}",
                          json={"defaultMarkupPercent": 7.5,
                                "defaultMarkupBase": "b2b",
                                "defaultMarkupScope": "models"},
                          headers=admin_headers, timeout=15)
        assert rp.status_code == 200, rp.text
        updated = rp.json()
        assert updated["defaultMarkupPercent"] == 7.5
        assert updated["defaultMarkupBase"] == "b2b"
        assert updated["defaultMarkupScope"] == "models"
    finally:
        _hard_delete(admin_headers, dealer["id"])


# ----- Edge: invalid base/scope coerced to safe defaults; login still 200 --
def test_invalid_base_scope_coerced_to_defaults(admin_headers):
    dealer, body = _create_dealer(
        admin_headers,
        defaultMarkupPercent=5,
        defaultMarkupBase="garbage",
        defaultMarkupScope="nonsense",
    )
    try:
        r = requests.post(f"{API}/dealer/auth/login",
                          json={"username": body["username"], "password": body["password"]},
                          timeout=20)
        assert r.status_code == 200, r.text
        ob = r.json().get("onboardingApplied")
        assert ob is not None, "onboarding should still fire with coerced safe defaults"
        assert ob["base"] == "wm"
        assert ob["scope"] == "all"
        assert ob["percent"] == 5
    finally:
        _hard_delete(admin_headers, dealer["id"])


# ----- Edge: no defaultMarkupPercent → onboardingApplied stays null --------
def test_no_default_markup_means_no_onboarding(admin_headers):
    dealer, body = _create_dealer(admin_headers)  # no markup
    try:
        r = requests.post(f"{API}/dealer/auth/login",
                          json={"username": body["username"], "password": body["password"]},
                          timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("onboardingApplied") is None
        # onboardedAt should remain unset
        assert j["dealer"].get("onboardedAt") in (None, "")
    finally:
        _hard_delete(admin_headers, dealer["id"])


# ----- Edge: b2b base with no B2B prices → touched=0 but still stamps -----
def test_b2b_base_no_b2b_prices_touched_zero(admin_headers):
    dealer, body = _create_dealer(
        admin_headers,
        defaultMarkupPercent=20,
        defaultMarkupBase="b2b",
        defaultMarkupScope="all",
    )
    try:
        r = requests.post(f"{API}/dealer/auth/login",
                          json={"username": body["username"], "password": body["password"]},
                          timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        ob = j.get("onboardingApplied")
        assert ob is not None
        assert ob["touched"] == 0, f"b2b base with no B2B overrides should touch 0 rows, got {ob['touched']}"
        # onboardedAt still gets stamped to prevent repeated retries
        assert j["dealer"].get("onboardedAt")
    finally:
        _hard_delete(admin_headers, dealer["id"])
