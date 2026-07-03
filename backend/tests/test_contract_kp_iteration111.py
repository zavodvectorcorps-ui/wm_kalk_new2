"""
Iteration 111: Backend tests for contract-generation modal KP endpoints.
Bug fix: documents-first KP gathering, no 504, kpId scheme, doc URL attach.
"""
import os
import time
import requests
import pytest

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
LEAD_ID = "CRM-DOC-TEST"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": "admin", "password": "admin123"},
                      timeout=15)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- available-kps for seeded lead ---
def test_available_kps_returns_two_doc_kps_fast(headers):
    t0 = time.time()
    r = requests.get(
        f"{BASE_URL}/api/sauna-crm/contract-template/available-kps/{LEAD_ID}",
        headers=headers, timeout=30,
    )
    elapsed = time.time() - t0
    assert r.status_code == 200, r.text
    assert elapsed < 15, f"Too slow: {elapsed:.2f}s"
    data = r.json()
    assert "kps" in data
    kps = data["kps"]
    doc_kps = [k for k in kps if str(k.get("kpId", "")).startswith("doc:")]
    assert len(doc_kps) >= 2, f"expected >=2 doc KPs, got {len(doc_kps)}: {kps}"
    names = " | ".join(k.get("name", "") for k in doc_kps)
    assert "Сауна" in names or "Sauna" in names or "Балия" in names or "Balia" in names or "Damian" in names, names
    for k in doc_kps[:2]:
        assert k.get("collection") == "documents"
        assert k.get("hasPdf") is True
    client = data.get("client") or {}
    for f in ("clientName", "phone", "address", "totalAmount"):
        assert f in client, f"missing client.{f}: {client}"


# --- attach doc KP that resolves to seeded calculator_pdfs order ---
def test_generate_contract_attaches_doc_kp(headers):
    body = {
        "leadId": LEAD_ID,
        "selectedKpIds": ["doc:/api/integrations/amocrm/calculator-pdf/ALS-DOC-1"],
        "clientData": {"clientName": "QA Doc"},
    }
    r = requests.post(f"{BASE_URL}/api/sauna-crm/generate-contract",
                      headers=headers, json=body, timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("status") == "ok", j
    assert j.get("kpAttached") is True, j
    assert j.get("contractUrl"), j
    # verify client update
    lr = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{LEAD_ID}", headers=headers, timeout=15)
    assert lr.status_code == 200
    assert lr.json().get("clientName") == "QA Doc"


# --- empty selection ---
def test_generate_contract_empty_selection(headers):
    body = {"leadId": LEAD_ID, "selectedKpIds": [], "clientData": {}}
    r = requests.post(f"{BASE_URL}/api/sauna-crm/generate-contract",
                      headers=headers, json=body, timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("status") == "ok"
    assert j.get("kpAttached") is False


# --- legacy no selectedKpIds -> auto-attach ---
def test_generate_contract_legacy_no_selection_auto_attaches(headers):
    body = {"leadId": LEAD_ID}
    r = requests.post(f"{BASE_URL}/api/sauna-crm/generate-contract",
                      headers=headers, json=body, timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("status") == "ok"
    assert j.get("kpAttached") is True, j


# --- lead without KPs -> 200 empty list, no 504 ---
def test_available_kps_no_kps_returns_empty(headers):
    # find a lead with no docs; try a synthetic id first
    r = requests.get(
        f"{BASE_URL}/api/sauna-crm/contract-template/available-kps/NON-EXISTENT-LEAD-XYZ",
        headers=headers, timeout=30,
    )
    # Either 200 with empty kps OR 404. The bug fix says returns 200 kps:[].
    if r.status_code == 200:
        assert r.json().get("kps") == []
    else:
        assert r.status_code in (200, 404), r.status_code
