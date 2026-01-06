"""Driver panel routes - API for driver's mobile/web interface."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import uuid
import base64
import logging

from pymongo import MongoClient
from services.auth_service import get_current_user

router = APIRouter(prefix="/api/driver-panel", tags=["driver-panel"])
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

drivers_collection = db["drivers"]
trips_collection = db["trips"]
greenhouse_orders = db["greenhouse_orders"]
balia_orders = db["orders"]
sauna_orders = db["sauna_orders"]
delivery_photos = db["delivery_photos"]


def get_section_collection(section: str):
    """Get the correct collection based on section."""
    if section == "greenhouse":
        return greenhouse_orders
    elif section == "balia":
        return balia_orders
    elif section == "sauna":
        return sauna_orders
    return None


class DeliveryConfirmation(BaseModel):
    orderId: str
    tripId: str
    isDelivered: bool = True
    receivedAmount: Optional[str] = None
    deliveryNotes: Optional[str] = None


@router.get("/my-trips")
async def get_my_trips(current_user: dict = Depends(get_current_user)):
    """Get all trips assigned to current driver, or all trips for admins."""
    user_id = current_user.get("sub")
    user_role = current_user.get("role", "")
    
    # Check if user is admin or super-admin
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    is_admin = user and user.get("role") in ["admin", "super-admin"]
    
    # Find driver profile linked to this user
    driver = drivers_collection.find_one({"userId": user_id}, {"_id": 0})
    if not driver and user:
        # Also try to find by username match (for backward compatibility)
        driver = drivers_collection.find_one({"name": user.get("username")}, {"_id": 0})
    
    # For admins without driver profile, show all active trips
    if is_admin:
        if not driver:
            # Create a virtual "admin" driver for display purposes
            driver = {"id": "admin", "name": user.get("username", "Admin"), "isAdmin": True}
        
        # Get all active trips for admin
        trips = list(trips_collection.find({
            "status": {"$in": ["planned", "in_transit"]}
        }, {"_id": 0}))
    else:
        if not driver:
            return {"trips": [], "driver": None, "message": "Водитель не найден. Обратитесь к администратору."}
        
        driver_id = driver.get("id")
        driver_name = driver.get("name")
        
        # Get trips assigned to this driver (active: planned or in_transit)
        trips = list(trips_collection.find({
            "$or": [
                {"driverId": driver_id},
                {"driverName": driver_name}
            ],
            "status": {"$in": ["planned", "in_transit"]}
        }, {"_id": 0}))
    
    # Enrich trips with order data
    for trip in trips:
        section = trip.get("section", "")
        collection = get_section_collection(section)
        if collection is not None:
            order_ids = trip.get("orderIds", [])
            orders = list(collection.find({"id": {"$in": order_ids}}, {"_id": 0}))
            # Sort orders by their position in orderIds
            order_map = {o["id"]: o for o in orders}
            trip["orders"] = [order_map[oid] for oid in order_ids if oid in order_map]
        else:
            trip["orders"] = []
    
    return {"trips": trips, "driver": driver}


@router.get("/trip/{trip_id}")
async def get_trip_details(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed trip information including orders."""
    user_id = current_user.get("sub")
    
    # Check if user is admin
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    is_admin = user and user.get("role") == "admin"
    
    # Find driver profile
    driver = drivers_collection.find_one({"userId": user_id}, {"_id": 0})
    if not driver and user:
        driver = drivers_collection.find_one({"name": user.get("username")}, {"_id": 0})
    
    # For admins, create virtual driver if not linked
    if is_admin and not driver:
        driver = {"id": "admin", "name": user.get("username", "Admin"), "isAdmin": True}
    
    if not driver:
        raise HTTPException(status_code=403, detail="Водитель не найден")
    
    # Get trip
    trip = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Рейс не найден")
    
    # Verify this trip is assigned to this driver (skip for admins)
    if not is_admin:
        driver_id = driver.get("id")
        driver_name = driver.get("name")
        if trip.get("driverId") != driver_id and trip.get("driverName") != driver_name:
            raise HTTPException(status_code=403, detail="Этот рейс не назначен вам")
    
    # Get orders
    section = trip.get("section", "")
    collection = get_section_collection(section)
    orders = []
    if collection:
        order_ids = trip.get("orderIds", [])
        orders_list = list(collection.find({"id": {"$in": order_ids}}, {"_id": 0}))
        order_map = {o["id"]: o for o in orders_list}
        orders = [order_map[oid] for oid in order_ids if oid in order_map]
    
    # Get delivery photos for this trip
    photos = list(delivery_photos.find({"tripId": trip_id}, {"_id": 0}))
    photo_map = {p["orderId"]: p for p in photos}
    
    # Add delivery info to orders
    for order in orders:
        order_photo = photo_map.get(order["id"])
        if order_photo:
            order["deliveryPhoto"] = order_photo.get("photoUrl")
            order["receivedAmount"] = order_photo.get("receivedAmount")
            order["deliveryConfirmedAt"] = order_photo.get("confirmedAt")
    
    trip["orders"] = orders
    
    return {"trip": trip, "driver": driver}


