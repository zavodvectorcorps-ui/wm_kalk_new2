"""Iteration 126 - Bug: duplicate KP/orders per amocrm_id; must pick the LATEST order/PDF.

Covers:
- routes/sauna_crm.py get_linked_calculator_order fallback by amocrm_id (sort createdAt desc)
- routes/sauna_crm.py link_calculator_order (order sort createdAt desc, pdf sort created_at desc)
- Regression: lead with a single order still links correctly
"""
import os
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME")


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module")
def db():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- seeded duplicate scenario ----------

def test_seeded_duplicates_present(db):
    orders = run(db.sauna_orders.find({"amocrm_id": "KPDUP_TEST_1"}, {"_id": 0}).to_list(10))
    ids = sorted(o["id"] for o in orders)
    assert ids == ["ORD-NEW", "ORD-OLD"], f"expected two seeded orders, got {ids}"
    pdfs = run(db.calculator_pdfs.find({"amocrm_id": "KPDUP_TEST_1"}, {"_id": 0, "pdf_data": 0}).to_list(10))
    assert len(pdfs) == 2


def test_calculator_order_fallback_returns_latest(db, api):
    # clear stored link to force amocrm_id fallback path
    run(db.sauna_crm_leads.update_one(
        {"id": "LEAD-KPDUP"},
        {"$unset": {"calculatorOrderId": "", "calculatorCollection": ""}},
    ))
    r = api.get(f"{BASE_URL}/api/sauna-crm/leads/LEAD-KPDUP/calculator-order", timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data["linked"] is True
    order = data["order"]
    assert order["id"] == "ORD-NEW", f"BUG: returned stale order {order['id']}"
    assert order["modelName"] == "NEW KP"
    assert order["kpCloudinaryUrl"].endswith("/new.pdf")
    assert "_id" not in order


def test_fallback_persists_latest_link(db):
    lead = run(db.sauna_crm_leads.find_one({"id": "LEAD-KPDUP"}, {"_id": 0}))
    assert lead.get("calculatorOrderId") == "ORD-NEW"
    assert lead.get("calculatorCollection") == "sauna_orders"


def test_stored_link_is_honoured(api):
    r = api.get(f"{BASE_URL}/api/sauna-crm/leads/LEAD-KPDUP/calculator-order", timeout=30)
    assert r.status_code == 200
    assert r.json()["order"]["id"] == "ORD-NEW"


def test_link_calculator_order_helper_uses_latest_pdf():
    """Direct call of internal helper used by amoCRM sync."""
    import sys
    sys.path.insert(0, "/app/backend")
    from routes.sauna_crm import link_calculator_order

    crm_lead = {"id": "LEAD-KPDUP", "amocrm_id": "KPDUP_TEST_1", "documents": []}
    res = run(link_calculator_order("KPDUP_TEST_1", crm_lead))
    assert res["linked"] is True, res
    assert crm_lead["calculatorOrderId"] == "ORD-NEW", crm_lead
    assert crm_lead.get("modelName") == "NEW KP"
    kp_docs = [d for d in crm_lead.get("documents", []) if d.get("type") == "kp"]
    assert len(kp_docs) == 1, crm_lead.get("documents")
    assert kp_docs[0].get("url", "").endswith("/new.pdf"), kp_docs[0]


# ---------- regression: single order lead ----------

TEST_LEAD = "TEST_LEAD_SINGLE_126"
TEST_AMO = "TEST_AMO_SINGLE_126"
TEST_ORDER = "TEST_ORD_SINGLE_126"


@pytest.fixture(scope="module", autouse=True)
def seed_single(db):
    now = datetime.now(timezone.utc)
    run(db.sauna_crm_leads.delete_many({"id": TEST_LEAD}))
    run(db.sauna_orders.delete_many({"amocrm_id": TEST_AMO}))
    run(db.calculator_pdfs.delete_many({"amocrm_id": TEST_AMO}))
    run(db.sauna_crm_leads.insert_one({
        "id": TEST_LEAD, "amocrm_id": TEST_AMO, "clientName": "TEST_Single", "stageId": "new",
    }))
    run(db.sauna_orders.insert_one({
        "id": TEST_ORDER, "amocrm_id": TEST_AMO, "modelName": "SINGLE KP",
        "kpCloudinaryUrl": "https://x/single.pdf",
        "createdAt": (now - timedelta(days=1)).isoformat(),
    }))
    run(db.calculator_pdfs.insert_one({
        "order_id": TEST_ORDER, "amocrm_id": TEST_AMO,
        "cloudinary_url": "https://x/single.pdf", "created_at": now.isoformat(),
    }))
    yield
    run(db.sauna_crm_leads.delete_many({"id": TEST_LEAD}))
    run(db.sauna_orders.delete_many({"amocrm_id": TEST_AMO}))
    run(db.calculator_pdfs.delete_many({"amocrm_id": TEST_AMO}))


def test_single_order_lead_links(api):
    r = api.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD}/calculator-order", timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data["linked"] is True
    assert data["order"]["id"] == TEST_ORDER
    assert data["order"]["modelName"] == "SINGLE KP"


def test_single_order_helper_links_pdf():
    import sys
    sys.path.insert(0, "/app/backend")
    from routes.sauna_crm import link_calculator_order
    crm_lead = {"id": TEST_LEAD, "amocrm_id": TEST_AMO, "documents": []}
    res = run(link_calculator_order(TEST_AMO, crm_lead))
    assert res["linked"] is True
    assert crm_lead["calculatorOrderId"] == TEST_ORDER
    kp = [d for d in crm_lead["documents"] if d.get("type") == "kp"]
    assert len(kp) == 1 and kp[0]["url"].endswith("/single.pdf")


def test_unknown_lead_404(api):
    r = api.get(f"{BASE_URL}/api/sauna-crm/leads/TEST_NOPE_126/calculator-order", timeout=30)
    assert r.status_code == 404


# ---------- NOT FIXED: same bug class remains in widget path ----------

def test_widget_orders_status_should_return_latest(api):
    """routes/widget.py get_orders_dict_by_amocrm_id() has no sort -> returns stale order.
    This widget is embedded in the amoCRM deal card, so stale KP is still user-visible."""
    r = api.get(f"{BASE_URL}/api/widget/orders-status/KPDUP_TEST_1", timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data.get("found") is True
    assert data["orders"]["sauna"]["id"] == "ORD-NEW", (
        f"BUG NOT FIXED: widget returned {data['orders']['sauna']['id']} "
        f"(modelName={data['orders']['sauna'].get('modelName')}) instead of latest ORD-NEW"
    )
