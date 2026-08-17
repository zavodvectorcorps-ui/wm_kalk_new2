"""AI-agent API surface (`/api/ai`).

Full READ access across the service + narrow, two-step (preview -> apply) WRITE
access to: order status/comment/assignee, tech cards, components & purchase
prices, plus a per-order cost/margin recalculation that never touches the
client-agreed price. Every write is audited (ai_agent_audit).

Auth: service key (X-AI-Agent-Key or Bearer) or human ADMIN JWT — see
services/ai_agent_auth.py.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from database import db
from services.ai_agent_auth import (
    get_ai_principal, require_scope, log_ai_action,
    make_diff_token, verify_diff_token, READ_ANY,
)

router = APIRouter(prefix="/api/ai", tags=["ai-agent"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# =============================== CONTEXT / GUIDE =============================
@router.get("/context")
async def ai_context(principal: dict = Depends(require_scope(READ_ANY))):
    """High-level orientation for the agent: what this service is, which
    collections matter, and the rules it must follow."""
    counts = {}
    for coll in ["sauna_orders", "sauna_crm_leads", "sauna_tech_cards",
                 "sauna_components", "procurement_requests"]:
        try:
            counts[coll] = await db[coll].estimated_document_count()
        except Exception:
            counts[coll] = None
    return {
        "service": "Alicor SPA — модульный конфигуратор саун (CRM + производство + логистика + закупки)",
        "principal": {"role": principal.get("role"), "initiator": principal.get("initiator")},
        "capabilities": {
            "read": "все разделы (заказы, расчёт стоимости, техкарты, комплектующие, закупки)",
            "write": [
                "заказ: статус / комментарий / ответственный (двухшагово)",
                "техкарты: создание/правка (двухшагово)",
                "комплектующие и закупочная цена (двухшагово)",
                "пересчёт заказа по ID: себестоимость+маржа, НЕ цена клиента (двухшагово)",
            ],
        },
        "rules": [
            "Любая запись — в два шага: сначала *_preview (возвращает diff и token), потом *_apply(token).",
            "Изменения цен комплектующих/техкарт действуют ТОЛЬКО вперёд; существующие заказы не пересчитываются автоматически.",
            "Пересчёт заказа обновляет только внутренние показатели (себестоимость, маржа, база комиссии). Согласованная цена клиента (total) не меняется.",
            "Все действия логируются в ai_agent_audit (инициатор: Максим через Claude).",
        ],
        "counts": counts,
    }


# =============================== READ ========================================
@router.get("/orders")
async def ai_list_orders(
    status: Optional[str] = None,
    manager: Optional[str] = None,
    limit: int = Query(100, le=500),
    principal: dict = Depends(require_scope(READ_ANY)),
):
    q: dict = {}
    if status:
        q["status"] = status
    if manager:
        q["createdBy"] = {"$regex": manager, "$options": "i"}
    # light projection — heavy fields excluded
    proj = {"_id": 0, "selectedOptions": 0, "selections": 0, "changeHistory": 0,
            "layoutConfigJson": 0}
    orders = await db.sauna_orders.find(q, proj).sort("createdAt", -1).to_list(limit)
    return {"count": len(orders), "orders": orders}


@router.get("/orders/{order_id}")
async def ai_get_order(order_id: str, principal: dict = Depends(require_scope(READ_ANY))):
    o = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    return o


@router.get("/pricing")
async def ai_get_pricing(principal: dict = Depends(require_scope(READ_ANY))):
    """Calculator cost/price configuration (read-only)."""
    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
    return prices


@router.get("/tech-cards")
async def ai_list_tech_cards(principal: dict = Depends(require_scope(READ_ANY))):
    cards = await db.sauna_tech_cards.find({}, {"_id": 0}).to_list(5000)
    return {"count": len(cards), "cards": cards}


@router.get("/tech-cards/{card_id}")
async def ai_get_tech_card(card_id: str, principal: dict = Depends(require_scope(READ_ANY))):
    c = await db.sauna_tech_cards.find_one({"id": card_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Tech card not found")
    return c


@router.get("/components")
async def ai_list_components(principal: dict = Depends(require_scope(READ_ANY))):
    items = await db.sauna_components.find({}, {"_id": 0}).sort([("category", 1), ("name", 1)]).to_list(5000)
    return {"count": len(items), "components": items}


@router.get("/procurement/requests")
async def ai_list_procurement(principal: dict = Depends(require_scope(READ_ANY))):
    reqs = await db.procurement_requests.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    return {"count": len(reqs), "requests": reqs}


@router.get("/audit")
async def ai_audit_tail(limit: int = Query(100, le=500),
                        principal: dict = Depends(require_scope(READ_ANY))):
    rows = await db.ai_agent_audit.find({}, {"_id": 0}).sort("at", -1).to_list(limit)
    return {"count": len(rows), "actions": rows}


# =============================== ORDER WRITE (2-step) =======================
_ORDER_WRITE_FIELDS = {
    "status": "status",
    "comment": "deliveryComment",
    "assignee": "createdBy",
}


class OrderUpdateBody(BaseModel):
    field: str          # one of: status | comment | assignee
    value: str


class ApplyBody(BaseModel):
    token: str


@router.post("/orders/{order_id}/update/preview")
async def ai_order_update_preview(order_id: str, body: OrderUpdateBody,
                                  principal: dict = Depends(require_scope("orders:write"))):
    if body.field not in _ORDER_WRITE_FIELDS:
        raise HTTPException(400, f"field must be one of {list(_ORDER_WRITE_FIELDS)}")
    o = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    real = _ORDER_WRITE_FIELDS[body.field]
    before = o.get(real, "")
    changes = {real: {"before": before, "after": body.value}}
    token = make_diff_token("order_update", "sauna_order", order_id, changes,
                            meta={"field": body.field})
    return {"order_id": order_id, "field": body.field, "diff": changes, "token": token}


@router.post("/orders/{order_id}/update/apply")
async def ai_order_update_apply(order_id: str, body: ApplyBody,
                                principal: dict = Depends(require_scope("orders:write"))):
    payload = verify_diff_token(body.token, expected_op="order_update")
    if payload["target_id"] != order_id:
        raise HTTPException(400, "Token does not match this order")
    o = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    real, delta = next(iter(payload["changes"].items()))
    set_doc = {real: delta["after"], "updatedAt": _now(),
               "updatedBy": principal.get("initiator")}
    hist = {"field": real, "oldValue": delta["before"], "newValue": delta["after"],
            "timestamp": _now(), "source": "ai_agent", "by": principal.get("initiator")}
    await db.sauna_orders.update_one(
        {"id": order_id},
        {"$set": set_doc, "$push": {"changeHistory": hist}},
    )
    await log_ai_action(principal, "order_update", "sauna_order", order_id,
                        before={real: delta["before"]}, after={real: delta["after"]},
                        extra={"field": payload.get("meta", {}).get("field")})
    return {"ok": True, "order_id": order_id, "changed": {real: delta["after"]}}


# =============================== ORDER RECALCULATE (2-step) =================
@router.post("/orders/{order_id}/recalculate/preview")
async def ai_order_recalc_preview(order_id: str,
                                  principal: dict = Depends(require_scope("orders:recalculate"))):
    """Preview refreshed cost/margin from current tech-cards & purchase prices.
    Does NOT touch the client-agreed price (`total`)."""
    from routes.sauna_orders import _recompute_one, _flatten_options  # lazy import
    o = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
    patch = _recompute_one(o, prices, _flatten_options(prices))
    if not patch:
        raise HTTPException(400, "Cannot recompute — model not found in current prices")
    if patch.get("marginNeedsBackfill"):
        raise HTTPException(400, "Dealer order missing manufacturerTotal — backfill required first")
    changes = {
        "totalCost": {"before": o.get("totalCost"), "after": patch.get("totalCost")},
        "margin": {"before": o.get("margin"), "after": patch.get("margin")},
    }
    token = make_diff_token("order_recalc", "sauna_order", order_id,
                            {k: v for k, v in changes.items()},
                            meta={"patch": patch})
    return {
        "order_id": order_id,
        "clientPrice_total": o.get("total"),  # unchanged, shown for context
        "diff": changes,
        "token": token,
        "note": "Цена клиента (total) не меняется — обновляются только себестоимость и маржа.",
    }


@router.post("/orders/{order_id}/recalculate/apply")
async def ai_order_recalc_apply(order_id: str, body: ApplyBody,
                                principal: dict = Depends(require_scope("orders:recalculate"))):
    payload = verify_diff_token(body.token, expected_op="order_recalc")
    if payload["target_id"] != order_id:
        raise HTTPException(400, "Token does not match this order")
    patch = payload.get("meta", {}).get("patch") or {}
    # Safety: never write the client price fields.
    patch.pop("total", None)
    patch.pop("subtotal", None)
    patch["marginRecalculatedBy"] = principal.get("initiator")
    o = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0, "totalCost": 1, "margin": 1})
    await db.sauna_orders.update_one({"id": order_id}, {"$set": patch})
    await log_ai_action(principal, "order_recalc", "sauna_order", order_id,
                        before={"totalCost": (o or {}).get("totalCost"), "margin": (o or {}).get("margin")},
                        after={"totalCost": patch.get("totalCost"), "margin": patch.get("margin")})
    return {"ok": True, "order_id": order_id,
            "totalCost": patch.get("totalCost"), "margin": patch.get("margin")}


# =============================== COMPONENT PURCHASE PRICE (2-step) ==========
class PriceBody(BaseModel):
    unitPrice: float


@router.post("/components/{component_id}/purchase-price/preview")
async def ai_component_price_preview(component_id: str, body: PriceBody,
                                     principal: dict = Depends(require_scope("procurement:write"))):
    c = await db.sauna_components.find_one({"id": component_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Component not found")
    before = float(c.get("unitPrice") or 0)
    affected = await db.sauna_tech_cards.count_documents({"items.componentId": component_id})
    changes = {"unitPrice": {"before": before, "after": float(body.unitPrice)}}
    token = make_diff_token("component_price", "sauna_component", component_id, changes,
                            meta={"affectedCards": affected})
    return {"component_id": component_id, "name": c.get("name"), "diff": changes,
            "affectedCards": affected, "token": token,
            "note": "Действует вперёд. Существующие заказы не пересчитываются автоматически."}


@router.post("/components/{component_id}/purchase-price/apply")
async def ai_component_price_apply(component_id: str, body: ApplyBody,
                                   principal: dict = Depends(require_scope("procurement:write"))):
    from routes.sauna_tech_cards import _recompute_and_sync  # lazy import
    payload = verify_diff_token(body.token, expected_op="component_price")
    if payload["target_id"] != component_id:
        raise HTTPException(400, "Token does not match this component")
    delta = payload["changes"]["unitPrice"]
    await db.sauna_components.update_one(
        {"id": component_id},
        {"$set": {"unitPrice": delta["after"], "updatedAt": _now()}},
    )
    # Propagate to affected tech-cards' cost (catalog) — forward-only.
    affected_cards = await db.sauna_tech_cards.find(
        {"items.componentId": component_id}, {"_id": 0, "id": 1}
    ).to_list(5000)
    recomputed = 0
    for tc in affected_cards:
        try:
            await _recompute_and_sync(tc["id"])
            recomputed += 1
        except Exception:
            pass
    await log_ai_action(principal, "component_price", "sauna_component", component_id,
                        before={"unitPrice": delta["before"]},
                        after={"unitPrice": delta["after"]},
                        extra={"recomputedCards": recomputed})
    return {"ok": True, "component_id": component_id, "unitPrice": delta["after"],
            "recomputedCards": recomputed}


# =============================== TECH CARD WRITE (2-step) ===================
class TechCardBody(BaseModel):
    # Whitelisted editable fields of a tech card
    items: Optional[list] = None      # BOM lines [{componentId, qty, ...}]
    note: Optional[str] = None


@router.post("/tech-cards/{card_id}/update/preview")
async def ai_techcard_preview(card_id: str, body: TechCardBody,
                              principal: dict = Depends(require_scope("tech_cards:write"))):
    c = await db.sauna_tech_cards.find_one({"id": card_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Tech card not found")
    changes = {}
    if body.items is not None:
        changes["items"] = {"before": c.get("items"), "after": body.items}
    if body.note is not None:
        changes["note"] = {"before": c.get("note"), "after": body.note}
    if not changes:
        raise HTTPException(400, "No editable fields provided (items | note)")
    token = make_diff_token("techcard_update", "sauna_tech_card", card_id, changes)
    return {"card_id": card_id, "diff": changes, "token": token,
            "note": "Действует вперёд; существующие заказы не пересчитываются автоматически."}


@router.post("/tech-cards/{card_id}/update/apply")
async def ai_techcard_apply(card_id: str, body: ApplyBody,
                            principal: dict = Depends(require_scope("tech_cards:write"))):
    from routes.sauna_tech_cards import _recompute_and_sync  # lazy import
    payload = verify_diff_token(body.token, expected_op="techcard_update")
    if payload["target_id"] != card_id:
        raise HTTPException(400, "Token does not match this card")
    set_doc = {"updatedAt": _now()}
    for field, delta in payload["changes"].items():
        set_doc[field] = delta["after"]
    await db.sauna_tech_cards.update_one({"id": card_id}, {"$set": set_doc})
    try:
        await _recompute_and_sync(card_id)
    except Exception:
        pass
    await log_ai_action(principal, "techcard_update", "sauna_tech_card", card_id,
                        before={k: v["before"] for k, v in payload["changes"].items()},
                        after={k: v["after"] for k, v in payload["changes"].items()})
    return {"ok": True, "card_id": card_id, "changed": list(payload["changes"].keys())}
