"""
Iteration 106 — Stock delivery cycle.

Backend tests for sauna_components.stockCurrent atomic updates when
procurement_requests transition in/out of delivered status.

Covers:
 - POST status=delivered + items[componentId, qty] -> stockCurrent += qty,
   stockApplied=True, stockSummary present (applied/skipped/updates).
 - POST status=draft -> stock unchanged, stockApplied=False.
 - PUT to delivered from draft -> stock +qty, stockApplied=True.
 - PUT delivered -> delivered (idempotent): no double increment.
 - PUT delivered -> ordered (revert): stock -qty, stockApplied=False, reverted=True.
 - Multi-line: 3 items, 2 with componentId (5 and 10), 1 free-form -> +5/+10, skipped=1.
 - Item with unknown componentId -> skipped.
 - DELETE delivered -> stock revert. DELETE non-delivered -> stock untouched.
 - Legacy single-line (componentId+quantity, no items[]) PUT delivered -> stock += qty.
 - Edge: delivered -> ordered (revert) -> delivered again -> stock applied second time.
"""
import os
import uuid
import pytest
import requests

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


@pytest.fixture(scope="module")
def created_component_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_headers, created_request_ids, created_component_ids):
    yield
    # Cleanup requests via API
    for rid in created_request_ids:
        try:
            requests.delete(f"{API}/procurement/requests/{rid}",
                            headers=admin_headers, timeout=15)
        except Exception:
            pass
    # Cleanup TEST_ components directly via Mongo (no public DELETE endpoint).
    try:
        import asyncio
        from database import db

        async def _purge():
            if created_component_ids:
                await db["sauna_components"].delete_many(
                    {"id": {"$in": created_component_ids}}
                )
        asyncio.get_event_loop().run_until_complete(_purge())
    except Exception:
        # fallback: leave them, they have TEST_ prefix and zero stock anyway
        pass


def _make_component(admin_headers, created_component_ids, name_suffix="", price=10.0):
    """Quick-create a sauna_component with stockCurrent=0 and return it."""
    name = f"TEST_STK_{name_suffix}_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/procurement/components/quick-create",
                      headers=admin_headers,
                      json={"name": name, "category": "other",
                            "unit": "шт", "unitPrice": price,
                            "supplier": "TEST_supplier"}, timeout=20)
    assert r.status_code == 200, r.text
    c = r.json()
    created_component_ids.append(c["id"])
    return c


def _get_stock(admin_headers, comp_id):
    """Fetch stockCurrent from /procurement/components listing."""
    r = requests.get(f"{API}/procurement/components",
                     headers=admin_headers, timeout=20)
    assert r.status_code == 200
    for it in r.json()["items"]:
        if it["id"] == comp_id:
            return float(it.get("stockCurrent") or 0)
    raise AssertionError(f"component {comp_id} not in listing")


# ─────────── CREATE flows ───────────

