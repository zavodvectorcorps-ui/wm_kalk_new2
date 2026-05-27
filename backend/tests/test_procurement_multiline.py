"""
Iteration 105 — Multi-line procurement requests tests.

Covers:
 - POST /api/procurement/requests with items[] (multi-line)
 - Auto-fill from sauna_components by componentId
 - Auto supplier from first component
 - Empty items[] fallback to legacy single-line
 - Manual items without componentId
 - PUT replacement / preservation of items
 - PUT legacy single-line recompute
 - Telegram format includes multi-line block
 - GET returns both shapes
 - Regression endpoints intact
 - Sorting & isOverdue for multi-line
"""
import os
import uuid
import importlib
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

ADMIN = ("admin", "admin123")


# ─────────── shared fixtures ───────────

@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login",
                      json={"username": ADMIN[0], "password": ADMIN[1]}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_request_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_headers, created_request_ids):
    yield
    for rid in created_request_ids:
        try:
            requests.delete(f"{API}/procurement/requests/{rid}",
                            headers=admin_headers, timeout=15)
        except Exception:
            pass


@pytest.fixture(scope="module")
def two_components(admin_headers):
    """Return 2 sauna_components quick-created for use as line items."""
    out = []
    for i, price in enumerate([12.5, 33.0]):
        name = f"TEST_MULTI_{uuid.uuid4().hex[:6]}_{i}"
        payload = {"name": name, "category": "other", "unit": "шт",
                   "unitPrice": price, "supplier": f"Drewno24_{i}"}
        r = requests.post(f"{API}/procurement/components/quick-create",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        out.append(r.json())
    return out


# ─────────── multi-line create ───────────

class TestMultiLineCreate:
    def test_create_multiline_basic(self, admin_headers, two_components, created_request_ids):
        c1, c2 = two_components
        payload = {
            "title": f"TEST_MULTI_BASIC_{uuid.uuid4().hex[:6]}",
            "items": [
                {"componentId": c1["id"], "quantity": 5, "unitPrice": 10.0},
                {"componentId": c2["id"], "quantity": 3, "unitPrice": 20.0},
            ],
            "supplier": "ExplicitSupplier",
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        # items[]
        assert isinstance(d.get("items"), list) and len(d["items"]) == 2
        # per-line totals
        assert d["items"][0]["totalPrice"] == 50.0
        assert d["items"][1]["totalPrice"] == 60.0
        # grand total = 110
        assert d["totalPrice"] == 110.0
        # single-line scalars cleared
        assert d["quantity"] == 0
        assert d["unitPrice"] == 0
        assert d["componentId"] in (None, "")
        # supplier preserved (not overridden)
        assert d["supplier"] == "ExplicitSupplier"

    def test_create_multiline_autofill_from_catalog(self, admin_headers, two_components, created_request_ids):
        """Item with componentId but empty name/unit/price → autofilled."""
        c1 = two_components[0]
        payload = {
            "title": f"TEST_MULTI_AUTO_{uuid.uuid4().hex[:6]}",
            "items": [
                # Only componentId + qty: name/unit/price should be auto-filled
                {"componentId": c1["id"], "quantity": 2},
            ],
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        item = d["items"][0]
        assert item["componentName"] == c1["name"], f"name not autofilled: {item}"
        assert item["unitPrice"] == float(c1["unitPrice"])
        assert item["unit"] == c1["unit"]
        expected = round(2 * float(c1["unitPrice"]), 2)
        assert item["totalPrice"] == expected
        assert d["totalPrice"] == expected

    def test_create_multiline_supplier_autofill(self, admin_headers, two_components, created_request_ids):
        """No supplier in body → take from first item's component."""
        c1 = two_components[0]
        payload = {
            "title": f"TEST_MULTI_SUPP_{uuid.uuid4().hex[:6]}",
            "items": [{"componentId": c1["id"], "quantity": 1}],
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        assert d["supplier"] == c1.get("supplier", ""), \
            f"supplier autofill failed: {d['supplier']} vs catalog {c1.get('supplier')}"

    def test_create_empty_items_falls_back_to_legacy(self, admin_headers, created_request_ids):
        """items=[] should behave as legacy single-line, no crash."""
        payload = {
            "title": f"TEST_LEGACY_FALL_{uuid.uuid4().hex[:6]}",
            "items": [],
            "quantity": 4, "unitPrice": 7,
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        # Should be legacy: items list empty, quantity/unitPrice preserved
        assert d.get("items") in ([], None)
        assert d["quantity"] == 4
        assert d["unitPrice"] == 7
        assert d["totalPrice"] == 28

    def test_create_multiline_manual_no_componentId(self, admin_headers, created_request_ids):
        """Items with only componentName (manual entry) should be saved as-is."""
        payload = {
            "title": f"TEST_MULTI_MAN_{uuid.uuid4().hex[:6]}",
            "items": [
                {"componentName": "Hand-typed item", "quantity": 2, "unitPrice": 15.5, "unit": "kg"},
            ],
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        it = d["items"][0]
        assert it["componentName"] == "Hand-typed item"
        assert it.get("componentId") in (None, "")
        assert it["totalPrice"] == 31.0
        assert d["totalPrice"] == 31.0

    def test_create_legacy_singleline_still_works(self, admin_headers, created_request_ids):
        """POST without items[] continues to work like before."""
        payload = {
            "title": f"TEST_LEGACY_{uuid.uuid4().hex[:6]}",
            "quantity": 6, "unitPrice": 2.5,
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        assert d["totalPrice"] == 15.0
        assert d["quantity"] == 6
        assert d.get("items") in ([], None)


# ─────────── multi-line update ───────────

class TestMultiLineUpdate:
    def _create_multiline(self, admin_headers, two_components, created_request_ids):
        c1, c2 = two_components
        payload = {
            "title": f"TEST_MUP_{uuid.uuid4().hex[:6]}",
            "items": [
                {"componentId": c1["id"], "quantity": 2, "unitPrice": 10.0},
                {"componentId": c2["id"], "quantity": 1, "unitPrice": 20.0},
            ],
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        return d

    def test_put_replaces_items_and_recomputes(self, admin_headers, two_components, created_request_ids):
        d = self._create_multiline(admin_headers, two_components, created_request_ids)
        rid = d["id"]
        c1 = two_components[0]
        # Replace with three lines
        new_items = [
            {"componentId": c1["id"], "quantity": 5, "unitPrice": 4.0},
            {"componentName": "Extra1", "quantity": 2, "unitPrice": 3.5},
            {"componentName": "Extra2", "quantity": 1, "unitPrice": 100.0},
        ]
        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"items": new_items}, timeout=20)
        assert u.status_code == 200, u.text
        ud = u.json()
        assert len(ud["items"]) == 3
        # 5*4 + 2*3.5 + 1*100 = 20 + 7 + 100 = 127
        assert ud["totalPrice"] == 127.0
        # Single-line scalars cleared
        assert ud["quantity"] == 0
        assert ud["unitPrice"] == 0
        assert ud.get("componentId") in (None, "")

    def test_put_without_items_preserves_existing_multiline(self, admin_headers, two_components, created_request_ids):
        d = self._create_multiline(admin_headers, two_components, created_request_ids)
        rid = d["id"]
        original_items = d["items"]
        original_total = d["totalPrice"]
        # Update only status, do not touch items
        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"status": "approved"}, timeout=20)
        assert u.status_code == 200, u.text
        ud = u.json()
        assert ud["status"] == "approved"
        # items must stay intact (NOT reset to [])
        assert ud["items"] and len(ud["items"]) == len(original_items), \
            f"items wiped on partial update! got {ud['items']}"
        assert ud["totalPrice"] == original_total

    def test_put_singleline_legacy_recomputes(self, admin_headers, created_request_ids):
        # Create legacy single-line
        c = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_LSL_{uuid.uuid4().hex[:6]}",
                                "quantity": 2, "unitPrice": 5,
                                "notifyTelegram": False}, timeout=20)
        assert c.status_code == 200
        rid = c.json()["id"]
        created_request_ids.append(rid)

        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"quantity": 7, "unitPrice": 3}, timeout=20)
        assert u.status_code == 200
        ud = u.json()
        assert ud["totalPrice"] == 21


