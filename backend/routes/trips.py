"""Trips (routes/рейсы) management routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
from pymongo import MongoClient

router = APIRouter(prefix="/api/trips", tags=["trips"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

trips_collection = db["trips"]
greenhouse_orders = db["greenhouse_orders"]
balia_orders = db["orders"]  # Balia orders are stored in 'orders' collection
sauna_orders = db["sauna_orders"]


class TripCreate(BaseModel):
    name: str
    section: str  # greenhouse, balia, sauna
    orderIds: List[str] = []
    driverId: Optional[str] = None
    driverName: Optional[str] = None


class TripUpdate(BaseModel):
    name: Optional[str] = None
    orderIds: Optional[List[str]] = None
    driverId: Optional[str] = None
    driverName: Optional[str] = None
    status: Optional[str] = None  # planned, in_transit, completed
    # Order statuses within trip: {orderId: "delivering" | "delivered" | "cancelled"}
    orderStatuses: Optional[dict] = None


# Trip status constants
TRIP_STATUSES = {
    "planned": "Готов к отправке",
    "in_transit": "В пути",
    "completed": "Доставлен"
}

# Order delivery status within trip
ORDER_DELIVERY_STATUSES = {
    "pending": "Ожидает",
    "delivering": "В доставке",
    "delivered": "Доставлен",
    "cancelled": "Отменён"
}


def get_section_collection(section: str):
    """Get MongoDB collection for section."""
    if section == "greenhouse":
        return greenhouse_orders
    elif section == "balia":
        return balia_orders
    elif section == "sauna":
        return sauna_orders
    return None


@router.get("")
async def get_all_trips(section: Optional[str] = None):
    """Get all trips, optionally filtered by section."""
    query = {}
    if section:
        query["section"] = section
    
    trips = list(trips_collection.find(query, {"_id": 0}).sort("createdAt", -1))
    return trips


@router.get("/{trip_id}")
async def get_trip(trip_id: str):
    """Get a single trip with its orders."""
    trip = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Get orders for this trip
    collection = get_section_collection(trip.get("section", ""))
    if collection is not None:
        orders = list(collection.find(
            {"id": {"$in": trip.get("orderIds", [])}},
            {"_id": 0}
        ))
        trip["orders"] = orders
    else:
        trip["orders"] = []
    
    return trip


@router.post("")
async def create_trip(trip_data: TripCreate):
    """Create a new trip and assign orders to it."""
    now = datetime.now(timezone.utc).isoformat()
    
    # Generate trip ID
    section_prefix = {"greenhouse": "GH", "balia": "BAL", "sauna": "SAU"}
    prefix = section_prefix.get(trip_data.section, "TRIP")
    trip_id = f"{prefix}-{int(datetime.now().timestamp())}"
    
    # Initialize order statuses as pending
    order_statuses = {oid: "pending" for oid in trip_data.orderIds}
    
    trip = {
        "id": trip_id,
        "name": trip_data.name,
        "section": trip_data.section,
        "orderIds": trip_data.orderIds,
        "orderStatuses": order_statuses,  # Status per order
        "driverId": trip_data.driverId,
        "driverName": trip_data.driverName,
        "status": "planned",  # planned, in_transit, completed
        "createdAt": now,
        "updatedAt": now
    }
    
    trips_collection.insert_one(trip)
    
    # Update orders to mark them as assigned to this trip
    collection = get_section_collection(trip_data.section)
    if collection is not None and trip_data.orderIds:
        collection.update_many(
            {"id": {"$in": trip_data.orderIds}},
            {"$set": {"tripId": trip_id, "tripName": trip_data.name}}
        )
    
    trip.pop("_id", None)
    return trip


@router.put("/{trip_id}")
async def update_trip(trip_id: str, trip_data: TripUpdate):
    """Update a trip."""
    existing = trips_collection.find_one({"id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    update_data = {k: v for k, v in trip_data.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    # Handle order changes
    collection = get_section_collection(existing.get("section", ""))
    
    # Handle orderStatuses update
    if "orderStatuses" in update_data:
        # Merge with existing statuses
        existing_statuses = existing.get("orderStatuses", {})
        existing_statuses.update(update_data["orderStatuses"])
        update_data["orderStatuses"] = existing_statuses
    
    if "orderIds" in update_data and collection is not None:
        old_order_ids = set(existing.get("orderIds", []))
        new_order_ids = set(update_data["orderIds"])
        
        # Remove tripId from orders that were removed
        removed = old_order_ids - new_order_ids
        if removed:
            collection.update_many(
                {"id": {"$in": list(removed)}},
                {"$unset": {"tripId": "", "tripName": ""}}
            )
        
        # Add tripId to new orders
        added = new_order_ids - old_order_ids
        if added:
            collection.update_many(
                {"id": {"$in": list(added)}},
                {"$set": {"tripId": trip_id, "tripName": existing.get("name", "")}}
            )
    
    trips_collection.update_one({"id": trip_id}, {"$set": update_data})
    
    updated = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    return updated


@router.post("/{trip_id}/add-orders")
async def add_orders_to_trip(trip_id: str, order_ids: List[str]):
    """Add orders to an existing trip."""
    existing = trips_collection.find_one({"id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    collection = get_section_collection(existing.get("section", ""))
    if collection is None:
        raise HTTPException(status_code=400, detail="Invalid section")
    
    # Check if any orders are already in another trip
    for order_id in order_ids:
        order = collection.find_one({"id": order_id})
        if order and order.get("tripId") and order.get("tripId") != trip_id:
            raise HTTPException(
                status_code=400, 
                detail=f"Order {order_id} is already in trip {order.get('tripId')}"
            )
    
    # Update trip
    current_orders = existing.get("orderIds", [])
    new_orders = list(set(current_orders + order_ids))
    
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": {"orderIds": new_orders, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update orders
    collection.update_many(
        {"id": {"$in": order_ids}},
        {"$set": {"tripId": trip_id, "tripName": existing.get("name", "")}}
    )
    
    return {"status": "ok", "added": order_ids}


@router.post("/{trip_id}/remove-orders")
async def remove_orders_from_trip(trip_id: str, order_ids: List[str]):
    """Remove orders from a trip (return them to general list)."""
    existing = trips_collection.find_one({"id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    collection = get_section_collection(existing.get("section", ""))
    if collection is None:
        raise HTTPException(status_code=400, detail="Invalid section")
    
    # Update trip
    current_orders = existing.get("orderIds", [])
    new_orders = [oid for oid in current_orders if oid not in order_ids]
    
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": {"orderIds": new_orders, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Remove tripId from orders
    collection.update_many(
        {"id": {"$in": order_ids}},
        {"$unset": {"tripId": "", "tripName": ""}}
    )
    
    return {"status": "ok", "removed": order_ids}


@router.put("/{trip_id}/order-status/{order_id}")
async def update_order_status_in_trip(trip_id: str, order_id: str, status: str):
    """Update the delivery status of a single order within a trip."""
    if status not in ORDER_DELIVERY_STATUSES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {list(ORDER_DELIVERY_STATUSES.keys())}"
        )
    
    existing = trips_collection.find_one({"id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if order_id not in existing.get("orderIds", []):
        raise HTTPException(status_code=404, detail="Order not in this trip")
    
    # Update order status within trip
    order_statuses = existing.get("orderStatuses", {})
    order_statuses[order_id] = status
    
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": {
            "orderStatuses": order_statuses,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Also update the order's deliveryStatus in its collection
    collection = get_section_collection(existing.get("section", ""))
    if collection is not None:
        collection.update_one(
            {"id": order_id},
            {"$set": {"deliveryStatus": status}}
        )
    
    return {"status": "ok", "order_id": order_id, "new_status": status}


@router.delete("/{trip_id}")
async def delete_trip(trip_id: str):
    """Delete a trip and release its orders back to general list."""
    existing = trips_collection.find_one({"id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Release orders
    collection = get_section_collection(existing.get("section", ""))
    if collection is not None:
        collection.update_many(
            {"tripId": trip_id},
            {"$unset": {"tripId": "", "tripName": ""}}
        )
    
    trips_collection.delete_one({"id": trip_id})
    
    return {"status": "ok", "message": "Trip deleted"}
