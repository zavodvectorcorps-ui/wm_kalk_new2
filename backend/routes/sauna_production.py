"""Sauna Production routes - Production board for sauna orders."""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from database import db
from services.auth_service import get_current_user
import logging
import uuid

router = APIRouter(prefix="/sauna-production", tags=["Sauna Production"])
logger = logging.getLogger(__name__)


async def _enrich_orders_with_margin(leads: list) -> None:
    """Attach admin-only `marginInfo` (netto margin + traffic-light level) to each
    production lead, computed from its linked calculator order. Single batched
    lookup. Levels: green ≥25% · amber 15–25% · red <15%."""
    order_ids = [l.get("calculatorOrderId") for l in leads if l.get("calculatorOrderId")]
    amo_ids = [str(l.get("amocrm_id")) for l in leads if l.get("amocrm_id")]
    proj = {"_id": 0, "id": 1, "amocrm_id": 1, "total": 1, "totalCost": 1, "retailExtraCost": 1, "createdAt": 1}
    by_id: Dict[str, dict] = {}
    by_amo: Dict[str, dict] = {}
    for coll in ("sauna_orders", "balia_orders"):
        if order_ids:
            async for o in db[coll].find({"id": {"$in": order_ids}}, proj):
                by_id[o["id"]] = o
        if amo_ids:
            amo_query = amo_ids + [int(a) for a in amo_ids if a.isdigit()]
            async for o in db[coll].find({"amocrm_id": {"$in": amo_query}}, proj).sort("createdAt", -1):
                key = str(o.get("amocrm_id"))
                if key not in by_amo:
                    by_amo[key] = o
    for l in leads:
        o = by_id.get(l.get("calculatorOrderId")) or by_amo.get(str(l.get("amocrm_id")))
        if not o:
            continue
        total = float(o.get("total") or 0)
        cost = float(o.get("totalCost") or 0)
        if total <= 0 or cost <= 0:
            continue
        netto = total / 1.23
        extras = float(o.get("retailExtraCost") or 0)
        margin = netto - cost - extras
        pct = (margin / netto * 100) if netto > 0 else 0
        level = "green" if pct >= 25 else ("amber" if pct >= 15 else "red")
        l["marginInfo"] = {
            "totalCost": round(cost),
            "marginNetto": round(margin),
            "marginPct": round(pct, 1),
            "level": level,
        }


# ============== DEFAULT SETTINGS ==============

def get_default_production_settings() -> dict:
    return {
        "stages": [
            {"id": "accepted", "name": "Заказ принят", "color": "#3b82f6", "sortOrder": 1},
            {"id": "in_production", "name": "В производстве", "color": "#f59e0b", "sortOrder": 2},
            {"id": "ready", "name": "Готов", "color": "#22c55e", "sortOrder": 3},
            {"id": "shipped", "name": "Отгружен", "color": "#8b5cf6", "sortOrder": 4},
        ],
        "lastSyncAt": None,
        "googleSheets": {
            "spreadsheetId": "",
            "sheetName": "",
            "serviceAccountJson": "",
        },
    }


# ============== SETTINGS ==============

@router.get("/settings")
async def get_production_settings():
    settings = await db.sauna_production_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = get_default_production_settings()
        await db.sauna_production_settings.insert_one(settings)
        settings.pop("_id", None)
    return settings


@router.post("/settings")
async def save_production_settings(data: dict):
    data.pop("_id", None)
    await db.sauna_production_settings.update_one({}, {"$set": data}, upsert=True)
    return {"status": "ok"}


# ============== ORDERS (read from sauna_crm_leads where inProduction=true) ==============

