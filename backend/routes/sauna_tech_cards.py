"""Sauna Tech Cards & Components — cost-price BOM management.

Two collections:
  * sauna_components     — master catalog of raw components/materials.
  * sauna_tech_cards     — BOM per scope (model/variant/option/option_variant).

When a component's unitPrice changes → all tech-cards containing it are
recomputed; if `syncToCostPrice=true`, the result is written back to the
target entity's costPrice in the sauna_prices doc.
"""
"""Sauna Tech Cards (BOM) + Components — admin-only routes.

Build marker: iter95.1 (2026-05-16 — force backend rebuild for export/import endpoints).
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging
import io

from database import db
from services.auth_service import get_admin_user
from services import sauna_production_excel as prod_xlsx

router = APIRouter(prefix="/sauna-production/cost", tags=["Sauna Tech Cards"])
logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip(d):
    if d and "_id" in d:
        d.pop("_id", None)
    return d


# ============================================================
# COMPONENTS
# ============================================================

DEFAULT_COMPONENT_CATEGORIES = [
    {"id": "wood",      "name": "Дерево",      "color": "#a16207"},
    {"id": "metal",     "name": "Металл",      "color": "#64748b"},
    {"id": "fasteners", "name": "Крепёж",      "color": "#475569"},
    {"id": "electric",  "name": "Электрика",   "color": "#eab308"},
    {"id": "heater",    "name": "Печь",        "color": "#dc2626"},
    {"id": "glass",     "name": "Стекло",      "color": "#0ea5e9"},
    {"id": "insulation","name": "Изоляция",    "color": "#f97316"},
    {"id": "finishing", "name": "Отделка",     "color": "#10b981"},
    {"id": "other",     "name": "Прочее",      "color": "#94a3b8"},
]


@router.get("/categories")
async def list_categories(_: dict = Depends(get_admin_user)):
    return {"items": DEFAULT_COMPONENT_CATEGORIES}


@router.get("/components")
async def list_components(_: dict = Depends(get_admin_user)):
    items = await db.sauna_components.find({}, {"_id": 0}).sort([("category", 1), ("name", 1)]).to_list(length=5000)
    return {"items": items, "count": len(items)}


@router.post("/components")
async def create_component(body: dict, _: dict = Depends(get_admin_user)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    item = {
        "id": str(uuid.uuid4()),
        "name": name,
        "category": body.get("category") or "other",
        "unit": body.get("unit") or "шт",
        "unitPrice": float(body.get("unitPrice") or 0),
        "supplier": body.get("supplier") or "",
        "note": body.get("note") or "",
        "stockCurrent": float(body.get("stockCurrent") or 0),
        "stockMin": float(body.get("stockMin") or 0),
        "isActive": bool(body.get("isActive", True)),
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await db.sauna_components.insert_one(item)
    return _strip(item)


@router.put("/components/{component_id}")
async def update_component(component_id: str, body: dict, _: dict = Depends(get_admin_user)):
    existing = await db.sauna_components.find_one({"id": component_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Component not found")
    old_price = float(existing.get("unitPrice") or 0)
    update = {}
    for k in ("name", "category", "unit", "supplier", "note"):
        if k in body and body[k] is not None:
            update[k] = body[k]
    if "unitPrice" in body and body["unitPrice"] is not None:
        update["unitPrice"] = float(body["unitPrice"])
    if "stockCurrent" in body and body["stockCurrent"] is not None:
        update["stockCurrent"] = float(body["stockCurrent"])
    if "stockMin" in body and body["stockMin"] is not None:
        update["stockMin"] = float(body["stockMin"])
    if "isActive" in body:
        update["isActive"] = bool(body["isActive"])
    update["updatedAt"] = _now()
    await db.sauna_components.update_one({"id": component_id}, {"$set": update})

    new_price = update.get("unitPrice", old_price)
    affected = 0
    if abs(new_price - old_price) > 1e-9:
        # Recompute all tech-cards that use this component
        affected_cards = await db.sauna_tech_cards.find(
            {"items.componentId": component_id}, {"_id": 0}
        ).to_list(length=5000)
        for tc in affected_cards:
            await _recompute_and_sync(tc["id"])
            affected += 1
    return {"ok": True, "affectedCards": affected, "priceChanged": abs(new_price - old_price) > 1e-9}


@router.delete("/components/{component_id}")
async def delete_component(component_id: str, _: dict = Depends(get_admin_user)):
    # Check usage
    in_use = await db.sauna_tech_cards.count_documents({"items.componentId": component_id})
    if in_use > 0:
        raise HTTPException(400, f"Компонент используется в {in_use} тех.карт(ах). Сначала удалите его из них.")
    res = await db.sauna_components.delete_one({"id": component_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Component not found")
    return {"ok": True}


# ============================================================
# TECH CARDS
# ============================================================

VALID_SCOPES = ("model", "variant", "option", "option_variant")


async def _resolve_target_meta(card: dict) -> dict:
    """Return {name, retailPrice} for the target entity from sauna_prices."""
    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
    scope = card.get("scope")
    model_id = card.get("modelId")
    variant_id = card.get("variantId")
    option_id = card.get("optionId")
    option_variant_id = card.get("optionVariantId")

    name = ""
    retail = 0

    if scope == "model":
        for m in prices.get("models", []) or []:
            if m.get("id") == model_id:
                name = m.get("name") or model_id
                retail = int(m.get("basePrice") or 0)
                break
    elif scope == "variant":
        for m in prices.get("models", []) or []:
            if m.get("id") == model_id:
                for v in m.get("variants", []) or []:
                    if v.get("id") == variant_id:
                        name = f"{m.get('name','')} — {v.get('name','')}".strip(" —")
                        retail = int(v.get("price") or 0) + int(m.get("basePrice") or 0)
                        break
    elif scope in ("option", "option_variant"):
        opts = list(prices.get("options", []) or [])
        for cat in prices.get("categories", []) or []:
            opts.extend(cat.get("options", []) or [])
        for o in opts:
            if o.get("id") == option_id:
                if scope == "option":
                    name = o.get("name") or option_id
                    retail = int(o.get("price") or 0)
                else:
                    for v in o.get("variants", []) or []:
                        if v.get("id") == option_variant_id:
                            name = f"{o.get('name','')} — {v.get('name','')}".strip(" —")
                            retail = int(v.get("price") or 0)
                            break
                break
    return {"name": name, "retailPrice": retail}


async def _compute_totals(card: dict) -> dict:
    components_ids = [it.get("componentId") for it in (card.get("items") or []) if it.get("componentId")]
    by_id = {}
    if components_ids:
        cursor = db.sauna_components.find({"id": {"$in": components_ids}}, {"_id": 0})
        for c in await cursor.to_list(length=1000):
            by_id[c["id"]] = c

    materials = 0.0
    enriched_items = []
    for it in (card.get("items") or []):
        comp = by_id.get(it.get("componentId"))
        unit_price = float(comp.get("unitPrice") or 0) if comp else 0
        qty = float(it.get("qty") or 0)
        line_total = round(unit_price * qty, 2)
        materials += line_total
        enriched_items.append({
            **it,
            "componentName": (comp or {}).get("name", ""),
            "componentCategory": (comp or {}).get("category", ""),
            "unit": (comp or {}).get("unit", ""),
            "unitPrice": unit_price,
            "lineTotal": line_total,
            "missing": comp is None,
        })

    labor = float(card.get("laborCost") or 0)
    overhead_pct = float(card.get("overheadPct") or 0)
    overhead = round(materials * overhead_pct / 100.0, 2)
    manual = float(card.get("manualAdjustment") or 0)
    total = round(materials + labor + overhead + manual, 2)
    # Розничные накладные расходы (доставка клиенту, упаковка для конечника,
    # комиссия продавца). Учитываются только в розничной марже, не в дилерской.
    retail_extra = float(card.get("retailExtraCost") or 0)

    meta = await _resolve_target_meta(card)
    retail_brutto = meta["retailPrice"]  # retail in sauna_prices is stored as gross/brutto (incl. VAT)
    # Cost prices are entered NET (without VAT). VAT in PL is 23%.
    vat_rate = 0.23
    retail_netto = round(retail_brutto / (1 + vat_rate), 2) if retail_brutto else 0
    # Pure margin (used for dealer pricing comparisons; retail extra IGNORED)
    margin = round(retail_netto - total, 2) if retail_netto else 0
    margin_pct = round(margin * 100.0 / retail_netto, 1) if retail_netto > 0 else None
    # Retail margin (CRM/orders): subtracts retail-only extras
    retail_margin = round(margin - retail_extra, 2) if retail_netto else 0
    retail_margin_pct = round(retail_margin * 100.0 / retail_netto, 1) if retail_netto > 0 else None

    return {
        "items": enriched_items,
        "materialsCost": round(materials, 2),
        "laborCost": labor,
        "overheadPct": overhead_pct,
        "overheadCost": overhead,
        "manualAdjustment": manual,
        "totalCost": int(round(total)),
        "retailExtraCost": int(round(retail_extra)),
        "retailPrice": retail_brutto,
        "retailNetto": int(round(retail_netto)),
        "vatRate": vat_rate,
        "marginAmount": int(round(margin)),
        "marginPct": margin_pct,
        "retailMarginAmount": int(round(retail_margin)),
        "retailMarginPct": retail_margin_pct,
        "name": meta["name"],
    }


async def _sync_cost_price_to_sauna_prices(card: dict, total_cost: int, retail_extra: int = 0):
    """Write totalCost into the target entity's costPrice field in sauna_prices.

    Also writes retailExtraCost so order-margin recomputation can subtract retail-only
    overhead (delivery, packaging, sales commission) when computing real retail margin.
    """
    scope = card.get("scope")
    model_id = card.get("modelId")
    variant_id = card.get("variantId")
    option_id = card.get("optionId")
    option_variant_id = card.get("optionVariantId")

    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
    models = list(prices.get("models", []) or [])
    categories = list(prices.get("categories", []) or [])
    options = list(prices.get("options", []) or [])

    changed = False

    def _maybe_set(obj: dict, key: str, val: int) -> bool:
        if int(obj.get(key) or 0) != int(val):
            obj[key] = int(val)
            return True
        return False

    if scope == "model":
        for m in models:
            if m.get("id") == model_id:
                if _maybe_set(m, "costPrice", total_cost):
                    changed = True
                if _maybe_set(m, "retailExtraCost", retail_extra):
                    changed = True
                break
    elif scope == "variant":
        for m in models:
            if m.get("id") == model_id:
                for v in m.get("variants", []) or []:
                    if v.get("id") == variant_id:
                        if _maybe_set(v, "costPrice", total_cost):
                            changed = True
                        if _maybe_set(v, "retailExtraCost", retail_extra):
                            changed = True
                        break
                break
    elif scope in ("option", "option_variant"):
        target_opt = None
        for o in options:
            if o.get("id") == option_id:
                target_opt = o
                break
        if target_opt is None:
            for cat in categories:
                for o in (cat.get("options") or []):
                    if o.get("id") == option_id:
                        target_opt = o
                        break
                if target_opt:
                    break
        if target_opt:
            if scope == "option":
                if _maybe_set(target_opt, "costPrice", total_cost):
                    changed = True
                if _maybe_set(target_opt, "retailExtraCost", retail_extra):
                    changed = True
            else:
                for v in (target_opt.get("variants") or []):
                    if v.get("id") == option_variant_id:
                        if _maybe_set(v, "costPrice", total_cost):
                            changed = True
                        if _maybe_set(v, "retailExtraCost", retail_extra):
                            changed = True
                        break

    if changed:
        await db.sauna_prices.update_one(
            {"_id": "default"},
            {"$set": {"models": models, "categories": categories, "options": options}},
            upsert=True,
        )
    return changed


async def _recompute_and_sync(card_id: str):
    card = await db.sauna_tech_cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        return None
    totals = await _compute_totals(card)
    set_doc = {
        "name": totals["name"],
        "materialsCost": totals["materialsCost"],
        "laborCost": totals["laborCost"],
        "overheadPct": totals["overheadPct"],
        "overheadCost": totals["overheadCost"],
        "manualAdjustment": totals["manualAdjustment"],
        "retailExtraCost": totals["retailExtraCost"],
        "totalCost": totals["totalCost"],
        "retailPrice": totals["retailPrice"],
        "retailNetto": totals["retailNetto"],
        "vatRate": totals["vatRate"],
        "marginAmount": totals["marginAmount"],
        "marginPct": totals["marginPct"],
        "retailMarginAmount": totals["retailMarginAmount"],
        "retailMarginPct": totals["retailMarginPct"],
        "updatedAt": _now(),
    }
    await db.sauna_tech_cards.update_one({"id": card_id}, {"$set": set_doc})
    synced = False
    if card.get("syncToCostPrice"):
        synced = await _sync_cost_price_to_sauna_prices(
            card, totals["totalCost"], totals.get("retailExtraCost", 0),
        )
    return {"card": {**card, **set_doc}, "synced": synced}


@router.get("/tech-cards")
async def list_tech_cards(modelId: Optional[str] = None, _: dict = Depends(get_admin_user)):
    q = {}
    if modelId:
        q["modelId"] = modelId
    items = await db.sauna_tech_cards.find(q, {"_id": 0}).sort("updatedAt", -1).to_list(length=2000)
    return {"items": items, "count": len(items)}


@router.get("/tech-cards/{card_id}")
async def get_tech_card(card_id: str, _: dict = Depends(get_admin_user)):
    card = await db.sauna_tech_cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Tech card not found")
    # Always return enriched items with current unitPrice
    totals = await _compute_totals(card)
    return {**card, **totals}


@router.post("/tech-cards")
async def upsert_tech_card(body: dict, _: dict = Depends(get_admin_user)):
    """Create or update a tech card. Idempotent by (scope, modelId, variantId, optionId, optionVariantId)."""
    scope = body.get("scope") or "model"
    if scope not in VALID_SCOPES:
        raise HTTPException(400, f"scope must be one of {VALID_SCOPES}")
    if not body.get("modelId") and scope in ("model", "variant"):
        raise HTTPException(400, "modelId required for model/variant scope")
    if scope in ("option", "option_variant") and not body.get("optionId"):
        raise HTTPException(400, "optionId required for option scope")

    key = {
        "scope": scope,
        "modelId": body.get("modelId") or "",
        "variantId": body.get("variantId") or "",
        "optionId": body.get("optionId") or "",
        "optionVariantId": body.get("optionVariantId") or "",
    }
    existing = await db.sauna_tech_cards.find_one(key, {"_id": 0})

    items = []
    for it in (body.get("items") or []):
        comp_id = (it.get("componentId") or "").strip()
        if not comp_id:
            continue
        items.append({
            "id": it.get("id") or str(uuid.uuid4()),
            "componentId": comp_id,
            "qty": float(it.get("qty") or 0),
            "note": it.get("note") or "",
        })

    doc = {
        **key,
        "items": items,
        "laborCost": float(body.get("laborCost") or 0),
        "overheadPct": float(body.get("overheadPct") or 0),
        "manualAdjustment": float(body.get("manualAdjustment") or 0),
        "retailExtraCost": float(body.get("retailExtraCost") or 0),
        "syncToCostPrice": bool(body.get("syncToCostPrice", True)),
        "note": body.get("note") or "",
        "updatedAt": _now(),
    }
    if existing:
        card_id = existing["id"]
        await db.sauna_tech_cards.update_one({"id": card_id}, {"$set": doc})
    else:
        card_id = str(uuid.uuid4())
        doc["id"] = card_id
        doc["createdAt"] = _now()
        await db.sauna_tech_cards.insert_one(doc)

    result = await _recompute_and_sync(card_id)
    return result["card"] if result else doc


@router.delete("/tech-cards/{card_id}")
async def delete_tech_card(card_id: str, _: dict = Depends(get_admin_user)):
    res = await db.sauna_tech_cards.delete_one({"id": card_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tech card not found")
    return {"ok": True}


@router.post("/tech-cards/recompute-all")
async def recompute_all(_: dict = Depends(get_admin_user)):
    cards = await db.sauna_tech_cards.find({}, {"_id": 0, "id": 1}).to_list(length=5000)
    n = 0
    for c in cards:
        await _recompute_and_sync(c["id"])
        n += 1
    return {"ok": True, "recomputed": n}


@router.get("/dashboard")
async def cost_dashboard(_: dict = Depends(get_admin_user)):
    """Compact stats for the cost-cards page."""
    total_components = await db.sauna_components.count_documents({})
    total_cards = await db.sauna_tech_cards.count_documents({})
    # Average margin across cards that have retail > 0
    cursor = db.sauna_tech_cards.find(
        {"retailPrice": {"$gt": 0}}, {"_id": 0, "marginPct": 1, "marginAmount": 1, "totalCost": 1, "retailPrice": 1, "name": 1, "scope": 1, "modelId": 1, "variantId": 1, "optionId": 1}
    )
    pcts = []
    low = 0
    cards = []
    async for c in cursor:
        if c.get("marginPct") is not None:
            pcts.append(c["marginPct"])
            cards.append(c)
            if c["marginPct"] < 15:
                low += 1
    avg = round(sum(pcts) / len(pcts), 1) if pcts else None
    # Top-5 low margin
    low_margin_top = sorted(cards, key=lambda x: x["marginPct"])[:5]
    high_margin_top = sorted(cards, key=lambda x: -x["marginPct"])[:5]
    return {
        "totalComponents": total_components,
        "totalCards": total_cards,
        "avgMarginPct": avg,
        "lowMarginCards": low,
        "lowMarginTop": low_margin_top,
        "highMarginTop": high_margin_top,
    }


# ============================================================
# SEED — bulk-import default components from packaged template
# ============================================================

@router.post("/components/seed-from-template")
async def seed_components_from_template(_: dict = Depends(get_admin_user)):
    """Bulk-import a starter catalog of ~49 components extracted from the
    user's pricing spreadsheet (Себес Сауны.xlsx). Adds only components that
    don't already exist by exact name match. Idempotent.
    """
    import json
    import os
    seed_path = os.path.join(os.path.dirname(__file__), "..", "data", "sauna_components_seed.json")
    if not os.path.exists(seed_path):
        raise HTTPException(404, "Seed file not found")
    with open(seed_path, "r", encoding="utf-8") as f:
        items = json.load(f)
    existing_names = set()
    cursor = db.sauna_components.find({}, {"_id": 0, "name": 1})
    async for c in cursor:
        existing_names.add((c.get("name") or "").lower())
    added = 0
    for it in items:
        name = (it.get("name") or "").strip()
        if not name or name.lower() in existing_names:
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "name": name,
            "category": it.get("category") or "other",
            "unit": it.get("unit") or "шт",
            "unitPrice": float(it.get("unitPrice") or 0),
            "supplier": it.get("supplier") or "",
            "note": it.get("note") or "",
            "isActive": bool(it.get("isActive", True)),
            "createdAt": _now(),
            "updatedAt": _now(),
        }
        await db.sauna_components.insert_one(doc)
        added += 1
    return {"ok": True, "added": added, "skipped": len(items) - added, "total": len(items)}


# ============================================================
# DUPLICATE — copy a tech card to another scope target
# ============================================================

@router.post("/tech-cards/{card_id}/duplicate")
async def duplicate_tech_card(card_id: str, body: dict, _: dict = Depends(get_admin_user)):
    """Copy this card's BOM + labor + overhead onto a new target.

    Body: { scope, modelId?, variantId?, optionId?, optionVariantId? }
    Returns the newly created / updated tech card.
    """
    src = await db.sauna_tech_cards.find_one({"id": card_id}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Source tech card not found")
    scope = body.get("scope") or src["scope"]
    if scope not in VALID_SCOPES:
        raise HTTPException(400, f"scope must be one of {VALID_SCOPES}")

    new_items = []
    for it in (src.get("items") or []):
        new_items.append({
            "id": str(uuid.uuid4()),
            "componentId": it.get("componentId"),
            "qty": it.get("qty"),
            "note": it.get("note") or "",
        })

    target_key = {
        "scope": scope,
        "modelId": body.get("modelId") or "",
        "variantId": body.get("variantId") or "",
        "optionId": body.get("optionId") or "",
        "optionVariantId": body.get("optionVariantId") or "",
    }

    payload = {
        **target_key,
        "items": new_items,
        "laborCost": src.get("laborCost", 0),
        "overheadPct": src.get("overheadPct", 0),
        "manualAdjustment": src.get("manualAdjustment", 0),
        "retailExtraCost": src.get("retailExtraCost", 0),
        "syncToCostPrice": src.get("syncToCostPrice", True),
        "note": f"Скопировано из {src.get('name') or src['id'][:8]}",
    }
    return await upsert_tech_card(payload, _)


# ============================================================
# PROCUREMENT — shopping list from active production orders
# ============================================================

def _extract_targets_from_lead(lead: dict) -> list[dict]:
    """Return [{scope, modelId, variantId?, optionId?, optionVariantId?}] for one in-production lead.

    Looks for model+options in several common locations to be robust against
    schema drift across leads.
    """
    targets: list[dict] = []
    cd = lead.get("calculatorData") or lead.get("config") or {}
    model_id = lead.get("modelId") or cd.get("modelId") or cd.get("model_id") or ""
    variant_id = lead.get("variantId") or cd.get("variantId") or cd.get("variant_id") or ""
    if model_id:
        if variant_id:
            targets.append({"scope": "variant", "modelId": model_id, "variantId": variant_id})
        else:
            targets.append({"scope": "model", "modelId": model_id})

    # Options can be dict {optionId: variantId|true} or list of ids
    opts = cd.get("selectedOptions") or cd.get("options") or lead.get("selectedOptions") or {}
    if isinstance(opts, dict):
        for oid, ov in opts.items():
            if not oid or oid == "false" or ov in (False, None):
                continue
            if isinstance(ov, str) and ov not in ("true", "True"):
                targets.append({"scope": "option_variant", "optionId": oid, "optionVariantId": ov})
            else:
                targets.append({"scope": "option", "optionId": oid})
    elif isinstance(opts, list):
        for oid in opts:
            if oid:
                targets.append({"scope": "option", "optionId": oid})
    return targets


async def _aggregate_targets(targets: list[dict]) -> dict:
    """Sum BOM items across multiple (scope, key, qty=1) targets.

    Returns {totalCost, items: [{componentId, name, category, unit, totalQty, unitPrice, lineTotal, sources: [{name, qty}]}]}
    """
    keys = [
        {
            "scope": t.get("scope"),
            "modelId": t.get("modelId") or "",
            "variantId": t.get("variantId") or "",
            "optionId": t.get("optionId") or "",
            "optionVariantId": t.get("optionVariantId") or "",
        }
        for t in targets
    ]
    if not keys:
        return {"items": [], "totalMaterials": 0, "matchedTargets": 0, "unmatched": []}

    cards: list[dict] = []
    unmatched: list[dict] = []
    for t, k in zip(targets, keys):
        card = await db.sauna_tech_cards.find_one(k, {"_id": 0})
        if card:
            cards.append({"target": t, "card": card})
        else:
            unmatched.append(t)

    component_ids = set()
    for entry in cards:
        for it in (entry["card"].get("items") or []):
            if it.get("componentId"):
                component_ids.add(it["componentId"])
    comps_by_id = {}
    if component_ids:
        cursor = db.sauna_components.find({"id": {"$in": list(component_ids)}}, {"_id": 0})
        for c in await cursor.to_list(length=5000):
            comps_by_id[c["id"]] = c

    agg: dict[str, dict] = {}
    for entry in cards:
        card = entry["card"]
        card_name = card.get("name") or ""
        qty_multiplier = float(entry["target"].get("qty") or 1)
        for it in (card.get("items") or []):
            cid = it.get("componentId")
            if not cid:
                continue
            line_qty = float(it.get("qty") or 0) * qty_multiplier
            comp = comps_by_id.get(cid, {})
            if cid not in agg:
                agg[cid] = {
                    "componentId": cid,
                    "name": comp.get("name", "Удалённый компонент"),
                    "category": comp.get("category", "other"),
                    "unit": comp.get("unit", ""),
                    "unitPrice": float(comp.get("unitPrice") or 0),
                    "supplier": comp.get("supplier") or "",
                    "totalQty": 0.0,
                    "sources": [],
                }
            agg[cid]["totalQty"] += line_qty
            agg[cid]["sources"].append({"target": card_name or "?", "qty": line_qty})

    items: list[dict] = []
    total_materials = 0.0
    for cid, row in agg.items():
        line_total = round(row["totalQty"] * row["unitPrice"], 2)
        row["totalQty"] = round(row["totalQty"], 3)
        row["lineTotal"] = line_total
        total_materials += line_total
        items.append(row)
    items.sort(key=lambda r: (r["category"], -r["lineTotal"]))

    return {
        "items": items,
        "totalMaterials": round(total_materials, 2),
        "matchedTargets": len(cards),
        "unmatched": unmatched,
    }


@router.get("/procurement")
async def procurement_from_production(_: dict = Depends(get_admin_user)):
    """Aggregate BOM from ALL leads currently in-production."""
    leads = await db.sauna_crm_leads.find({"inProduction": True}, {"_id": 0}).to_list(length=2000)
    targets: list[dict] = []
    by_order: list[dict] = []
    for lead in leads:
        ts = _extract_targets_from_lead(lead)
        targets.extend(ts)
        by_order.append({
            "leadId": lead.get("id"),
            "clientName": lead.get("clientName") or "",
            "modelName": lead.get("modelName") or "",
            "stageId": lead.get("productionStageId") or lead.get("stageId") or "",
            "readyDate": lead.get("readyDate") or "",
            "targets": len(ts),
        })
    result = await _aggregate_targets(targets)
    result["orders"] = by_order
    result["totalOrders"] = len(leads)
    return result


@router.post("/procurement/forecast")
async def procurement_forecast(body: dict, _: dict = Depends(get_admin_user)):
    """Manual what-if forecast.

    Body: { targets: [{scope, modelId?, variantId?, optionId?, optionVariantId?, qty:int}] }
    """
    raw = body.get("targets") or []
    if not isinstance(raw, list) or len(raw) == 0:
        raise HTTPException(400, "targets must be a non-empty array")
    flat: list[dict] = []
    for t in raw:
        qty = max(1, int(t.get("qty") or 1))
        for _ in range(qty):
            flat.append({k: v for k, v in t.items() if k != "qty"})
    result = await _aggregate_targets(flat)
    return result


# ============================================================
# STOCK MOVEMENTS — manual inventory adjustments
# ============================================================

VALID_MOVEMENT_TYPES = ("in", "out", "set")


@router.post("/components/{component_id}/stock-adjust")
async def adjust_stock(component_id: str, body: dict, user: dict = Depends(get_admin_user)):
    """Manually adjust a component's stockCurrent.

    Body: { type: "in"|"out"|"set", qty: float, note?: str }
      * in  — add qty to stockCurrent (e.g. delivery received)
      * out — subtract qty from stockCurrent (e.g. used in production)
      * set — overwrite stockCurrent with qty (e.g. after inventory audit)
    Records a movement document for the audit log.
    """
    comp = await db.sauna_components.find_one({"id": component_id}, {"_id": 0})
    if not comp:
        raise HTTPException(404, "Component not found")
    mtype = (body.get("type") or "").lower()
    if mtype not in VALID_MOVEMENT_TYPES:
        raise HTTPException(400, f"type must be one of {VALID_MOVEMENT_TYPES}")
    try:
        qty = float(body.get("qty"))
    except (TypeError, ValueError):
        raise HTTPException(400, "qty must be a number")
    if mtype in ("in", "out") and qty <= 0:
        raise HTTPException(400, "qty must be > 0 for in/out movements")
    if mtype == "set" and qty < 0:
        raise HTTPException(400, "qty cannot be negative for set movement")

    before = float(comp.get("stockCurrent") or 0)
    if mtype == "in":
        after = before + qty
    elif mtype == "out":
        after = before - qty
    else:
        after = qty

    await db.sauna_components.update_one(
        {"id": component_id},
        {"$set": {"stockCurrent": after, "updatedAt": _now()}},
    )
    movement = {
        "id": str(uuid.uuid4()),
        "componentId": component_id,
        "componentName": comp.get("name") or "",
        "type": mtype,
        "qty": qty,
        "before": before,
        "after": after,
        "note": (body.get("note") or "").strip(),
        "actorUserId": user.get("sub") or user.get("id") or "",
        "actorUsername": user.get("username") or "",
        "at": _now(),
    }
    await db.sauna_stock_movements.insert_one(dict(movement))
    movement.pop("_id", None)
    return {"ok": True, "movement": movement, "stockCurrent": after}


@router.get("/components/{component_id}/stock-movements")
async def list_stock_movements(component_id: str, _: dict = Depends(get_admin_user)):
    items = await db.sauna_stock_movements.find(
        {"componentId": component_id}, {"_id": 0},
    ).sort("at", -1).limit(200).to_list(length=200)
    return {"items": items, "count": len(items)}


@router.get("/stock-movements")
async def list_all_stock_movements(_: dict = Depends(get_admin_user)):
    """Recent stock movements across all components (last 200)."""
    items = await db.sauna_stock_movements.find(
        {}, {"_id": 0},
    ).sort("at", -1).limit(200).to_list(length=200)
    return {"items": items, "count": len(items)}


# ============================================================
# EXPORT / IMPORT — components + tech-cards bundle
# ============================================================

@router.get("/export")
async def export_components_and_cards(template: bool = False, _: dict = Depends(get_admin_user)):
    """Download a two-sheet XLSX containing all components + tech-cards.

    Query ``template=true`` adds blank TechCards rows for every model
    (without variants) / variant / option (without variants) /
    option_variant that does NOT yet have a tech-card. Useful as a
    starting point — fill in Excel, then re-import.
    """
    comps = await db.sauna_components.find({}, {"_id": 0}).sort([("category", 1), ("name", 1)]).to_list(length=10000)
    cards = await db.sauna_tech_cards.find({}, {"_id": 0}).sort("updatedAt", -1).to_list(length=10000)

    empty_targets: list[dict] = []
    if template:
        prices_doc = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
        # Models — if no variants, the model itself needs a tech-card
        for m in (prices_doc.get("models") or []):
            variants = m.get("variants") or []
            if not variants:
                empty_targets.append({
                    "scope": "model",
                    "modelId": m.get("id"),
                    "componentName": m.get("name") or "",
                })
            for v in variants:
                empty_targets.append({
                    "scope": "variant",
                    "modelId": m.get("id"),
                    "variantId": v.get("id"),
                    "componentName": f"{m.get('name', '')} — {v.get('name') or v.get('namePl') or ''}",
                })
        # Options (flat + categorised)
        flat_opts = list(prices_doc.get("options") or [])
        for cat in (prices_doc.get("categories") or []):
            for o in (cat.get("options") or []):
                flat_opts.append({**o, "_catName": cat.get("name")})
        for o in flat_opts:
            variants = o.get("variants") or []
            if not variants:
                empty_targets.append({
                    "scope": "option",
                    "optionId": o.get("id"),
                    "componentName": f"{('[' + o.get('_catName') + '] ') if o.get('_catName') else ''}{o.get('name') or o.get('namePl') or ''}",
                })
            for v in variants:
                empty_targets.append({
                    "scope": "option_variant",
                    "optionId": o.get("id"),
                    "optionVariantId": v.get("id"),
                    "componentName": f"{o.get('name') or ''} — {v.get('name') or v.get('namePl') or ''}",
                })

    blob = prod_xlsx.export_xlsx(comps, cards, empty_targets=empty_targets if template else None)
    suffix = "_template" if template else ""
    fname = f"sauna_production{suffix}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        io.BytesIO(blob),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@router.post("/import-dry-run")
async def import_dry_run(file: UploadFile = File(...), _: dict = Depends(get_admin_user)):
    """Parse the uploaded XLSX and return a diff preview (no DB writes)."""
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(400, "Only .xlsx files are supported")
    blob = await file.read()
    try:
        parsed_comps, parsed_cards, errors = prod_xlsx.parse_xlsx(blob)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {e}")
    existing_comps = await db.sauna_components.find({}, {"_id": 0}).to_list(length=10000)
    existing_cards = await db.sauna_tech_cards.find({}, {"_id": 0}).to_list(length=10000)
    return {
        "components": prod_xlsx.diff_components(parsed_comps, existing_comps),
        "techCards": prod_xlsx.diff_cards(parsed_cards, existing_cards),
        "errors": errors,
        "summary": {
            "componentsParsed": len(parsed_comps),
            "techCardsParsed": len(parsed_cards),
            "errorsCount": len(errors),
        },
    }


@router.post("/import-commit")
async def import_commit(file: UploadFile = File(...), _: dict = Depends(get_admin_user)):
    """Apply the uploaded XLSX to DB: upserts components and tech-cards.

    Components: matched by id first, else by case-insensitive name.
    Tech-cards: matched by id first, else by (scope, modelId, variantId, optionId, optionVariantId).
    """
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(400, "Only .xlsx files are supported")
    blob = await file.read()
    parsed_comps, parsed_cards, errors = prod_xlsx.parse_xlsx(blob)

    existing_comps = await db.sauna_components.find({}, {"_id": 0}).to_list(length=10000)
    comp_by_id = {c["id"]: c for c in existing_comps if c.get("id")}
    comp_by_name = {(c.get("name") or "").strip().lower(): c for c in existing_comps if c.get("name")}

    comp_added = 0
    comp_updated = 0
    now = _now()
    for parsed in parsed_comps:
        existing = comp_by_id.get(parsed.get("id"))
        if not existing and parsed.get("name"):
            existing = comp_by_name.get(parsed["name"].strip().lower())
        merged = prod_xlsx.merge_component(parsed, existing)
        merged["updatedAt"] = now
        if not existing:
            merged.setdefault("createdAt", now)
            await db.sauna_components.insert_one(dict(merged))
            comp_added += 1
        else:
            await db.sauna_components.update_one(
                {"id": existing["id"]}, {"$set": {k: v for k, v in merged.items() if k != "id"}}
            )
            comp_updated += 1

    existing_cards = await db.sauna_tech_cards.find({}, {"_id": 0}).to_list(length=10000)
    card_by_id = {c["id"]: c for c in existing_cards if c.get("id")}
    card_by_key = {
        (c.get("scope"), c.get("modelId") or "", c.get("variantId") or "",
         c.get("optionId") or "", c.get("optionVariantId") or ""): c
        for c in existing_cards
    }

    card_added = 0
    card_updated = 0
    for parsed in parsed_cards:
        existing = card_by_id.get(parsed.get("id")) if parsed.get("id") else None
        if not existing:
            key = (
                parsed["scope"], parsed.get("modelId") or "",
                parsed.get("variantId") or "", parsed.get("optionId") or "",
                parsed.get("optionVariantId") or "",
            )
            existing = card_by_key.get(key)
        merged = prod_xlsx.merge_card(parsed, existing)
        merged["updatedAt"] = now
        if not existing:
            merged.setdefault("createdAt", now)
            await db.sauna_tech_cards.insert_one(dict(merged))
            card_added += 1
        else:
            await db.sauna_tech_cards.update_one(
                {"id": existing["id"]}, {"$set": {k: v for k, v in merged.items() if k != "id"}}
            )
            card_updated += 1
        # Recompute totals + sync cost-price if enabled
        await _recompute_and_sync(merged["id"])

    return {
        "ok": True,
        "components": {"added": comp_added, "updated": comp_updated},
        "techCards": {"added": card_added, "updated": card_updated},
        "errors": errors,
    }
