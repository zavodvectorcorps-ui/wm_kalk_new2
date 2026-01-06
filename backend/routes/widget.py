"""amoCRM Widget API - endpoints for widget integration."""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import os
import logging

from pymongo import MongoClient

router = APIRouter(prefix="/api/widget", tags=["widget"])
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

trips_collection = db["trips"]
greenhouse_orders = db["greenhouse_orders"]
balia_orders = db["orders"]
sauna_orders = db["sauna_orders"]
delivery_photos = db["delivery_photos"]


def get_all_orders_by_amocrm_id(amocrm_id: str):
    """Search for order by amoCRM lead ID across all collections."""
    # Search in all collections
    collections = [
        ("greenhouse", greenhouse_orders),
        ("balia", balia_orders),
        ("sauna", sauna_orders)
    ]
    
    for section, collection in collections:
        order = collection.find_one({"amocrm_id": str(amocrm_id)}, {"_id": 0})
        if order:
            return order, section
    
    return None, None


@router.get("/delivery-status/{lead_id}")
async def get_delivery_status(lead_id: str):
    """Get delivery status for amoCRM lead.
    
    This endpoint is called by the amoCRM widget to display
    delivery status in the lead card.
    """
    # Find order by amoCRM lead ID
    order, section = get_all_orders_by_amocrm_id(lead_id)
    
    if not order:
        return {
            "found": False,
            "message": "Заказ не найден в системе логистики"
        }
    
    # Get trip info if order is in a trip
    trip_info = None
    if order.get("tripId"):
        trip = trips_collection.find_one({"id": order.get("tripId")}, {"_id": 0})
        if trip:
            trip_info = {
                "id": trip.get("id"),
                "name": trip.get("name"),
                "driverName": trip.get("driverName"),
                "departureDate": trip.get("departureDate"),
                "status": trip.get("status")
            }
    
    # Get delivery photo if exists
    photo_info = None
    if order.get("tripId"):
        photo = delivery_photos.find_one({
            "tripId": order.get("tripId"),
            "orderId": order.get("id")
        }, {"_id": 0, "photoUrl": 0})  # Exclude base64 for performance
        if photo:
            photo_info = {
                "hasPhoto": True,
                "uploadedAt": photo.get("confirmedAt"),
                "uploadedBy": photo.get("uploadedBy")
            }
    
    # Status labels
    STATUS_LABELS = {
        "pending": {"label": "Ожидает", "color": "#6b7280"},
        "delivering": {"label": "В пути", "color": "#3b82f6"},
        "delivered": {"label": "Доставлен", "color": "#22c55e"},
        "cancelled": {"label": "Отменён", "color": "#ef4444"}
    }
    
    order_status = order.get("tripOrderStatus") or order.get("deliveryStatus") or "pending"
    status_info = STATUS_LABELS.get(order_status, STATUS_LABELS["pending"])
    
    return {
        "found": True,
        "orderId": order.get("id"),
        "section": section,
        "status": {
            "code": order_status,
            "label": status_info["label"],
            "color": status_info["color"]
        },
        "trip": trip_info,
        "delivery": {
            "confirmedAt": order.get("deliveryConfirmedAt"),
            "confirmedBy": order.get("deliveryConfirmedBy"),
            "receivedAmount": order.get("receivedAmount"),
            "photo": photo_info
        },
        "customer": {
            "name": order.get("fullName"),
            "address": order.get("fullAddress"),
            "phone": order.get("phoneNumber")
        }
    }


@router.get("/delivery-photo/{lead_id}")
async def get_delivery_photo(lead_id: str):
    """Get delivery photo for amoCRM lead."""
    order, section = get_all_orders_by_amocrm_id(lead_id)
    
    if not order or not order.get("tripId"):
        raise HTTPException(status_code=404, detail="Фото не найдено")
    
    photo = delivery_photos.find_one({
        "tripId": order.get("tripId"),
        "orderId": order.get("id")
    }, {"_id": 0})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Фото не найдено")
    
    return {
        "photoUrl": photo.get("photoUrl"),
        "uploadedAt": photo.get("confirmedAt"),
        "uploadedBy": photo.get("uploadedBy")
    }


@router.get("/calculator-url")
async def get_calculator_url(
    lead_id: str = Query(..., description="amoCRM lead ID"),
    calculator: str = Query(..., description="Calculator type: balia, sauna, greenhouse")
):
    """Generate URL to open calculator with lead data.
    
    This is used by the sidebar widget to open the calculator
    with pre-filled data from amoCRM.
    """
    base_url = os.environ.get("APP_BASE_URL", "https://wm-kalkulator.pl")
    
    # Map calculator type to section
    calculator_map = {
        "balia": "balia",
        "sauna": "sauna", 
        "greenhouse": "greenhouse",
        "teplica": "greenhouse"
    }
    
    section = calculator_map.get(calculator.lower(), "balia")
    
    # Build URL with lead_id parameter
    url = f"{base_url}/?amocrm_lead={lead_id}&section={section}&source=widget"
    
    return {
        "url": url,
        "calculator": section
    }


@router.get("/download")
async def download_widget():
    """Download amoCRM widget as ZIP file."""
    from fastapi.responses import FileResponse
    import os
    
    widget_path = "/app/amocrm-widget.zip"
    
    if not os.path.exists(widget_path):
        # Try to create it if not exists
        import subprocess
        try:
            subprocess.run(
                ["zip", "-r", "/app/amocrm-widget.zip", "."],
                cwd="/app/amocrm-widget",
                check=True
            )
        except Exception as e:
            logger.error(f"Failed to create widget zip: {e}")
            raise HTTPException(status_code=404, detail="Widget package not found")
    
    return FileResponse(
        path=widget_path,
        filename="amocrm-widget.zip",
        media_type="application/zip"
    )
