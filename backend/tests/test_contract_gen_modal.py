"""Backend tests for Contract Generation Modal features:
- GET /api/sauna-crm/contract-template/available-kps/{lead_id}
- POST /api/sauna-crm/generate-contract with selectedOrderIds + clientData
- Empty selection case
- Legacy backward compatibility (no selectedOrderIds)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LEAD_ID = "CRM-TEST-NOPDF-276A"
KP_IDS = ["ALS-TEST-KP-1", "ALB-TEST-KP-1"]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


def test_available_kps(h):
    r = requests.get(
        f"{BASE_URL}/api/sauna-crm/contract-template/available-kps/{LEAD_ID}",
        headers=h, timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "client" in data and "kps" in data
    client = data["client"]
    for k in ("clientName", "phone", "email", "address", "totalAmount", "advancePayment"):
        assert k in client, f"client missing {k}"
    ids = {kp.get("orderId") for kp in data["kps"]}
    assert set(KP_IDS).issubset(ids), f"expected KPs missing. got={ids}"
    # Validate structure of one kp
    for kp in data["kps"]:
        for k in ("orderId", "collection", "label", "modelName", "total", "hasPdf"):
            assert k in kp, f"kp missing {k}"


def test_generate_contract_with_selection(h):
    payload = {
        "leadId": LEAD_ID,
        "selectedOrderIds": KP_IDS,
        "clientData": {
            "clientName": "QA Client",
            "phone": "+48111",
            "address": "ul QA 1",
        },
    }
    r = requests.post(f"{BASE_URL}/api/sauna-crm/generate-contract",
                      json=payload, headers=h, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "ok", data
    assert data.get("contractUrl"), "contractUrl missing"
    assert data.get("kpAttached") is True, data

    # Verify lead clientName updated
    r2 = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{LEAD_ID}", headers=h, timeout=30)
    assert r2.status_code == 200, r2.text
    lead = r2.json()
    assert lead.get("clientName") == "QA Client", lead


def test_generate_contract_empty_selection(h):
    payload = {
        "leadId": LEAD_ID,
        "selectedOrderIds": [],
        "clientData": None,
    }
    r = requests.post(f"{BASE_URL}/api/sauna-crm/generate-contract",
                      json=payload, headers=h, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "ok", data
    assert data.get("contractUrl"), "contractUrl missing"
    assert data.get("kpAttached") is False, f"expected kpAttached=False for empty, got {data}"


def test_generate_contract_legacy(h):
    """No selectedOrderIds -> auto-attach all KPs."""
    payload = {"leadId": LEAD_ID}
    r = requests.post(f"{BASE_URL}/api/sauna-crm/generate-contract",
                      json=payload, headers=h, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "ok", data
    assert data.get("kpAttached") is True, f"legacy path must auto-attach, got {data}"