class TestCreateStockDelivery:
    def test_create_delivered_increments_stock(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "DEL")
        before = _get_stock(admin_headers, c["id"])
        payload = {
            "title": f"TEST_DEL_{uuid.uuid4().hex[:6]}",
            "items": [{"componentId": c["id"], "quantity": 7}],
            "status": "delivered",
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        assert d["stockApplied"] is True
        summary = d.get("stockSummary") or {}
        assert summary.get("applied") == 1
        assert summary.get("skipped", 0) == 0
        # Stock incremented by 7
        after = _get_stock(admin_headers, c["id"])
        assert after == before + 7.0, f"stock {before} -> {after}, expected +7"

    def test_create_draft_does_not_touch_stock(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "DRAFT")
        before = _get_stock(admin_headers, c["id"])
        payload = {
            "title": f"TEST_DRAFT_{uuid.uuid4().hex[:6]}",
            "items": [{"componentId": c["id"], "quantity": 5}],
            # status default = draft
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        assert d.get("status") == "draft"
        assert d.get("stockApplied") is False
        # stock unchanged
        after = _get_stock(admin_headers, c["id"])
        assert after == before, f"draft must not touch stock: {before} -> {after}"


# ─────────── PUT transitions ───────────

class TestPutStockTransitions:
    def test_put_to_delivered_increments_stock(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "PUT2DEL")
        before = _get_stock(admin_headers, c["id"])
        # Create as draft
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_P2D_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c["id"], "quantity": 4}],
                                "notifyTelegram": False}, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]
        created_request_ids.append(rid)
        # PUT -> delivered
        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"status": "delivered"}, timeout=20)
        assert u.status_code == 200, u.text
        ud = u.json()
        assert ud["status"] == "delivered"
        assert ud["stockApplied"] is True
        assert (ud.get("stockSummary") or {}).get("applied") == 1
        after = _get_stock(admin_headers, c["id"])
        assert after == before + 4.0

    def test_put_delivered_to_delivered_is_idempotent(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "IDEMP")
        before = _get_stock(admin_headers, c["id"])
        # Create directly as delivered
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_IDEMP_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c["id"], "quantity": 3}],
                                "status": "delivered",
                                "notifyTelegram": False}, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]
        created_request_ids.append(rid)
        mid = _get_stock(admin_headers, c["id"])
        assert mid == before + 3.0
        # Re-PUT delivered (any benign field change)
        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"status": "delivered", "note": "second touch"}, timeout=20)
        assert u.status_code == 200, u.text
        assert u.json()["stockApplied"] is True
        after = _get_stock(admin_headers, c["id"])
        # No double-credit
        assert after == before + 3.0, f"idempotency broken: {before} -> {after}"

    def test_put_delivered_to_ordered_reverts_stock(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "REV")
        before = _get_stock(admin_headers, c["id"])
        # Create as delivered
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_REV_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c["id"], "quantity": 6}],
                                "status": "delivered",
                                "notifyTelegram": False}, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]
        created_request_ids.append(rid)
        assert _get_stock(admin_headers, c["id"]) == before + 6.0
        # PUT -> ordered (revert)
        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"status": "ordered"}, timeout=20)
        assert u.status_code == 200, u.text
        ud = u.json()
        assert ud["status"] == "ordered"
        assert ud["stockApplied"] is False
        assert (ud.get("stockSummary") or {}).get("reverted") is True
        after = _get_stock(admin_headers, c["id"])
        assert after == before, f"revert failed: {before} -> {after}"

    def test_put_delivered_to_cancelled_reverts_stock(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "CANC")
        before = _get_stock(admin_headers, c["id"])
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_CANC_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c["id"], "quantity": 2}],
                                "status": "delivered",
                                "notifyTelegram": False}, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]
        created_request_ids.append(rid)
        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"status": "cancelled"}, timeout=20)
        assert u.status_code == 200
        assert u.json()["stockApplied"] is False
        assert _get_stock(admin_headers, c["id"]) == before


# ─────────── Multi-line and edge cases ───────────

class TestMultiAndEdge:
    def test_multiline_partial_componentId(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        c1 = _make_component(admin_headers, created_component_ids, "ML1")
        c2 = _make_component(admin_headers, created_component_ids, "ML2")
        b1 = _get_stock(admin_headers, c1["id"])
        b2 = _get_stock(admin_headers, c2["id"])
        payload = {
            "title": f"TEST_ML_{uuid.uuid4().hex[:6]}",
            "items": [
                {"componentId": c1["id"], "quantity": 5},
                {"componentId": c2["id"], "quantity": 10},
                {"componentName": "Free-form", "quantity": 3, "unitPrice": 1.0},
            ],
            "status": "delivered",
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        summary = d.get("stockSummary") or {}
        assert summary.get("applied") == 2, summary
        assert summary.get("skipped") == 1, summary
        assert _get_stock(admin_headers, c1["id"]) == b1 + 5.0
        assert _get_stock(admin_headers, c2["id"]) == b2 + 10.0

    def test_unknown_componentId_skipped(
        self, admin_headers, created_request_ids
    ):
        fake_id = f"ghost-{uuid.uuid4().hex}"
        payload = {
            "title": f"TEST_GHOST_{uuid.uuid4().hex[:6]}",
            "items": [{"componentId": fake_id, "quantity": 9}],
            "status": "delivered",
            "notifyTelegram": False,
        }
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_request_ids.append(d["id"])
        summary = d.get("stockSummary") or {}
        # Unknown id => skipped (no Mongo match)
        assert summary.get("applied", 0) == 0
        assert summary.get("skipped", 0) >= 1

    def test_legacy_singleline_put_delivered(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "LEG")
        before = _get_stock(admin_headers, c["id"])
        # Legacy: componentId+quantity on doc, no items[]
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_LEG_{uuid.uuid4().hex[:6]}",
                                "componentId": c["id"],
                                "quantity": 8, "unitPrice": 1.0,
                                "notifyTelegram": False}, timeout=20)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        created_request_ids.append(rid)
        # PUT -> delivered
        u = requests.put(f"{API}/procurement/requests/{rid}",
                         headers=admin_headers,
                         json={"status": "delivered"}, timeout=20)
        assert u.status_code == 200, u.text
        assert u.json()["stockApplied"] is True
        after = _get_stock(admin_headers, c["id"])
        assert after == before + 8.0, f"legacy delivery: {before} -> {after}"

    def test_revert_then_redeliver_applies_again(
        self, admin_headers, created_request_ids, created_component_ids
    ):
        """delivered -> ordered (revert) -> delivered again -> stock applied second time."""
        c = _make_component(admin_headers, created_component_ids, "RD")
        before = _get_stock(admin_headers, c["id"])
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_RD_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c["id"], "quantity": 4}],
                                "status": "delivered",
                                "notifyTelegram": False}, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]
        created_request_ids.append(rid)
        assert _get_stock(admin_headers, c["id"]) == before + 4.0
        # Revert
        u1 = requests.put(f"{API}/procurement/requests/{rid}",
                          headers=admin_headers,
                          json={"status": "ordered"}, timeout=20)
        assert u1.status_code == 200
        assert _get_stock(admin_headers, c["id"]) == before
        # Re-deliver
        u2 = requests.put(f"{API}/procurement/requests/{rid}",
                          headers=admin_headers,
                          json={"status": "delivered"}, timeout=20)
        assert u2.status_code == 200
        assert u2.json()["stockApplied"] is True
        assert _get_stock(admin_headers, c["id"]) == before + 4.0