@router.post("/confirm-delivery")
async def confirm_delivery(
    confirmation: DeliveryConfirmation,
    current_user: dict = Depends(get_current_user)
):
    """Confirm delivery of an order."""
    user_id = current_user.get("sub")
    
    # Check if user is admin
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    is_admin = user and user.get("role") == "admin"
    
    # Find driver
    driver = drivers_collection.find_one({"userId": user_id}, {"_id": 0})
    if not driver and user:
        driver = drivers_collection.find_one({"name": user.get("username")}, {"_id": 0})
    
    # For admins, create virtual driver if not linked
    if is_admin and not driver:
        driver = {"id": "admin", "name": user.get("username", "Admin"), "isAdmin": True}
    
    if not driver:
        raise HTTPException(status_code=403, detail="Водитель не найден")
    
    # Get trip
    trip = trips_collection.find_one({"id": confirmation.tripId}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Рейс не найден")
    
    # Get section collection
    section = trip.get("section", "")
    collection = get_section_collection(section)
    if not collection:
        raise HTTPException(status_code=400, detail="Неверный раздел")
    
    # Update order status
    order = collection.find_one({"id": confirmation.orderId})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update order in collection
    update_data = {
        "tripOrderStatus": "delivered" if confirmation.isDelivered else "pending",
        "deliveryStatus": "delivered" if confirmation.isDelivered else "pending",
        "deliveryConfirmedAt": now if confirmation.isDelivered else None,
        "deliveryConfirmedBy": driver.get("name"),
    }
    
    if confirmation.receivedAmount:
        update_data["receivedAmount"] = confirmation.receivedAmount
    
    if confirmation.deliveryNotes:
        update_data["deliveryNotes"] = confirmation.deliveryNotes
    
    collection.update_one({"id": confirmation.orderId}, {"$set": update_data})
    
    # Update order status in trip
    order_statuses = trip.get("orderStatuses", {})
    order_statuses[confirmation.orderId] = "delivered" if confirmation.isDelivered else "pending"
    trips_collection.update_one(
        {"id": confirmation.tripId},
        {"$set": {"orderStatuses": order_statuses, "updatedAt": now}}
    )
    
    logger.info(f"Driver {driver.get('name')} confirmed delivery of order {confirmation.orderId}")
    
    # Sync to amoCRM if order has amocrm_id
    amocrm_synced = False
    if order.get("amocrm_id") and confirmation.isDelivered:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{os.environ.get('APP_BASE_URL', 'http://localhost:8001')}/api/integrations/amocrm/upload-delivery-photo",
                    params={
                        "amocrm_id": order["amocrm_id"],
                        "order_id": confirmation.orderId,
                        "driver_name": driver.get("name", ""),
                        "received_amount": confirmation.receivedAmount or ""
                    }
                )
                amocrm_synced = True
        except Exception as e:
            logger.error(f"Failed to sync delivery to amoCRM: {e}")
    
    return {"status": "ok", "message": "Доставка подтверждена", "amocrm_synced": amocrm_synced}


