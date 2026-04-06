"""Sales management routes for tracking orders and manager bonuses."""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import json
import logging
import io

router = APIRouter(prefix="/api/sales", tags=["sales"])
logger = logging.getLogger(__name__)

# MongoDB connection
from database import db

def get_sales_collection():
    return db.sales

def get_managers_collection():
    return db.sales_managers


# ============ MODELS ============

class SaleCreate(BaseModel):
    order_id: Optional[str] = None  # WMS-XX-XX-XXXX-XXXXXX
    product_name: str  # наименование
    client_name: str  # клиент
    total_amount: float  # сумма
    paid_amount: Optional[float] = 0  # внесено
    advance_amount: Optional[float] = 0  # аванс зл
    order_date: Optional[str] = None  # дата заказа
    prepayment_terms: Optional[str] = None  # внесена предоплата
    payment_method: Optional[str] = None  # метод оплаты
    delivery_date: Optional[str] = None  # дата сдачи заказа
    status: Optional[str] = "новый"  # статус заказа
    manager: str  # менеджер
    # Additional product details
    door_material: Optional[str] = None  # материал дверь
    door_glass: Optional[str] = None  # стекло дверь
    wood_type: Optional[str] = None  # дерево
    panorama: Optional[str] = None  # панорама
    tray: Optional[str] = None  # поддон
    boiler: Optional[str] = None  # бойлер
    notes: Optional[str] = None  # примечания


class SaleUpdate(BaseModel):
    order_id: Optional[str] = None
    product_name: Optional[str] = None
    client_name: Optional[str] = None
    total_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    advance_amount: Optional[float] = None
    order_date: Optional[str] = None
    prepayment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    delivery_date: Optional[str] = None
    status: Optional[str] = None
    manager: Optional[str] = None
    door_material: Optional[str] = None
    door_glass: Optional[str] = None
    wood_type: Optional[str] = None
    panorama: Optional[str] = None
    tray: Optional[str] = None
    boiler: Optional[str] = None
    notes: Optional[str] = None


class ManagerBonusSettings(BaseModel):
    manager_name: str
    bonus_percent: float = 5.0  # Default 5%


# ============ SALES CRUD ============

@router.get("/")
async def get_sales(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    manager: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 500
):
    """Get sales with optional filters."""
    collection = get_sales_collection()
    
    query = {}
    
    # Date range filter
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        if date_query:
            query["order_date"] = date_query
    
    # Manager filter
    if manager:
        query["manager"] = {"$regex": manager, "$options": "i"}
    
    # Status filter
    if status:
        query["status"] = {"$regex": status, "$options": "i"}
    
    sales = []
    cursor = collection.find(query, {"_id": 0}).sort("order_date", -1).limit(limit)
    async for doc in cursor:
        sales.append(doc)
    
    # Calculate totals
    total_amount = sum(s.get("total_amount", 0) or 0 for s in sales)
    total_paid = sum(s.get("paid_amount", 0) or 0 for s in sales)
    total_advance = sum(s.get("advance_amount", 0) or 0 for s in sales)
    
    return {
        "sales": sales,
        "count": len(sales),
        "totals": {
            "total_amount": total_amount,
            "paid_amount": total_paid,
            "advance_amount": total_advance,
            "remaining": total_amount - total_paid
        }
    }


