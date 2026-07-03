"""Backend tests for the new Upload KP endpoint in contract modal (iteration 112)."""
import os
import io
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://alicor-spa-preview.preview.emergentagent.com").rstrip("/")
LEAD_ID = "CRM-UP-TEST"

MIN_PDF = (
    b"%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
    b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
    b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>endobj\n"
    b"xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000110 00000 n\n"
    b"trailer<< /Size 4 /Root 1 0 R >>\nstartxref\n170\n%%EOF"
)


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def test_upload_kp_success_and_available_list(s):
    files = {"file": (f"test_kp_{uuid.uuid4().hex[:6]}.pdf", MIN_PDF, "application/pdf")}
    r = s.post(f"{BASE_URL}/api/sauna-crm/contract-template/upload-kp/{LEAD_ID}", files=files, timeout=30)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("status") == "ok"
    kp = body.get("kp") or {}
    assert kp.get("kind") == "document"
    assert kp.get("hasPdf") is True
    kp_id = kp.get("kpId", "")
    assert kp_id.startswith("doc:/api/integrations/amocrm/calculator-pdf/KPU-"), kp_id

    # available-kps must contain it
    r2 = s.get(f"{BASE_URL}/api/sauna-crm/contract-template/available-kps/{LEAD_ID}", timeout=15)
    assert r2.status_code == 200
    kps = r2.json().get("kps", [])
    ids = [k.get("kpId") for k in kps]
    assert kp_id in ids, f"uploaded kpId {kp_id} not found in available-kps: {ids}"

    # Save for attach test
    pytest.uploaded_kp_id = kp_id


def test_upload_kp_non_pdf_returns_400(s):
    files = {"file": ("bad.txt", b"hello world", "text/plain")}
    r = s.post(f"{BASE_URL}/api/sauna-crm/contract-template/upload-kp/{LEAD_ID}", files=files, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


def test_upload_kp_nonexistent_lead_returns_404(s):
    files = {"file": ("x.pdf", MIN_PDF, "application/pdf")}
    r = s.post(f"{BASE_URL}/api/sauna-crm/contract-template/upload-kp/NO-SUCH-LEAD-XYZ", files=files, timeout=15)
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"


def test_generate_contract_with_uploaded_kp(s):
    kp_id = getattr(pytest, "uploaded_kp_id", None)
    assert kp_id, "no uploaded kpId from previous test"
    payload = {"leadId": LEAD_ID, "selectedKpIds": [kp_id]}
    r = s.post(f"{BASE_URL}/api/sauna-crm/generate-contract", json=payload, timeout=60)
    assert r.status_code == 200, f"generate-contract failed: {r.status_code} {r.text[:400]}"
    body = r.json()
    assert body.get("status") == "ok", body
    assert body.get("kpAttached") is True, f"kpAttached not true: {body}"