@router.post("/upload-photo")
async def upload_delivery_photo(
    tripId: str = Form(...),
    orderId: str = Form(...),
    receivedAmount: str = Form(None),
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload delivery confirmation photo."""
    user_id = current_user.get("sub")
    
    # Check if user is admin
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    is_admin = user and user.get("role") == "admin"
    
    # Find driver
    driver = drivers_collection.find_one({"userId": user_id}, {"_id": 0})
    if not driver and user:
        driver = drivers_collection.find_one({"name": user.get("username")}, {"_id": 0})
    
    # For admins, create virtual driver if not linked
    if is_admin and not driver:
        driver = {"id": "admin", "name": user.get("username", "Admin"), "isAdmin": True}
    
    if not driver:
        raise HTTPException(status_code=403, detail="Водитель не найден")
    
    # Validate file type
    if not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Только изображения разрешены")
    
    # Read and compress image
    contents = await photo.read()
    
    # Check file size (max 10MB)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 10MB)")
    
    # Store as base64 (for simplicity, can be changed to file storage later)
    photo_base64 = base64.b64encode(contents).decode('utf-8')
    photo_url = f"data:{photo.content_type};base64,{photo_base64}"
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Save or update photo record
    photo_record = {
        "id": f"photo-{uuid.uuid4().hex[:8]}",
        "tripId": tripId,
        "orderId": orderId,
        "photoUrl": photo_url,
        "receivedAmount": receivedAmount,
        "uploadedBy": driver.get("name"),
        "uploadedByUserId": user_id,
        "confirmedAt": now,
        "filename": photo.filename
    }
    
    # Upsert - update if exists, insert if not
    delivery_photos.update_one(
        {"tripId": tripId, "orderId": orderId},
        {"$set": photo_record},
        upsert=True
    )
    
    # Update order with delivery info
    trip = trips_collection.find_one({"id": tripId})
    if trip:
        section = trip.get("section", "")
        collection = get_section_collection(section)
        if collection:
            update_data = {
                "deliveryPhotoUrl": photo_url,
                "deliveryConfirmedAt": now,
                "deliveryConfirmedBy": driver.get("name"),
                "tripOrderStatus": "delivered",
                "deliveryStatus": "delivered"
            }
            if receivedAmount:
                update_data["receivedAmount"] = receivedAmount
            
            collection.update_one({"id": orderId}, {"$set": update_data})
            
            # Update trip order status
            order_statuses = trip.get("orderStatuses", {})
            order_statuses[orderId] = "delivered"
            trips_collection.update_one(
                {"id": tripId},
                {"$set": {"orderStatuses": order_statuses, "updatedAt": now}}
            )
    
    logger.info(f"Driver {driver.get('name')} uploaded photo for order {orderId}")
    
    return {
        "status": "ok",
        "message": "Фото загружено",
        "photoId": photo_record["id"]
    }


@router.get("/photo/{trip_id}/{order_id}")
async def get_delivery_photo(trip_id: str, order_id: str):
    """Get delivery photo for an order."""
    photo = delivery_photos.find_one({"tripId": trip_id, "orderId": order_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Фото не найдено")
    return photo



@router.post("/start-trip/{trip_id}")
async def start_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Start a trip - change trip status to 'in_transit' and all orders to 'delivering'.
    
    This syncs with logistics and amoCRM.
    """
    user_id = current_user.get("sub")
    
    # Check if user is admin
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    is_admin = user and user.get("role") == "admin"
    
    # Find driver
    driver = drivers_collection.find_one({"userId": user_id}, {"_id": 0})
    if not driver and user:
        driver = drivers_collection.find_one({"name": user.get("username")}, {"_id": 0})
    
    # For admins, create virtual driver if not linked
    if is_admin and not driver:
        driver = {"id": "admin", "name": user.get("username", "Admin"), "isAdmin": True}
    
    if not driver:
        raise HTTPException(status_code=403, detail="Водитель не найден")
    
    # Get trip
    trip = trips_collection.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Рейс не найден")
    
    # Verify access (driver can only start their own trips, admins can start any)
    if not is_admin:
        driver_id = driver.get("id")
        driver_name = driver.get("name")
        if trip.get("driverId") != driver_id and trip.get("driverName") != driver_name:
            raise HTTPException(status_code=403, detail="Этот рейс не назначен вам")
    
    now = datetime.now(timezone.utc).isoformat()
    section = trip.get("section", "")
    collection = get_section_collection(section)
    
    # Update all order statuses to 'delivering'
    order_ids = trip.get("orderIds", [])
    order_statuses = trip.get("orderStatuses", {})
    
    for order_id in order_ids:
        # Only update if not already delivered
        current_status = order_statuses.get(order_id, "pending")
        if current_status != "delivered":
            order_statuses[order_id] = "delivering"
    
    # Update trip status to in_transit
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": {
            "status": "in_transit",
            "orderStatuses": order_statuses,
            "startedAt": now,
            "startedBy": driver.get("name"),
            "updatedAt": now
        }}
    )
    
    # Update all orders in the collection
    if collection is not None:
        for order_id in order_ids:
            if order_statuses.get(order_id) == "delivering":
                collection.update_one(
                    {"id": order_id},
                    {"$set": {
                        "tripOrderStatus": "delivering",
                        "deliveryStatus": "delivering",
                        "tripStatus": "in_transit"
                    }}
                )
    
    logger.info(f"Driver {driver.get('name')} started trip {trip_id}")
    
    # Sync to amoCRM for all orders with amocrm_id
    amocrm_synced_count = 0
    if collection is not None:
        orders_with_amocrm = list(collection.find(
            {"id": {"$in": order_ids}, "amocrm_id": {"$exists": True, "$ne": ""}},
            {"_id": 0}
        ))
        
        # Import sync function from trips module
        try:
            from routes.trips import sync_single_order_to_amocrm
            for order in orders_with_amocrm:
                try:
                    await sync_single_order_to_amocrm(order)
                    amocrm_synced_count += 1
                except Exception as e:
                    logger.error(f"Failed to sync order {order.get('id')} to amoCRM: {e}")
        except ImportError:
            logger.warning("Could not import sync function from trips module")
    
    return {
        "status": "ok",
        "message": "Рейс начат! Статусы всех заказов изменены на 'В пути'",
        "trip_status": "in_transit",
        "orders_updated": len([s for s in order_statuses.values() if s == "delivering"]),
        "amocrm_synced": amocrm_synced_count
    }
