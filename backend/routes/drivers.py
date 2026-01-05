"""Drivers management routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import uuid
from pymongo import MongoClient

router = APIRouter(prefix="/api/drivers", tags=["drivers"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

drivers_collection = db["drivers"]


class DriverCreate(BaseModel):
    name: str


class DriverUpdate(BaseModel):
    name: Optional[str] = None


@router.get("")
async def get_all_drivers():
    """Get all drivers."""
    drivers = list(drivers_collection.find({}, {"_id": 0}))
    return drivers


@router.post("")
async def create_driver(driver_data: DriverCreate):
    """Create a new driver."""
    driver = {
        "id": f"driver-{uuid.uuid4().hex[:8]}",
        "name": driver_data.name,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    drivers_collection.insert_one(driver)
    driver.pop("_id", None)
    
    return driver


@router.put("/{driver_id}")
async def update_driver(driver_id: str, driver_data: DriverUpdate):
    """Update a driver."""
    existing = drivers_collection.find_one({"id": driver_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    update_data = {}
    if driver_data.name is not None:
        update_data["name"] = driver_data.name
    
    if update_data:
        drivers_collection.update_one({"id": driver_id}, {"$set": update_data})
    
    updated = drivers_collection.find_one({"id": driver_id}, {"_id": 0})
    return updated


@router.delete("/{driver_id}")
async def delete_driver(driver_id: str):
    """Delete a driver."""
    existing = drivers_collection.find_one({"id": driver_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    drivers_collection.delete_one({"id": driver_id})
    
    return {"status": "ok", "message": "Driver deleted"}