# ─────────── listing returns both ───────────

class TestListing:
    def test_list_returns_both_shapes(self, admin_headers, two_components, created_request_ids):
        c1 = two_components[0]
        # single
        s = requests.post(f"{API}/procurement/requests", headers=admin_headers,
                          json={"title": f"TEST_LST_S_{uuid.uuid4().hex[:6]}",
                                "quantity": 1, "unitPrice": 1, "notifyTelegram": False},
                          timeout=20)
        assert s.status_code == 200
        sid = s.json()["id"]
        created_request_ids.append(sid)
        # multi
        m = requests.post(f"{API}/procurement/requests", headers=admin_headers,
                          json={"title": f"TEST_LST_M_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c1["id"], "quantity": 1}],
                                "notifyTelegram": False}, timeout=20)
        assert m.status_code == 200
        mid = m.json()["id"]
        created_request_ids.append(mid)

        r = requests.get(f"{API}/procurement/requests", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {it["id"] for it in items}
        assert sid in ids and mid in ids

        # Multi-line has items list populated
        mdoc = next(it for it in items if it["id"] == mid)
        assert isinstance(mdoc.get("items"), list) and len(mdoc["items"]) == 1
        # isOverdue decoration present on both
        assert "isOverdue" in mdoc
        sdoc = next(it for it in items if it["id"] == sid)
        assert "isOverdue" in sdoc

    def test_multiline_isOverdue_decoration(self, admin_headers, two_components, created_request_ids):
        c1 = two_components[0]
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        r = requests.post(f"{API}/procurement/requests", headers=admin_headers,
                          json={"title": f"TEST_MOD_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c1["id"], "quantity": 1}],
                                "dueDate": yesterday, "notifyTelegram": False},
                          timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]
        created_request_ids.append(rid)

        listing = requests.get(f"{API}/procurement/requests?only_overdue=true",
                               headers=admin_headers, timeout=20).json()["items"]
        match = [it for it in listing if it["id"] == rid]
        assert match, "multi-line overdue not in only_overdue filter"
        assert match[0]["isOverdue"] is True
        assert match[0]["items"] and len(match[0]["items"]) == 1


# ─────────── Telegram format ───────────

class TestTelegramFormat:
    def test_multiline_message_format(self):
        from routes import procurement as proc
        doc_multi = {
            "title": "Drewno24 weekly",
            "items": [
                {"componentName": "Доска 25х100", "quantity": 50, "unit": "шт", "totalPrice": 2500.0},
                {"componentName": "Брус 50х50", "quantity": 30, "unit": "шт", "totalPrice": 1500.0},
            ],
            "totalPrice": 4000.0,
            "dueDate": "2026-02-01",
            "supplier": "Drewno24",
            "assigneeUsername": "admin",
        }
        msg = proc._format_request_message("🆕 New", doc_multi)
        assert "Drewno24 weekly" in msg
        assert "Позиций" in msg and "2" in msg
        assert "Доска 25х100" in msg
        assert "Брус 50х50" in msg
        assert "Итого" in msg
        assert "4000.00" in msg

    def test_singleline_message_format(self):
        from routes import procurement as proc
        doc = {
            "title": "Single item",
            "quantity": 5,
            "unit": "шт",
            "totalPrice": 100.0,
            "dueDate": "2026-02-01",
            "supplier": "ACME",
            "assigneeUsername": "admin",
            "items": [],
        }
        msg = proc._format_request_message("🆕 New", doc)
        assert "Single item" in msg
        # Single-line uses Кол-во block
        assert "Кол-во" in msg
        assert "Позиций" not in msg


# ─────────── Regression ───────────

class TestRegression:
    def test_stats(self, admin_headers):
        r = requests.get(f"{API}/procurement/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        for k in ("byStatus", "overdue", "dueSoon", "total"):
            assert k in r.json()

    def test_components(self, admin_headers):
        r = requests.get(f"{API}/procurement/components", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_quick_create_component(self, admin_headers):
        name = f"TEST_REG_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/procurement/components/quick-create",
                          headers=admin_headers,
                          json={"name": name, "unitPrice": 1.0}, timeout=20)
        assert r.status_code == 200
        assert r.json()["name"] == name
