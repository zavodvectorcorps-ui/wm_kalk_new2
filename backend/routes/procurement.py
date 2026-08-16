"""Procurement (Закупки) — purchase requests linked to the components catalog.

Workflow:
  1. User creates a request: pick existing ``sauna_components`` item or create
     a new one inline. Quantity, unit price (defaulted from the component but
     editable), deadline (``dueDate``), supplier, assignee are captured.
  2. UI highlights overdue requests (dueDate < today and not finished).
  3. Telegram notifications:
       • On creation              → "Создана заявка на закупку…"
       • N days before deadline   → "До закупки X осталось N дней"
       • On overdue (first time)  → "Просрочена закупка…"
     A per-doc ``notifications`` map tracks what was already sent so the
     scheduler is idempotent.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from services.auth_service import get_current_user, get_admin_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/procurement", tags=["Procurement"])

COL = "procurement_requests"
COMPONENTS_COL = "sauna_components"

STATUSES = ("draft", "approved", "ordered", "delivered", "cancelled")
PRIORITIES = ("low", "medium", "high", "urgent")

# Default reminder window — admin can override per-document.
DEFAULT_REMINDER_DAYS = 3


# ─────────────────────────── Models ───────────────────────────

class ProcurementLine(BaseModel):
    """One line item inside a multi-line procurement request."""
    componentId: Optional[str] = None
    componentName: Optional[str] = ""
    category: Optional[str] = ""
    unit: Optional[str] = "шт"
    quantity: float = 1.0
    unitPrice: float = 0.0
    note: Optional[str] = ""


class ProcurementCreate(BaseModel):
    title: str
    # Multi-line mode: when ``items`` is non-empty, single-line fields are
    # ignored (we treat them as legacy / quick-shortcut input).
    items: List[ProcurementLine] = Field(default_factory=list)
    # ── Legacy single-line fields (kept for backwards compat & quick-add) ──
    componentId: Optional[str] = None
    componentName: Optional[str] = ""
    category: Optional[str] = ""
    unit: Optional[str] = "шт"
    quantity: float = 1.0
    unitPrice: float = 0.0
    # ── Common request-level fields ──
    supplier: Optional[str] = ""
    note: Optional[str] = ""
    status: str = "draft"
    priority: str = "medium"
    dueDate: Optional[str] = None  # ISO YYYY-MM-DD
    assigneeUserId: Optional[str] = None
    assigneeUsername: Optional[str] = ""
    reminderDaysBefore: int = DEFAULT_REMINDER_DAYS
    notifyTelegram: bool = True
    tags: List[str] = Field(default_factory=list)


class ProcurementUpdate(BaseModel):
    title: Optional[str] = None
    items: Optional[List[ProcurementLine]] = None  # full replacement when present
    componentId: Optional[str] = None
    componentName: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    unitPrice: Optional[float] = None
    supplier: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None
    assigneeUserId: Optional[str] = None
    assigneeUsername: Optional[str] = None
    reminderDaysBefore: Optional[int] = None
    notifyTelegram: Optional[bool] = None
    tags: Optional[List[str]] = None


class QuickComponentCreate(BaseModel):
    name: str
    category: Optional[str] = "other"
    unit: Optional[str] = "шт"
    unitPrice: float = 0.0
    supplier: Optional[str] = ""


# ─────────────────────────── Helpers ───────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip(d: dict) -> dict:
    d.pop("_id", None)
    return d


def _validate(status: Optional[str], priority: Optional[str]):
    if status is not None and status not in STATUSES:
        raise HTTPException(400, f"Invalid status. Use one of: {STATUSES}")
    if priority is not None and priority not in PRIORITIES:
        raise HTTPException(400, f"Invalid priority. Use one of: {PRIORITIES}")


def _compute_total(quantity: float, unit_price: float) -> float:
    return round(float(quantity or 0) * float(unit_price or 0), 2)


def _normalize_items(items: List[dict], components_by_id: dict) -> tuple[list[dict], float]:
    """Normalize raw line items and compute their total sum.

    - Auto-fills missing fields from the component catalog (name, category,
      unit, unitPrice) when ``componentId`` resolves to a known component.
    - Computes per-line ``totalPrice``.
    """
    normalized: list[dict] = []
    grand = 0.0
    for raw in items or []:
        line = dict(raw) if not isinstance(raw, dict) else raw
        cid = line.get("componentId")
        comp = components_by_id.get(cid) if cid else None
        if comp:
            line["componentName"] = line.get("componentName") or comp.get("name", "")
            line["category"] = line.get("category") or comp.get("category", "")
            line["unit"] = line.get("unit") or comp.get("unit", "шт")
            if not float(line.get("unitPrice") or 0):
                line["unitPrice"] = float(comp.get("unitPrice", 0) or 0)
        qty = float(line.get("quantity") or 0)
        price = float(line.get("unitPrice") or 0)
        line["quantity"] = qty
        line["unitPrice"] = price
        line["totalPrice"] = _compute_total(qty, price)
        grand += line["totalPrice"]
        normalized.append(line)
    return normalized, round(grand, 2)


async def _resolve_components_by_id(ids: list[str]) -> dict:
    """Fetch sauna_components by ids, return dict keyed by id."""
    ids = [i for i in ids if i]
    if not ids:
        return {}
    cursor = db[COMPONENTS_COL].find({"id": {"$in": ids}}, {"_id": 0})
    return {c["id"]: c async for c in cursor}


def _is_finished(status: str) -> bool:
    return status in ("delivered", "cancelled")


async def _apply_stock_delivery(doc: dict, direction: int = 1) -> dict:
    """Add (direction=+1) or subtract (direction=-1) request quantities to/from
    ``sauna_components.stockCurrent``.

    Returns a summary {"applied": int, "skipped": int, "updates": [...]} so the
    caller can show feedback. Uses Mongo ``$inc`` per component to be atomic.
    Items without a ``componentId`` are skipped — we can't auto-update stock
    on a free-form line.
    """
    items: list = doc.get("items") or []
    # Legacy single-line fallback.
    if not items and doc.get("componentId"):
        items = [{
            "componentId": doc["componentId"],
            "quantity": doc.get("quantity", 0),
        }]
    applied = 0
    skipped = 0
    updates: list[dict] = []
    for it in items:
        cid = it.get("componentId")
        qty = float(it.get("quantity") or 0)
        if not cid or qty <= 0:
            skipped += 1
            continue
        delta = qty * direction
        res = await db[COMPONENTS_COL].update_one(
            {"id": cid},
            {"$inc": {"stockCurrent": delta},
             "$set": {"updatedAt": _now()}},
        )
        if res.matched_count:
            applied += 1
            updates.append({"componentId": cid, "delta": delta})
        else:
            skipped += 1
    return {"applied": applied, "skipped": skipped, "updates": updates}


async def _send_telegram(message: str) -> bool:
    """Send a Telegram message via the bot. Returns True if delivered.
    Routed to the dedicated alerts chat (Настройки CRM → alertsChatId) when set."""
    try:
        from services.telegram_service import send_telegram_message
        alerts_chat = None
        try:
            s = await db.sauna_crm_settings.find_one({}, {"_id": 0, "alertsChatId": 1})
            alerts_chat = (s or {}).get("alertsChatId") or None
        except Exception:
            alerts_chat = None
        return bool(await send_telegram_message(message, chat_id=alerts_chat))
    except Exception as e:
        logger.warning(f"procurement telegram send failed: {e}")
        return False


def _format_request_message(prefix: str, doc: dict) -> str:
    """HTML-formatted Telegram message for a procurement request.

    Supports both single-line (legacy fields on the doc itself) and
    multi-line (``items`` array) requests. Multi-line variants get a
    bulleted positions block.
    """
    title = doc.get("title", "—")
    total = doc.get("totalPrice", 0)
    due = doc.get("dueDate") or "—"
    supplier = doc.get("supplier") or "—"
    assignee = doc.get("assigneeUsername") or "не назначен"
    items = doc.get("items") or []

    if items:
        # Multi-line: render a compact positions list (up to 10 lines).
        positions_lines = []
        for it in items[:10]:
            name = it.get("componentName") or "—"
            qty = it.get("quantity", 0)
            unit = it.get("unit") or ""
            price = it.get("totalPrice", 0)
            positions_lines.append(f"• {name} — <b>{qty} {unit}</b> · {price:.2f}")
        if len(items) > 10:
            positions_lines.append(f"… и ещё {len(items) - 10} поз.")
        positions = "\n".join(positions_lines)
        return (
            f"{prefix}\n"
            f"📦 <b>{title}</b>\n"
            f"Позиций: <b>{len(items)}</b>\n"
            f"{positions}\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"Итого: <b>{total:.2f}</b>\n"
            f"Срок: <b>{due}</b>\n"
            f"Поставщик: {supplier}\n"
            f"Ответственный: <b>{assignee}</b>"
        )

    # Legacy single-line variant
    qty = doc.get("quantity", 0)
    unit = doc.get("unit", "шт")
    return (
        f"{prefix}\n"
        f"📦 <b>{title}</b>\n"
        f"Кол-во: <b>{qty} {unit}</b>\n"
        f"Сумма: <b>{total:.2f}</b>\n"
        f"Срок: <b>{due}</b>\n"
        f"Поставщик: {supplier}\n"
        f"Ответственный: <b>{assignee}</b>"
    )


# ─────────────────────────── Endpoints: components ───────────────────────────

@router.get("/components")
async def list_components_for_procurement(_: dict = Depends(get_current_user)):
    """Return active components for the procurement picker (id, name, price, unit)."""
    items = await db[COMPONENTS_COL].find(
        {"isActive": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "category": 1,
         "unit": 1, "unitPrice": 1, "supplier": 1, "stockCurrent": 1}
    ).sort([("category", 1), ("name", 1)]).to_list(length=5000)
    return {"items": items}


@router.post("/components/quick-create")
async def quick_create_component(
    body: QuickComponentCreate,
    user: dict = Depends(get_current_user),
):
    """Allow procurement users to create a new component inline.

    Mirrors the canonical ``POST /sauna-tech-cards/components`` but is
    available to any logged-in planner user, not just admins, because the
    procurement workflow needs to add unknown items on the fly.
    """
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    # Avoid silent duplicates: case-insensitive name dedup.
    existing = await db[COMPONENTS_COL].find_one(
        {"name": {"$regex": f"^{name}$", "$options": "i"}}, {"_id": 0}
    )
    if existing:
        return existing
    item = {
        "id": str(uuid.uuid4()),
        "name": name,
        "category": body.category or "other",
        "unit": body.unit or "шт",
        "unitPrice": float(body.unitPrice or 0),
        "supplier": body.supplier or "",
        "note": "",
        "stockCurrent": 0.0,
        "stockMin": 0.0,
        "isActive": True,
        "createdAt": _now(),
        "updatedAt": _now(),
        "createdViaProcurement": True,
    }
    await db[COMPONENTS_COL].insert_one(item)
    return _strip(item)


# ─────────────────────────── Endpoints: requests ───────────────────────────

@router.get("/requests")
async def list_requests(
    status: Optional[str] = None,
    only_overdue: bool = False,
    assignee_user_id: Optional[str] = None,
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status:
        query["status"] = status
    if assignee_user_id:
        query["assigneeUserId"] = assignee_user_id
    if only_overdue:
        today = date.today().isoformat()
        query["dueDate"] = {"$lt": today, "$ne": None}
        query["status"] = {"$nin": ["delivered", "cancelled"]}
    docs = await db[COL].find(query, {"_id": 0}).to_list(length=2000)
    today = date.today().isoformat()
    # Sort in Python so null dueDates sort to the end (Mongo treats them as min).
    docs.sort(key=lambda d: (
        d.get("dueDate") or "9999-12-31",  # nulls last
        -1 * int(d.get("createdAt", "")[:19].replace("-", "").replace("T", "").replace(":", "") or 0),
    ))
    # Decorate with `isOverdue` so the FE doesn't reimplement the rule.
    for d in docs:
        dd = d.get("dueDate")
        d["isOverdue"] = bool(
            dd and dd < today and not _is_finished(d.get("status", ""))
        )
    return {"items": docs}


@router.get("/requests/{request_id}")
async def get_request(request_id: str, _: dict = Depends(get_current_user)):
    doc = await db[COL].find_one({"id": request_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Request not found")
    return doc


@router.post("/requests")
async def create_request(body: ProcurementCreate, user: dict = Depends(get_current_user)):
    _validate(body.status, body.priority)

    # ── Multi-line mode ───────────────────────────────────────────
    if body.items:
        comp_ids = [it.componentId for it in body.items if it.componentId]
        comps_by_id = await _resolve_components_by_id(comp_ids)
        raw_items = [it.model_dump() for it in body.items]
        norm_items, grand_total = _normalize_items(raw_items, comps_by_id)

        # Auto-fill supplier from the first item's component if absent.
        supplier = body.supplier
        if not supplier and comp_ids:
            first_comp = comps_by_id.get(comp_ids[0])
            if first_comp:
                supplier = first_comp.get("supplier", "")

        doc = {
            "id": str(uuid.uuid4()),
            "title": body.title.strip() or "Заявка на закупку",
            "items": norm_items,
            "totalPrice": grand_total,
            # Single-line fields cleared for clarity (UI reads ``items``).
            "componentId": None,
            "componentName": "",
            "category": "",
            "unit": "",
            "quantity": 0,
            "unitPrice": 0,
            "supplier": supplier or "",
            "note": body.note or "",
            "status": body.status,
            "priority": body.priority,
            "dueDate": body.dueDate or None,
            "assigneeUserId": body.assigneeUserId or None,
            "assigneeUsername": body.assigneeUsername or "",
            "reminderDaysBefore": int(body.reminderDaysBefore or DEFAULT_REMINDER_DAYS),
            "notifyTelegram": bool(body.notifyTelegram),
            "tags": list(body.tags or []),
            "createdAt": _now(),
            "updatedAt": _now(),
            "createdByUserId": user.get("id") or user.get("user_id"),
            "createdByUsername": user.get("username", ""),
            "notifications": {"created": False, "reminder": False, "overdue": False},
            "stockApplied": False,
        }
        await db[COL].insert_one(doc)
        # If created already in delivered state, push stock to catalog.
        if doc["status"] == "delivered":
            try:
                summary = await _apply_stock_delivery(doc, direction=+1)
                await db[COL].update_one({"id": doc["id"]},
                    {"$set": {"stockApplied": True, "stockSummary": summary}})
                doc["stockApplied"] = True
                doc["stockSummary"] = summary
            except Exception as e:
                logger.warning(f"procurement stock-apply (multi-create) failed: {e}")
        if doc["notifyTelegram"]:
            try:
                sent = await _send_telegram(
                    _format_request_message("🆕 <b>Новая заявка на закупку</b>", doc)
                )
                await db[COL].update_one({"id": doc["id"]},
                    {"$set": {"notifications.created": bool(sent)}})
            except Exception as e:
                logger.warning(f"procurement create-notify (multi) failed: {e}")
        return _strip(doc)

    # ── Legacy single-line mode ───────────────────────────────────
    # If linked to an existing component, pull current price / name / unit
    # as defaults — the body values still win if the user overrides them.
    comp_name = body.componentName or ""
    comp_category = body.category or ""
    comp_unit = body.unit or "шт"
    if body.componentId:
        comp = await db[COMPONENTS_COL].find_one(
            {"id": body.componentId}, {"_id": 0}
        )
        if comp:
            comp_name = body.componentName or comp.get("name", "")
            comp_category = body.category or comp.get("category", "")
            comp_unit = body.unit or comp.get("unit", "шт")
            if not body.unitPrice:
                body.unitPrice = float(comp.get("unitPrice", 0) or 0)
            if not body.supplier:
                body.supplier = comp.get("supplier", "")

    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title.strip() or comp_name or "Заявка",
        "items": [],
        "componentId": body.componentId or None,
        "componentName": comp_name,
        "category": comp_category,
        "unit": comp_unit,
        "quantity": float(body.quantity or 1),
        "unitPrice": float(body.unitPrice or 0),
        "totalPrice": _compute_total(body.quantity, body.unitPrice),
        "supplier": body.supplier or "",
        "note": body.note or "",
        "status": body.status,
        "priority": body.priority,
        "dueDate": body.dueDate or None,
        "assigneeUserId": body.assigneeUserId or None,
        "assigneeUsername": body.assigneeUsername or "",
        "reminderDaysBefore": int(body.reminderDaysBefore or DEFAULT_REMINDER_DAYS),
        "notifyTelegram": bool(body.notifyTelegram),
        "tags": list(body.tags or []),
        "createdAt": _now(),
        "updatedAt": _now(),
        "createdByUserId": user.get("id") or user.get("user_id"),
        "createdByUsername": user.get("username", ""),
        "notifications": {  # idempotency markers for scheduled Telegram pushes
            "created": False,
            "reminder": False,
            "overdue": False,
        },
        "stockApplied": False,
    }
    await db[COL].insert_one(doc)

    # If created already in delivered state, push stock to catalog.
    if doc["status"] == "delivered":
        try:
            summary = await _apply_stock_delivery(doc, direction=+1)
            await db[COL].update_one({"id": doc["id"]},
                {"$set": {"stockApplied": True, "stockSummary": summary}})
            doc["stockApplied"] = True
            doc["stockSummary"] = summary
        except Exception as e:
            logger.warning(f"procurement stock-apply (legacy-create) failed: {e}")

    # Fire-and-forget Telegram notification on creation.
    if doc["notifyTelegram"]:
        try:
            sent = await _send_telegram(
                _format_request_message("🆕 <b>Новая заявка на закупку</b>", doc)
            )
            await db[COL].update_one(
                {"id": doc["id"]},
                {"$set": {"notifications.created": bool(sent)}}
            )
        except Exception as e:
            logger.warning(f"procurement create-notify failed: {e}")

    return _strip(doc)


@router.post("/requests/from-deficit")
async def create_request_from_deficit(user: dict = Depends(get_current_user)):
    """One-click draft: build a procurement request from ALL components whose
    stock is at/below their minimum. Quantity per line = stockMin − stockCurrent
    (restock exactly up to the minimum)."""
    comps = await db[COMPONENTS_COL].find(
        {"$expr": {"$and": [
            {"$gt": [{"$ifNull": ["$stockMin", 0]}, 0]},
            {"$lte": [{"$ifNull": ["$stockCurrent", 0]}, {"$ifNull": ["$stockMin", 0]}]},
        ]}},
        {"_id": 0},
    ).to_list(length=5000)
    if not comps:
        raise HTTPException(400, "Нет позиций с дефицитом — заявка не создана")

    lines = []
    for c in comps:
        cur = float(c.get("stockCurrent") or 0)
        mn = float(c.get("stockMin") or 0)
        need = mn - cur
        if need <= 0:
            need = mn  # safety fallback
        lines.append({
            "componentId": c.get("id"),
            "componentName": c.get("name", ""),
            "category": c.get("category", ""),
            "unit": c.get("unit", "шт"),
            "quantity": round(need, 3),
            "unitPrice": float(c.get("unitPrice") or 0),
            "note": f"Дефицит: остаток {round(cur, 2)} ≤ мин {round(mn, 2)}",
        })

    comps_by_id = {c["id"]: c for c in comps}
    norm_items, grand_total = _normalize_items(lines, comps_by_id)

    today = _now()[:10]
    doc = {
        "id": str(uuid.uuid4()),
        "title": f"Закупка по дефициту · {today}",
        "items": norm_items,
        "totalPrice": grand_total,
        "componentId": None, "componentName": "", "category": "", "unit": "",
        "quantity": 0, "unitPrice": 0,
        "supplier": "",
        "note": f"Автоматический черновик по {len(norm_items)} дефицитным позициям.",
        "status": "draft",
        "priority": "high",
        "dueDate": None,
        "assigneeUserId": None,
        "assigneeUsername": "",
        "reminderDaysBefore": DEFAULT_REMINDER_DAYS,
        "notifyTelegram": False,
        "tags": ["deficit", "auto"],
        "createdAt": _now(),
        "updatedAt": _now(),
        "createdByUserId": user.get("id") or user.get("user_id"),
        "createdByUsername": user.get("username", ""),
        "notifications": {"created": False, "reminder": False, "overdue": False},
        "stockApplied": False,
        "source": "deficit",
    }
    await db[COL].insert_one(doc)
    return {"status": "ok", "request": _strip(doc), "linesCount": len(norm_items)}


@router.put("/requests/{request_id}")
async def update_request(
    request_id: str,
    body: ProcurementUpdate,
    user: dict = Depends(get_current_user),
):
    existing = await db[COL].find_one({"id": request_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Request not found")
    _validate(body.status, body.priority)

    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    update["updatedAt"] = _now()

    # ── Items replacement (multi-line) ──────────────────────────
    # When ``items`` is included, we fully replace and recompute totalPrice.
    if "items" in update:
        raw_items = update.get("items") or []
        comp_ids = [it.get("componentId") for it in raw_items if it.get("componentId")]
        comps_by_id = await _resolve_components_by_id(comp_ids)
        norm_items, grand_total = _normalize_items(raw_items, comps_by_id)
        update["items"] = norm_items
        update["totalPrice"] = grand_total
        # Clear single-line scalars when switching to multi-line.
        if norm_items:
            update.setdefault("componentId", None)
            update["quantity"] = 0
            update["unitPrice"] = 0
    else:
        # Single-line: recompute totalPrice if qty/price changed.
        new_qty = update.get("quantity", existing.get("quantity"))
        new_price = update.get("unitPrice", existing.get("unitPrice"))
        # Only recompute if the doc is single-line (no items).
        if not (existing.get("items") or []):
            update["totalPrice"] = _compute_total(new_qty, new_price)

    # If the deadline moved forward to a non-overdue date, reset overdue
    # notification so a future overdue fires again.
    if "dueDate" in update and update["dueDate"]:
        today = date.today().isoformat()
        if update["dueDate"] >= today:
            update["notifications.overdue"] = False
            update["notifications.reminder"] = False

    # ── Stock delivery transition ──────────────────────────────
    # Detect status transitions in/out of `delivered` and update the
    # components catalog atomically. ``stockApplied`` is the idempotency
    # marker: we only apply once and revert once. The flag is flipped via
    # a conditional update_one with ``stockApplied: {$ne: True}`` so two
    # concurrent PUT delivered requests can't both pass the "not already
    # applied" check and double-credit stock.
    prev_status = existing.get("status")
    new_status = update.get("status", prev_status)
    already_applied = bool(existing.get("stockApplied"))
    stock_event = None
    if new_status == "delivered" and not already_applied:
        # Race-safe claim: only the first concurrent PUT wins.
        claim = await db[COL].update_one(
            {"id": request_id, "stockApplied": {"$ne": True}},
            {"$set": {"stockApplied": True}},
        )
        if claim.matched_count == 1:
            effective = {**existing, **update}
            if "items" in update:
                effective["items"] = update["items"]
            try:
                stock_event = await _apply_stock_delivery(effective, direction=+1)
                update["stockApplied"] = True
                update["stockSummary"] = stock_event
            except Exception as e:
                logger.warning(f"procurement stock-apply (PUT) failed: {e}")
                # Roll back the optimistic flag so a future retry can apply.
                await db[COL].update_one(
                    {"id": request_id},
                    {"$set": {"stockApplied": False}},
                )
                # And surface the error to the caller — better than silently
                # leaving status=delivered with no stock credited.
                raise HTTPException(
                    500, f"Не удалось применить приход на склад: {e}"
                )
    elif prev_status == "delivered" and new_status != "delivered" and already_applied:
        # Race-safe release of the claim.
        release = await db[COL].update_one(
            {"id": request_id, "stockApplied": True},
            {"$set": {"stockApplied": False}},
        )
        if release.matched_count == 1:
            try:
                stock_event = await _apply_stock_delivery(existing, direction=-1)
                update["stockApplied"] = False
                update["stockSummary"] = {**(stock_event or {}), "reverted": True}
            except Exception as e:
                logger.warning(f"procurement stock-revert (PUT) failed: {e}")
                # Restore the claim so the doc still reflects credited stock
                # and a retry stays consistent.
                await db[COL].update_one(
                    {"id": request_id},
                    {"$set": {"stockApplied": True}},
                )
                raise HTTPException(
                    500, f"Не удалось списать приход со склада: {e}"
                )

    await db[COL].update_one({"id": request_id}, {"$set": update})
    return await db[COL].find_one({"id": request_id}, {"_id": 0})


@router.delete("/requests/{request_id}")
async def delete_request(request_id: str, _: dict = Depends(get_admin_user)):
    # If the request had already credited stock, undo it on delete to keep
    # the catalog honest.
    existing = await db[COL].find_one({"id": request_id}, {"_id": 0})
    if existing and existing.get("stockApplied"):
        try:
            await _apply_stock_delivery(existing, direction=-1)
        except Exception as e:
            logger.warning(f"procurement stock-revert (DELETE) failed: {e}")
    res = await db[COL].delete_one({"id": request_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Request not found")
    return {"deleted": True}


@router.get("/stats")
async def get_procurement_stats(_: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "totalValue": {"$sum": "$totalPrice"},
        }},
    ]
    rows = await db[COL].aggregate(pipeline).to_list(length=50)
    by_status = {r["_id"]: {"count": r["count"], "totalValue": r["totalValue"]} for r in rows}
    overdue = await db[COL].count_documents({
        "dueDate": {"$lt": today, "$ne": None},
        "status": {"$nin": ["delivered", "cancelled"]},
    })
    soon = await db[COL].count_documents({
        "dueDate": {
            "$gte": today,
            "$lte": (date.today() + timedelta(days=7)).isoformat(),
        },
        "status": {"$nin": ["delivered", "cancelled"]},
    })
    return {
        "byStatus": by_status,
        "overdue": overdue,
        "dueSoon": soon,
        "total": sum(v["count"] for v in by_status.values()),
    }


# ─────────────────────────── Scheduler-callable ───────────────────────────

async def run_procurement_notifications() -> dict:
    """Iterate open requests, send reminder/overdue Telegram messages once each.

    Called from the global daily scheduler (server.py) and idempotent thanks
    to the per-doc ``notifications`` flags.
    """
    today_d = date.today()
    docs = await db[COL].find(
        {
            "notifyTelegram": True,
            "status": {"$nin": ["delivered", "cancelled"]},
            "dueDate": {"$ne": None},
        },
        {"_id": 0},
    ).to_list(length=5000)

    sent_reminder = 0
    sent_overdue = 0
    for d in docs:
        try:
            due_d = date.fromisoformat(d["dueDate"])
        except Exception:
            continue
        days_left = (due_d - today_d).days
        notifs = d.get("notifications") or {}
        reminder_window = int(d.get("reminderDaysBefore") or DEFAULT_REMINDER_DAYS)

        # Reminder N days before deadline (fires once — set flag regardless
        # of TG success so missing creds don't cause daily re-attempts).
        if 0 <= days_left <= reminder_window and not notifs.get("reminder"):
            ok = await _send_telegram(_format_request_message(
                f"⏰ <b>Напоминание: до закупки осталось {days_left} дн.</b>",
                d,
            ))
            await db[COL].update_one(
                {"id": d["id"]}, {"$set": {"notifications.reminder": True}}
            )
            if ok:
                sent_reminder += 1

        # Overdue (fires once — same idempotency policy as reminder)
        if days_left < 0 and not notifs.get("overdue"):
            ok = await _send_telegram(_format_request_message(
                f"🚨 <b>ПРОСРОЧЕНА закупка</b> (срок был {d['dueDate']}, "
                f"опоздание: {abs(days_left)} дн.)",
                d,
            ))
            await db[COL].update_one(
                {"id": d["id"]}, {"$set": {"notifications.overdue": True}}
            )
            if ok:
                sent_overdue += 1

    return {"checked": len(docs), "sentReminder": sent_reminder,
            "sentOverdue": sent_overdue}


@router.post("/notifications/run")
async def trigger_notifications(_: dict = Depends(get_admin_user)):
    """Manual trigger of the notification job — useful for testing."""
    return await run_procurement_notifications()
