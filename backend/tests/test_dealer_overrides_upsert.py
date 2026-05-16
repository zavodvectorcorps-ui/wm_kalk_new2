"""Tests for POST /api/admin/dealers/{dealer_id}/overrides/upsert.

Run with REACT_APP_BACKEND_URL set to the preview URL.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
pytestmark = pytest.mark.skipif(not BASE, reason="REACT_APP_BACKEND_URL not set")


def _admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "admin123"}, timeout=10)
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_admin_token()}"}


@pytest.fixture(scope="module")
def dealer_id(admin_headers):
    # Create a throwaway dealer
    username = f"test_upsert_{uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{BASE}/api/admin/dealers",
        headers=admin_headers,
        json={"username": username, "password": "x12345678", "name": "TEST UPSERT"},
        timeout=10,
    )
    r.raise_for_status()
    did = r.json()["id"]
    yield did
    # Cleanup
    requests.delete(f"{BASE}/api/admin/dealers/{did}", headers=admin_headers, timeout=10)


def _list(dealer_id, admin_headers):
    r = requests.get(f"{BASE}/api/admin/dealers/{dealer_id}/overrides", headers=admin_headers, timeout=10)
    r.raise_for_status()
    return r.json()["overrides"]


def test_upsert_empty(admin_headers, dealer_id):
    r = requests.post(
        f"{BASE}/api/admin/dealers/{dealer_id}/overrides/upsert",
        headers=admin_headers, json={"overrides": []}, timeout=10,
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True, "upserted": 0, "modified": 0, "inserted": 0}


def test_upsert_inserts_new(admin_headers, dealer_id):
    r = requests.post(
        f"{BASE}/api/admin/dealers/{dealer_id}/overrides/upsert",
        headers=admin_headers,
        json={"overrides": [
            {"kind": "model", "modelId": "M1", "price": 100},
            {"kind": "option", "optionId": "O1", "price": 50},
        ]},
        timeout=10,
    )
    assert r.status_code == 200
    j = r.json()
    assert j["inserted"] == 2
    assert j["modified"] == 0
    assert j["upserted"] == 2
    items = _list(dealer_id, admin_headers)
    prices = {(it["kind"], it.get("modelId"), it.get("optionId")): it["price"] for it in items}
    assert prices[("model", "M1", None)] == 100
    assert prices[("option", None, "O1")] == 50


def test_upsert_modifies_existing(admin_headers, dealer_id):
    requests.post(
        f"{BASE}/api/admin/dealers/{dealer_id}/overrides/upsert",
        headers=admin_headers,
        json={"overrides": [{"kind": "model", "modelId": "M1", "price": 200}]},
        timeout=10,
    ).raise_for_status()
    items = _list(dealer_id, admin_headers)
    m1 = next(it for it in items if it["kind"] == "model" and it["modelId"] == "M1")
    assert m1["price"] == 200


def test_upsert_does_not_wipe_other_overrides(admin_headers, dealer_id):
    # M1 + O1 already exist from previous tests. Upsert only M1 with a new value.
    requests.post(
        f"{BASE}/api/admin/dealers/{dealer_id}/overrides/upsert",
        headers=admin_headers,
        json={"overrides": [{"kind": "model", "modelId": "M1", "price": 300}]},
        timeout=10,
    ).raise_for_status()
    items = _list(dealer_id, admin_headers)
    kinds = sorted([(it["kind"], it.get("modelId"), it.get("optionId")) for it in items])
    # O1 must still be there
    assert ("option", None, "O1") in kinds
    assert ("model", "M1", None) in kinds


def test_upsert_invalid_kind(admin_headers, dealer_id):
    r = requests.post(
        f"{BASE}/api/admin/dealers/{dealer_id}/overrides/upsert",
        headers=admin_headers,
        json={"overrides": [{"kind": "garbage", "price": 1}]},
        timeout=10,
    )
    assert r.status_code == 400


def test_upsert_unknown_dealer(admin_headers):
    r = requests.post(
        f"{BASE}/api/admin/dealers/__nope__/overrides/upsert",
        headers=admin_headers,
        json={"overrides": [{"kind": "model", "modelId": "X", "price": 1}]},
        timeout=10,
    )
    assert r.status_code == 404


def test_upsert_requires_auth(dealer_id):
    r = requests.post(
        f"{BASE}/api/admin/dealers/{dealer_id}/overrides/upsert",
        json={"overrides": []}, timeout=10,
    )
    assert r.status_code in (401, 403)
