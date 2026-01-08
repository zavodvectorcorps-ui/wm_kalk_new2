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


class StartTripRequest(BaseModel):
    startMileage: Optional[int] = None  # Начальный пробег в км


class FinishTripRequest(BaseModel):
    endMileage: Optional[int] = None  # Конечный пробег в км
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
    
    # Get warehouse settings for route start point
    logistics_settings = db.integration_settings.find_one({"type": "logistics"}, {"_id": 0})
    warehouse = None
    if logistics_settings:
        warehouse = {
            "address": logistics_settings.get("warehouse_address", ""),
            "lat": logistics_settings.get("warehouse_lat"),
            "lng": logistics_settings.get("warehouse_lng")
        }
    
    # Enrich trips with order data, preserving order sequence from logistics
    for trip in trips:
        section = trip.get("section", "")
        collection = get_section_collection(section)
        if collection is not None:
            order_ids = trip.get("orderIds", [])
            orders = list(collection.find({"id": {"$in": order_ids}}, {"_id": 0}))
            
            # Sort orders by their position in orderIds (preserves logistics sequence)
            order_map = {o["id"]: o for o in orders}
            ordered_list = [order_map[oid] for oid in order_ids if oid in order_map]
            
            # Auto-geocode orders without coordinates
            orders_without_coords = [o for o in ordered_list if not o.get("lat") or not o.get("lng")]
            if orders_without_coords:
                google_api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
                if google_api_key:
                    await auto_geocode_orders(orders_without_coords, collection, google_api_key)
                    # Refresh orders after geocoding
                    orders = list(collection.find({"id": {"$in": order_ids}}, {"_id": 0}))
                    order_map = {o["id"]: o for o in orders}
                    ordered_list = [order_map[oid] for oid in order_ids if oid in order_map]
            
            trip["orders"] = ordered_list
        else:
            trip["orders"] = []
        
        # Add warehouse to trip for route building
        if warehouse and warehouse.get("address"):
            trip["warehouse"] = warehouse
    
    return {"trips": trips, "driver": driver, "warehouse": warehouse}


