"""Warehouse (склад) management routes."""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

from database import db
from services.auth_service import get_current_user

router = APIRouter(prefix="/warehouse", tags=["Warehouse"])
logger = logging.getLogger(__name__)

# Collections
warehouse_history = db["warehouse_history"]
greenhouse_orders = db["greenhouse_orders"]
balia_orders = db["balia_orders"]
sauna_orders = db["sauna_orders"]
trips_collection = db["trips"]

# Warehouse statuses
WAREHOUSE_STATUSES = {
    "request": "Заявка",
    "picking": "Комплектация",
    "ready": "Готов к загрузке"
}


def check_warehouse_access(user: dict):
    """Check if user has warehouse access."""
    access = user.get("access", [])
    role = user.get("role", "")
    
    if role == "admin":
        return True
    
    if isinstance(access, str):
        return access in ["warehouse", "all"]
    
    return "warehouse" in access or "all" in access


@router.get("/orders")
async def get_warehouse_orders(
    section: Optional[str] = Query(None, description="Filter by section: balia, greenhouse, sauna"),
    status: Optional[str] = Query(None, description="Filter by warehouse status"),
    search: Optional[str] = Query(None, description="Search by order ID or client name"),
    current_user: dict = Depends(get_current_user)
):
    """Get all orders for warehouse view with filtering."""
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа к складу")
    
    all_orders = []
    
    # Build query filter
    query = {}
    if status:
        query["warehouseStatus"] = status
    
    collections = []
    if section:
        if section == "balia":
            collections = [("balia", balia_orders)]
        elif section == "greenhouse":
            collections = [("greenhouse", greenhouse_orders)]
        elif section == "sauna":
            collections = [("sauna", sauna_orders)]
    else:
        collections = [
            ("balia", balia_orders),
            ("greenhouse", greenhouse_orders),
            ("sauna", sauna_orders)
        ]
    
    for section_name, collection in collections:
        try:
            orders = await collection.find(query, {"_id": 0}).to_list(1000)
            for order in orders:
                order["section"] = section_name
                # Default warehouse status if not set
                if "warehouseStatus" not in order:
                    order["warehouseStatus"] = "request"
                all_orders.append(order)
        except Exception as e:
            logger.error(f"Error fetching {section_name} orders: {e}")
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        all_orders = [
            o for o in all_orders 
            if search_lower in o.get("id", "").lower() 
            or search_lower in o.get("clientName", "").lower()
            or search_lower in o.get("amocrm_id", "").lower()
        ]
    
    # Sort by creation date (newest first)
    all_orders.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    
    return {
        "orders": all_orders,
        "total": len(all_orders),
        "statuses": WAREHOUSE_STATUSES
    }


@router.get("/orders/{order_id}")
async def get_warehouse_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single order details for warehouse."""
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа к складу")
    
    # Search in all collections
    for section_name, collection in [
        ("balia", balia_orders),
        ("greenhouse", greenhouse_orders),
        ("sauna", sauna_orders)
    ]:
        order = await collection.find_one({"id": order_id}, {"_id": 0})
        if order:
            order["section"] = section_name
            if "warehouseStatus" not in order:
                order["warehouseStatus"] = "request"
            return order
    
    raise HTTPException(status_code=404, detail="Заказ не найден")


@router.put("/orders/{order_id}/status")
async def update_warehouse_status(
    order_id: str,
    status: str = Query(..., description="New warehouse status: request, picking, ready"),
    comment: Optional[str] = Query(None, description="Optional comment"),
    current_user: dict = Depends(get_current_user)
):
    """Update warehouse status for an order."""
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа к складу")
    
    if status not in WAREHOUSE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {list(WAREHOUSE_STATUSES.keys())}")
    
    now = datetime.now(timezone.utc).isoformat()
    username = current_user.get("username", "unknown")
    
    # Find and update order in the correct collection
    updated = False
    section_name = None
    old_status = None
    
    for sec_name, collection in [
        ("balia", balia_orders),
        ("greenhouse", greenhouse_orders),
        ("sauna", sauna_orders)
    ]:
        order = await collection.find_one({"id": order_id}, {"_id": 0})
        if order:
            old_status = order.get("warehouseStatus", "request")
            section_name = sec_name
            
            result = await collection.update_one(
                {"id": order_id},
                {"$set": {
                    "warehouseStatus": status,
                    "warehouseUpdatedAt": now,
                    "warehouseUpdatedBy": username
                }}
            )
            
            if result.modified_count > 0:
                updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    # Record history
    history_entry = {
        "id": str(uuid.uuid4()),
        "orderId": order_id,
        "section": section_name,
        "oldStatus": old_status,
        "newStatus": status,
        "comment": comment,
        "changedBy": username,
        "changedAt": now
    }
    await warehouse_history.insert_one(history_entry)
    
    logger.info(f"Warehouse status updated: order={order_id}, {old_status} -> {status}, by={username}")
    
    return {
        "success": True,
        "message": f"Статус изменён на '{WAREHOUSE_STATUSES[status]}'",
        "order_id": order_id,
        "old_status": old_status,
        "new_status": status
    }


@router.get("/orders/{order_id}/history")
async def get_order_history(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get warehouse status history for an order."""
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа к складу")
    
    history = await warehouse_history.find(
        {"orderId": order_id},
        {"_id": 0}
    ).sort("changedAt", -1).to_list(100)
    
    return {
        "order_id": order_id,
        "history": history
    }


