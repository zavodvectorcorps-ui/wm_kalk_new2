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
    import subprocess
    
    widget_dir = "/app/amocrm-widget"
    widget_path = "/app/amocrm-widget.zip"
    
    # Always rebuild ZIP to include latest changes
    if os.path.exists(widget_dir):
        try:
            # Remove old ZIP if exists
            if os.path.exists(widget_path):
                os.remove(widget_path)
            
            # Create fresh ZIP
            subprocess.run(
                ["zip", "-r", widget_path, "."],
                cwd=widget_dir,
                check=True,
                capture_output=True
            )
            logger.info("Widget ZIP rebuilt successfully")
        except Exception as e:
            logger.error(f"Failed to create widget zip: {e}")
            if not os.path.exists(widget_path):
                raise HTTPException(status_code=404, detail="Widget package not found")
    
    if not os.path.exists(widget_path):
        raise HTTPException(status_code=404, detail="Widget package not found")
    
    return FileResponse(
        path=widget_path,
        filename="amocrm-widget.zip",
        media_type="application/zip"
    )


# ============= External Integration (iframe widget) =============

@router.get("/embed/{lead_id}")
async def get_embed_widget(lead_id: str, theme: str = "light"):
    """
    Embeddable HTML widget for amoCRM external integration.
    
    This endpoint returns an HTML page that can be embedded in an iframe
    within amoCRM. It shows delivery status and calculator buttons.
    
    Usage in amoCRM:
    1. Create external integration
    2. Add widget with iframe URL: {APP_URL}/api/widget/embed/{lead_id}
    """
    from fastapi.responses import HTMLResponse
    
    # Get order status
    order, section = get_all_orders_by_amocrm_id(lead_id)
    
    # Get trip info
    trip_info = None
    photo_info = None
    if order and order.get("tripId"):
        trip = trips_collection.find_one({"id": order.get("tripId")}, {"_id": 0})
        if trip:
            trip_info = {
                "name": trip.get("name", ""),
                "driverName": trip.get("driverName", ""),
                "departureDate": trip.get("departureDate", ""),
                "status": trip.get("status", "")
            }
        
        photo = delivery_photos.find_one({
            "tripId": order.get("tripId"),
            "orderId": order.get("id")
        }, {"_id": 0})
        if photo:
            photo_info = {"hasPhoto": True}
    
    # Status config
    status_config = {
        "pending": {"label": "Ожидает", "color": "#6b7280", "bg": "#f3f4f6"},
        "planned": {"label": "Запланирован", "color": "#3b82f6", "bg": "#eff6ff"},
        "in_transit": {"label": "В пути", "color": "#f59e0b", "bg": "#fffbeb"},
        "delivering": {"label": "Доставляется", "color": "#f59e0b", "bg": "#fffbeb"},
        "delivered": {"label": "Доставлен", "color": "#22c55e", "bg": "#f0fdf4"},
        "cancelled": {"label": "Отменён", "color": "#ef4444", "bg": "#fef2f2"}
    }
    
    order_status = "not_found"
    status_label = "Не найден"
    status_color = "#6b7280"
    status_bg = "#f3f4f6"
    
    if order:
        order_status = order.get("tripOrderStatus") or order.get("deliveryStatus") or "pending"
        cfg = status_config.get(order_status, status_config["pending"])
        status_label = cfg["label"]
        status_color = cfg["color"]
        status_bg = cfg["bg"]
    
    # Base URL for calculators
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "")
    if not base_url:
        base_url = os.environ.get("APP_BASE_URL", "")
    
    # Theme colors
    is_dark = theme == "dark"
    bg_color = "#1f2937" if is_dark else "#ffffff"
    text_color = "#f9fafb" if is_dark else "#1f2937"
    border_color = "#374151" if is_dark else "#e5e7eb"
    muted_color = "#9ca3af" if is_dark else "#6b7280"
    
    # Build HTML
    html = f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WM-Group Widget</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: {bg_color};
            color: {text_color};
            padding: 12px;
            font-size: 13px;
        }}
        .widget {{
            max-width: 320px;
        }}
        .section {{
            margin-bottom: 16px;
        }}
        .section-title {{
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: {muted_color};
            margin-bottom: 8px;
        }}
        .status-badge {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 500;
            font-size: 13px;
        }}
        .status-dot {{
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid {border_color};
        }}
        .info-row:last-child {{
            border-bottom: none;
        }}
        .info-label {{
            color: {muted_color};
        }}
        .info-value {{
            font-weight: 500;
        }}
        .btn-group {{
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }}
        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            text-decoration: none;
            border: 1px solid {border_color};
            background: {bg_color};
            color: {text_color};
            cursor: pointer;
            transition: all 0.15s;
        }}
        .btn:hover {{
            background: {'#374151' if is_dark else '#f3f4f6'};
        }}
        .btn-primary {{
            background: #3b82f6;
            border-color: #3b82f6;
            color: white;
        }}
        .btn-primary:hover {{
            background: #2563eb;
        }}
        .btn svg {{
            width: 14px;
            height: 14px;
        }}
        .not-found {{
            text-align: center;
            padding: 20px;
            color: {muted_color};
        }}
        .photo-badge {{
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: #22c55e;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="widget">
"""

    if order:
        html += f"""
        <!-- Status Section -->
        <div class="section">
            <div class="section-title">Статус доставки</div>
            <div class="status-badge" style="background: {status_bg}; color: {status_color};">
                <span class="status-dot" style="background: {status_color};"></span>
                {status_label}
            </div>
            {f'<span class="photo-badge" style="margin-left: 8px;">📷 Фото загружено</span>' if photo_info else ''}
        </div>
"""
        
        if trip_info:
            departure_date = trip_info.get('departureDate', '')
            if departure_date:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(departure_date.replace('Z', '+00:00'))
                    departure_date = dt.strftime('%d.%m.%Y')
                except:
                    pass
            
            html += f"""
        <!-- Trip Info -->
        <div class="section">
            <div class="section-title">Информация о рейсе</div>
            <div class="info-row">
                <span class="info-label">Рейс</span>
                <span class="info-value">{trip_info.get('name', '-')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Водитель</span>
                <span class="info-value">{trip_info.get('driverName', '-')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Дата</span>
                <span class="info-value">{departure_date or '-'}</span>
            </div>
        </div>
"""

        html += f"""
        <!-- Order Info -->
        <div class="section">
            <div class="section-title">Заказ</div>
            <div class="info-row">
                <span class="info-label">ID</span>
                <span class="info-value">{order.get('id', '-')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Раздел</span>
                <span class="info-value">{section.capitalize() if section else '-'}</span>
            </div>
        </div>
"""
    else:
        html += f"""
        <div class="not-found">
            <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
            <div>Заказ не найден в системе</div>
            <div style="font-size: 11px; margin-top: 4px;">Создайте заказ через калькулятор</div>
        </div>
"""

    html += f"""
        <!-- Calculator Buttons -->
        <div class="section">
            <div class="section-title">Калькуляторы</div>
            <div class="btn-group">
                <a href="{base_url}/?amocrm_lead={lead_id}&section=balia&source=amocrm" target="_blank" class="btn btn-primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    </svg>
                    Купель
                </a>
                <a href="{base_url}/?amocrm_lead={lead_id}&section=sauna&source=amocrm" target="_blank" class="btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
                    </svg>
                    Сауна
                </a>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 12px;">
            <a href="{base_url}/logistics" target="_blank" style="color: {muted_color}; font-size: 11px; text-decoration: none;">
                Открыть логистику →
            </a>
        </div>
    </div>
    
    <script>
        // Send height to parent for auto-resize iframe
        function sendHeight() {{
            const height = document.body.scrollHeight;
            window.parent.postMessage({{ type: 'resize', height: height }}, '*');
        }}
        window.addEventListener('load', sendHeight);
        window.addEventListener('resize', sendHeight);
    </script>
</body>
</html>
"""

    return HTMLResponse(content=html)


@router.get("/embed-info")
async def get_embed_info():
    """Get information about embedding the widget in amoCRM."""
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    
    return {
        "embed_url_template": f"{base_url}/api/widget/embed/{{lead_id}}",
        "embed_url_example": f"{base_url}/api/widget/embed/12345678",
        "supported_params": {
            "lead_id": "ID сделки amoCRM (обязательный)",
            "theme": "Тема оформления: light (по умолчанию) или dark"
        },
        "setup_instructions": {
            "ru": [
                "1. Откройте amoCRM → Настройки → Интеграции",
                "2. Нажмите 'Создать интеграцию'",
                "3. Выберите тип 'Внешняя интеграция'",
                "4. В настройках виджета укажите URL iframe:",
                f"   {base_url}/api/widget/embed/{{lead.id}}",
                "5. Сохраните и активируйте интеграцию"
            ]
        }
    }
