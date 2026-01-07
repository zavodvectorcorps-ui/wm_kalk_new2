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
sync_logs = db["sync_logs"]  # Logs for amoCRM sync operations


class TripCreate(BaseModel):
    name: str
    section: str  # greenhouse, balia, sauna
    orderIds: List[str] = []
    driverId: Optional[str] = None
    driverName: Optional[str] = None
    amocrmPipelineId: Optional[str] = None  # amoCRM pipeline to move orders to
    amocrmStatusId: Optional[str] = None  # amoCRM status/stage to move orders to


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
    amocrmPipelineId: Optional[str] = None  # amoCRM pipeline to move orders to
    amocrmStatusId: Optional[str] = None  # amoCRM status/stage to move orders to


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
    logger.info("=== sync_trip_data_to_orders START ===")
    
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
    
    logger.info(f"Syncing trip data to {len(order_ids)} orders. Trip data: {trip_data_for_orders}")
    logger.info(f"Order statuses from trip: {order_statuses}")
    
    # Update each order with its specific status
    for order_id in order_ids:
        order_status = order_statuses.get(order_id, "pending")
        
        update_fields = {
            **trip_data_for_orders,
            "tripOrderStatus": order_status
        }
        
        result = collection.update_one(
            {"id": order_id},
            {"$set": update_fields}
        )
        logger.info(f"Updated order {order_id}: matched={result.matched_count}, modified={result.modified_count}, tripOrderStatus='{order_status}'")
    
    logger.info("=== sync_trip_data_to_orders END ===")


async def sync_single_order_to_amocrm(order: dict):
    """Sync a single order's trip data to amoCRM.
    
    Called when order status is updated in trip.
    """
    logger.info(f"=== sync_single_order_to_amocrm START for order {order.get('id')} ===")
    
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        logger.warning("amoCRM settings not found")
        return
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        logger.warning(f"amoCRM credentials not configured - domain: '{domain}', token: {'present' if token else 'missing'}")
        return
    
    amocrm_id = order.get("amocrm_id")
    if not amocrm_id:
        logger.warning(f"Order {order.get('id')} has no amocrm_id")
        return
    
    logger.info(f"Order {order.get('id')} has amocrm_id: {amocrm_id}")
    
    # Field IDs
    trip_number_field_id = settings.get("trip_number_field_id", "")
    trip_driver_field_id = settings.get("trip_driver_field_id", "")
    trip_departure_field_id = settings.get("trip_departure_field_id", "")
    trip_order_status_field_id = settings.get("trip_order_status_field_id", "")
    
    logger.info(f"Field IDs - trip_number: '{trip_number_field_id}', driver: '{trip_driver_field_id}', departure: '{trip_departure_field_id}', order_status: '{trip_order_status_field_id}'")
    
    if not any([trip_number_field_id, trip_driver_field_id, trip_departure_field_id, trip_order_status_field_id]):
        logger.warning("No trip field IDs configured")
        return
    
    STATUS_LABELS = {
        "pending": "Ожидает",
        "delivering": "В пути",
        "delivered": "Доставлен",
        "cancelled": "Отменён"
    }
    
    custom_fields_values = []
    
    if trip_number_field_id and order.get("tripName"):
        logger.info(f"  Adding tripName: '{order.get('tripName')}'")
        try:
            custom_fields_values.append({
                "field_id": int(trip_number_field_id),
                "values": [{"value": order.get("tripName", "")}]
            })
        except ValueError as e:
            logger.error(f"  ValueError: {e}")
    
    if trip_driver_field_id and order.get("tripDriverName"):
        logger.info(f"  Adding tripDriverName: '{order.get('tripDriverName')}'")
        try:
            custom_fields_values.append({
                "field_id": int(trip_driver_field_id),
                "values": [{"value": order.get("tripDriverName", "")}]
            })
        except ValueError as e:
            logger.error(f"  ValueError: {e}")
    
    if trip_departure_field_id and order.get("tripDepartureDate"):
        # Convert date to ISO 8601 format with time for amoCRM
        departure_date = order.get("tripDepartureDate", "")
        if departure_date and "T" not in departure_date:
            departure_date = f"{departure_date}T00:00:00+00:00"
        logger.info(f"  Adding tripDepartureDate: '{departure_date}'")
        try:
            custom_fields_values.append({
                "field_id": int(trip_departure_field_id),
                "values": [{"value": departure_date}]
            })
        except ValueError as e:
            logger.error(f"  ValueError: {e}")
    
    if trip_order_status_field_id and order.get("tripOrderStatus"):
        status_label = STATUS_LABELS.get(order.get("tripOrderStatus"), order.get("tripOrderStatus"))
        logger.info(f"  Adding tripOrderStatus: raw='{order.get('tripOrderStatus')}', label='{status_label}'")
        try:
            custom_fields_values.append({
                "field_id": int(trip_order_status_field_id),
                "values": [{"value": status_label}]
            })
        except ValueError as e:
            logger.error(f"  ValueError: {e}")
    
    if not custom_fields_values:
        logger.warning("No custom_fields_values built - order may be missing trip data")
        log_sync_operation("sync_single_order", {
            "order_id": order.get("id"),
            "amocrm_id": amocrm_id,
            "status": "skipped",
            "reason": "no_fields_to_send",
            "order_data": {
                "tripName": order.get("tripName"),
                "tripDriverName": order.get("tripDriverName"),
                "tripDepartureDate": order.get("tripDepartureDate"),
                "tripOrderStatus": order.get("tripOrderStatus")
            }
        })
        return
    
    url = f"https://{domain}/api/v4/leads/{amocrm_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {"custom_fields_values": custom_fields_values}
    
    logger.info(f"API Request URL: {url}")
    logger.info(f"API Request Payload: {payload}")
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as http_client:
            response = await http_client.patch(url, json=payload, headers=headers)
            logger.info(f"API Response: status={response.status_code}, body={response.text[:500] if response.text else 'empty'}")
            
            log_sync_operation("sync_single_order", {
                "order_id": order.get("id"),
                "amocrm_id": amocrm_id,
                "status": "success" if response.status_code == 200 else "error",
                "http_status": response.status_code,
                "response": response.text[:500] if response.text else "",
                "payload": payload
            })
            
            if response.status_code == 200:
                logger.info(f"✅ Synced order {order.get('id')} trip data to amoCRM lead {amocrm_id}")
            else:
                logger.warning(f"❌ Failed to sync order to amoCRM: {response.status_code} - {response.text}")
    except Exception as e:
        logger.error(f"❌ Error syncing order to amoCRM: {e}")
        log_sync_operation("sync_single_order", {
            "order_id": order.get("id"),
            "amocrm_id": amocrm_id,
            "status": "exception",
            "error": str(e)
        })
    
    logger.info("=== sync_single_order_to_amocrm END ===")