async def auto_geocode_orders(orders: list, collection, api_key: str):
    """Auto-geocode orders that don't have coordinates."""
    import httpx
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        for order in orders:
            address = order.get("fullAddress", "")
            if not address:
                continue
            
            try:
                geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
                params = {
                    "address": address,
                    "key": api_key,
                    "language": "ru"
                }
                
                response = await client.get(geocode_url, params=params)
                data = response.json()
                
                if data.get("status") == "OK" and data.get("results"):
                    location = data["results"][0]["geometry"]["location"]
                    lat = location["lat"]
                    lng = location["lng"]
                    
                    # Update order with coordinates
                    collection.update_one(
                        {"id": order.get("id")},
                        {"$set": {
                            "lat": lat,
                            "lng": lng,
                            "geocodedAt": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    logger.info(f"Auto-geocoded order {order.get('id')}: {lat}, {lng}")
                    
            except Exception as e:
                logger.error(f"Auto-geocode failed for order {order.get('id')}: {e}")


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
    if collection is None:
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
    
    # Sync to amoCRM - update order status field
    amocrm_synced = False
    if order.get("amocrm_id"):
        try:
            # Prepare order data for sync
            order_for_sync = {
                **order,
                "tripOrderStatus": "delivered" if confirmation.isDelivered else "pending",
                "tripName": trip.get("name", ""),
                "tripDriverName": trip.get("driverName", driver.get("name", "")),
                "tripDepartureDate": trip.get("departureDate", "")
            }
            
            from routes.trips import sync_single_order_to_amocrm
            await sync_single_order_to_amocrm(order_for_sync)
            amocrm_synced = True
            logger.info(f"Synced delivery status to amoCRM for order {confirmation.orderId}")
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
        if collection is not None:
            update_data = {
                "deliveryPhotoUrl": photo_url,
                "deliveryConfirmedAt": now,
                "deliveryConfirmedBy": driver.get("name"),
                "tripOrderStatus": "delivered",
                "deliveryStatus": "delivered",
                "tripId": tripId  # Save tripId to order for photo link
            }
            if receivedAmount:
                update_data["receivedAmount"] = receivedAmount
            
            # Try to find and update order by different ID formats
            order_updated = False
            
            # First try exact ID match
            result = collection.update_one({"id": orderId}, {"$set": update_data})
            if result.modified_count > 0:
                order_updated = True
                logger.info(f"Updated order {orderId} by exact id match")
            
            # If not found, try by amocrm_id (for cases like "22413323" -> "AMO-GH-22413323")
            if not order_updated:
                # Extract numeric ID if present
                numeric_id = orderId.split("-")[-1] if "-" in orderId else orderId
                if numeric_id.isdigit():
                    result = collection.update_one({"amocrm_id": numeric_id}, {"$set": update_data})
                    if result.modified_count > 0:
                        order_updated = True
                        logger.info(f"Updated order by amocrm_id {numeric_id}")
            
            # Also try the reverse - if orderId is numeric, search for AMO-XX- prefixed version
            if not order_updated and orderId.isdigit():
                prefixes = ["AMO-GH-", "AMO-BA-", "AMO-SA-"]
                for prefix in prefixes:
                    result = collection.update_one({"id": f"{prefix}{orderId}"}, {"$set": update_data})
                    if result.modified_count > 0:
                        order_updated = True
                        logger.info(f"Updated order by prefixed id {prefix}{orderId}")
                        break
            
            if not order_updated:
                logger.warning(f"Could not find order {orderId} to update with photo")
            
            # Update trip order status
            order_statuses = trip.get("orderStatuses", {})
            order_statuses[orderId] = "delivered"
            trips_collection.update_one(
                {"id": tripId},
                {"$set": {"orderStatuses": order_statuses, "updatedAt": now}}
            )
            
            # Find the actual order for amoCRM sync (using same search logic)
            order = collection.find_one({"id": orderId}, {"_id": 0})
            if not order:
                numeric_id = orderId.split("-")[-1] if "-" in orderId else orderId
                if numeric_id.isdigit():
                    order = collection.find_one({"amocrm_id": numeric_id}, {"_id": 0})
            if not order and orderId.isdigit():
                for prefix in ["AMO-GH-", "AMO-BA-", "AMO-SA-"]:
                    order = collection.find_one({"id": f"{prefix}{orderId}"}, {"_id": 0})
                    if order:
                        break
            
            # Sync to amoCRM if order has amocrm_id
            if order and order.get("amocrm_id"):
                try:
                    from routes.trips import sync_single_order_to_amocrm, send_photo_to_amocrm
                    order_for_sync = {
                        **order,
                        "tripOrderStatus": "delivered",
                        "tripName": trip.get("name", ""),
                        "tripDriverName": trip.get("driverName", driver.get("name", "")),
                        "tripDepartureDate": trip.get("departureDate", "")
                    }
                    await sync_single_order_to_amocrm(order_for_sync)
                    logger.info(f"Synced delivery with photo to amoCRM for order {orderId}")
                    
                    # Send photo to amoCRM
                    photo_sent = await send_photo_to_amocrm(
                        order_id=orderId,
                        amocrm_id=order.get("amocrm_id"),
                        photo_url=photo_url,
                        driver_name=driver.get("name", "")
                    )
                    if photo_sent:
                        logger.info(f"Photo sent to amoCRM for order {orderId}")
                    else:
                        logger.warning(f"Failed to send photo to amoCRM for order {orderId}")
                        
                except Exception as e:
                    logger.error(f"Failed to sync delivery to amoCRM: {e}")
    
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


@router.get("/photo-image/{trip_id}/{order_id}")
async def get_delivery_photo_image(trip_id: str, order_id: str):
    """Get delivery photo as image file."""
    from fastapi.responses import Response
    
    logger.info(f"Looking for photo: tripId={trip_id}, orderId={order_id}")
    
    photo = delivery_photos.find_one({"tripId": trip_id, "orderId": order_id}, {"_id": 0})
    if not photo:
        logger.warning(f"Photo not found for tripId={trip_id}, orderId={order_id}")
        # Debug: list all photos
        all_photos = list(delivery_photos.find({}, {"_id": 0, "tripId": 1, "orderId": 1}))
        logger.info(f"Total photos in DB: {len(all_photos)}")
        raise HTTPException(status_code=404, detail="Фото не найдено")
    
    logger.info(f"Photo found: id={photo.get('id')}")
    
    # Photo is stored as data URL (data:image/jpeg;base64,xxx) in photoUrl field
    photo_url = photo.get("photoUrl", "")
    if not photo_url:
        raise HTTPException(status_code=404, detail="Фото данные не найдены")
    
    # Extract base64 data and content type from data URL
    import base64
    try:
        # Parse data URL: "data:image/jpeg;base64,/9j/4AAQ..."
        if photo_url.startswith("data:"):
            # Extract content type and base64 data
            header, base64_data = photo_url.split(",", 1)
            # header is like "data:image/jpeg;base64"
            content_type = header.replace("data:", "").replace(";base64", "")
        else:
            # Fallback if just raw base64
            base64_data = photo_url
            content_type = "image/jpeg"
        
        image_bytes = base64.b64decode(base64_data)
        logger.info(f"Returning photo: {len(image_bytes)} bytes, type={content_type}")
        return Response(content=image_bytes, media_type=content_type)
    except Exception as e:
        logger.error(f"Photo decode error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка декодирования: {str(e)}")


@router.get("/photos/list")
async def list_all_photos():
    """List all delivery photos (for debugging)."""
    photos = list(delivery_photos.find({}, {"_id": 0, "photoUrl": 0}))  # Exclude base64 data
    return {"count": len(photos), "photos": photos}


@router.get("/debug/order/{order_id}")
async def debug_order_info(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get debug info for an order including photo and amoCRM sync status."""
    result = {
        "orderId": order_id,
        "found_in_collections": [],
        "photo": None,
        "amocrm_id": None,
        "delivery_status": None
    }
    
    # Build possible ID variations for searching
    search_ids = [order_id]
    # If it's a plain number, also search with AMO- prefixes
    if order_id.isdigit():
        search_ids.extend([
            f"AMO-GH-{order_id}",  # Greenhouse format
            f"AMO-BA-{order_id}",  # Balia format
            f"AMO-SA-{order_id}",  # Sauna format
        ])
    # If it has AMO- prefix, also search plain number
    if order_id.startswith("AMO-"):
        plain_id = order_id.split("-")[-1]
        search_ids.append(plain_id)
    
    # Check all section collections
    for section_name, collection in [
        ("balia", balia_orders),
        ("greenhouse", greenhouse_orders),
        ("sauna", sauna_orders)
    ]:
        if collection is not None:
            # Try to find by any of the ID variations
            order = None
            for sid in search_ids:
                order = collection.find_one({"id": sid}, {"_id": 0, "deliveryPhotoUrl": 0})
                if order:
                    break
                order = collection.find_one({"amocrm_id": sid}, {"_id": 0, "deliveryPhotoUrl": 0})
                if order:
                    break
            
            if order:
                result["found_in_collections"].append(section_name)
                result["amocrm_id"] = order.get("amocrm_id")
                result["internal_id"] = order.get("id")
                result["delivery_status"] = order.get("deliveryStatus")
                result["trip_id"] = order.get("tripId")
                result["order_data"] = order
    
    # Check for photo - try all ID variations
    # First, check if photo exists (without fetching large photoUrl)
    photo = None
    for sid in search_ids:
        photo = delivery_photos.find_one({"orderId": sid}, {"_id": 0, "photoUrl": 0})
        if photo:
            result["photo_found_by_id"] = sid
            break
    
    if not photo and result.get("internal_id"):
        photo = delivery_photos.find_one({"orderId": result["internal_id"]}, {"_id": 0, "photoUrl": 0})
        if photo:
            result["photo_found_by_id"] = result["internal_id"]
    
    if photo:
        # Check if photoUrl exists separately (don't load it, just check existence)
        photo_with_url = delivery_photos.find_one(
            {"orderId": photo.get("orderId")}, 
            {"_id": 0, "photoUrl": 1}
        )
        has_photo_url = bool(photo_with_url and photo_with_url.get("photoUrl"))
        
        result["photo"] = {
            "id": photo.get("id"),
            "tripId": photo.get("tripId"),
            "orderId": photo.get("orderId"),
            "uploadedBy": photo.get("uploadedBy"),
            "confirmedAt": photo.get("confirmedAt"),
            "receivedAmount": photo.get("receivedAmount"),
            "has_photoUrl": has_photo_url
        }
        
        # Check if order has the photo link
        if result.get("order_data"):
            result["order_has_deliveryPhotoUrl"] = bool(result["order_data"].get("deliveryPhotoUrl"))
    
    # Show what IDs were searched
    result["searched_ids"] = search_ids
    
    return result


@router.post("/repair-photo-link/{order_id}")
async def repair_photo_link(order_id: str, current_user: dict = Depends(get_current_user)):
    """Repair the link between a photo in delivery_photos and the order record.
    
    This is useful when photo was uploaded but the order record wasn't updated.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    result = {
        "success": False,
        "message": "",
        "order_id": order_id,
        "debug": {}
    }
    
    # Build possible ID variations
    search_ids = [order_id]
    if order_id.isdigit():
        search_ids.extend([f"AMO-GH-{order_id}", f"AMO-BA-{order_id}", f"AMO-SA-{order_id}"])
    if order_id.startswith("AMO-"):
        plain_id = order_id.split("-")[-1]
        search_ids.append(plain_id)
    
    result["debug"]["search_ids"] = search_ids
    
    # Find photo
    photo = None
    photo_found_by = None
    for sid in search_ids:
        photo = delivery_photos.find_one({"orderId": sid})
        if photo:
            photo_found_by = sid
            break
    
    if not photo:
        result["message"] = "Фото не найдено в базе delivery_photos"
        result["debug"]["photos_count"] = delivery_photos.count_documents({})
        # List some photos for debugging
        sample_photos = list(delivery_photos.find({}, {"_id": 0, "orderId": 1, "tripId": 1}).limit(5))
        result["debug"]["sample_photos"] = sample_photos
        return result
    
    result["debug"]["photo_found_by"] = photo_found_by
    
    photo_order_id = photo.get("orderId")
    photo_url = photo.get("photoUrl")
    trip_id = photo.get("tripId")
    
    result["debug"]["photo_orderId"] = photo_order_id
    result["debug"]["photo_tripId"] = trip_id
    result["debug"]["has_photoUrl"] = bool(photo_url)
    result["debug"]["photoUrl_length"] = len(photo_url) if photo_url else 0
    
    if not photo_url:
        result["message"] = "Фото найдено в delivery_photos, но поле photoUrl пустое"
        return result
    
    # Find order in collections
    order = None
    order_collection = None
    order_found_by = None
    for section_name, collection in [
        ("balia", balia_orders),
        ("greenhouse", greenhouse_orders),
        ("sauna", sauna_orders)
    ]:
        if collection is not None:
            for sid in search_ids:
                order = collection.find_one({"id": sid})
                if order:
                    order_collection = collection
                    order_found_by = f"id={sid}"
                    result["found_in"] = section_name
                    break
                order = collection.find_one({"amocrm_id": sid})
                if order:
                    order_collection = collection
                    order_found_by = f"amocrm_id={sid}"
                    result["found_in"] = section_name
                    break
            if order:
                break
    
    result["debug"]["order_found_by"] = order_found_by
    
    if not order:
        result["message"] = "Заказ не найден ни в одной коллекции (balia, greenhouse, sauna)"
        # Count orders in each collection
        result["debug"]["balia_count"] = balia_orders.count_documents({}) if balia_orders else 0
        result["debug"]["greenhouse_count"] = greenhouse_orders.count_documents({}) if greenhouse_orders else 0
        result["debug"]["sauna_count"] = sauna_orders.count_documents({}) if sauna_orders else 0
        return result
    
    result["debug"]["order_id_in_db"] = order.get("id")
    result["debug"]["order_amocrm_id"] = order.get("amocrm_id")
    result["debug"]["order_current_deliveryPhotoUrl"] = bool(order.get("deliveryPhotoUrl"))
    
    # Update order with photo data
    update_data = {
        "deliveryPhotoUrl": photo_url,
        "tripId": trip_id
    }
    
    # Copy additional fields from photo if they exist
    if photo.get("confirmedAt"):
        update_data["deliveryConfirmedAt"] = photo.get("confirmedAt")
    if photo.get("uploadedBy"):
        update_data["deliveryConfirmedBy"] = photo.get("uploadedBy")
    if photo.get("receivedAmount"):
        update_data["receivedAmount"] = photo.get("receivedAmount")
    
    update_result = order_collection.update_one({"id": order.get("id")}, {"$set": update_data})
    
    result["debug"]["update_matched"] = update_result.matched_count
    result["debug"]["update_modified"] = update_result.modified_count
    
    # Verify the update
    updated_order = order_collection.find_one({"id": order.get("id")}, {"_id": 0, "deliveryPhotoUrl": 1})
    result["debug"]["verified_has_photoUrl"] = bool(updated_order.get("deliveryPhotoUrl") if updated_order else False)
    
    if update_result.modified_count > 0 or (updated_order and updated_order.get("deliveryPhotoUrl")):
        result["success"] = True
        result["message"] = f"Связь восстановлена для заказа {order.get('id')}"
        result["updated_fields"] = list(update_data.keys())
    else:
        result["message"] = "Обновление не применилось"
    
    return result


@router.post("/resend-photo-to-amocrm/{order_id}")
async def resend_photo_to_amocrm(order_id: str, current_user: dict = Depends(get_current_user)):
    """Manually resend a delivery photo to amoCRM.
    
    amoCRM File Upload Process (correct method via drive_url):
    1. Get drive_url from /api/v4/account?with=drive_url
    2. Create upload session: POST {drive_url}/v1.0/sessions
    3. Upload file to the returned upload_url
    4. Get file UUID from response
    5. Attach file to lead: PUT /api/v4/leads/{lead_id}/files
    """
    import httpx
    import base64
    from datetime import datetime, timezone
    
    result = {
        "success": False,
        "message": "",
        "order_id": order_id,
        "debug": {}
    }
    
    # Build possible ID variations
    search_ids = [order_id]
    if order_id.isdigit():
        search_ids.extend([f"AMO-GH-{order_id}", f"AMO-BA-{order_id}", f"AMO-SA-{order_id}"])
    if order_id.startswith("AMO-"):
        plain_id = order_id.split("-")[-1]
        search_ids.append(plain_id)
    
    # Find photo
    photo = None
    for sid in search_ids:
        photo = delivery_photos.find_one({"orderId": sid})
        if photo:
            break
    
    if not photo:
        result["message"] = "Фото не найдено в базе"
        return result
    
    photo_url = photo.get("photoUrl")
    if not photo_url:
        result["message"] = "Фото найдено, но photoUrl пустой"
        return result
    
    result["debug"]["photo_size"] = len(photo_url)
    
    # Find order to get amocrm_id
    order = None
    for section_name, collection in [
        ("balia", balia_orders),
        ("greenhouse", greenhouse_orders),
        ("sauna", sauna_orders)
    ]:
        if collection is not None:
            for sid in search_ids:
                order = collection.find_one({"id": sid})
                if not order:
                    order = collection.find_one({"amocrm_id": sid})
                if order:
                    result["debug"]["found_in"] = section_name
                    break
            if order:
                break
    
    if not order:
        result["message"] = "Заказ не найден"
        return result
    
    amocrm_id = order.get("amocrm_id")
    if not amocrm_id:
        result["message"] = "У заказа нет amocrm_id"
        return result
    
    result["debug"]["amocrm_id"] = amocrm_id
    result["debug"]["order_id"] = order.get("id")
    
    # Get amoCRM settings
    integration_settings = db["integration_settings"]
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        result["message"] = "Настройки amoCRM не найдены"
        return result
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        result["message"] = "Токен или домен amoCRM не настроены"
        return result
    
    result["debug"]["domain"] = domain
    
    # Parse photo data
    try:
        header, base64_data = photo_url.split(",", 1)
        content_type = header.replace("data:", "").replace(";base64", "")
        photo_bytes = base64.b64decode(base64_data)
        
        result["debug"]["content_type"] = content_type
        result["debug"]["photo_bytes_size"] = len(photo_bytes)
        
        ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
        file_ext = ext_map.get(content_type, "jpg")
        filename = f"delivery_photo_{order.get('id')}.{file_ext}"
        
        result["debug"]["filename"] = filename
    except Exception as e:
        result["message"] = f"Ошибка парсинга фото: {e}"
        return result
    
    # Send to amoCRM using correct process via drive_url
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers_auth = {"Authorization": f"Bearer {token}"}
            headers_json = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Step 1: Get drive_url from account info
            account_url = f"https://{domain}/api/v4/account?with=drive_url"
            result["debug"]["step1_url"] = account_url
            
            account_response = await client.get(account_url, headers=headers_auth)
            result["debug"]["account_status"] = account_response.status_code
            
            if account_response.status_code != 200:
                result["message"] = f"Не удалось получить данные аккаунта: {account_response.status_code}"
                result["debug"]["account_response"] = account_response.text[:500]
                return result
            
            account_data = account_response.json()
            drive_url = account_data.get("drive_url")
            
            if not drive_url:
                result["message"] = "drive_url не найден в данных аккаунта"
                result["debug"]["account_keys"] = list(account_data.keys())
                return result
            
            result["debug"]["drive_url"] = drive_url
            
            # Step 2: Create upload session on drive
            session_url = f"{drive_url}/v1.0/sessions"
            session_payload = {
                "file_name": filename,
                "file_size": len(photo_bytes),
                "content_type": content_type
            }
            
            result["debug"]["step2_url"] = session_url
            result["debug"]["step2_payload"] = session_payload
            
            session_response = await client.post(
                session_url,
                headers=headers_json,
                json=session_payload
            )
            
            result["debug"]["session_status"] = session_response.status_code
            result["debug"]["session_response"] = session_response.text[:500]
            
            if session_response.status_code not in [200, 201]:
                result["message"] = f"Не удалось создать сессию загрузки: {session_response.status_code}"
                return result
            
            session_data = session_response.json()
            upload_url = session_data.get("upload_url")
            max_part_size = session_data.get("max_part_size", len(photo_bytes))
            
            if not upload_url:
                result["message"] = "upload_url не найден в ответе сессии"
                result["debug"]["session_data"] = session_data
                return result
            
            result["debug"]["upload_url"] = upload_url
            result["debug"]["max_part_size"] = max_part_size
            
            # Step 3: Upload file to upload_url (chunked if needed)
            file_uuid = None
            current_url = upload_url
            offset = 0
            file_size = len(photo_bytes)
            chunk_num = 0
            
            while offset < file_size:
                chunk_end = min(offset + max_part_size, file_size)
                chunk = photo_bytes[offset:chunk_end]
                chunk_num += 1
                
                result["debug"][f"chunk_{chunk_num}"] = f"bytes {offset}-{chunk_end} of {file_size}"
                
                # Use POST for upload to session URL
                upload_response = await client.post(
                    current_url,
                    headers=headers_auth,
                    content=chunk
                )
                
                result["debug"]["upload_status"] = upload_response.status_code
                result["debug"]["upload_response"] = upload_response.text[:500]
                
                if upload_response.status_code not in [200, 201]:
                    result["message"] = f"Не удалось загрузить файл (chunk {chunk_num}): {upload_response.status_code}"
                    return result
                
                upload_data = upload_response.json()
                file_uuid = upload_data.get("uuid")
                next_url = upload_data.get("next_url")
                
                result["debug"]["upload_data_keys"] = list(upload_data.keys())
                
                if file_uuid:
                    result["debug"]["file_uuid"] = file_uuid
                    break
                    
                if next_url:
                    current_url = next_url
                    offset = chunk_end
                else:
                    # No next_url and no uuid - check if upload is complete
                    if upload_data.get("next_url") is None and not file_uuid:
                        result["debug"]["upload_complete_no_uuid"] = upload_data
                    break
            
            if not file_uuid:
                result["message"] = "UUID файла не получен после загрузки"
                return result
            
            # Step 4: Attach file to lead
            link_url = f"https://{domain}/api/v4/leads/{amocrm_id}/files"
            link_payload = [{"file_uuid": file_uuid}]
            
            result["debug"]["step4_url"] = link_url
            result["debug"]["step4_payload"] = link_payload
            
            link_response = await client.put(
                link_url,
                headers=headers_json,
                json=link_payload
            )
            
            result["debug"]["link_status"] = link_response.status_code
            result["debug"]["link_response"] = link_response.text[:500]
            
            if link_response.status_code in [200, 201, 202]:
                # Step 5: Also create a note about the photo
                note_text = f"📷 Фото акта доставки загружено"
                note_text += f"\nВремя: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}"
                note_text += f"\nЗаказ: {order.get('id')}"
                note_text += f"\nФайл: {filename}"
                
                notes_url = f"https://{domain}/api/v4/leads/{amocrm_id}/notes"
                note_payload = [{"note_type": "common", "params": {"text": note_text}}]
                
                note_response = await client.post(notes_url, headers=headers_json, json=note_payload)
                result["debug"]["note_status"] = note_response.status_code
                
                result["success"] = True
                result["message"] = f"Фото успешно загружено и привязано к сделке {amocrm_id}"
                return result
            else:
                result["message"] = f"Не удалось привязать файл к сделке: {link_response.status_code}"
                return result
            
    except Exception as e:
        result["message"] = f"Ошибка при отправке в amoCRM: {e}"
        result["debug"]["exception"] = str(e)
        import traceback
        result["debug"]["traceback"] = traceback.format_exc()
        return result


@router.post("/start-trip/{trip_id}")
async def start_trip(
    trip_id: str, 
    request: StartTripRequest = None,
    current_user: dict = Depends(get_current_user)
):
    """Start a trip - change trip status to 'in_transit' and all orders to 'delivering'.
    
    This syncs with logistics and amoCRM.
    """
    user_id = current_user.get("sub")
    start_mileage = request.startMileage if request else None
    
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
    
    # Update trip status to in_transit with mileage data
    update_data = {
        "status": "in_transit",
        "orderStatuses": order_statuses,
        "startedAt": now,
        "startedBy": driver.get("name"),
        "updatedAt": now
    }
    
    # Add mileage if provided
    if start_mileage is not None:
        update_data["mileage"] = {
            "start": start_mileage,
            "end": None,
            "total": None
        }
    
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": update_data}
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
                        "tripStatus": "in_transit",
                        "tripName": trip.get("name", ""),
                        "tripDriverName": trip.get("driverName", driver.get("name", "")),
                        "tripDepartureDate": trip.get("departureDate", "")
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
                    # Add trip data to order for sync
                    order_for_sync = {
                        **order,
                        "tripOrderStatus": "delivering",
                        "tripName": trip.get("name", ""),
                        "tripDriverName": trip.get("driverName", driver.get("name", "")),
                        "tripDepartureDate": trip.get("departureDate", "")
                    }
                    await sync_single_order_to_amocrm(order_for_sync)
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
        "amocrm_synced": amocrm_synced_count,
        "start_mileage": start_mileage
    }


@router.post("/finish-trip/{trip_id}")
async def finish_trip(
    trip_id: str,
    request: FinishTripRequest = None,
    current_user: dict = Depends(get_current_user)
):
    """Finish a trip - change trip status to 'delivered' and all orders to 'delivered'.
    
    This syncs with logistics and amoCRM.
    """
    user_id = current_user.get("sub")
    end_mileage = request.endMileage if request else None
    
    # Check if user is admin
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    is_admin = user and user.get("role") == "admin"
    
    # Find driver
    driver = drivers_collection.find_one({"userId": user_id}, {"_id": 0})
    if not driver and user:
        driver = drivers_collection.find_one({"name": user.get("username")}, {"_id": 0})
    
    if is_admin and not driver:
        driver = {"id": "admin", "name": user.get("username", "Admin"), "isAdmin": True}
    
    if not driver:
        raise HTTPException(status_code=403, detail="Водитель не найден")
    
    # Get trip
    trip = trips_collection.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Рейс не найден")
    
    # Verify access
    if not is_admin:
        driver_id = driver.get("id")
        driver_name = driver.get("name")
        if trip.get("driverId") != driver_id and trip.get("driverName") != driver_name:
            raise HTTPException(status_code=403, detail="Этот рейс не назначен вам")
    
    now = datetime.now(timezone.utc).isoformat()
    section = trip.get("section", "")
    collection = get_section_collection(section)
    
    # Update all order statuses to 'delivered'
    order_ids = trip.get("orderIds", [])
    order_statuses = trip.get("orderStatuses", {})
    
    for order_id in order_ids:
        order_statuses[order_id] = "delivered"
    
    # Calculate mileage
    mileage_data = trip.get("mileage", {})
    start_mileage = mileage_data.get("start")
    total_mileage = None
    
    if end_mileage is not None:
        mileage_data["end"] = end_mileage
        if start_mileage is not None:
            total_mileage = end_mileage - start_mileage
            mileage_data["total"] = total_mileage
    
    # Update trip status to delivered
    update_data = {
        "status": "delivered",
        "orderStatuses": order_statuses,
        "finishedAt": now,
        "finishedBy": driver.get("name"),
        "updatedAt": now
    }
    
    if mileage_data:
        update_data["mileage"] = mileage_data
    
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": update_data}
    )
    
    # Update all orders in the collection
    if collection is not None:
        for order_id in order_ids:
            collection.update_one(
                {"id": order_id},
                {"$set": {
                    "tripOrderStatus": "delivered",
                    "deliveryStatus": "delivered",
                    "tripStatus": "delivered",
                    "deliveredAt": now
                }}
            )
    
    logger.info(f"Driver {driver.get('name')} finished trip {trip_id}, mileage: {start_mileage} -> {end_mileage} = {total_mileage}")
    
    # Sync to amoCRM for all orders with amocrm_id
    amocrm_synced_count = 0
    if collection is not None:
        orders_with_amocrm = list(collection.find(
            {"id": {"$in": order_ids}, "amocrm_id": {"$exists": True, "$ne": ""}},
            {"_id": 0}
        ))
        
        try:
            from routes.trips import sync_single_order_to_amocrm
            for order in orders_with_amocrm:
                try:
                    order_for_sync = {
                        **order,
                        "tripOrderStatus": "delivered",
                        "tripStatus": "delivered",
                        "deliveredAt": now
                    }
                    await sync_single_order_to_amocrm(order_for_sync)
                    amocrm_synced_count += 1
                except Exception as e:
                    logger.error(f"Failed to sync order {order.get('id')} to amoCRM: {e}")
        except ImportError:
            logger.warning("Could not import sync function from trips module")
    
    return {
        "status": "ok",
        "message": "Рейс завершён! Все заказы отмечены как доставленные.",
        "trip_status": "delivered",
        "orders_updated": len(order_ids),
        "amocrm_synced": amocrm_synced_count,
        "mileage": {
            "start": start_mileage,
            "end": end_mileage,
            "total": total_mileage
        }
    }


@router.get("/debug/trip/{trip_id}")
async def debug_trip_data(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Debug endpoint to view trip and orders data including coordinates."""
    trip = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        return {"error": "Trip not found"}
    
    section = trip.get("section", "")
    collection = get_section_collection(section)
    
    orders_data = []
    if collection is not None:
        order_ids = trip.get("orderIds", [])
        for order in collection.find({"id": {"$in": order_ids}}, {"_id": 0}):
            orders_data.append({
                "id": order.get("id"),
                "fullName": order.get("fullName"),
                "fullAddress": order.get("fullAddress"),
                "lat": order.get("lat"),
                "lng": order.get("lng"),
                "phoneNumber": order.get("phoneNumber"),
                "debtSum": order.get("debtSum"),
                "has_coordinates": bool(order.get("lat") and order.get("lng"))
            })
    
    return {
        "trip_id": trip_id,
        "trip_name": trip.get("name"),
        "section": section,
        "total_orders": len(trip.get("orderIds", [])),
        "orders_with_coords": len([o for o in orders_data if o["has_coordinates"]]),
        "orders": orders_data
    }


@router.get("/debug/logs")
async def get_debug_logs(current_user: dict = Depends(get_current_user)):
    """Get recent logs for debugging."""
    # Get recent sync logs
    sync_logs = list(db["sync_logs"].find({}, {"_id": 0}).sort("timestamp", -1).limit(20))
    
    # Get driver panel specific logs
    driver_logs = []
    try:
        import os
        log_path = "/var/log/supervisor/backend.err.log"
        if os.path.exists(log_path):
            with open(log_path, "r") as f:
                lines = f.readlines()
                # Filter for driver panel related logs
                driver_lines = [l.strip() for l in lines[-200:] if "driver" in l.lower() or "trip" in l.lower() or "order" in l.lower()]
                driver_logs = driver_lines[-50:]
    except:
        pass
    
    return {
        "sync_logs": sync_logs,
        "recent_backend_logs": driver_logs
    }



class GeocodingRequest(BaseModel):
    orderId: str
    section: str
    address: str


@router.post("/geocode-order")
async def geocode_order_address(
    request: GeocodingRequest,
    current_user: dict = Depends(get_current_user)
):
    """Geocode an order's address using Google Maps API.
    
    This is useful when orders are created from amoCRM without coordinates.
    """
    collection = get_section_collection(request.section)
    if collection is None:
        raise HTTPException(status_code=400, detail="Неверный раздел")
    
    order = collection.find_one({"id": request.orderId})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    # Get Google Maps API key
    google_api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not google_api_key:
        raise HTTPException(status_code=400, detail="Google Maps API ключ не настроен")
    
    # Use address from request or from order
    address = request.address or order.get("fullAddress", "")
    if not address:
        raise HTTPException(status_code=400, detail="Адрес не указан")
    
    try:
        import httpx
        
        geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": address,
            "key": google_api_key,
            "language": "ru"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(geocode_url, params=params)
            data = response.json()
            
            if data.get("status") == "OK" and data.get("results"):
                location = data["results"][0]["geometry"]["location"]
                lat = location["lat"]
                lng = location["lng"]
                formatted_address = data["results"][0].get("formatted_address", address)
                
                # Update order with coordinates
                collection.update_one(
                    {"id": request.orderId},
                    {"$set": {
                        "lat": lat,
                        "lng": lng,
                        "geocodedAddress": formatted_address,
                        "geocodedAt": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logger.info(f"Geocoded order {request.orderId}: {lat}, {lng}")
                
                return {
                    "status": "ok",
                    "lat": lat,
                    "lng": lng,
                    "formatted_address": formatted_address
                }
            else:
                error_msg = data.get("status", "Unknown error")
                logger.error(f"Geocoding failed for {address}: {error_msg}")
                return {
                    "status": "error",
                    "message": f"Не удалось определить координаты: {error_msg}"
                }
                
    except Exception as e:
        logger.error(f"Geocoding error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка геокодирования: {str(e)}")


@router.post("/geocode-trip/{trip_id}")
async def geocode_trip_orders(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Geocode all orders in a trip that don't have coordinates."""
    trip = trips_collection.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Рейс не найден")
    
    section = trip.get("section", "")
    collection = get_section_collection(section)
    if collection is None:
        raise HTTPException(status_code=400, detail="Неверный раздел")
    
    # Get Google Maps API key
    google_api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not google_api_key:
        raise HTTPException(status_code=400, detail="Google Maps API ключ не настроен")
    
    # Find orders without coordinates
    order_ids = trip.get("orderIds", [])
    orders_to_geocode = list(collection.find({
        "id": {"$in": order_ids},
        "$or": [
            {"lat": {"$exists": False}},
            {"lat": None},
            {"lng": {"$exists": False}},
            {"lng": None}
        ]
    }, {"_id": 0}))
    
    if not orders_to_geocode:
        return {
            "status": "ok",
            "message": "Все заказы уже имеют координаты",
            "geocoded": 0,
            "failed": 0
        }
    
    geocoded_count = 0
    failed_count = 0
    results = []
    
    import httpx
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        for order in orders_to_geocode:
            address = order.get("fullAddress", "")
            if not address:
                failed_count += 1
                results.append({"order_id": order.get("id"), "status": "no_address"})
                continue
            
            try:
                geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
                params = {
                    "address": address,
                    "key": google_api_key,
                    "language": "ru"
                }
                
                response = await client.get(geocode_url, params=params)
                data = response.json()
                
                if data.get("status") == "OK" and data.get("results"):
                    location = data["results"][0]["geometry"]["location"]
                    lat = location["lat"]
                    lng = location["lng"]
                    
                    # Update order
                    collection.update_one(
                        {"id": order.get("id")},
                        {"$set": {
                            "lat": lat,
                            "lng": lng,
                            "geocodedAt": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    geocoded_count += 1
                    results.append({
                        "order_id": order.get("id"),
                        "status": "ok",
                        "lat": lat,
                        "lng": lng
                    })
                else:
                    failed_count += 1
                    results.append({
                        "order_id": order.get("id"),
                        "status": "geocode_failed",
                        "error": data.get("status")
                    })
                    
            except Exception as e:
                failed_count += 1
                results.append({
                    "order_id": order.get("id"),
                    "status": "error",
                    "error": str(e)
                })
    
    logger.info(f"Geocoded trip {trip_id}: {geocoded_count} success, {failed_count} failed")
    
    return {
        "status": "ok",
        "message": f"Геокодировано {geocoded_count} заказов, ошибок: {failed_count}",
        "geocoded": geocoded_count,
        "failed": failed_count,
        "total": len(orders_to_geocode),
        "results": results
    }



class WarehouseSettings(BaseModel):
    warehouse_address: str
    warehouse_lat: Optional[float] = None
    warehouse_lng: Optional[float] = None


@router.get("/warehouse-settings")
async def get_warehouse_settings(current_user: dict = Depends(get_current_user)):
    """Get warehouse/depot settings for route planning."""
    settings = db.integration_settings.find_one({"type": "logistics"}, {"_id": 0})
    if not settings:
        return {
            "warehouse_address": "",
            "warehouse_lat": None,
            "warehouse_lng": None
        }
    return {
        "warehouse_address": settings.get("warehouse_address", ""),
        "warehouse_lat": settings.get("warehouse_lat"),
        "warehouse_lng": settings.get("warehouse_lng")
    }


@router.post("/warehouse-settings")
async def save_warehouse_settings(
    settings: WarehouseSettings,
    current_user: dict = Depends(get_current_user)
):
    """Save warehouse/depot settings for route planning."""
    # Check admin access
    user = db.users.find_one({"id": current_user.get("sub")}, {"_id": 0})
    if not user or user.get("role") not in ["admin", "super-admin"]:
        raise HTTPException(status_code=403, detail="Требуются права администратора")
    
    update_data = {
        "warehouse_address": settings.warehouse_address,
        "warehouse_lat": settings.warehouse_lat,
        "warehouse_lng": settings.warehouse_lng,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If address provided but no coordinates, try to geocode
    if settings.warehouse_address and (not settings.warehouse_lat or not settings.warehouse_lng):
        google_api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
        if google_api_key:
            import httpx
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
                    params = {
                        "address": settings.warehouse_address,
                        "key": google_api_key,
                        "language": "ru"
                    }
                    response = await client.get(geocode_url, params=params)
                    data = response.json()
                    
                    if data.get("status") == "OK" and data.get("results"):
                        location = data["results"][0]["geometry"]["location"]
                        update_data["warehouse_lat"] = location["lat"]
                        update_data["warehouse_lng"] = location["lng"]
                        logger.info(f"Geocoded warehouse: {location}")
            except Exception as e:
                logger.error(f"Failed to geocode warehouse: {e}")
    
    db.integration_settings.update_one(
        {"type": "logistics"},
        {"$set": update_data},
        upsert=True
    )
    
    return {
        "status": "ok",
        "message": "Настройки склада сохранены",
        **update_data
    }
