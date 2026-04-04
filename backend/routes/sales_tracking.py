"""Sales Tracking API for admin managers."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import logging

from database import db

router = APIRouter(prefix="/api/sales-tracking", tags=["sales-tracking"])
logger = logging.getLogger(__name__)

sales_collection = db["sales_records"]
crm_leads_collection = db["sauna_crm_leads"]
bonus_settings_collection = db["bonus_settings"]

# Ensure indexes
sales_collection.create_index([("orderDate", -1)])
sales_collection.create_index([("manager", 1)])
sales_collection.create_index([("status", 1)])


class SaleRecord(BaseModel):
    orderNumber: Optional[str] = None
    productName: str
    clientName: str
    totalAmount: float
    paidAmount: Optional[float] = 0
    advanceZl: Optional[float] = 0
    orderDate: Optional[str] = None
    prepaymentDate: Optional[str] = None
    prepaymentTerms: Optional[str] = None
    paymentMethod: Optional[str] = None
    deliveryDate: Optional[str] = None
    status: str = "запланировано"
    manager: str
    material: Optional[str] = None
    door: Optional[str] = None
    glass: Optional[str] = None
    woodenDoor: Optional[str] = None
    panorama: Optional[str] = None
    tray: Optional[str] = None
    boiler: Optional[str] = None
    notes: Optional[str] = None


class SaleRecordUpdate(BaseModel):
    orderNumber: Optional[str] = None
    productName: Optional[str] = None
    clientName: Optional[str] = None
    totalAmount: Optional[float] = None
    paidAmount: Optional[float] = None
    advanceZl: Optional[float] = None
    orderDate: Optional[str] = None
    prepaymentDate: Optional[str] = None
    prepaymentTerms: Optional[str] = None
    paymentMethod: Optional[str] = None
    deliveryDate: Optional[str] = None
    status: Optional[str] = None
    manager: Optional[str] = None
    material: Optional[str] = None
    door: Optional[str] = None
    glass: Optional[str] = None
    woodenDoor: Optional[str] = None
    panorama: Optional[str] = None
    tray: Optional[str] = None
    boiler: Optional[str] = None
    notes: Optional[str] = None


class BonusSettings(BaseModel):
    managerId: str
    managerName: str
    bonusPercent: float = 5.0  # Default 5%


# ============ SALE RECORDS CRUD ============

@router.get("/records")
async def get_sales_records(
    startDate: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    endDate: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    manager: Optional[str] = Query(None, description="Manager name filter"),
    status: Optional[str] = Query(None, description="Status filter"),
    limit: int = Query(200, ge=1, le=1000),
    skip: int = Query(0, ge=0)
):
    """Get sales records from CRM leads filtered by prepaymentDate (дата аванса)."""
    query = {}
    
    # Date filter by prepaymentDate
    if startDate or endDate:
        date_filter = {}
        if startDate:
            date_filter["$gte"] = startDate
        if endDate:
            date_filter["$lte"] = endDate + "T23:59:59"
        date_filter["$ne"] = None
        query["prepaymentDate"] = date_filter
    
    # Manager filter
    if manager:
        query["manager"] = {"$regex": manager, "$options": "i"}
    
    # Stage filter (status)
    if status:
        query["stageId"] = status
    
    total = await crm_leads_collection.count_documents(query)
    leads = await crm_leads_collection.find(query, {"_id": 0}).sort("prepaymentDate", -1).skip(skip).limit(limit).to_list(limit)
    
    # Map CRM leads to sales record format
    records = []
    for lead in leads:
        records.append({
            "id": lead.get("id", ""),
            "orderNumber": lead.get("id", ""),
            "productName": lead.get("modelName") or lead.get("field_1", ""),
            "clientName": lead.get("clientName", ""),
            "totalAmount": lead.get("totalAmount") or 0,
            "advanceZl": lead.get("advancePayment") or 0,
            "orderDate": lead.get("prepaymentDate", ""),
            "prepaymentDate": lead.get("prepaymentDate", ""),
            "deliveryDate": lead.get("deliveryDate", ""),
            "status": lead.get("stageId", ""),
            "manager": lead.get("manager", ""),
            "notes": lead.get("notes", ""),
            "phone": lead.get("phone", ""),
            "productionDate": lead.get("productionDate", ""),
            "readyDate": lead.get("readyDate", ""),
            "source": "crm",
        })
    
    return {
        "records": records,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post("/records")
async def create_sale_record(record: SaleRecord):
    """Create a new sale record."""
    record_dict = record.model_dump()
    record_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    record_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    # Generate order number if not provided
    if not record_dict.get("orderNumber"):
        today = datetime.now(timezone.utc).strftime("%d-%m-%Y")
        count = await sales_collection.count_documents({}) + 1
        record_dict["orderNumber"] = f"SALE-{today}-{count:04d}"
    
    record_dict["id"] = record_dict["orderNumber"]
    
    await sales_collection.insert_one(record_dict)
    
    # Remove MongoDB _id from response
    record_dict.pop("_id", None)
    
    return {"success": True, "record": record_dict}


@router.put("/records/{record_id}")
async def update_sale_record(record_id: str, update: SaleRecordUpdate):
    """Update a sale record."""
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    update_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    result = await sales_collection.update_one(
        {"$or": [{"id": record_id}, {"orderNumber": record_id}]},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"success": True, "updated": record_id}


@router.delete("/records/{record_id}")
async def delete_sale_record(record_id: str):
    """Delete a sale record."""
    result = await sales_collection.delete_one(
        {"$or": [{"id": record_id}, {"orderNumber": record_id}]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"success": True, "deleted": record_id}


# ============ MANAGERS LIST ============

@router.get("/managers")
async def get_managers():
    """Get unique list of managers from CRM leads and sales records."""
    crm_managers = await crm_leads_collection.distinct("manager")
    sales_managers = await sales_collection.distinct("manager")
    all_managers = list(set([m for m in (crm_managers + sales_managers) if m]))
    all_managers.sort()
    return {"managers": all_managers}


# ============ STATUSES LIST ============

@router.get("/statuses")
async def get_statuses():
    """Get predefined list of statuses."""
    return {
        "statuses": [
            "запланировано",
            "в процессе",
            "реализовано",
            "ожидается информация",
            "отменено"
        ]
    }


# ============ BONUS SETTINGS ============

@router.get("/bonus-settings")
async def get_bonus_settings():
    """Get bonus settings for all managers."""
    settings = await bonus_settings_collection.find({}, {"_id": 0}).to_list(1000)
    return {"settings": settings}


@router.post("/bonus-settings")
async def save_bonus_settings(settings: BonusSettings):
    """Save or update bonus settings for a manager."""
    settings_dict = settings.model_dump()
    settings_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await bonus_settings_collection.update_one(
        {"managerId": settings.managerId},
        {"$set": settings_dict},
        upsert=True
    )
    
    return {"success": True, "settings": settings_dict}


# ============ STATISTICS & BONUS CALCULATION ============

@router.get("/statistics")
async def get_sales_statistics(
    startDate: str = Query(..., description="Start date (YYYY-MM-DD)"),
    endDate: str = Query(..., description="End date (YYYY-MM-DD)"),
    manager: Optional[str] = Query(None, description="Manager name filter")
):
    """Get sales statistics from CRM leads filtered by prepaymentDate (дата аванса)."""
    query = {
        "prepaymentDate": {"$gte": startDate, "$lte": endDate + "T23:59:59"},
    }
    # Exclude leads without prepaymentDate
    query["prepaymentDate"]["$ne"] = None
    
    if manager:
        query["manager"] = {"$regex": manager, "$options": "i"}
    
    # Aggregate statistics from CRM leads
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$manager",
            "totalSales": {"$sum": {"$ifNull": ["$totalAmount", 0]}},
            "ordersCount": {"$sum": 1},
        }},
        {"$sort": {"totalSales": -1}}
    ]
    
    results = await crm_leads_collection.aggregate(pipeline).to_list(5000)
    
    # Get bonus settings
    bonus_docs = await bonus_settings_collection.find({}, {"_id": 0}).to_list(1000)
    bonus_settings = {s["managerName"]: s["bonusPercent"] for s in bonus_docs}
    
    # Calculate bonuses
    statistics = []
    totalAllSales = 0
    totalAllBonus = 0
    
    for r in results:
        manager_name = r["_id"] or "Неизвестный"
        bonus_percent = bonus_settings.get(manager_name, 5.0)
        total_sales = r["totalSales"]
        bonus_amount = total_sales * (bonus_percent / 100)
        
        statistics.append({
            "manager": manager_name,
            "totalSales": total_sales,
            "completedSales": total_sales,
            "ordersCount": r["ordersCount"],
            "completedOrders": r["ordersCount"],
            "pendingOrders": 0,
            "totalPaid": 0,
            "bonusPercent": bonus_percent,
            "bonusAmount": round(bonus_amount, 2)
        })
        
        totalAllSales += total_sales
        totalAllBonus += bonus_amount
    
    return {
        "dateRange": {"start": startDate, "end": endDate},
        "filterManager": manager,
        "statistics": statistics,
        "summary": {
            "totalSales": totalAllSales,
            "totalBonus": round(totalAllBonus, 2),
            "managersCount": len(statistics)
        }
    }


@router.get("/bonus-calculation")
async def calculate_bonus(
    startDate: str = Query(..., description="Start date (YYYY-MM-DD)"),
    endDate: str = Query(..., description="End date (YYYY-MM-DD)"),
    manager: str = Query(..., description="Manager name"),
    bonusPercent: float = Query(..., description="Bonus percentage", ge=0, le=100)
):
    """Calculate bonus for a specific manager based on CRM leads by prepaymentDate."""
    query = {
        "prepaymentDate": {"$gte": startDate, "$lte": endDate + "T23:59:59", "$ne": None},
        "manager": {"$regex": f"^{manager}$", "$options": "i"},
    }
    
    records = await crm_leads_collection.find(query, {"_id": 0, "id": 1, "totalAmount": 1, "clientName": 1, "modelName": 1, "prepaymentDate": 1}).to_list(5000)
    
    total_sales = sum(r.get("totalAmount", 0) or 0 for r in records)
    bonus_amount = total_sales * (bonusPercent / 100)
    
    return {
        "manager": manager,
        "dateRange": {"start": startDate, "end": endDate},
        "bonusPercent": bonusPercent,
        "completedOrders": len(records),
        "totalSales": round(total_sales, 2),
        "bonusAmount": round(bonus_amount, 2),
        "orders": [{
            "orderNumber": r.get("id", ""),
            "clientName": r.get("clientName", ""),
            "productName": r.get("modelName", ""),
            "totalAmount": r.get("totalAmount", 0),
            "orderDate": r.get("prepaymentDate", ""),
        } for r in records]
    }


# ============ IMPORT FROM EXCEL (helper) ============

@router.post("/import")
async def import_sales_records(records: List[SaleRecord]):
    """Import multiple sales records (for Excel import)."""
    imported = 0
    errors = []
    
    for record in records:
        try:
            record_dict = record.model_dump()
            record_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
            record_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
            
            if not record_dict.get("orderNumber"):
                today = datetime.now(timezone.utc).strftime("%d-%m-%Y")
                count = await sales_collection.count_documents({}) + imported + 1
                record_dict["orderNumber"] = f"IMPORT-{today}-{count:04d}"
            
            record_dict["id"] = record_dict["orderNumber"]
            
            # Upsert to avoid duplicates
            await sales_collection.update_one(
                {"orderNumber": record_dict["orderNumber"]},
                {"$set": record_dict},
                upsert=True
            )
            imported += 1
        except Exception as e:
            errors.append({"record": record.productName, "error": str(e)})
    
    return {
        "success": True,
        "imported": imported,
        "errors": errors
    }
