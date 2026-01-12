"""Greenhouse orders routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os

router = APIRouter(prefix="/api/greenhouse", tags=["greenhouse"])

# MongoDB connection
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
greenhouse_orders = db["greenhouse_orders"]


class GreenhouseOrder(BaseModel):
    model_config = {"extra": "allow"}  # Allow extra fields
    
    id: Optional[str] = None
    fullName: str
    phoneNumber: Optional[str] = None
    fullAddress: Optional[str] = ""
    notes: Optional[str] = None
    orderDate: Optional[str] = None
    createdAt: Optional[str] = None
    source: Optional[str] = "logistics"
    status: Optional[str] = "new"
    deliveryStatus: Optional[str] = "pending"
    deliveryComment: Optional[str] = ""
    driverName: Optional[str] = ""
    routeNumber: Optional[str] = ""
    amocrm_id: Optional[str] = None
    amocrm_data: Optional[dict] = None
    # === LOGISTICS FIELDS ===
    clientName: Optional[str] = None
    phone: Optional[str] = None
    orderContents: Optional[str] = None
    dealSum: Optional[str] = None
    debtSum: Optional[str] = None
    totalPrice: Optional[str] = None
    amountDue: Optional[str] = None
    # Trip assignment
    tripId: Optional[str] = None
    tripName: Optional[str] = None
    tripDriverName: Optional[str] = None
    tripDepartureDate: Optional[str] = None
    tripOrderStatus: Optional[str] = None
    # Flags
    isImportant: Optional[bool] = False
    # amoCRM
    amocrm_link: Optional[str] = None
    order_number: Optional[str] = None
    budget: Optional[float] = None
    # Geo
    lat: Optional[float] = None
    lng: Optional[float] = None
    # Transfer/History
    transferredAt: Optional[str] = None
    transferredBy: Optional[str] = None
    updatedAt: Optional[str] = None
    updatedBy: Optional[str] = None
    changeHistory: Optional[list] = []


@router.get("/orders")
async def get_greenhouse_orders():
    """Get all greenhouse orders."""
    orders = list(greenhouse_orders.find({}, {"_id": 0}))
    return orders


@router.post("/orders")
async def create_greenhouse_order(order: GreenhouseOrder):
    """Create a new greenhouse order."""
    now = datetime.now(timezone.utc).isoformat()
    
    order_data = order.dict()
    if not order_data.get("id"):
        order_data["id"] = f"GH-{int(datetime.now().timestamp() * 1000)}"
    if not order_data.get("orderDate"):
        order_data["orderDate"] = now
    if not order_data.get("createdAt"):
        order_data["createdAt"] = now
    if not order_data.get("source"):
        order_data["source"] = "logistics"
    if not order_data.get("status"):
        order_data["status"] = "new"
    
    greenhouse_orders.insert_one(order_data)
    
    # Return without _id
    order_data.pop("_id", None)
    return order_data


@router.get("/orders/{order_id}")
async def get_greenhouse_order(order_id: str):
    """Get a specific greenhouse order."""
    order = greenhouse_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/orders/{order_id}")
async def update_greenhouse_order(order_id: str, order: GreenhouseOrder):
    """Update a greenhouse order."""
    existing = greenhouse_orders.find_one({"id": order_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {k: v for k, v in order.dict().items() if v is not None}
    update_data["id"] = order_id  # Preserve original ID
    
    greenhouse_orders.update_one({"id": order_id}, {"$set": update_data})
    
    updated = greenhouse_orders.find_one({"id": order_id}, {"_id": 0})
    return updated


@router.delete("/orders/{order_id}")
async def delete_greenhouse_order(order_id: str):
    """Delete a greenhouse order."""
    result = greenhouse_orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted successfully"}
