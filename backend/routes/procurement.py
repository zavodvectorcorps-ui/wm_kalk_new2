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

class ProcurementCreate(BaseModel):
    title: str
    componentId: Optional[str] = None
    componentName: Optional[str] = ""
    category: Optional[str] = ""
    unit: Optional[str] = "шт"
    quantity: float = 1.0
    unitPrice: float = 0.0
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


def _is_finished(status: str) -> bool:
    return status in ("delivered", "cancelled")


async def _send_telegram(message: str) -> bool:
    """Send a Telegram message via the bot. Returns True if delivered."""
    try:
        from services.telegram_service import send_telegram_message
        return bool(await send_telegram_message(message))
    except Exception as e:
        logger.warning(f"procurement telegram send failed: {e}")
        return False


def _format_request_message(prefix: str, doc: dict) -> str:
    """HTML-formatted Telegram message for a procurement request."""
    title = doc.get("title", "—")
    qty = doc.get("quantity", 0)
    unit = doc.get("unit", "шт")
    total = doc.get("totalPrice", 0)
    due = doc.get("dueDate") or "—"
    supplier = doc.get("supplier") or "—"
    assignee = doc.get("assigneeUsername") or "не назначен"
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
    docs = await db[COL].find(query, {"_id": 0}).sort([
        # Overdue first (oldest deadline first), then by priority weight.
        ("dueDate", 1), ("createdAt", -1),
    ]).to_list(length=2000)
    # Decorate with `isOverdue` so the FE doesn't reimplement the rule.
    today = date.today().isoformat()
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
    }
    await db[COL].insert_one(doc)

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

    # Recompute totalPrice if either qty or price changed.
    new_qty = update.get("quantity", existing.get("quantity"))
    new_price = update.get("unitPrice", existing.get("unitPrice"))
    update["totalPrice"] = _compute_total(new_qty, new_price)

    # If the deadline moved forward to a non-overdue date, reset overdue
    # notification so a future overdue fires again.
    if "dueDate" in update and update["dueDate"]:
        today = date.today().isoformat()
        if update["dueDate"] >= today:
            update["notifications.overdue"] = False
            update["notifications.reminder"] = False

    await db[COL].update_one({"id": request_id}, {"$set": update})
    return await db[COL].find_one({"id": request_id}, {"_id": 0})


@router.delete("/requests/{request_id}")
async def delete_request(request_id: str, _: dict = Depends(get_admin_user)):
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

        # Reminder N days before deadline (fires once)
        if 0 <= days_left <= reminder_window and not notifs.get("reminder"):
            ok = await _send_telegram(_format_request_message(
                f"⏰ <b>Напоминание: до закупки осталось {days_left} дн.</b>",
                d,
            ))
            await db[COL].update_one(
                {"id": d["id"]}, {"$set": {"notifications.reminder": bool(ok)}}
            )
            if ok:
                sent_reminder += 1

        # Overdue (fires once)
        if days_left < 0 and not notifs.get("overdue"):
            ok = await _send_telegram(_format_request_message(
                f"🚨 <b>ПРОСРОЧЕНА закупка</b> (срок был {d['dueDate']}, "
                f"опоздание: {abs(days_left)} дн.)",
                d,
            ))
            await db[COL].update_one(
                {"id": d["id"]}, {"$set": {"notifications.overdue": bool(ok)}}
            )
            if ok:
                sent_overdue += 1

    return {"checked": len(docs), "sentReminder": sent_reminder,
            "sentOverdue": sent_overdue}


@router.post("/notifications/run")
async def trigger_notifications(_: dict = Depends(get_admin_user)):
    """Manual trigger of the notification job — useful for testing."""
    return await run_procurement_notifications()