@router.get("/trips")
async def get_warehouse_trips(
    current_user: dict = Depends(get_current_user)
):
    """Get all trips for warehouse view (read-only)."""
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа к складу")
    
    trips = await trips_collection.find(
        {},
        {"_id": 0}
    ).sort("createdAt", -1).to_list(500)
    
    # Enrich trips with full order details
    enriched_trips = []
    for trip in trips:
        trip_orders = []
        order_ids = trip.get("orderIds", [])
        
        for order_id in order_ids:
            order = None
            # Search in all collections with multiple ID formats
            for section_name, collection in [
                ("balia", balia_orders),
                ("greenhouse", greenhouse_orders),
                ("sauna", sauna_orders)
            ]:
                # Try exact match first
                order = await collection.find_one({"id": order_id}, {"_id": 0})
                
                # Try amocrm_id match
                if not order:
                    order = await collection.find_one({"amocrm_id": order_id}, {"_id": 0})
                
                # Try partial match (AMO-GH-12345 -> 12345)
                if not order and order_id.isdigit():
                    for prefix in ["AMO-GH-", "AMO-BA-", "AMO-SA-"]:
                        order = await collection.find_one({"id": f"{prefix}{order_id}"}, {"_id": 0})
                        if order:
                            break
                
                if order:
                    order["section"] = section_name
                    trip_orders.append(order)
                    break
            
            # If order not found, add placeholder
            if not order:
                trip_orders.append({
                    "id": order_id,
                    "section": "unknown",
                    "clientName": None,
                    "_notFound": True
                })
        
        trip["orders"] = trip_orders
        trip["orderCount"] = len([o for o in trip_orders if not o.get("_notFound")])
        enriched_trips.append(trip)
    
    return {
        "trips": enriched_trips,
        "total": len(enriched_trips)
    }


@router.get("/trips/{trip_id}")
async def get_warehouse_trip(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single trip details for warehouse view."""
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа к складу")
    
    trip = await trips_collection.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Рейс не найден")
    
    # Enrich with order details
    trip_orders = []
    for order_id in trip.get("orderIds", []):
        for section_name, collection in [
            ("balia", balia_orders),
            ("greenhouse", greenhouse_orders),
            ("sauna", sauna_orders)
        ]:
            order = await collection.find_one({"id": order_id}, {"_id": 0})
            if order:
                order["section"] = section_name
                trip_orders.append(order)
                break
    
    trip["orders"] = trip_orders
    
    return trip


@router.get("/stats")
async def get_warehouse_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get warehouse statistics."""
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа к складу")
    
    stats = {
        "byStatus": {},
        "bySection": {},
        "total": 0
    }
    
    for section_name, collection in [
        ("balia", balia_orders),
        ("greenhouse", greenhouse_orders),
        ("sauna", sauna_orders)
    ]:
        try:
            # Count by status
            for status_key in WAREHOUSE_STATUSES.keys():
                count = await collection.count_documents({"warehouseStatus": status_key})
                stats["byStatus"][status_key] = stats["byStatus"].get(status_key, 0) + count
            
            # Count orders without warehouseStatus (default to 'request')
            no_status_count = await collection.count_documents({"warehouseStatus": {"$exists": False}})
            stats["byStatus"]["request"] = stats["byStatus"].get("request", 0) + no_status_count
            
            # Total by section
            section_total = await collection.count_documents({})
            stats["bySection"][section_name] = section_total
            stats["total"] += section_total
            
        except Exception as e:
            logger.error(f"Error counting {section_name} orders: {e}")
    
    return stats
