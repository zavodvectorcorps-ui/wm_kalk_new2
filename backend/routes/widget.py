"""amoCRM Widget API - endpoints for widget integration."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse
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

@router.get("/embed/{theme}/{lead_id}")
async def get_embed_widget_with_theme(lead_id: str, theme: str = "light"):
    """
    Embeddable HTML widget with theme in URL path.
    
    URL format: /api/widget/embed/{theme}/{lead_id}
    Example: /api/widget/embed/dark/12345
    """
    return await _render_embed_widget(lead_id, theme)


@router.get("/embed/{lead_id}")
async def get_embed_widget(lead_id: str, theme: str = "light"):
    """
    Embeddable HTML widget (legacy URL format with query param).
    
    URL format: /api/widget/embed/{lead_id}?theme=dark
    """
    return await _render_embed_widget(lead_id, theme)


async def _render_embed_widget(lead_id: str, theme: str = "light"):
    """
    Internal function to render the embed widget.
    
    This endpoint returns an HTML page that can be embedded in an iframe
    within amoCRM. It shows order info, delivery status and calculator buttons.
    """
    from fastapi.responses import HTMLResponse
    from datetime import datetime
    
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
        "new": {"label": "Новый", "color": "#3b82f6", "bg": "#eff6ff"},
        "planned": {"label": "Запланирован", "color": "#8b5cf6", "bg": "#f5f3ff"},
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
        order_status = order.get("tripOrderStatus") or order.get("deliveryStatus") or order.get("status") or "new"
        cfg = status_config.get(order_status, status_config["pending"])
        status_label = cfg["label"]
        status_color = cfg["color"]
        status_bg = cfg["bg"]
    
    # Base URL for calculators - use APP_DOMAIN or APP_BASE_URL
    app_domain = os.environ.get("APP_DOMAIN", "")
    if app_domain:
        base_url = f"https://{app_domain}"
    else:
        base_url = os.environ.get("APP_BASE_URL", "")
        if not base_url:
            try:
                with open("/app/frontend/.env", "r") as f:
                    for line in f:
                        if line.startswith("REACT_APP_BACKEND_URL="):
                            base_url = line.strip().split("=", 1)[1]
                            break
            except:
                pass
    
    # Theme colors
    is_dark = theme == "dark"
    bg_color = "#1f2937" if is_dark else "#ffffff"
    text_color = "#f9fafb" if is_dark else "#1f2937"
    border_color = "#374151" if is_dark else "#e5e7eb"
    muted_color = "#9ca3af" if is_dark else "#6b7280"
    card_bg = "#374151" if is_dark else "#f9fafb"
    
    # Section labels
    section_labels = {
        "greenhouse": "Теплица",
        "balia": "Купель",
        "sauna": "Сауна"
    }
    
    # Source labels
    source_labels = {
        "calculator": "Калькулятор",
        "widget": "Виджет amoCRM",
        "web": "Сайт",
        "manual": "Ручной ввод",
        "iframe": "Iframe"
    }
    
    # Build HTML
    html = f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Информация о заказе</title>
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
            padding: 20px;
            font-size: 14px;
            line-height: 1.5;
        }}
        .widget {{
            max-width: 420px;
            margin: 0 auto;
        }}
        .header {{
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid {border_color};
        }}
        .header-title {{
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
        }}
        .header-subtitle {{
            font-size: 13px;
            color: {muted_color};
        }}
        .section {{
            margin-bottom: 20px;
        }}
        .section-title {{
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: {muted_color};
            margin-bottom: 10px;
        }}
        .status-row {{
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }}
        .status-badge {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border-radius: 20px;
            font-weight: 500;
            font-size: 14px;
        }}
        .status-dot {{
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }}
        .info-card {{
            background: {card_bg};
            border-radius: 10px;
            padding: 14px;
            border: 1px solid {border_color};
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid {border_color};
        }}
        .info-row:last-child {{
            border-bottom: none;
            padding-bottom: 0;
        }}
        .info-row:first-child {{
            padding-top: 0;
        }}
        .info-label {{
            color: {muted_color};
            font-size: 13px;
        }}
        .info-value {{
            font-weight: 500;
            text-align: right;
            max-width: 60%;
        }}
        .info-value.highlight {{
            color: #3b82f6;
        }}
        .info-value.success {{
            color: #22c55e;
        }}
        .info-value.warning {{
            color: #f59e0b;
        }}
        .calculator-block {{
            background: linear-gradient(135deg, {'#1e3a5f' if is_dark else '#e0f2fe'} 0%, {'#1e293b' if is_dark else '#f0f9ff'} 100%);
            border: 2px solid {'#3b82f6' if is_dark else '#3b82f6'};
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }}
        .calculator-title {{
            font-size: 16px;
            font-weight: 600;
            color: {'#60a5fa' if is_dark else '#1e40af'};
            margin-bottom: 6px;
        }}
        .calculator-subtitle {{
            font-size: 13px;
            color: {muted_color};
            margin-bottom: 16px;
        }}
        .btn-group {{
            display: flex;
            gap: 10px;
            justify-content: center;
        }}
        .btn {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            min-width: 130px;
        }}
        .btn-balia {{
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
        }}
        .btn-balia:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
        }}
        .btn-sauna {{
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
        }}
        .btn-sauna:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
        }}
        .btn svg {{
            width: 18px;
            height: 18px;
        }}
        .not-found {{
            text-align: center;
            padding: 30px 20px;
            color: {muted_color};
        }}
        .not-found-icon {{
            font-size: 48px;
            margin-bottom: 12px;
        }}
        .not-found-text {{
            font-size: 16px;
            margin-bottom: 6px;
        }}
        .not-found-hint {{
            font-size: 13px;
        }}
        .photo-badge {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #22c55e;
            font-size: 13px;
            background: {'#064e3b' if is_dark else '#dcfce7'};
            padding: 6px 12px;
            border-radius: 16px;
        }}
        .kp-badge {{
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 12px;
        }}
        .kp-yes {{
            background: {'#064e3b' if is_dark else '#dcfce7'};
            color: #22c55e;
        }}
        .kp-no {{
            background: {'#7f1d1d' if is_dark else '#fee2e2'};
            color: #ef4444;
        }}
    </style>
</head>
<body>
    <div class="widget">
"""

    if order:
        # Format dates
        created_at = order.get('createdAt') or order.get('created_at', '')
        created_date_str = '-'
        if created_at:
            try:
                if isinstance(created_at, str):
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    dt = created_at
                created_date_str = dt.strftime('%d.%m.%Y %H:%M')
            except:
                created_date_str = str(created_at)[:16] if created_at else '-'
        
        # Get creator info
        created_by = order.get('createdBy') or order.get('managerName') or order.get('employeeName') or '-'
        
        # Get source
        source = order.get('source') or order.get('orderSource') or 'calculator'
        source_label = source_labels.get(source, source)
        
        # Check if KP (commercial proposal) was created
        has_pdf = order.get('pdfGenerated') or order.get('hasPdf') or order.get('pdfUrl') or order.get('pdf_url')
        
        # Get total and payment info
        total = order.get('total') or order.get('totalPrice') or 0
        received_amount = order.get('receivedAmount') or 0
        currency = order.get('currencySymbol') or order.get('currency', 'zł')
        
        # Calculate debt
        try:
            total_float = float(total)
            received_float = float(received_amount)
            debt = total_float - received_float
        except:
            total_float = 0
            received_float = 0
            debt = 0
        
        try:
            total_formatted = f"{total_float:,.0f}".replace(",", " ")
            received_formatted = f"{received_float:,.0f}".replace(",", " ")
            debt_formatted = f"{debt:,.0f}".replace(",", " ")
        except:
            total_formatted = str(total)
            received_formatted = str(received_amount)
            debt_formatted = "0"
        
        # Customer name
        customer_name = order.get('fullName') or order.get('customerName') or '-'
        
        html += f"""
        <div class="header">
            <div class="header-title">Информация о заказе</div>
            <div class="header-subtitle">amoCRM ID: {lead_id}</div>
        </div>
        
        <!-- Status Section -->
        <div class="section">
            <div class="section-title">Статус</div>
            <div class="status-row">
                <div class="status-badge" style="background: {status_bg}; color: {status_color};">
                    <span class="status-dot" style="background: {status_color};"></span>
                    {status_label}
                </div>
                {f'<span class="photo-badge">📷 Фото доставки</span>' if photo_info else ''}
            </div>
        </div>
        
        <!-- Order Details -->
        <div class="section">
            <div class="section-title">Детали заказа</div>
            <div class="info-card">
                <div class="info-row">
                    <span class="info-label">ID заказа</span>
                    <span class="info-value">{order.get('id', '-')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Тип</span>
                    <span class="info-value highlight">{section_labels.get(section, section.capitalize() if section else '-')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Клиент</span>
                    <span class="info-value">{customer_name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Сумма заказа</span>
                    <span class="info-value">{total_formatted} {currency}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Оплачено</span>
                    <span class="info-value {'success' if received_float > 0 else ''}">{received_formatted} {currency}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Задолженность</span>
                    <span class="info-value {'warning' if debt > 0 else 'success'}">{debt_formatted} {currency}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Создан</span>
                    <span class="info-value">{created_date_str}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Создал</span>
                    <span class="info-value">{created_by}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Источник</span>
                    <span class="info-value">{source_label}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">КП создано</span>
                    <span class="info-value">
                        <span class="kp-badge {'kp-yes' if has_pdf else 'kp-no'}">
                            {'✓ Да' if has_pdf else '✗ Нет'}
                        </span>
                    </span>
                </div>
            </div>
        </div>
"""
        
        # Trip info section (especially for greenhouse)
        if trip_info:
            departure_date = trip_info.get('departureDate', '')
            if departure_date:
                try:
                    dt = datetime.fromisoformat(departure_date.replace('Z', '+00:00'))
                    departure_date = dt.strftime('%d.%m.%Y')
                except:
                    pass
            
            trip_status_labels = {
                "planned": "Запланирован",
                "in_progress": "В пути",
                "completed": "Завершён",
                "cancelled": "Отменён"
            }
            trip_status = trip_info.get('status', '')
            trip_status_label = trip_status_labels.get(trip_status, trip_status)
            
            html += f"""
        <!-- Trip Info -->
        <div class="section">
            <div class="section-title">Рейс и доставка</div>
            <div class="info-card">
                <div class="info-row">
                    <span class="info-label">Рейс</span>
                    <span class="info-value highlight">{trip_info.get('name', '-')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Водитель</span>
                    <span class="info-value">{trip_info.get('driverName', '-')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Дата выезда</span>
                    <span class="info-value">{departure_date or '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Статус рейса</span>
                    <span class="info-value">{trip_status_label}</span>
                </div>
            </div>
        </div>
"""

    else:
        html += f"""
        <div class="not-found">
            <div class="not-found-icon">📦</div>
            <div class="not-found-text">Заказ не найден</div>
            <div class="not-found-hint">Создайте заказ через калькулятор ниже</div>
        </div>
"""

    html += f"""
        <!-- Calculator Block -->
        <div class="section">
            <div class="calculator-block">
                <div class="calculator-title">Создать КП в калькуляторе</div>
                <div class="calculator-subtitle">Выберите тип продукта</div>
                <div class="btn-group">
                    <a href="{base_url}/?calc=balia&amocrm_id={lead_id}" target="_blank" class="btn btn-balia">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M8 12h8M12 8v8"/>
                        </svg>
                        Купель
                    </a>
                    <a href="{base_url}/?calc=sauna&amocrm_id={lead_id}" target="_blank" class="btn btn-sauna">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83M12 18v4M16.24 16.24l2.83 2.83M18 12h4M16.24 7.76l2.83-2.83"/>
                        </svg>
                        Сауна
                    </a>
                </div>
            </div>
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

    # Return with headers that allow iframe embedding from amoCRM
    return HTMLResponse(
        content=html,
        headers={
            "X-Frame-Options": "ALLOWALL",
            "Content-Security-Policy": "frame-ancestors *",
            "Access-Control-Allow-Origin": "*"
        }
    )


@router.get("/embed-info")
async def get_embed_info():
    """Get information about embedding the widget in amoCRM."""
    # Use APP_DOMAIN or APP_BASE_URL
    app_domain = os.environ.get("APP_DOMAIN", "")
    if app_domain:
        base_url = f"https://{app_domain}"
    else:
        base_url = os.environ.get("APP_BASE_URL", "")
        if not base_url:
            try:
                with open("/app/frontend/.env", "r") as f:
                    for line in f:
                        if line.startswith("REACT_APP_BACKEND_URL="):
                            base_url = line.strip().split("=", 1)[1]
                            break
            except:
                base_url = "https://your-domain.com"
    
    return {
        "base_url": base_url,
        "embed_url_template": f"{base_url}/api/widget/embed/{{lead_id}}",
        "embed_url_example": f"{base_url}/api/widget/embed/12345678",
        "webhook_urls": {
            "greenhouse": f"{base_url}/api/integrations/amocrm/webhook/greenhouse",
            "balia": f"{base_url}/api/integrations/amocrm/webhook/balia",
            "sauna": f"{base_url}/api/integrations/amocrm/webhook/sauna"
        },
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


@router.post("/salesbot-handler")
async def salesbot_handler(request: dict = {}):
    """Handler for amoCRM Salesbot - returns calculator buttons.
    
    amoCRM Salesbot calls this endpoint and expects a response with widgets/buttons.
    """
    # Get lead_id from request params
    lead_id = request.get("lead_id") or request.get("params", {}).get("lead_id", "")
    
    # If no lead_id provided, try to get from leads array
    if not lead_id:
        leads = request.get("leads", [])
        if leads and len(leads) > 0:
            lead_id = leads[0].get("id", "")
    
    # Get base URL
    app_domain = os.environ.get("APP_DOMAIN", "")
    if app_domain:
        base_url = f"https://{app_domain}"
    else:
        try:
            with open("/app/frontend/.env", "r") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        base_url = line.strip().split("=", 1)[1]
                        break
        except:
            base_url = "https://wm-kalkulator.pl"
    
    # Build calculator URLs
    sauna_url = f"{base_url}/?calc=sauna&amocrm_id={lead_id}"
    balia_url = f"{base_url}/?calc=balia&amocrm_id={lead_id}"
    
    # Return widget with buttons
    return {
        "type": "buttons",
        "text": "🧮 Калькуляторы WM",
        "buttons": [
            {
                "type": "url",
                "text": "🔥 Калькулятор саун",
                "url": sauna_url
            },
            {
                "type": "url",
                "text": "💧 Калькулятор купелей", 
                "url": balia_url
            }
        ]
    }


@router.get("/salesbot-handler")
async def salesbot_handler_get(lead_id: str = ""):
    """GET version of salesbot handler for testing."""
    # Get base URL
    app_domain = os.environ.get("APP_DOMAIN", "")
    if app_domain:
        base_url = f"https://{app_domain}"
    else:
        try:
            with open("/app/frontend/.env", "r") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        base_url = line.strip().split("=", 1)[1]
                        break
        except:
            base_url = "https://wm-kalkulator.pl"
    
    sauna_url = f"{base_url}/?calc=sauna&amocrm_id={lead_id}"
    balia_url = f"{base_url}/?calc=balia&amocrm_id={lead_id}"
    
    return {
        "type": "buttons",
        "text": "🧮 Калькуляторы WM",
        "buttons": [
            {
                "type": "url",
                "text": "🔥 Калькулятор саун",
                "url": sauna_url
            },
            {
                "type": "url",
                "text": "💧 Калькулятор купелей",
                "url": balia_url
            }
        ]
    }