# ─────────── DELETE flows ───────────

class TestDeleteStockRevert:
    def test_delete_delivered_reverts_stock(
        self, admin_headers, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "DELDEL")
        before = _get_stock(admin_headers, c["id"])
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_DELDEL_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c["id"], "quantity": 11}],
                                "status": "delivered",
                                "notifyTelegram": False}, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]
        assert _get_stock(admin_headers, c["id"]) == before + 11.0
        # DELETE — should revert stock
        d = requests.delete(f"{API}/procurement/requests/{rid}",
                            headers=admin_headers, timeout=20)
        assert d.status_code == 200, d.text
        assert d.json().get("deleted") is True
        assert _get_stock(admin_headers, c["id"]) == before, \
            "DELETE of delivered request must revert stock"

    def test_delete_nondelivered_does_not_change_stock(
        self, admin_headers, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "DELDRAFT")
        before = _get_stock(admin_headers, c["id"])
        r = requests.post(f"{API}/procurement/requests",
                          headers=admin_headers,
                          json={"title": f"TEST_DELDRAFT_{uuid.uuid4().hex[:6]}",
                                "items": [{"componentId": c["id"], "quantity": 5}],
                                "notifyTelegram": False}, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]
        # Still draft → no stock change
        assert _get_stock(admin_headers, c["id"]) == before
        d = requests.delete(f"{API}/procurement/requests/{rid}",
                            headers=admin_headers, timeout=20)
        assert d.status_code == 200
        assert _get_stock(admin_headers, c["id"]) == before


# ─────────── Regression: iter104/105 features still work ───────────

class TestRegression:
    def test_stats_still_works(self, admin_headers):
        r = requests.get(f"{API}/procurement/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        for k in ("byStatus", "overdue", "dueSoon", "total"):
            assert k in r.json()

    def test_components_listing(self, admin_headers):
        r = requests.get(f"{API}/procurement/components",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert "items" in r.json()
        # stockCurrent must be exposed
        items = r.json()["items"]
        if items:
            assert any("stockCurrent" in it for it in items), \
                "stockCurrent missing in /procurement/components"

    def test_telegram_format_multiline_unchanged(self):
        from routes import procurement as proc
        msg = proc._format_request_message("🆕 New", {
            "title": "Reg multi",
            "items": [{"componentName": "X", "quantity": 1, "unit": "шт", "totalPrice": 5.0}],
            "totalPrice": 5.0, "dueDate": "2026-02-01",
            "supplier": "S", "assigneeUsername": "a",
        })
        assert "Reg multi" in msg
        assert "Позиций" in msg

    def test_isOverdue_decoration_intact(self, admin_headers):
        r = requests.get(f"{API}/procurement/requests", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        if items:
            assert all("isOverdue" in it for it in items)