async def send_photo_to_amocrm(order_id: str, amocrm_id: str, photo_url: str, driver_name: str = ""):
    """Send delivery photo to amoCRM as a note with file attachment.
    
    amoCRM API v4 process:
    1. Create a note on the lead (POST /api/v4/leads/{lead_id}/notes)
    2. Upload file to that note (POST /api/v4/notes/{note_id}/files)
    
    Args:
        order_id: Internal order ID
        amocrm_id: amoCRM lead ID
        photo_url: Base64 data URL of the photo
        driver_name: Name of driver who uploaded the photo
    """
    logger.info(f"=== send_photo_to_amocrm START for order {order_id}, amoCRM lead {amocrm_id} ===")
    
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        logger.warning("amoCRM settings not found")
        return False
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        logger.warning("amoCRM credentials not configured")
        return False
    
    if not photo_url or not photo_url.startswith("data:"):
        logger.warning("Invalid photo URL format")
        return False
    
    try:
        import base64
        import httpx
        from datetime import datetime, timezone
        
        # Parse data URL
        header, base64_data = photo_url.split(",", 1)
        content_type = header.replace("data:", "").replace(";base64", "")
        photo_bytes = base64.b64decode(base64_data)
        
        # Determine file extension
        ext_map = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif"
        }
        file_ext = ext_map.get(content_type, "jpg")
        filename = f"delivery_photo_{order_id}.{file_ext}"
        
        logger.info(f"Photo size: {len(photo_bytes)} bytes, type: {content_type}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Create a note on the lead
            note_text = f"📷 Фото акта доставки"
            if driver_name:
                note_text += f"\nВодитель: {driver_name}"
            note_text += f"\nВремя: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}"
            
            notes_url = f"https://{domain}/api/v4/leads/{amocrm_id}/notes"
            note_payload = [
                {
                    "note_type": "common",
                    "params": {
                        "text": note_text
                    }
                }
            ]
            
            response = await client.post(
                notes_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json=note_payload
            )
            
            note_id = None
            if response.status_code in [200, 201]:
                try:
                    resp_data = response.json()
                    # amoCRM returns _embedded.notes[0].id
                    notes_list = resp_data.get("_embedded", {}).get("notes", [])
                    if notes_list:
                        note_id = notes_list[0].get("id")
                        logger.info(f"✅ Created note {note_id} on amoCRM lead {amocrm_id}")
                except Exception as parse_err:
                    logger.warning(f"Could not parse note response: {parse_err}")
            else:
                logger.warning(f"Failed to create note: {response.status_code} - {response.text[:200]}")
            
            # Step 2: Upload file to the note
            if note_id:
                file_upload_url = f"https://{domain}/api/v4/notes/{note_id}/files"
                
                # Use multipart/form-data for file upload
                files = {
                    "file": (filename, photo_bytes, content_type)
                }
                
                file_response = await client.post(
                    file_upload_url,
                    headers={
                        "Authorization": f"Bearer {token}"
                    },
                    files=files
                )
                
                if file_response.status_code in [200, 201]:
                    logger.info(f"✅ Uploaded photo file to amoCRM note {note_id}")
                    return True
                else:
                    logger.warning(f"Failed to upload file to note: {file_response.status_code} - {file_response.text[:300]}")
                    # Try alternative: attach file directly to lead
                    lead_files_url = f"https://{domain}/api/v4/leads/{amocrm_id}/files"
                    alt_response = await client.post(
                        lead_files_url,
                        headers={
                            "Authorization": f"Bearer {token}"
                        },
                        files=files
                    )
                    if alt_response.status_code in [200, 201]:
                        logger.info(f"✅ Uploaded photo file directly to lead {amocrm_id}")
                        return True
                    else:
                        logger.warning(f"Alt file upload failed: {alt_response.status_code}")
            
            # Return True if at least note was created (partial success)
            return note_id is not None
                
    except Exception as e:
        logger.error(f"❌ Error sending photo to amoCRM: {e}")
        return False
    
    logger.info("=== send_photo_to_amocrm END ===")


async def move_trip_orders_to_amocrm_stage(trip: dict, collection, pipeline_id: int, status_id: int):
    """Move all orders in a trip to a specific amoCRM pipeline stage.
    
    This is called when creating/updating a trip with amoCRM stage selection.
    """
    logger.info("=== move_trip_orders_to_amocrm_stage START ===")
    logger.info(f"Trip: {trip.get('id')}, Pipeline: {pipeline_id}, Status: {status_id}")
    
    # Load settings
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        logger.warning("amoCRM settings not found")
        return {"moved": 0, "errors": 0, "message": "Настройки amoCRM не найдены"}
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        logger.warning(f"amoCRM credentials not set. Domain: '{domain}', Token: {'SET' if token else 'NOT SET'}")
        return {"moved": 0, "errors": 0, "message": "Домен или токен amoCRM не настроены"}
    
    # Get orders with amocrm_id
    order_ids = trip.get("orderIds", [])
    if not order_ids:
        return {"moved": 0, "errors": 0, "message": "Нет заказов в рейсе"}
    
    orders = list(collection.find(
        {"id": {"$in": order_ids}, "amocrm_id": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "amocrm_id": 1}
    ))
    
    logger.info(f"Found {len(orders)} orders with amocrm_id")
    
    moved_count = 0
    error_count = 0
    
    # API URL
    api_url = f"https://{domain}/api/v4/leads"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    for order in orders:
        amocrm_id = order.get("amocrm_id")
        if not amocrm_id:
            continue
        
        try:
            # Update lead in amoCRM - move to specified pipeline/status
            update_url = f"{api_url}/{amocrm_id}"
            payload = {
                "pipeline_id": pipeline_id,
                "status_id": status_id
            }
            
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                response = await http_client.patch(update_url, json=payload, headers=headers)
            
            if response.status_code == 200:
                logger.info(f"✅ Moved lead {amocrm_id} to pipeline {pipeline_id}, status {status_id}")
                moved_count += 1
                
                # Update order in local DB to track the amoCRM stage
                collection.update_one(
                    {"id": order.get("id")},
                    {"$set": {
                        "amocrmPipelineId": pipeline_id,
                        "amocrmStatusId": status_id
                    }}
                )
            else:
                logger.warning(f"❌ Failed to move lead {amocrm_id}: {response.status_code} - {response.text}")
                error_count += 1
        except Exception as e:
            logger.error(f"❌ Error moving lead {amocrm_id}: {e}")
            error_count += 1
    
    logger.info(f"=== move_trip_orders_to_amocrm_stage END: moved={moved_count}, errors={error_count} ===")
    
    return {
        "moved": moved_count,
        "errors": error_count,
        "message": f"Перемещено {moved_count} заказов в amoCRM" if moved_count > 0 else "Не удалось переместить заказы"
    }


async def clear_order_trip_data_in_amocrm(amocrm_id: str) -> dict:
    """Clear trip-related fields in amoCRM when order is removed from trip.
    
    Sets trip name, driver, departure date, and status fields to empty values.
    
    amoCRM API behavior for clearing text fields:
    - Sending empty string "" clears the field
    - Sending "0" shows "0" in the field
    - Sending null/None may cause 400 error
    
    Returns dict with status and details for frontend feedback.
    """
    logger.info(f"=== clear_order_trip_data_in_amocrm START for lead {amocrm_id} ===")
    
    result = {
        "amocrm_id": amocrm_id,
        "status": "pending",
        "message": ""
    }
    
    if not amocrm_id:
        logger.warning("No amocrm_id provided")
        result["status"] = "skipped"
        result["message"] = "No amocrm_id"
        log_sync_operation("clear_trip_data", {
            "amocrm_id": amocrm_id,
            "status": "skipped",
            "reason": "no_amocrm_id"
        })
        return result
    
    # Load settings from integration_settings collection with type: "amocrm"
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    
    # Log what we found for debugging
    logger.info(f"Settings found: {bool(settings)}")
    if settings:
        logger.info(f"Settings keys: {list(settings.keys())}")
    
    if not settings:
        logger.warning("amoCRM settings not found in integration_settings collection (type='amocrm') - skipping clear")
        result["status"] = "skipped"
        result["message"] = "Настройки amoCRM не найдены"
        log_sync_operation("clear_trip_data", {
            "amocrm_id": amocrm_id,
            "status": "skipped",
            "reason": "settings_not_found"
        })
        return result
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    logger.info(f"Loaded credentials - domain: '{domain}', token present: {bool(token)}")
    
    if not domain or not token:
        logger.warning(f"amoCRM domain or token not set. Domain: '{domain}', Token: {'SET' if token else 'NOT SET'}")
        result["status"] = "skipped"
        result["message"] = "Домен или токен amoCRM не настроены"
        log_sync_operation("clear_trip_data", {
            "amocrm_id": amocrm_id,
            "status": "skipped",
            "reason": "credentials_missing",
            "domain_set": bool(domain),
            "token_set": bool(token)
        })
        return result
    
    # Get field IDs for trip data (try both naming conventions)
    trip_name_field_id = settings.get("trip_number_field_id") or settings.get("trip_name_field_id")
    trip_driver_field_id = settings.get("trip_driver_field_id")
    trip_departure_field_id = settings.get("trip_departure_field_id")
    trip_order_status_field_id = settings.get("trip_order_status_field_id")
    
    logger.info(f"Trip field IDs - name: {trip_name_field_id}, driver: {trip_driver_field_id}, departure: {trip_departure_field_id}, status: {trip_order_status_field_id}")
    
    custom_fields_values = []
    
    # Clear trip name/number field - always send "0" to clear
    if trip_name_field_id:
        try:
            custom_fields_values.append({
                "field_id": int(trip_name_field_id),
                "values": [{"value": "0"}]
            })
        except ValueError:
            logger.error(f"Invalid trip_name_field_id: {trip_name_field_id}")
    
    # Clear trip driver field - always send "0" to clear
    if trip_driver_field_id:
        try:
            custom_fields_values.append({
                "field_id": int(trip_driver_field_id),
                "values": [{"value": "0"}]
            })
        except ValueError:
            logger.error(f"Invalid trip_driver_field_id: {trip_driver_field_id}")
    
    # Clear trip order status field - send "0" to clear
    if trip_order_status_field_id:
        try:
            custom_fields_values.append({
                "field_id": int(trip_order_status_field_id),
                "values": [{"value": "0"}]
            })
        except ValueError:
            logger.error(f"Invalid trip_order_status_field_id: {trip_order_status_field_id}")
    
    if not custom_fields_values:
        logger.info("No trip fields configured to clear")
        result["status"] = "skipped"
        result["message"] = "ID полей рейса не настроены"
        return result
    
    url = f"https://{domain}/api/v4/leads/{amocrm_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {"custom_fields_values": custom_fields_values}
    
    logger.info(f"Clearing trip data in amoCRM. URL: {url}, Payload: {payload}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as http_client:
            response = await http_client.patch(url, json=payload, headers=headers)
            response_text = response.text[:500] if response.text else ""
            logger.info(f"Clear response: status={response.status_code}, body={response_text}")
            
            log_sync_operation("clear_trip_data", {
                "amocrm_id": amocrm_id,
                "status": "success" if response.status_code == 200 else "error",
                "response_code": response.status_code,
                "response_text": response_text,
                "payload": payload
            })
            
            if response.status_code == 200:
                logger.info(f"✅ Successfully cleared trip data for lead {amocrm_id}")
                result["status"] = "success"
                result["message"] = "Данные рейса очищены в amoCRM"
            else:
                logger.error(f"❌ Failed to clear trip data: {response.status_code} - {response_text}")
                result["status"] = "error"
                result["message"] = f"Ошибка amoCRM API: {response.status_code}"
                result["detail"] = response_text
                
    except Exception as e:
        logger.error(f"❌ Error clearing trip data in amoCRM: {e}")
        result["status"] = "exception"
        result["message"] = f"Ошибка соединения: {str(e)}"
        log_sync_operation("clear_trip_data", {
            "amocrm_id": amocrm_id,
            "status": "exception",
            "error": str(e)
        })
    
    logger.info("=== clear_order_trip_data_in_amocrm END ===")
    return result


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
    logger.info("=== sync_trip_orders_to_amocrm START ===")
    logger.info(f"Trip ID: {trip.get('id')}, Trip Name: {trip.get('name')}")
    logger.info(f"Trip orderIds: {trip.get('orderIds', [])}")
    
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        logger.warning("amoCRM settings not found - skipping sync")
        return
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    logger.info(f"amoCRM domain: {domain}, token present: {bool(token)}")
    
    if not domain or not token:
        logger.warning(f"amoCRM credentials not configured - domain: '{domain}', token: {'present' if token else 'missing'}")
        log_sync_operation("sync_trip_orders", {
            "trip_id": trip.get("id"),
            "status": "skipped",
            "reason": "credentials_missing",
            "domain": domain,
            "token_present": bool(token)
        })
        return
    
    trip_number_field_id = settings.get("trip_number_field_id", "")
    trip_driver_field_id = settings.get("trip_driver_field_id", "")
    trip_departure_field_id = settings.get("trip_departure_field_id", "")
    trip_order_status_field_id = settings.get("trip_order_status_field_id", "")
    
    logger.info(f"Field IDs - trip_number: '{trip_number_field_id}', driver: '{trip_driver_field_id}', departure: '{trip_departure_field_id}', order_status: '{trip_order_status_field_id}'")
    
    # Check if any trip fields are configured
    if not any([trip_number_field_id, trip_driver_field_id, trip_departure_field_id, trip_order_status_field_id]):
        logger.warning("No trip field IDs configured in amoCRM settings - skipping sync")
        log_sync_operation("sync_trip_orders", {
            "trip_id": trip.get("id"),
            "status": "skipped",
            "reason": "no_field_ids_configured"
        })
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
        logger.warning(f"No order IDs or collection is None - orderIds: {order_ids}, collection: {collection}")
        return
    
    logger.info(f"Looking for orders with IDs: {order_ids}")
    
    # Get orders with their trip data (stored in each order)
    orders = list(collection.find({"id": {"$in": order_ids}, "amocrm_id": {"$exists": True, "$ne": ""}}, {"_id": 0}))
    
    logger.info(f"Found {len(orders)} orders with amocrm_id")
    
    for order in orders:
        amocrm_id = order.get("amocrm_id")
        if not amocrm_id:
            logger.info(f"Order {order.get('id')} has no amocrm_id - skipping")
            continue
        
        logger.info(f"--- Processing order {order.get('id')} (amoCRM ID: {amocrm_id}) ---")
        logger.info(f"Order trip data from DB: tripName='{order.get('tripName')}', tripDriverName='{order.get('tripDriverName')}', tripDepartureDate='{order.get('tripDepartureDate')}', tripOrderStatus='{order.get('tripOrderStatus')}'")
        
        # Build update payload - use trip data stored in order
        custom_fields_values = []
        
        if trip_number_field_id:
            trip_name_value = order.get("tripName", "") or trip.get("name", "")
            logger.info(f"  Adding trip_name field: field_id={trip_number_field_id}, value='{trip_name_value}'")
            try:
                custom_fields_values.append({
                    "field_id": int(trip_number_field_id),
                    "values": [{"value": trip_name_value}]
                })
            except ValueError as e:
                logger.error(f"  ValueError converting trip_number_field_id '{trip_number_field_id}': {e}")
        
        if trip_driver_field_id:
            driver_value = order.get("tripDriverName", "") or trip.get("driverName", "") or ""
            logger.info(f"  Adding driver field: field_id={trip_driver_field_id}, value='{driver_value}'")
            try:
                custom_fields_values.append({
                    "field_id": int(trip_driver_field_id),
                    "values": [{"value": driver_value}]
                })
            except ValueError as e:
                logger.error(f"  ValueError converting trip_driver_field_id '{trip_driver_field_id}': {e}")
        
        if trip_departure_field_id:
            departure_value = order.get("tripDepartureDate", "") or trip.get("departureDate", "") or ""
            # Convert date to ISO 8601 format with time for amoCRM
            if departure_value and "T" not in departure_value:
                departure_value = f"{departure_value}T00:00:00+00:00"
            logger.info(f"  Adding departure field: field_id={trip_departure_field_id}, value='{departure_value}'")
            try:
                custom_fields_values.append({
                    "field_id": int(trip_departure_field_id),
                    "values": [{"value": departure_value}]
                })
            except ValueError as e:
                logger.error(f"  ValueError converting trip_departure_field_id '{trip_departure_field_id}': {e}")
        
        if trip_order_status_field_id:
            order_status = order.get("tripOrderStatus", "pending")
            status_label = STATUS_LABELS.get(order_status, order_status)
            logger.info(f"  Adding order_status field: field_id={trip_order_status_field_id}, raw='{order_status}', label='{status_label}'")
            try:
                custom_fields_values.append({
                    "field_id": int(trip_order_status_field_id),
                    "values": [{"value": status_label}]
                })
            except ValueError as e:
                logger.error(f"  ValueError converting trip_order_status_field_id '{trip_order_status_field_id}': {e}")
        
        if not custom_fields_values:
            logger.warning(f"  No custom_fields_values built for order {order.get('id')} - skipping API call")
            continue
        
        # Make API request
        url = f"https://{domain}/api/v4/leads/{amocrm_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {"custom_fields_values": custom_fields_values}
        
        logger.info(f"  API Request URL: {url}")
        logger.info(f"  API Request Payload: {payload}")
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as http_client:
                response = await http_client.patch(url, json=payload, headers=headers)
                logger.info(f"  API Response: status={response.status_code}, body={response.text[:500] if response.text else 'empty'}")
                
                log_sync_operation("sync_trip_order", {
                    "trip_id": trip.get("id"),
                    "order_id": order.get("id"),
                    "amocrm_id": amocrm_id,
                    "status": "success" if response.status_code == 200 else "error",
                    "http_status": response.status_code,
                    "response": response.text[:300] if response.text else "",
                    "payload": payload
                })
                
                if response.status_code == 200:
                    logger.info(f"  ✅ Successfully synced trip data to amoCRM lead {amocrm_id}")
                else:
                    logger.warning(f"  ❌ Failed to sync trip to amoCRM lead {amocrm_id}: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"  ❌ Error syncing trip to amoCRM: {e}")
            log_sync_operation("sync_trip_order", {
                "trip_id": trip.get("id"),
                "order_id": order.get("id"),
                "amocrm_id": amocrm_id,
                "status": "exception",
                "error": str(e)
            })
    
    logger.info("=== sync_trip_orders_to_amocrm END ===")


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
        "amocrmPipelineId": trip_data.amocrmPipelineId,
        "amocrmStatusId": trip_data.amocrmStatusId,
        "createdAt": now,
        "updatedAt": now
    }
    
    trips_collection.insert_one(trip)
    
    # Update orders to mark them as assigned to this trip and store trip data
    collection = get_section_collection(trip_data.section)
    if collection is not None and trip_data.orderIds:
        # Sync trip data to all orders
        sync_trip_data_to_orders(trip, collection)
        
        # If amoCRM pipeline/status is specified, move orders in amoCRM
        if trip_data.amocrmPipelineId and trip_data.amocrmStatusId:
            await move_trip_orders_to_amocrm_stage(
                trip, 
                collection, 
                int(trip_data.amocrmPipelineId), 
                int(trip_data.amocrmStatusId)
            )
    
    trip.pop("_id", None)
    return trip


@router.put("/{trip_id}")
async def update_trip(trip_id: str, trip_data: TripUpdate):
    """Update a trip."""
    logger.info(f"=== UPDATE_TRIP START: {trip_id} ===")
    logger.info(f"Received trip_data: {trip_data.dict()}")
    
    existing = trips_collection.find_one({"id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    logger.info(f"Existing trip found: name='{existing.get('name')}', section='{existing.get('section')}', orderIds={existing.get('orderIds', [])}")
    
    update_data = {k: v for k, v in trip_data.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    logger.info(f"Update data (after filtering None): {update_data}")
    
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
    
    logger.info(f"Updating trip in DB with: {update_data}")
    trips_collection.update_one({"id": trip_id}, {"$set": update_data})
    
    updated = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    logger.info(f"Trip after DB update: name='{updated.get('name')}', status='{updated.get('status')}', orderStatuses={updated.get('orderStatuses', {})}")
    
    # Sync trip data to all orders in this trip
    if collection is not None:
        logger.info("Calling sync_trip_data_to_orders...")
        sync_trip_data_to_orders(updated, collection)
        
        # Re-fetch to verify sync completed
        sample_order_id = updated.get("orderIds", [])[0] if updated.get("orderIds") else None
        if sample_order_id:
            sample_order = collection.find_one({"id": sample_order_id}, {"_id": 0})
            if sample_order:
                logger.info(f"Sample order {sample_order_id} after sync_trip_data_to_orders: tripName='{sample_order.get('tripName')}', tripOrderStatus='{sample_order.get('tripOrderStatus')}'")
    else:
        logger.warning("Collection is None - cannot sync trip data to orders")
    
    # Sync trip data to amoCRM for orders with amocrm_id
    try:
        logger.info("Calling sync_trip_orders_to_amocrm...")
        await sync_trip_orders_to_amocrm(updated, collection)
    except Exception as e:
        logger.error(f"Failed to sync trip to amoCRM: {e}")
    
    # Send notification to driver if driver was assigned or changed
    old_driver_id = existing.get("driverId")
    new_driver_id = updated.get("driverId")
    if new_driver_id and new_driver_id != old_driver_id:
        try:
            from routes.notifications import notify_driver_new_trip
            await notify_driver_new_trip(trip_id, new_driver_id)
            logger.info(f"Notification sent to driver {new_driver_id} for trip {trip_id}")
        except Exception as e:
            logger.error(f"Failed to send notification to driver: {e}")
    
    logger.info(f"=== UPDATE_TRIP END: {trip_id} ===")
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


class MoveToAmoCRMRequest(BaseModel):
    pipelineId: int
    statusId: int


@router.post("/{trip_id}/move-to-amocrm")
async def move_trip_orders_to_amocrm(trip_id: str, request: MoveToAmoCRMRequest):
    """Move all orders in a trip to a specific amoCRM pipeline stage."""
    trip = trips_collection.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Рейс не найден")
    
    collection = get_section_collection(trip.get("section", ""))
    if collection is None:
        raise HTTPException(status_code=400, detail="Неверная секция")
    
    result = await move_trip_orders_to_amocrm_stage(trip, collection, request.pipelineId, request.statusId)
    
    # Update trip with amoCRM settings
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": {
            "amocrmPipelineId": str(request.pipelineId),
            "amocrmStatusId": str(request.statusId),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return result




@router.post("/{trip_id}/remove-orders")
async def remove_orders_from_trip(trip_id: str, order_ids: List[str]):
    """Remove orders from a trip (return them to general list)."""
    logger.info(f"=== REMOVE ORDERS FROM TRIP START: {trip_id}, orders: {order_ids} ===")
    
    existing = trips_collection.find_one({"id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    collection = get_section_collection(existing.get("section", ""))
    if collection is None:
        raise HTTPException(status_code=400, detail="Invalid section")
    
    # Get orders that have amocrm_id before removing trip data
    orders_to_clear_in_amocrm = list(collection.find(
        {"id": {"$in": order_ids}, "amocrm_id": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "amocrm_id": 1}
    ))
    
    logger.info(f"Found {len(orders_to_clear_in_amocrm)} orders with amocrm_id to clear")
    
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
    
    # Check amoCRM settings before attempting to clear
    amocrm_clear_results = []
    amocrm_settings_check = {
        "configured": False,
        "domain_set": False,
        "token_set": False,
        "trip_fields_configured": False
    }
    
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if settings:
        amocrm_settings_check["configured"] = True
        amocrm_settings_check["domain_set"] = bool(settings.get("amocrm_domain"))
        amocrm_settings_check["token_set"] = bool(settings.get("amocrm_token"))
        amocrm_settings_check["trip_fields_configured"] = any([
            settings.get("trip_number_field_id"),
            settings.get("trip_driver_field_id"),
            settings.get("trip_departure_field_id"),
            settings.get("trip_order_status_field_id")
        ])
    
    logger.info(f"amoCRM settings check: {amocrm_settings_check}")
    
    # Clear trip data in amoCRM for orders that have amocrm_id
    amocrm_success_count = 0
    amocrm_error_count = 0
    amocrm_skipped_count = 0
    
    if orders_to_clear_in_amocrm:
        logger.info(f"Clearing trip data in amoCRM for {len(orders_to_clear_in_amocrm)} orders")
        for order in orders_to_clear_in_amocrm:
            try:
                clear_result = await clear_order_trip_data_in_amocrm(order.get("amocrm_id"))
                amocrm_clear_results.append({
                    "order_id": order.get("id"),
                    "amocrm_id": order.get("amocrm_id"),
                    **clear_result
                })
                
                if clear_result.get("status") == "success":
                    amocrm_success_count += 1
                elif clear_result.get("status") == "skipped":
                    amocrm_skipped_count += 1
                else:
                    amocrm_error_count += 1
                    
            except Exception as e:
                logger.error(f"Failed to clear amoCRM data for order {order.get('id')}: {e}")
                amocrm_error_count += 1
                amocrm_clear_results.append({
                    "order_id": order.get("id"),
                    "amocrm_id": order.get("amocrm_id"),
                    "status": "error",
                    "message": str(e)
                })
    
    logger.info(f"=== REMOVE ORDERS FROM TRIP END: success={amocrm_success_count}, skipped={amocrm_skipped_count}, errors={amocrm_error_count} ===")
    
    return {
        "status": "ok", 
        "removed": order_ids, 
        "amocrm_orders_count": len(orders_to_clear_in_amocrm),
        "amocrm_success_count": amocrm_success_count,
        "amocrm_skipped_count": amocrm_skipped_count,
        "amocrm_error_count": amocrm_error_count,
        "amocrm_settings": amocrm_settings_check,
        "amocrm_clear_results": amocrm_clear_results
    }


@router.post("/{trip_id}/sync-amocrm")
async def sync_trip_to_amocrm(trip_id: str):
    """Force sync all orders in trip to amoCRM.
    
    This endpoint manually triggers sync of trip data to amoCRM
    for all orders that have amocrm_id.
    """
    logger.info(f"=== FORCE SYNC AMOCRM START: {trip_id} ===")
    
    existing = trips_collection.find_one({"id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    logger.info(f"Trip found: name='{existing.get('name')}', section='{existing.get('section')}', orderIds={existing.get('orderIds', [])}")
    
    collection = get_section_collection(existing.get("section", ""))
    if collection is None:
        raise HTTPException(status_code=400, detail="Invalid section")
    
    # First, make sure trip data is synced to orders
    logger.info("Step 1: Syncing trip data to orders...")
    sync_trip_data_to_orders(existing, collection)
    
    # Re-fetch trip to get any updates
    existing = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    
    # Get orders with amocrm_id
    order_ids = existing.get("orderIds", [])
    logger.info(f"Step 2: Looking for orders with amocrm_id in order_ids: {order_ids}")
    
    orders_with_amocrm = list(collection.find(
        {"id": {"$in": order_ids}, "amocrm_id": {"$exists": True, "$ne": ""}},
        {"_id": 0}
    ))
    
    logger.info(f"Found {len(orders_with_amocrm)} orders with amocrm_id")
    for order in orders_with_amocrm:
        logger.info(f"  Order {order.get('id')}: amocrm_id={order.get('amocrm_id')}, tripName={order.get('tripName')}, tripOrderStatus={order.get('tripOrderStatus')}")
    
    if not orders_with_amocrm:
        logger.warning("No orders with amocrm_id found")
        return {
            "status": "warning",
            "message": "Нет заказов с amocrm_id для синхронизации",
            "synced": 0,
            "total": len(order_ids)
        }
    
    # Sync each order to amoCRM
    synced_count = 0
    errors = []
    
    logger.info("Step 3: Syncing each order to amoCRM...")
    for order in orders_with_amocrm:
        try:
            await sync_single_order_to_amocrm(order)
            synced_count += 1
        except Exception as e:
            errors.append(f"{order.get('id')}: {str(e)}")
            logger.error(f"Failed to sync order {order.get('id')} to amoCRM: {e}")
    
    # Update last sync time in trip
    last_synced_at = datetime.now(timezone.utc).isoformat()
    trips_collection.update_one(
        {"id": trip_id},
        {"$set": {"lastSyncedAt": last_synced_at}}
    )
    
    logger.info(f"=== FORCE SYNC AMOCRM END: synced={synced_count}, total={len(orders_with_amocrm)}, errors={len(errors)} ===")
    
    return {
        "status": "ok" if not errors else "partial",
        "message": f"Синхронизировано {synced_count} из {len(orders_with_amocrm)} заказов",
        "synced": synced_count,
        "total": len(orders_with_amocrm),
        "lastSyncedAt": last_synced_at,
        "errors": errors if errors else None
    }


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


@router.delete("/cleanup/legacy-status")
async def delete_legacy_status_trips():
    """Delete trips with legacy/obsolete statuses like 'active'.
    
    This is a cleanup endpoint for removing old test trips that have
    statuses no longer used by the system.
    """
    legacy_statuses = ["active", "pending", "cancelled", "unknown"]
    
    # Find trips with legacy statuses
    trips_to_delete = list(trips_collection.find(
        {"status": {"$in": legacy_statuses}},
        {"_id": 0, "id": 1, "name": 1, "status": 1}
    ))
    
    if not trips_to_delete:
        return {
            "status": "ok",
            "message": "Нет рейсов с устаревшими статусами",
            "deleted": 0,
            "trips": []
        }
    
    # Delete them
    result = trips_collection.delete_many({"status": {"$in": legacy_statuses}})
    
    return {
        "status": "ok",
        "message": f"Удалено {result.deleted_count} рейсов с устаревшими статусами",
        "deleted": result.deleted_count,
        "trips": trips_to_delete
    }



def log_sync_operation(operation: str, details: dict):
    """Log sync operation to database for debugging."""
    try:
        sync_logs.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "operation": operation,
            **details
        })
        # Keep only last 100 logs
        count = sync_logs.count_documents({})
        if count > 100:
            oldest = list(sync_logs.find({}).sort("timestamp", 1).limit(count - 100))
            if oldest:
                sync_logs.delete_many({"_id": {"$in": [o["_id"] for o in oldest]}})
    except Exception as e:
        logger.error(f"Failed to log sync operation: {e}")


@router.get("/debug/sync-status")
async def get_sync_debug_status():
    """Get debug information about amoCRM sync configuration and recent operations."""
    # Get amoCRM settings - same query as used in clear_order_trip_data_in_amocrm
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    
    # Log for debugging
    logger.info(f"Debug sync-status: settings found = {bool(settings)}")
    if settings:
        logger.info(f"Debug sync-status: domain = '{settings.get('amocrm_domain', '')}', token_present = {bool(settings.get('amocrm_token'))}")
    
    settings_status = {
        "configured": bool(settings),
        "domain": settings.get("amocrm_domain", "") if settings else "",
        "token_present": bool(settings.get("amocrm_token")) if settings else False,
        "trip_number_field_id": settings.get("trip_number_field_id", "") if settings else "",
        "trip_driver_field_id": settings.get("trip_driver_field_id", "") if settings else "",
        "trip_departure_field_id": settings.get("trip_departure_field_id", "") if settings else "",
        "trip_order_status_field_id": settings.get("trip_order_status_field_id", "") if settings else "",
    }
    
    # Check if field IDs are configured
    has_trip_fields = any([
        settings_status["trip_number_field_id"],
        settings_status["trip_driver_field_id"],
        settings_status["trip_departure_field_id"],
        settings_status["trip_order_status_field_id"]
    ])
    
    # Get trips with orders that have amocrm_id
    trips = list(trips_collection.find({}, {"_id": 0}))
    trips_info = []
    
    for trip in trips:
        collection = get_section_collection(trip.get("section", ""))
        if collection is not None:
            order_ids = trip.get("orderIds", [])
            orders_with_amocrm = list(collection.find(
                {"id": {"$in": order_ids}, "amocrm_id": {"$exists": True, "$ne": ""}},
                {"_id": 0, "id": 1, "amocrm_id": 1, "tripName": 1, "tripOrderStatus": 1}
            ))
            trips_info.append({
                "trip_id": trip.get("id"),
                "trip_name": trip.get("name"),
                "section": trip.get("section"),
                "total_orders": len(order_ids),
                "orders_with_amocrm_id": len(orders_with_amocrm),
                "orders_details": orders_with_amocrm[:5],  # First 5 for debug
                "last_synced": trip.get("lastSyncedAt")
            })
    
    # Get recent sync logs
    recent_logs = list(sync_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(20))
    
    # Diagnostic messages
    issues = []
    if not settings_status["configured"]:
        issues.append("❌ Настройки amoCRM не найдены")
    elif not settings_status["domain"]:
        issues.append("❌ Не указан домен amoCRM")
    elif not settings_status["token_present"]:
        issues.append("❌ Не указан токен amoCRM")
    elif not has_trip_fields:
        issues.append("❌ Не настроены ID полей для рейсов (trip_number_field_id, etc.)")
    
    total_orders_with_amocrm = sum(t["orders_with_amocrm_id"] for t in trips_info)
    if total_orders_with_amocrm == 0:
        issues.append("⚠️ Нет заказов с amocrm_id в рейсах")
    
    if not issues:
        issues.append("✅ Конфигурация выглядит корректно")
    
    return {
        "settings": settings_status,
        "has_trip_fields_configured": has_trip_fields,
        "trips": trips_info,
        "recent_sync_logs": recent_logs,
        "diagnostic": issues
    }
