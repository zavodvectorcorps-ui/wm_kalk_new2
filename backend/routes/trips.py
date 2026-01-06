"""Trips (routes/рейсы) management routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import httpx
import logging
from pymongo import MongoClient

router = APIRouter(prefix="/api/trips", tags=["trips"])
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

trips_collection = db["trips"]
greenhouse_orders = db["greenhouse_orders"]
balia_orders = db["orders"]  # Balia orders are stored in 'orders' collection
sauna_orders = db["sauna_orders"]
integration_settings = db["integration_settings"]


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
    departureDate: Optional[str] = None  # Date of departure
    # Order statuses within trip: {orderId: "delivering" | "delivered" | "cancelled"}
    orderStatuses: Optional[dict] = None
    syncOrderStatuses: Optional[bool] = False  # Sync all order statuses with trip status


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


def sync_trip_data_to_orders(trip: dict, collection):
    """Sync trip data to all orders in trip.
    
    This stores trip info (name, driver, departure date, status) in each order,
    so that when syncing to amoCRM, each order has its own data to send.
    """
    if collection is None:
        logger.warning("sync_trip_data_to_orders: collection is None")
        return
    
    order_ids = trip.get("orderIds", [])
    if not order_ids:
        logger.info("sync_trip_data_to_orders: no order IDs in trip")
        return
    
    order_statuses = trip.get("orderStatuses", {})
    
    # Data to store in each order
    trip_data_for_orders = {
        "tripId": trip.get("id", ""),
        "tripName": trip.get("name", ""),
        "tripDriverId": trip.get("driverId", ""),
        "tripDriverName": trip.get("driverName", ""),
        "tripDepartureDate": trip.get("departureDate", ""),
        "tripStatus": trip.get("status", "planned")
    }
    
    logger.info(f"Syncing trip data to {len(order_ids)} orders: {trip_data_for_orders}")
    
    # Update each order with its specific status
    for order_id in order_ids:
        order_status = order_statuses.get(order_id, "pending")
        result = collection.update_one(
            {"id": order_id},
            {"$set": {
                **trip_data_for_orders,
                "tripOrderStatus": order_status
            }}
        )
        logger.info(f"Updated order {order_id}: matched={result.matched_count}, modified={result.modified_count}")


async def sync_single_order_to_amocrm(order: dict):
    """Sync a single order's trip data to amoCRM.
    
    Called when order status is updated in trip.
    """
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        return
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        return
    
    amocrm_id = order.get("amocrm_id")
    if not amocrm_id:
        return
    
    # Field IDs
    trip_number_field_id = settings.get("trip_number_field_id", "")
    trip_driver_field_id = settings.get("trip_driver_field_id", "")
    trip_departure_field_id = settings.get("trip_departure_field_id", "")
    trip_order_status_field_id = settings.get("trip_order_status_field_id", "")
    
    if not any([trip_number_field_id, trip_driver_field_id, trip_departure_field_id, trip_order_status_field_id]):
        return
    
    STATUS_LABELS = {
        "pending": "Ожидает",
        "delivering": "В пути",
        "delivered": "Доставлен",
        "cancelled": "Отменён"
    }
    
    custom_fields_values = []
    
    if trip_number_field_id and order.get("tripName"):
        try:
            custom_fields_values.append({
                "field_id": int(trip_number_field_id),
                "values": [{"value": order.get("tripName", "")}]
            })
        except ValueError:
            pass
    
    if trip_driver_field_id and order.get("tripDriverName"):
        try:
            custom_fields_values.append({
                "field_id": int(trip_driver_field_id),
                "values": [{"value": order.get("tripDriverName", "")}]
            })
        except ValueError:
            pass
    
    if trip_departure_field_id and order.get("tripDepartureDate"):
        try:
            custom_fields_values.append({
                "field_id": int(trip_departure_field_id),
                "values": [{"value": order.get("tripDepartureDate", "")}]
            })
        except ValueError:
            pass
    
    if trip_order_status_field_id and order.get("tripOrderStatus"):
        try:
            status_label = STATUS_LABELS.get(order.get("tripOrderStatus"), order.get("tripOrderStatus"))
            custom_fields_values.append({
                "field_id": int(trip_order_status_field_id),
                "values": [{"value": status_label}]
            })
        except ValueError:
            pass
    
    if not custom_fields_values:
        return
    
    url = f"https://{domain}/api/v4/leads/{amocrm_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {"custom_fields_values": custom_fields_values}
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as http_client:
            response = await http_client.patch(url, json=payload, headers=headers)
            if response.status_code == 200:
                logger.info(f"Synced order {order.get('id')} trip data to amoCRM lead {amocrm_id}")
            else:
                logger.warning(f"Failed to sync order to amoCRM: {response.status_code}")
    except Exception as e:
        logger.error(f"Error syncing order to amoCRM: {e}")


def get_section_collection(section: str):
    """Get MongoDB collection for section."""
    if section == "greenhouse":
        return greenhouse_orders
    elif section == "balia":
        return balia_orders
    elif section == "sauna":
        return sauna_orders
    return None


async def sync_trip_orders_to_amocrm(trip: dict, collection):
    """Sync trip data to amoCRM for all orders with amocrm_id.
    
    This is called when trip is updated (status change, driver assignment, etc.)
    Now uses trip data stored in each order (tripName, tripDriverName, etc.)
    """
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        return
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        return
    
    trip_number_field_id = settings.get("trip_number_field_id", "")
    trip_driver_field_id = settings.get("trip_driver_field_id", "")
    trip_departure_field_id = settings.get("trip_departure_field_id", "")
    trip_order_status_field_id = settings.get("trip_order_status_field_id", "")
    
    # Check if any trip fields are configured
    if not any([trip_number_field_id, trip_driver_field_id, trip_departure_field_id, trip_order_status_field_id]):
        return
    
    # Status labels
    STATUS_LABELS = {
        "pending": "Ожидает",
        "delivering": "В пути",
        "delivered": "Доставлен",
        "cancelled": "Отменён"
    }
    
    # Get all orders in trip that have amocrm_id
    order_ids = trip.get("orderIds", [])
    
    if not order_ids or collection is None:
        return
    
    # Get orders with their trip data (stored in each order)
    orders = list(collection.find({"id": {"$in": order_ids}, "amocrm_id": {"$exists": True, "$ne": ""}}, {"_id": 0}))
    
    for order in orders:
        amocrm_id = order.get("amocrm_id")
        if not amocrm_id:
            continue
        
        # Build update payload - use trip data stored in order
        custom_fields_values = []
        
        if trip_number_field_id:
            try:
                custom_fields_values.append({
                    "field_id": int(trip_number_field_id),
                    "values": [{"value": order.get("tripName", "") or trip.get("name", "")}]
                })
            except ValueError:
                pass
        
        if trip_driver_field_id:
            try:
                custom_fields_values.append({
                    "field_id": int(trip_driver_field_id),
                    "values": [{"value": order.get("tripDriverName", "") or trip.get("driverName", "") or ""}]
                })
            except ValueError:
                pass
        
        if trip_departure_field_id:
            try:
                custom_fields_values.append({
                    "field_id": int(trip_departure_field_id),
                    "values": [{"value": order.get("tripDepartureDate", "") or trip.get("departureDate", "") or ""}]
                })
            except ValueError:
                pass
        
        if trip_order_status_field_id:
            try:
                order_status = order.get("tripOrderStatus", "pending")
                status_label = STATUS_LABELS.get(order_status, order_status)
                custom_fields_values.append({
                    "field_id": int(trip_order_status_field_id),
                    "values": [{"value": status_label}]
                })
            except ValueError:
                pass
        
        if not custom_fields_values:
            continue
        
        # Make API request
        url = f"https://{domain}/api/v4/leads/{amocrm_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {"custom_fields_values": custom_fields_values}
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as http_client:
                response = await http_client.patch(url, json=payload, headers=headers)
                if response.status_code == 200:
                    logger.info(f"Synced trip data to amoCRM lead {amocrm_id}")
                else:
                    logger.warning(f"Failed to sync trip to amoCRM lead {amocrm_id}: {response.status_code}")
        except Exception as e:
            logger.error(f"Error syncing trip to amoCRM: {e}")


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
        "departureDate": None,  # Will be set later
        "createdAt": now,
        "updatedAt": now
    }
    
    trips_collection.insert_one(trip)
    
    # Update orders to mark them as assigned to this trip and store trip data
    collection = get_section_collection(trip_data.section)
    if collection is not None and trip_data.orderIds:
        # Sync trip data to all orders
        sync_trip_data_to_orders(trip, collection)
    
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
    
    # Remove syncOrderStatuses from update_data (it's a flag, not a field to store)
    sync_order_statuses = update_data.pop("syncOrderStatuses", False)
    
    # Handle order changes
    collection = get_section_collection(existing.get("section", ""))
    
    # Map trip status to order status
    TRIP_TO_ORDER_STATUS = {
        "planned": "pending",      # Ready to ship -> pending
        "in_transit": "delivering", # In transit -> delivering
        "completed": "delivered"    # Completed -> delivered
    }
    
    # Handle status change and sync order statuses
    if "status" in update_data and sync_order_statuses:
        new_trip_status = update_data["status"]
        new_order_status = TRIP_TO_ORDER_STATUS.get(new_trip_status, "pending")
        
        # Update all order statuses (except cancelled ones)
        existing_statuses = existing.get("orderStatuses", {})
        for order_id in existing.get("orderIds", []):
            current_status = existing_statuses.get(order_id, "pending")
            # Don't change cancelled orders
            if current_status != "cancelled":
                existing_statuses[order_id] = new_order_status
        
        update_data["orderStatuses"] = existing_statuses
    
    # Handle orderStatuses update (manual per-order changes)
    elif "orderStatuses" in update_data:
        # Merge with existing statuses
        existing_statuses = existing.get("orderStatuses", {})
        existing_statuses.update(update_data["orderStatuses"])
        update_data["orderStatuses"] = existing_statuses
    
    if "orderIds" in update_data and collection is not None:
        old_order_ids = set(existing.get("orderIds", []))
        new_order_ids = set(update_data["orderIds"])
        
        # Remove trip data from orders that were removed
        removed = old_order_ids - new_order_ids
        if removed:
            collection.update_many(
                {"id": {"$in": list(removed)}},
                {"$unset": {
                    "tripId": "", "tripName": "", "tripDriverId": "", 
                    "tripDriverName": "", "tripDepartureDate": "", 
                    "tripStatus": "", "tripOrderStatus": ""
                }}
            )
        
        # Add trip data to new orders (will be synced below)
        # No need to do partial update here, sync_trip_data_to_orders will handle it
    
    trips_collection.update_one({"id": trip_id}, {"$set": update_data})
    
    updated = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    
    # Sync trip data to all orders in this trip
    if collection is not None:
        sync_trip_data_to_orders(updated, collection)
    
    # Sync trip data to amoCRM for orders with amocrm_id
    try:
        await sync_trip_orders_to_amocrm(updated, collection)
    except Exception as e:
        logger.error(f"Failed to sync trip to amoCRM: {e}")
    
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
    
    # Update trip - add new orders and their statuses
    current_orders = existing.get("orderIds", [])
    current_statuses = existing.get("orderStatuses", {})
    
    new_orders = list(set(current_orders + order_ids))
    # Add pending status for new orders
    for oid in order_ids:
        if oid not in current_statuses:
            current_statuses[oid] = "pending"
    
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": {
            "orderIds": new_orders, 
            "orderStatuses": current_statuses,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get updated trip and sync data to all orders
    updated_trip = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    sync_trip_data_to_orders(updated_trip, collection)
    
    # Sync to amoCRM
    try:
        await sync_trip_orders_to_amocrm(updated_trip, collection)
    except Exception as e:
        logger.error(f"Failed to sync trip to amoCRM: {e}")
    
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
    
    # Update trip - remove orders and their statuses
    current_orders = existing.get("orderIds", [])
    current_statuses = existing.get("orderStatuses", {})
    
    new_orders = [oid for oid in current_orders if oid not in order_ids]
    # Remove statuses for removed orders
    for oid in order_ids:
        current_statuses.pop(oid, None)
    
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": {
            "orderIds": new_orders, 
            "orderStatuses": current_statuses,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Remove all trip data from orders
    collection.update_many(
        {"id": {"$in": order_ids}},
        {"$unset": {
            "tripId": "", "tripName": "", "tripDriverId": "", 
            "tripDriverName": "", "tripDepartureDate": "", 
            "tripStatus": "", "tripOrderStatus": ""
        }}
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
    
    # Update the order's tripOrderStatus and deliveryStatus in its collection
    collection = get_section_collection(existing.get("section", ""))
    if collection is not None:
        collection.update_one(
            {"id": order_id},
            {"$set": {
                "deliveryStatus": status,
                "tripOrderStatus": status  # Also update trip-related status
            }}
        )
        
        # Sync to amoCRM if order has amocrm_id
        order = collection.find_one({"id": order_id}, {"_id": 0})
        if order and order.get("amocrm_id"):
            try:
                await sync_single_order_to_amocrm(order)
            except Exception as e:
                logger.error(f"Failed to sync order {order_id} to amoCRM: {e}")
    
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
