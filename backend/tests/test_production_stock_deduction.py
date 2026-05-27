"""
Iteration 107 — Production stock deduction cycle.

Backend tests for sauna_components.stockCurrent atomic deduction when
a CRM lead is pushed to production. Covers admin-only preview/deduct/revert
endpoints + auto-deduct path via /api/sauna-crm/leads/{id}/to-production.

Endpoints under test:
  POST /api/sauna-production/cost/production-stock/preview/{lead_id}
  POST /api/sauna-production/cost/production-stock/deduct/{lead_id}
  POST /api/sauna-production/cost/production-stock/revert/{lead_id}
  POST /api/sauna-crm/leads/{lead_id}/to-production

Scenarios:
 - preview returns aggregated BOM, no stock change
 - preview 404 if lead missing
 - deduct lowers stock and writes audit (type='out')
 - deduct twice returns 409, no double-decrement
 - revert restores stock and writes audit (type='in')
 - revert without prior deduct returns 409
 - to-production auto-deducts BOM, returns stockSummary, sets productionStockDeducted
 - to-production for lead without model/variant -> applied=0, no 500
 - to-production twice -> 400 'Заказ уже в производстве', no double-deduct
 - multi-option BOM aggregation (model + option) -> components from both cards
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"
PS = f"{API}/sauna-production/cost/production-stock"
CRM = f"{API}/sauna-crm"
TC = f"{API}/sauna-production/cost"

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
def created_component_ids():
    return []


@pytest.fixture(scope="module")
def created_card_ids():
    return []


@pytest.fixture(scope="module")
def created_lead_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_headers, created_component_ids, created_card_ids, created_lead_ids):
    yield
    # Leads via API
    for lid in created_lead_ids:
        try:
            requests.delete(f"{CRM}/leads/{lid}", headers=admin_headers, timeout=15)
        except Exception:
            pass
    # Tech cards via API
    for cid in created_card_ids:
        try:
            requests.delete(f"{TC}/tech-cards/{cid}", headers=admin_headers, timeout=15)
        except Exception:
            pass
    # Components + stock_movements directly via Mongo
    try:
        import asyncio
        from database import db

        async def _purge():
            if created_component_ids:
                await db["sauna_components"].delete_many({"id": {"$in": created_component_ids}})
                await db["sauna_stock_movements"].delete_many(
                    {"componentId": {"$in": created_component_ids}}
                )
            if created_lead_ids:
                await db["sauna_stock_movements"].delete_many(
                    {"leadId": {"$in": created_lead_ids}}
                )
                await db["sauna_crm_leads"].delete_many({"id": {"$in": created_lead_ids}})
        try:
            asyncio.get_event_loop().run_until_complete(_purge())
        except RuntimeError:
            asyncio.run(_purge())
    except Exception:
        pass


# ─────────── helpers ───────────

def _make_component(admin_headers, created_component_ids, name_suffix="", start_stock=100.0, price=10.0):
    """Create a component, then directly set stockCurrent via Mongo for deterministic baseline."""
    name = f"TEST_PSD_{name_suffix}_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/procurement/components/quick-create",
                      headers=admin_headers,
                      json={"name": name, "category": "other",
                            "unit": "шт", "unitPrice": price,
                            "supplier": "TEST_supplier"}, timeout=20)
    assert r.status_code == 200, r.text
    c = r.json()
    created_component_ids.append(c["id"])
    # Force stockCurrent to known value via the stock-adjust endpoint (type=set)
    a = requests.post(f"{TC}/components/{c['id']}/stock-adjust",
                      headers=admin_headers,
                      json={"type": "set", "qty": start_stock, "note": "TEST seed"},
                      timeout=20)
    assert a.status_code in (200, 201), a.text
    return c


def _get_stock(admin_headers, comp_id):
    r = requests.get(f"{TC}/components", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data["items"] if isinstance(data, dict) else data
    for it in items:
        if it["id"] == comp_id:
            return float(it.get("stockCurrent") or 0)
    return None


def _make_tech_card(admin_headers, created_card_ids, scope_payload: dict, items: list):
    """Upsert tech card. scope_payload is e.g. {scope:'variant', modelId, variantId}."""
    body = {**scope_payload, "items": items}
    r = requests.post(f"{TC}/tech-cards", headers=admin_headers, json=body, timeout=20)
    assert r.status_code == 200, r.text
    card = r.json()
    cid = card.get("id")
    if cid:
        created_card_ids.append(cid)
    return card


def _make_lead(admin_headers, created_lead_ids, calc_data: dict | None = None, stage="invoice_sent"):
    # Use a random amocrm_id to dodge a unique index on amocrm_id (null collides on repeat insert)
    payload = {
        "stageId": stage,
        "clientName": f"TEST_LEAD_{uuid.uuid4().hex[:6]}",
        "amocrm_id": f"TEST_AMO_{uuid.uuid4().hex[:10]}",
    }
    r = requests.post(f"{CRM}/leads", headers=admin_headers, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    lead = r.json()["lead"]
    lid = lead["id"]
    created_lead_ids.append(lid)
    if calc_data is not None:
        u = requests.put(f"{CRM}/leads/{lid}",
                        headers=admin_headers,
                        json={"calculatorData": calc_data}, timeout=20)
        assert u.status_code == 200, u.text
    return lid


# ─────────── preview ───────────

class TestPreview:
    def test_preview_returns_404_for_unknown_lead(self, admin_headers):
        r = requests.post(f"{PS}/preview/__nope__{uuid.uuid4().hex[:8]}",
                          headers=admin_headers, timeout=20)
        assert r.status_code == 404, r.text

    def test_preview_returns_bom_and_does_not_change_stock(
        self, admin_headers, created_component_ids, created_card_ids, created_lead_ids
    ):
        comp = _make_component(admin_headers, created_component_ids, "PRE", start_stock=50)
        before = _get_stock(admin_headers, comp["id"])
        model_id = f"TEST_M_{uuid.uuid4().hex[:6]}"
        variant_id = f"TEST_V_{uuid.uuid4().hex[:6]}"
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "variant", "modelId": model_id, "variantId": variant_id},
                        [{"componentId": comp["id"], "qty": 3}])
        lid = _make_lead(admin_headers, created_lead_ids,
                         calc_data={"modelId": model_id, "variantId": variant_id})

        r = requests.post(f"{PS}/preview/{lid}", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["leadId"] == lid
        assert data["alreadyDeducted"] is False
        assert data["matchedTargets"] >= 1
        comp_ids_in_items = [i.get("componentId") for i in data.get("items", [])]
        assert comp["id"] in comp_ids_in_items

        after = _get_stock(admin_headers, comp["id"])
        assert after == before, f"preview must not mutate stock: {before} -> {after}"


# ─────────── manual deduct / revert ───────────

class TestManualDeductRevert:
    def test_deduct_lowers_stock_and_writes_audit(
        self, admin_headers, created_component_ids, created_card_ids, created_lead_ids
    ):
        comp = _make_component(admin_headers, created_component_ids, "DED", start_stock=100)
        model_id = f"TEST_M_{uuid.uuid4().hex[:6]}"
        variant_id = f"TEST_V_{uuid.uuid4().hex[:6]}"
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "variant", "modelId": model_id, "variantId": variant_id},
                        [{"componentId": comp["id"], "qty": 7}])
        lid = _make_lead(admin_headers, created_lead_ids,
                         calc_data={"modelId": model_id, "variantId": variant_id})

        before = _get_stock(admin_headers, comp["id"])
        r = requests.post(f"{PS}/deduct/{lid}", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        s = body["summary"]
        assert s["applied"] == 1
        assert s["skipped"] == 0
        assert s["totalQty"] == 7
        after = _get_stock(admin_headers, comp["id"])
        assert after == before - 7, f"expected {before-7}, got {after}"

        # Verify lead flag persisted + summary
        lr = requests.get(f"{CRM}/leads/{lid}", headers=admin_headers, timeout=20)
        assert lr.status_code == 200
        ld = lr.json()
        assert ld.get("productionStockDeducted") is True
        assert ld.get("productionStockSummary", {}).get("applied") == 1

        # Verify audit movement
        import asyncio
        from database import db
        async def _find():
            return await db["sauna_stock_movements"].find_one(
                {"leadId": lid, "componentId": comp["id"]}, {"_id": 0}
            )
        try:
            mv = asyncio.get_event_loop().run_until_complete(_find())
        except RuntimeError:
            mv = asyncio.run(_find())
        assert mv is not None, "audit movement not written"
        assert mv["type"] == "out"
        assert mv["qty"] == 7
        assert mv["before"] == before
        assert mv["after"] == after
        assert "Списание производство" in mv["note"]
        assert mv.get("actorUsername") == "admin"

    def test_deduct_twice_returns_409_no_double_decrement(
        self, admin_headers, created_component_ids, created_card_ids, created_lead_ids
    ):
        comp = _make_component(admin_headers, created_component_ids, "DUP", start_stock=50)
        model_id = f"TEST_M_{uuid.uuid4().hex[:6]}"
        variant_id = f"TEST_V_{uuid.uuid4().hex[:6]}"
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "variant", "modelId": model_id, "variantId": variant_id},
                        [{"componentId": comp["id"], "qty": 5}])
        lid = _make_lead(admin_headers, created_lead_ids,
                         calc_data={"modelId": model_id, "variantId": variant_id})

        r1 = requests.post(f"{PS}/deduct/{lid}", headers=admin_headers, timeout=20)
        assert r1.status_code == 200
        mid = _get_stock(admin_headers, comp["id"])
        r2 = requests.post(f"{PS}/deduct/{lid}", headers=admin_headers, timeout=20)
        assert r2.status_code == 409, r2.text
        after = _get_stock(admin_headers, comp["id"])
        assert after == mid, f"second deduct must NOT change stock: {mid} -> {after}"

    def test_revert_restores_stock_and_writes_in_audit(
        self, admin_headers, created_component_ids, created_card_ids, created_lead_ids
    ):
        comp = _make_component(admin_headers, created_component_ids, "REV", start_stock=40)
        model_id = f"TEST_M_{uuid.uuid4().hex[:6]}"
        variant_id = f"TEST_V_{uuid.uuid4().hex[:6]}"
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "variant", "modelId": model_id, "variantId": variant_id},
                        [{"componentId": comp["id"], "qty": 4}])
        lid = _make_lead(admin_headers, created_lead_ids,
                         calc_data={"modelId": model_id, "variantId": variant_id})
        before = _get_stock(admin_headers, comp["id"])

        d = requests.post(f"{PS}/deduct/{lid}", headers=admin_headers, timeout=20)
        assert d.status_code == 200
        mid = _get_stock(admin_headers, comp["id"])
        assert mid == before - 4

        rv = requests.post(f"{PS}/revert/{lid}", headers=admin_headers, timeout=20)
        assert rv.status_code == 200, rv.text
        s = rv.json()["summary"]
        assert s.get("reverted") is True
        assert s["applied"] == 1
        after = _get_stock(admin_headers, comp["id"])
        assert after == before, f"revert should restore: {before} vs {after}"

        # productionStockDeducted should be False after revert
        lr = requests.get(f"{CRM}/leads/{lid}", headers=admin_headers, timeout=20)
        assert lr.json().get("productionStockDeducted") is False

        # Audit: there should be an "in" movement
        import asyncio
        from database import db
        async def _find_in():
            return await db["sauna_stock_movements"].find_one(
                {"leadId": lid, "componentId": comp["id"], "type": "in"}, {"_id": 0}
            )
        try:
            mv = asyncio.get_event_loop().run_until_complete(_find_in())
        except RuntimeError:
            mv = asyncio.run(_find_in())
        assert mv is not None
        assert "Возврат списания производства" in mv["note"]

    def test_revert_without_deduct_returns_409(
        self, admin_headers, created_component_ids, created_card_ids, created_lead_ids
    ):
        comp = _make_component(admin_headers, created_component_ids, "RVX", start_stock=20)
        model_id = f"TEST_M_{uuid.uuid4().hex[:6]}"
        variant_id = f"TEST_V_{uuid.uuid4().hex[:6]}"
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "variant", "modelId": model_id, "variantId": variant_id},
                        [{"componentId": comp["id"], "qty": 2}])
        lid = _make_lead(admin_headers, created_lead_ids,
                         calc_data={"modelId": model_id, "variantId": variant_id})
        before = _get_stock(admin_headers, comp["id"])
        r = requests.post(f"{PS}/revert/{lid}", headers=admin_headers, timeout=20)
        assert r.status_code == 409, r.text
        after = _get_stock(admin_headers, comp["id"])
        assert after == before


# ─────────── to-production auto-deduct ───────────

class TestToProductionAutoDeduct:
    def test_to_production_auto_deducts_and_returns_summary(
        self, admin_headers, created_component_ids, created_card_ids, created_lead_ids
    ):
        comp = _make_component(admin_headers, created_component_ids, "AUTO", start_stock=200)
        model_id = f"TEST_M_{uuid.uuid4().hex[:6]}"
        variant_id = f"TEST_V_{uuid.uuid4().hex[:6]}"
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "variant", "modelId": model_id, "variantId": variant_id},
                        [{"componentId": comp["id"], "qty": 11}])
        lid = _make_lead(admin_headers, created_lead_ids,
                         calc_data={"modelId": model_id, "variantId": variant_id})
        before = _get_stock(admin_headers, comp["id"])

        r = requests.post(f"{CRM}/leads/{lid}/to-production",
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ok"
        ss = body.get("stockSummary")
        assert ss is not None, "to-production should return stockSummary"
        assert ss["applied"] == 1
        assert ss["totalQty"] == 11
        after = _get_stock(admin_headers, comp["id"])
        assert after == before - 11

        # lead flags
        lead = body["lead"]
        assert lead["inProduction"] is True
        assert lead.get("productionStockDeducted") is True
        assert lead.get("productionStockSummary", {}).get("applied") == 1

    def test_to_production_twice_returns_400_no_double_deduct(
        self, admin_headers, created_component_ids, created_card_ids, created_lead_ids
    ):
        comp = _make_component(admin_headers, created_component_ids, "TP2", start_stock=80)
        model_id = f"TEST_M_{uuid.uuid4().hex[:6]}"
        variant_id = f"TEST_V_{uuid.uuid4().hex[:6]}"
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "variant", "modelId": model_id, "variantId": variant_id},
                        [{"componentId": comp["id"], "qty": 6}])
        lid = _make_lead(admin_headers, created_lead_ids,
                         calc_data={"modelId": model_id, "variantId": variant_id})

        r1 = requests.post(f"{CRM}/leads/{lid}/to-production",
                           headers=admin_headers, timeout=20)
        assert r1.status_code == 200
        mid = _get_stock(admin_headers, comp["id"])
        r2 = requests.post(f"{CRM}/leads/{lid}/to-production",
                           headers=admin_headers, timeout=20)
        assert r2.status_code == 400, r2.text
        assert "производстве" in r2.text
        after = _get_stock(admin_headers, comp["id"])
        assert after == mid, f"second push should NOT decrement again: {mid} -> {after}"

    def test_to_production_without_bom_returns_applied_zero(
        self, admin_headers, created_lead_ids
    ):
        """Lead without model/variant -> no BOM matches -> applied=0, no 500."""
        lid = _make_lead(admin_headers, created_lead_ids, calc_data={})
        r = requests.post(f"{CRM}/leads/{lid}/to-production",
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ok"
        ss = body.get("stockSummary") or {}
        # applied must be 0 (no matched targets at all)
        assert ss.get("applied", 0) == 0
        lead = body["lead"]
        assert lead["inProduction"] is True
        # claim was set even on no-op so future pushes won't re-attempt
        assert lead.get("productionStockDeducted") is True

    def test_multi_option_bom_aggregation(
        self, admin_headers, created_component_ids, created_card_ids, created_lead_ids
    ):
        """Model card + option card -> both component deductions applied."""
        c1 = _make_component(admin_headers, created_component_ids, "MO1", start_stock=300)
        c2 = _make_component(admin_headers, created_component_ids, "MO2", start_stock=300)
        model_id = f"TEST_M_{uuid.uuid4().hex[:6]}"
        variant_id = f"TEST_V_{uuid.uuid4().hex[:6]}"
        option_id = f"TEST_O_{uuid.uuid4().hex[:6]}"
        # variant-level card with c1
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "variant", "modelId": model_id, "variantId": variant_id},
                        [{"componentId": c1["id"], "qty": 2}])
        # option-level card with c2
        _make_tech_card(admin_headers, created_card_ids,
                        {"scope": "option", "optionId": option_id},
                        [{"componentId": c2["id"], "qty": 5}])

        lid = _make_lead(admin_headers, created_lead_ids, calc_data={
            "modelId": model_id, "variantId": variant_id,
            "selectedOptions": {option_id: True},
        })
        b1, b2 = _get_stock(admin_headers, c1["id"]), _get_stock(admin_headers, c2["id"])
        r = requests.post(f"{CRM}/leads/{lid}/to-production",
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        ss = r.json().get("stockSummary") or {}
        assert ss["applied"] == 2, ss
        a1, a2 = _get_stock(admin_headers, c1["id"]), _get_stock(admin_headers, c2["id"])
        assert a1 == b1 - 2
        assert a2 == b2 - 5


# ─────────── regression: prior endpoints unaffected ───────────

class TestRegression:
    def test_stock_adjust_still_works(
        self, admin_headers, created_component_ids
    ):
        c = _make_component(admin_headers, created_component_ids, "RG1", start_stock=10)
        # +5 in
        r = requests.post(f"{TC}/components/{c['id']}/stock-adjust",
                          headers=admin_headers,
                          json={"type": "in", "qty": 5, "note": "regression"},
                          timeout=20)
        assert r.status_code in (200, 201), r.text
        assert _get_stock(admin_headers, c["id"]) == 15

    def test_procurement_endpoint_still_responds(self, admin_headers):
        r = requests.get(f"{TC}/procurement", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert "totalOrders" in body

    def test_procurement_forecast_still_works(self, admin_headers):
        r = requests.post(f"{TC}/procurement/forecast",
                          headers=admin_headers,
                          json={"targets": [
                              {"scope": "model", "modelId": "TEST_FORECAST_NOPE", "qty": 1}
                          ]}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert "unmatched" in body