@router.get("/orders")
async def get_production_orders(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {"inProduction": True}
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to + "T23:59:59"
        query["readyDate"] = date_q

    leads = await db.sauna_crm_leads.find(query, {"_id": 0}).to_list(1000)
    # Margin is admin-only — never leak cost/margin to managers/foremen.
    if user.get("role") in ("admin", "super-admin"):
        await _enrich_orders_with_margin(leads)
    return {"orders": leads}


@router.get("/orders/{order_id}")
async def get_production_order(order_id: str):
    lead = await db.sauna_crm_leads.find_one(
        {"id": order_id, "inProduction": True},
        {"_id": 0}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Order not found in production")
    return lead


@router.put("/orders/{order_id}/stage")
async def change_production_stage(order_id: str, stage_id: str = Query(...)):
    existing = await db.sauna_crm_leads.find_one({"id": order_id, "inProduction": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found in production")

    now = datetime.now(timezone.utc).isoformat()
    old_stage = existing.get("productionStageId", "")

    history_entry = {
        "fromStage": old_stage,
        "toStage": stage_id,
        "timestamp": now,
        "action": "production_stage_changed",
    }
    prod_history = existing.get("productionHistory", [])
    prod_history.append(history_entry)

    await db.sauna_crm_leads.update_one(
        {"id": order_id},
        {"$set": {
            "productionStageId": stage_id,
            "productionHistory": prod_history,
            "updatedAt": now,
        }}
    )

    # Best-effort: reflect the stage on the Telegram topic (prefix + icon, close on final)
    try:
        from routes.telegram_production import sync_topic_for_stage, refresh_production_summary
        settings = await db.sauna_production_settings.find_one({}, {"_id": 0}) or {}
        stage_name = next((s.get("name", "") for s in settings.get("stages", []) if s.get("id") == stage_id), "")
        await sync_topic_for_stage(order_id, stage_id, stage_name)
        await refresh_production_summary()
    except Exception as e:
        logger.error(f"Telegram topic stage-sync failed for {order_id}: {e}")

    updated = await db.sauna_crm_leads.find_one({"id": order_id}, {"_id": 0})
    return updated


@router.put("/orders/{order_id}")
async def update_production_order(order_id: str, data: dict):
    """Update production-specific fields (dates, notes)."""
    existing = await db.sauna_crm_leads.find_one({"id": order_id, "inProduction": True}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found in production")

    now = datetime.now(timezone.utc).isoformat()
    allowed_fields = [
        "productionDate", "readyDate", "deliveryDate",
        "productionNotes", "productionStageId",
        "totalAmount", "advancePayment", "prepaymentDate",
        "paymentMethod", "orderDate", "productionComment",
        "clientName", "modelName", "field_1", "calculatorOrderId",
    ]
    update = {"updatedAt": now}
    for key in allowed_fields:
        if key in data:
            update[key] = data[key]

    data.pop("_id", None)
    data.pop("id", None)

    await db.sauna_crm_leads.update_one({"id": order_id}, {"$set": update})

    # If the production stage changed here, sync the Telegram topic too
    if "productionStageId" in update and update["productionStageId"] != existing.get("productionStageId"):
        try:
            from routes.telegram_production import sync_topic_for_stage, refresh_production_summary
            settings = await db.sauna_production_settings.find_one({}, {"_id": 0}) or {}
            stage_name = next((s.get("name", "") for s in settings.get("stages", []) if s.get("id") == update["productionStageId"]), "")
            await sync_topic_for_stage(order_id, update["productionStageId"], stage_name)
            await refresh_production_summary()
        except Exception as e:
            logger.error(f"Telegram topic stage-sync (PUT) failed for {order_id}: {e}")

    updated = await db.sauna_crm_leads.find_one({"id": order_id}, {"_id": 0})
    return updated


# ============== CALENDAR ==============

@router.get("/calendar")
async def get_production_calendar(month: int = Query(...), year: int = Query(...), dateField: str = Query("advancePaymentDate")):
    """Production calendar grouped by the chosen date field (same options as CRM).

    dateField ∈ {advancePaymentDate, productionDate, readyDate, deliveryDate}.
    'advancePaymentDate' resolves to the CRM-configured calendarDateField.
    Only in-production leads are shown.
    """
    settings = await db.sauna_crm_settings.find_one({}, {"_id": 0})
    if dateField in ("productionDate", "readyDate", "deliveryDate"):
        date_field = dateField
    else:
        date_field = (settings or {}).get("calendarDateField") or "prepaymentDate"

    leads = await db.sauna_crm_leads.find(
        {"inProduction": True, date_field: {"$exists": True, "$ne": None, "$nin": [""]}},
        {"_id": 0}
    ).to_list(5000)

    by_date = {}
    for lead in leads:
        rd = lead.get(date_field, "")
        if not rd:
            continue
        try:
            dt = datetime.fromisoformat(rd.replace("Z", "+00:00")) if "T" in rd else datetime.strptime(rd[:10], "%Y-%m-%d")
            if dt.month == month and dt.year == year:
                date_key = dt.strftime("%Y-%m-%d")
                if date_key not in by_date:
                    by_date[date_key] = []
                by_date[date_key].append({
                    "id": lead.get("id"),
                    "clientName": lead.get("clientName", ""),
                    "modelName": lead.get("modelName") or lead.get("field_1", ""),
                    "dateValue": rd,
                    "readyDate": lead.get("readyDate", ""),
                    "productionDate": lead.get("productionDate", ""),
                    "deliveryDate": lead.get("deliveryDate", ""),
                    "productionStageId": lead.get("productionStageId"),
                    "totalAmount": lead.get("totalAmount") or lead.get("field_2"),
                    "phone": lead.get("phone", ""),
                    "manager": lead.get("manager", ""),
                })
        except (ValueError, TypeError):
            continue

    return {"month": month, "year": year, "byDate": by_date, "dateField": dateField, "totalOrders": sum(len(v) for v in by_date.values())}


# ============== GOOGLE SHEETS SYNC ==============

@router.post("/sync-google-sheets")
async def sync_to_google_sheets():
    """Sync production list data to Google Sheets."""
    # Try both possible document keys
    settings = await db.sauna_production_settings.find_one({"_id": "default"}, {"_id": 0})
    if not settings:
        settings = await db.sauna_production_settings.find_one({}, {"_id": 0})
    if not settings:
        raise HTTPException(400, "Настройки производства не найдены. Сохраните настройки в разделе Производство саун.")

    gs_config = settings.get("googleSheets", {})
    spreadsheet_id = (gs_config.get("spreadsheetId") or "").strip()
    sheet_name = (gs_config.get("sheetName") or "").strip() or "Лист1"
    sa_json_raw = gs_config.get("serviceAccountJson", "")

    if not spreadsheet_id:
        raise HTTPException(400, "Не указан ID таблицы Google Sheets в настройках")

    import json as json_mod
    import gspread
    from google.oauth2.service_account import Credentials

    # serviceAccountJson can be stored as string or dict
    sa_info = None
    if isinstance(sa_json_raw, dict) and sa_json_raw:
        sa_info = sa_json_raw
    elif isinstance(sa_json_raw, str) and sa_json_raw.strip():
        try:
            sa_info = json_mod.loads(sa_json_raw.strip())
        except Exception as e:
            logger.error(f"Failed to parse Service Account JSON: {e}")
            raise HTTPException(400, f"Невалидный JSON Service Account: {e}")

    if not sa_info:
        raise HTTPException(400, "Не указан Service Account JSON в настройках")

    scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    try:
        creds = Credentials.from_service_account_info(sa_info, scopes=scopes)
        gc = gspread.authorize(creds)
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(400, f"Ошибка авторизации Google: {e}")

    try:
        sh = gc.open_by_key(spreadsheet_id)
    except Exception as e:
        logger.error(f"Failed to open spreadsheet {spreadsheet_id}: {e}")
        raise HTTPException(400, f"Не удалось открыть таблицу. Проверьте ID и доступ Service Account: {e}")

    try:
        ws = sh.worksheet(sheet_name)
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=sheet_name, rows=500, cols=15)

    # Fetch production orders
    orders = await db.sauna_crm_leads.find(
        {"inProduction": True}, {"_id": 0}
    ).sort("createdAt", -1).to_list(5000)

    stages_list = settings.get("stages", [])
    stages_map = {s["id"]: s["name"] for s in stages_list}

    # Build rows
    header = [
        "№", "Номер заказа", "Наименование", "Клиент", "Этап",
        "Сумма", "Аванс/Предоплата", "Дата заказа",
        "Дата предоплаты", "Метод оплаты", "Дата сдачи", "Комментарий"
    ]

    rows = [header]
    for idx, order in enumerate(orders, 1):
        def fmt_date(v):
            if not v:
                return ""
            try:
                return v[:10] if len(v) >= 10 else v
            except Exception:
                return str(v)

        rows.append([
            idx,
            order.get("calculatorOrderId") or order.get("id", ""),
            order.get("modelName") or order.get("field_1") or "",
            order.get("clientName", ""),
            stages_map.get(order.get("productionStageId", ""), order.get("productionStageId", "")),
            order.get("totalAmount") or "",
            order.get("advancePayment") or "",
            fmt_date(order.get("orderDate") or order.get("createdAt", "")),
            fmt_date(order.get("prepaymentDate", "")),
            order.get("paymentMethod", ""),
            fmt_date(order.get("deliveryDate", "")),
            order.get("productionComment", ""),
        ])

    # Clear and write
    ws.clear()
    ws.update(range_name="A1", values=rows)

    # Format header
    try:
        ws.format("A1:L1", {"textFormat": {"bold": True}, "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}})
    except Exception:
        pass

    now = datetime.now(timezone.utc).isoformat()
    await db.sauna_production_settings.update_one(
        {"_id": "default"},
        {"$set": {"lastSyncAt": now}}
    )

    return {"success": True, "rows_synced": len(orders), "synced_at": now}
