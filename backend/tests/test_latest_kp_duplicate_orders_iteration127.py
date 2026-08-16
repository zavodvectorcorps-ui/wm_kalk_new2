"""iteration_127: latest-KP selection for duplicate orders on same amocrm_id."""
import os
import requests
import pytest
from dotenv import dotenv_values

fe = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or fe.get("REACT_APP_BACKEND_URL")).rstrip("/")

AMO_ID = "KPDUP_TEST_1"
LEAD_ID = "LEAD-KPDUP"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("access_token") or r.json().get("token")
    assert token
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {token}"})
    return sess


# --- widget.py: get_orders_dict_by_amocrm_id must pick freshest order ---
def test_widget_orders_status_returns_latest(s):
    r = s.get(f"{BASE_URL}/api/widget/orders-status/{AMO_ID}", timeout=30)
    assert r.status_code == 200, r.text[:500]
    data = r.json()
    print("WIDGET RESP:", data)
    sauna = (data.get("orders") or {}).get("sauna")
    assert sauna, f"no sauna order in response: {data}"
    assert sauna.get("id") == "ORD-NEW", f"expected ORD-NEW, got {sauna.get('id')}"
    assert sauna.get("modelName") == "NEW KP", sauna.get("modelName")


# --- sauna_crm.py regression (iteration_126) ---
def test_sauna_crm_calculator_order_returns_latest(s):
    r = s.get(f"{BASE_URL}/api/sauna-crm/leads/{LEAD_ID}/calculator-order", timeout=30)
    assert r.status_code == 200, r.text[:500]
    data = r.json()
    print("CRM RESP keys:", list(data.keys()))
    order = data.get("order") or data
    assert order.get("id") == "ORD-NEW", f"expected ORD-NEW, got {order.get('id')} / {data}"
    assert order.get("modelName") == "NEW KP"


# --- other widget consumers of the same helpers must resolve latest order ---
def test_widget_delivery_status_latest(s):
    r = s.get(f"{BASE_URL}/api/widget/delivery-status/{AMO_ID}", timeout=30)
    print("delivery-status:", r.status_code, r.text[:400])
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    if d.get("orderId") or d.get("order_id"):
        assert (d.get("orderId") or d.get("order_id")) == "ORD-NEW", d


def test_widget_embed_html_latest(s):
    r = s.get(f"{BASE_URL}/api/widget/embed/{AMO_ID}", timeout=40)
    print("embed status:", r.status_code)
    assert r.status_code == 200, r.text[:300]
    assert "OLD KP" not in r.text, "embed HTML shows stale OLD KP"


def test_widget_preview_html_latest(s):
    r = s.get(f"{BASE_URL}/api/widget/preview/{AMO_ID}", timeout=40)
    print("preview status:", r.status_code)
    assert r.status_code == 200, r.text[:300]
    assert "OLD KP" not in r.text, "preview HTML shows stale OLD KP"


# --- other consumers not broken ---
def test_widget_order_endpoint_ok(s):
    r = s.get(f"{BASE_URL}/api/widget/order/{AMO_ID}", timeout=30)
    print("widget/order status:", r.status_code, r.text[:300])
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        d = r.json()
        o = d.get("order") or d
        if isinstance(o, dict) and o.get("id"):
            assert o.get("id") == "ORD-NEW", o.get("id")


def test_driver_panel_debug_order_returns_latest(admin):
    """driver_panel.py line ~606 reads order by amocrm_id with createdAt desc sort."""
    r = admin.get(f"{BASE_URL}/api/driver-panel/debug/order/{AMO_ID}", timeout=30)
    print("driver debug/order:", r.status_code, r.text[:600])
    assert r.status_code == 200, r.text[:300]
    body = r.text
    assert "ORD-NEW" in body, body[:400]


def test_driver_panel_warehouse_settings_ok(admin):
    r = admin.get(f"{BASE_URL}/api/driver-panel/warehouse-settings", timeout=30)
    print("warehouse-settings status:", r.status_code, r.text[:200])
    assert r.status_code == 200