@router.post("/")
async def create_sale(sale: SaleCreate):
    """Create a new sale record."""
    collection = get_sales_collection()
    
    # Generate ID if not provided
    import uuid
    sale_id = sale.order_id or f"SALE-{uuid.uuid4().hex[:8].upper()}"
    
    sale_doc = {
        "id": sale_id,
        **sale.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await collection.insert_one(sale_doc)
    
    # Remove MongoDB _id
    sale_doc.pop("_id", None)
    
    return {"success": True, "sale": sale_doc}


@router.put("/{sale_id}")
async def update_sale(sale_id: str, sale: SaleUpdate):
    """Update a sale record."""
    collection = get_sales_collection()
    
    update_data = {k: v for k, v in sale.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await collection.update_one(
        {"id": sale_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    return {"success": True, "updated": sale_id}


@router.delete("/{sale_id}")
async def delete_sale(sale_id: str):
    """Delete a sale record."""
    collection = get_sales_collection()
    
    result = await collection.delete_one({"id": sale_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    return {"success": True, "deleted": sale_id}


# ============ MANAGER BONUSES ============

@router.get("/managers")
async def get_managers():
    """Get all managers with their bonus settings."""
    collection = get_managers_collection()
    
    managers = []
    async for doc in collection.find({}, {"_id": 0}):
        managers.append(doc)
    
    return {"managers": managers}


@router.post("/managers")
async def create_or_update_manager(settings: ManagerBonusSettings):
    """Create or update manager bonus settings."""
    collection = get_managers_collection()
    
    await collection.update_one(
        {"manager_name": settings.manager_name},
        {"$set": {
            "manager_name": settings.manager_name,
            "bonus_percent": settings.bonus_percent,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "manager": settings.manager_name, "bonus_percent": settings.bonus_percent}


@router.delete("/managers/{manager_name}")
async def delete_manager(manager_name: str):
    """Delete manager settings."""
    collection = get_managers_collection()
    
    result = await collection.delete_one({"manager_name": manager_name})
    
    return {"success": True, "deleted": result.deleted_count > 0}


@router.get("/bonus-calculation")
async def calculate_bonus(
    start_date: str,
    end_date: str,
    manager: Optional[str] = None
):
    """Calculate manager bonuses for a date range based on prepayment_date."""
    sales_collection = get_sales_collection()
    managers_collection = get_managers_collection()
    
    # Get manager bonus settings
    manager_settings = {}
    async for doc in managers_collection.find({}, {"_id": 0}):
        manager_settings[doc["manager_name"]] = doc.get("bonus_percent", 5.0)
    
    # Get sales for the period — use prepayment_date with fallback to order_date
    # We need to find sales where prepayment_date OR order_date falls in range
    query = {
        "$or": [
            {"prepayment_date": {"$gte": start_date, "$lte": end_date}},
            {"$and": [
                {"$or": [{"prepayment_date": {"$exists": False}}, {"prepayment_date": ""}, {"prepayment_date": None}]},
                {"order_date": {"$gte": start_date, "$lte": end_date}}
            ]}
        ]
    }
    if manager:
        query = {"$and": [query, {"manager": {"$regex": manager, "$options": "i"}}]}
    
    # Aggregate by manager
    bonuses = {}
    async for sale in sales_collection.find(query, {"_id": 0}):
        mgr = sale.get("manager", "Неизвестно")
        total = sale.get("total_amount", 0) or 0
        
        if mgr not in bonuses:
            bonuses[mgr] = {
                "manager": mgr,
                "total_sales": 0,
                "order_count": 0,
                "bonus_percent": manager_settings.get(mgr, 5.0),
                "bonus_amount": 0
            }
        
        bonuses[mgr]["total_sales"] += total
        bonuses[mgr]["order_count"] += 1
    
    # Calculate bonus amounts
    for mgr, data in bonuses.items():
        data["bonus_amount"] = round(data["total_sales"] * data["bonus_percent"] / 100, 2)
    
    total_bonus = sum(b["bonus_amount"] for b in bonuses.values())
    total_sales = sum(b["total_sales"] for b in bonuses.values())
    
    return {
        "period": {"start": start_date, "end": end_date},
        "bonuses": list(bonuses.values()),
        "totals": {
            "total_sales": total_sales,
            "total_bonus": total_bonus
        }
    }


# ============ EXCEL IMPORT ============

@router.post("/import-excel")
async def import_from_excel(file: UploadFile = File(...)):
    """Import sales data from Excel file."""
    try:
        import pandas as pd
        
        contents = await file.read()
        
        # Read Excel file
        df = pd.read_excel(io.BytesIO(contents))
        
        # Map column names (Russian to English)
        column_mapping = {
            '№': 'number',
            'наименование': 'product_name',
            'клиент': 'client_name',
            'сумма': 'total_amount',
            'внесено': 'paid_amount',
            'аванс зл': 'advance_amount',
            'дата заказа': 'order_date',
            'внесена предоплата': 'prepayment_terms',
            'метод оплаты': 'payment_method',
            'дата сдачи заказа': 'delivery_date',
            'cтатус заказа': 'status',
            'статус заказа': 'status',
            'менеджер': 'manager',
            'материал дверь': 'door_material',
            'стекло дверь': 'door_glass',
            'дерево': 'wood_type',
            'панорама': 'panorama',
            'поддон': 'tray',
            'бойлер': 'boiler'
        }
        
        # Rename columns
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        
        # Clean data
        df = df.dropna(how='all')  # Remove completely empty rows
        
        # Convert amounts to float
        for col in ['total_amount', 'paid_amount', 'advance_amount']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col].astype(str).str.replace(r'[^\d.]', '', regex=True), errors='coerce').fillna(0)
        
        # Convert dates to string format
        for col in ['order_date', 'delivery_date']:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce').dt.strftime('%Y-%m-%d')
                df[col] = df[col].fillna('')
        
        # Fill NaN with empty strings or 0
        df = df.fillna('')
        
        collection = get_sales_collection()
        
        imported = 0
        skipped = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                # Skip rows without product name or client
                product_name = str(row.get('product_name', '')).strip()
                client_name = str(row.get('client_name', '')).strip()
                
                if not product_name or not client_name:
                    skipped += 1
                    continue
                
                # Generate order ID
                import uuid
                order_id = f"IMP-{uuid.uuid4().hex[:8].upper()}"
                
                sale_doc = {
                    "id": order_id,
                    "order_id": order_id,
                    "product_name": product_name,
                    "client_name": client_name,
                    "total_amount": float(row.get('total_amount', 0) or 0),
                    "paid_amount": float(row.get('paid_amount', 0) or 0),
                    "advance_amount": float(row.get('advance_amount', 0) or 0),
                    "order_date": str(row.get('order_date', '')),
                    "prepayment_terms": str(row.get('prepayment_terms', '')),
                    "payment_method": str(row.get('payment_method', '')),
                    "delivery_date": str(row.get('delivery_date', '')),
                    "status": str(row.get('status', 'новый')),
                    "manager": str(row.get('manager', '')),
                    "door_material": str(row.get('door_material', '')),
                    "door_glass": str(row.get('door_glass', '')),
                    "wood_type": str(row.get('wood_type', '')),
                    "panorama": str(row.get('panorama', '')),
                    "tray": str(row.get('tray', '')),
                    "boiler": str(row.get('boiler', '')),
                    "imported": True,
                    "import_date": datetime.now(timezone.utc).isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                await collection.insert_one(sale_doc)
                imported += 1
                
            except Exception as e:
                errors.append(f"Row {idx + 1}: {str(e)}")
        
        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "errors": errors[:10] if errors else [],
            "total_rows": len(df)
        }
        
    except Exception as e:
        logger.error(f"Excel import error: {e}")
        raise HTTPException(status_code=400, detail=f"Ошибка импорта: {str(e)}")


# ============ STATISTICS ============

@router.get("/statistics")
async def get_statistics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    manager: Optional[str] = None
):
    """Get sales statistics."""
    collection = get_sales_collection()
    
    query = {}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        if date_query:
            query["order_date"] = date_query
    
    if manager:
        query["manager"] = {"$regex": manager, "$options": "i"}
    
    # Get all matching sales
    sales = []
    async for doc in collection.find(query, {"_id": 0}):
        sales.append(doc)
    
    # Calculate statistics
    total_count = len(sales)
    total_amount = sum(s.get("total_amount", 0) or 0 for s in sales)
    total_paid = sum(s.get("paid_amount", 0) or 0 for s in sales)
    
    # Status breakdown
    status_counts = {}
    for s in sales:
        status = s.get("status", "неизвестно") or "неизвестно"
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Manager breakdown
    manager_stats = {}
    for s in sales:
        mgr = s.get("manager", "неизвестно") or "неизвестно"
        if mgr not in manager_stats:
            manager_stats[mgr] = {"count": 0, "total": 0}
        manager_stats[mgr]["count"] += 1
        manager_stats[mgr]["total"] += s.get("total_amount", 0) or 0
    
    return {
        "period": {"start": start_date, "end": end_date},
        "total_count": total_count,
        "total_amount": total_amount,
        "total_paid": total_paid,
        "remaining": total_amount - total_paid,
        "avg_order": round(total_amount / total_count, 2) if total_count > 0 else 0,
        "status_breakdown": status_counts,
        "manager_breakdown": manager_stats
    }


@router.post("/sync-from-crm")
async def sync_sales_from_crm():
    """Sync sales records from sauna_crm_leads that are past the first stage."""
    import uuid as uuid_mod
    
    # Get CRM settings to know stage order and date fields
    crm_settings = await db.sauna_crm_settings.find_one({}, {"_id": 0}) or {}
    stages = crm_settings.get("stages", [])
    first_stage_id = stages[0]["id"] if stages else "invoice_sent"
    calendar_date_field = crm_settings.get("calendarDateField", "")
    
    # Only sync leads that are NOT in the first stage (already past initial contact)
    crm_leads = await db.sauna_crm_leads.find(
        {"stageId": {"$ne": first_stage_id}},
        {"_id": 0}
    ).to_list(5000)

    collection = get_sales_collection()
    imported = 0
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc).isoformat()

    # Build stage name map for status
    stage_to_status = {}
    for s in stages:
        sid = s.get("id", "")
        if sid in ("prepayment_received",):
            stage_to_status[sid] = "запланировано"
        elif sid in ("approved_by_production", "in_production"):
            stage_to_status[sid] = "в процессе"
        elif sid in ("ready", "delivered"):
            stage_to_status[sid] = "реализовано"
        elif sid in ("completed",):
            stage_to_status[sid] = "реализовано"
        else:
            stage_to_status[sid] = "новый"

    for lead in crm_leads:
        lead_id = lead.get("id", "")
        if not lead_id:
            skipped += 1
            continue

        order_id = lead.get("calculatorOrderId") or lead_id

        # Determine the best date to use as order_date
        order_date = ""
        # 1. Try the calendar date field configured in settings
        if calendar_date_field and lead.get(calendar_date_field):
            order_date = str(lead[calendar_date_field])[:10]
        # 2. Try prepaymentDate
        if not order_date and lead.get("prepaymentDate"):
            order_date = str(lead["prepaymentDate"])[:10]
        # 3. Try productionDate
        if not order_date and lead.get("productionDate"):
            order_date = str(lead["productionDate"])[:10]
        # 4. Fallback to createdAt
        if not order_date and lead.get("createdAt"):
            order_date = str(lead["createdAt"])[:10]

        # Determine delivery date from CRM fields
        delivery_date = ""
        if lead.get("deliveryDate"):
            delivery_date = str(lead["deliveryDate"])[:10]

        # Status from stage
        stage_id = lead.get("stageId", "")
        status = stage_to_status.get(stage_id, "новый")

        sale_data = {
            "order_id": order_id,
            "crm_lead_id": lead_id,
            "product_name": lead.get("modelName") or "",
            "client_name": lead.get("clientName", ""),
            "total_amount": lead.get("totalAmount") or 0,
            "paid_amount": lead.get("advancePayment") or 0,
            "advance_amount": lead.get("advancePayment") or 0,
            "order_date": order_date,
            "prepayment_date": str(lead.get("prepaymentDate", ""))[:10] if lead.get("prepaymentDate") else "",
            "delivery_date": delivery_date,
            "status": status,
            "manager": lead.get("manager", ""),
            "notes": lead.get("notes") or "",
            "source": "crm_sync",
        }

        existing = await collection.find_one({"$or": [{"crm_lead_id": lead_id}, {"order_id": order_id}]})
        if existing:
            upd = {}
            for k in ["product_name", "client_name", "total_amount", "paid_amount", "advance_amount",
                       "status", "crm_lead_id", "manager", "prepayment_date", "delivery_date", "order_date"]:
                if sale_data.get(k):
                    upd[k] = sale_data[k]
            upd["updated_at"] = now
            upd["source"] = "crm_sync"
            await collection.update_one({"_id": existing["_id"]}, {"$set": upd})
            updated += 1
        else:
            sale_doc = {
                "id": f"SALE-{uuid_mod.uuid4().hex[:8].upper()}",
                **sale_data,
                "created_at": now,
                "updated_at": now,
            }
            await collection.insert_one(sale_doc)
            imported += 1

    return {"imported": imported, "updated": updated, "skipped": skipped, "total_processed": len(crm_leads)}
