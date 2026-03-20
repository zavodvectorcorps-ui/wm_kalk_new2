"""Sauna Production routes - Production board for sauna orders."""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from database import db
import logging
import uuid

router = APIRouter(prefix="/sauna-production", tags=["Sauna Production"])
logger = logging.getLogger(__name__)


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
async def get_production_orders():
    leads = await db.sauna_crm_leads.find(
        {"inProduction": True},
        {"_id": 0}
    ).to_list(1000)
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
    ]
    update = {"updatedAt": now}
    for key in allowed_fields:
        if key in data:
            update[key] = data[key]

    data.pop("_id", None)
    data.pop("id", None)

    await db.sauna_crm_leads.update_one({"id": order_id}, {"$set": update})
    updated = await db.sauna_crm_leads.find_one({"id": order_id}, {"_id": 0})
    return updated


# ============== CALENDAR ==============

@router.get("/calendar")
async def get_production_calendar(month: int = Query(...), year: int = Query(...)):
    leads = await db.sauna_crm_leads.find(
        {"inProduction": True, "productionDate": {"$exists": True, "$ne": None, "$nin": [""]}},
        {"_id": 0}
    ).to_list(5000)

    by_date = {}
    for lead in leads:
        pd = lead.get("productionDate", "")
        if not pd:
            continue
        try:
            dt = datetime.fromisoformat(pd.replace("Z", "+00:00")) if "T" in pd else datetime.strptime(pd[:10], "%Y-%m-%d")
            if dt.month == month and dt.year == year:
                date_key = dt.strftime("%Y-%m-%d")
                if date_key not in by_date:
                    by_date[date_key] = []
                by_date[date_key].append({
                    "id": lead.get("id"),
                    "clientName": lead.get("clientName", ""),
                    "modelName": lead.get("modelName") or lead.get("field_1", ""),
                    "productionDate": pd,
                    "productionStageId": lead.get("productionStageId"),
                    "totalAmount": lead.get("totalAmount") or lead.get("field_2"),
                    "phone": lead.get("phone", ""),
                })
        except (ValueError, TypeError):
            continue

    return {"month": month, "year": year, "byDate": by_date, "totalOrders": sum(len(v) for v in by_date.values())}
