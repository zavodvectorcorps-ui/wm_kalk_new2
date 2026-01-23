"""amoCRM Widget API - endpoints for widget integration."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse
from typing import Optional
from datetime import datetime, timezone
import os
import logging
import httpx

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


def build_preview_panel(order, section):
    """Build inline order preview panel for widget."""
    if not order:
        return ""
    
    order_id = order.get('id', '-')
    client_name = order.get('fullName') or order.get('clientName', '-')
    phone = order.get('phoneNumber') or order.get('phone', '-')
    address = order.get('fullAddress') or order.get('address', '-')
    total = order.get('total', 0)
    discount = order.get('discountPercent', 0)
    model_name = order.get('modelName', '-')
    admin_gifts = order.get('adminGifts', [])
    notes = order.get('notes', '')
    
    # Build selected options HTML
    options_html = ""
    selected_options = order.get('selectedOptions', [])
    
    if isinstance(selected_options, list) and selected_options:
        for opt in selected_options:
            if isinstance(opt, dict):
                opt_id = opt.get('optionId') or opt.get('id', '')
                cat_name = opt.get('categoryName', '')
                opt_name = opt.get('optionName') or opt.get('name', '')
                opt_price = opt.get('price', 0) or opt.get('optionPrice', 0)
                is_gift = opt_id in admin_gifts
                
                if opt_name:
                    gift_badge = '<span class="preview-gift-badge">🎁</span>' if is_gift else ''
                    price_class = 'preview-price gift-strike' if is_gift else 'preview-price'
                    options_html += f"""
                    <div class="preview-option">
                        <div class="preview-option-info">
                            <span class="preview-cat">{cat_name}</span>
                            <span class="preview-name">{opt_name} {gift_badge}</span>
                        </div>
                        <span class="{price_class}">{opt_price:,.0f} zł</span>
                    </div>"""
    
    # Calculate totals
    gifts_total = sum([opt.get('price', 0) or opt.get('optionPrice', 0) 
                       for opt in selected_options 
                       if isinstance(opt, dict) and (opt.get('optionId') or opt.get('id', '')) in admin_gifts])
    discount_amount = round(total * discount / 100) if discount else 0
    
    return f"""
        <div id="previewPanel" class="preview-panel" style="display: none;">
            <div class="preview-header">
                <span>📋 Просмотр заказа</span>
                <button type="button" class="preview-close" onclick="togglePreviewPanel()">✕</button>
            </div>
            
            <div class="preview-info-grid">
                <div class="preview-info-item">
                    <span class="preview-label">👤 Клиент</span>
                    <span class="preview-value">{client_name}</span>
                </div>
                <div class="preview-info-item">
                    <span class="preview-label">📞 Телефон</span>
                    <span class="preview-value">{phone}</span>
                </div>
                <div class="preview-info-item full-width">
                    <span class="preview-label">📍 Адрес</span>
                    <span class="preview-value">{address}</span>
                </div>
                <div class="preview-info-item">
                    <span class="preview-label">🏷️ Модель</span>
                    <span class="preview-value">{model_name}</span>
                </div>
            </div>
            
            {f'<div class="preview-notes"><strong>📝 Примечания:</strong> {notes}</div>' if notes else ''}
            
            <div class="preview-options-title">Выбранные опции:</div>
            <div class="preview-options">
                {options_html if options_html else '<p style="color: #6b7280; text-align: center;">Нет опций</p>'}
            </div>
            
            <div class="preview-summary">
                {f'<div class="preview-summary-row"><span>🎁 Подарки:</span><span class="preview-gift-value">-{gifts_total:,.0f} zł</span></div>' if gifts_total > 0 else ''}
                {f'<div class="preview-summary-row"><span>📊 Скидка ({discount}%):</span><span>-{discount_amount:,.0f} zł</span></div>' if discount > 0 else ''}
                <div class="preview-summary-row total">
                    <span>Итого:</span>
                    <span>{total:,.0f} zł</span>
                </div>
            </div>
        </div>
        
        <script>
            function togglePreviewPanel() {{
                const panel = document.getElementById('previewPanel');
                const giftsPanel = document.getElementById('giftsPanel');
                if (giftsPanel) giftsPanel.style.display = 'none';
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }}
        </script>
    """


def build_gifts_panel(order, base_url, lead_id):
    """Build inline gifts editing panel for widget."""
    if not order:
        return ""
    
    admin_gifts = order.get('adminGifts', [])
    discount = order.get('discountPercent', 0)
    selected_options = order.get('selectedOptions', [])
    
    if not selected_options:
        return ""
    
    # Build options list
    options_html = ""
    for opt in selected_options:
        if isinstance(opt, dict):
            opt_id = opt.get('optionId') or opt.get('id', '')
            opt_name = opt.get('optionName') or opt.get('name', '')
            opt_price = opt.get('price', 0) or opt.get('optionPrice', 0)
            cat_name = opt.get('categoryName', '')
            is_gift = opt_id in admin_gifts
            
            if opt_name:
                options_html += f"""
                <div class="gift-option {'is-gift' if is_gift else ''}" data-id="{opt_id}" data-price="{opt_price}">
                    <div class="gift-option-info">
                        <span class="gift-cat">{cat_name}</span>
                        <span class="gift-name">{opt_name}</span>
                    </div>
                    <div class="gift-option-right">
                        <span class="gift-price {'gift-strike' if is_gift else ''}">{opt_price:,.0f} zł</span>
                        <label class="gift-check">
                            <input type="checkbox" {'checked' if is_gift else ''} onchange="toggleGift(this, '{opt_id}')">
                            <span>🎁</span>
                        </label>
                    </div>
                </div>"""
    
    return f"""
        <div id="giftsPanel" class="gifts-panel" style="display: none;">
            <div class="gifts-header">
                <span>🎁 Редактирование подарков</span>
                <button type="button" class="gifts-close" onclick="toggleGiftsPanel()">✕</button>
            </div>
            
            <div class="gifts-discount">
                <label>Скидка:</label>
                <input type="number" id="discountInput" value="{discount}" min="0" max="100" step="1">
                <span>%</span>
            </div>
            
            <div class="gifts-options">
                {options_html}
            </div>
            
            <div id="giftsStatus" class="gifts-status"></div>
            
            <button type="button" class="btn btn-save-gifts" onclick="saveGifts()" id="saveGiftsBtn">
                💾 Сохранить изменения
            </button>
        </div>
        
        <script>
            let selectedGifts = {list(admin_gifts)};
            
            function toggleGiftsPanel() {{
                const panel = document.getElementById('giftsPanel');
                const previewPanel = document.getElementById('previewPanel');
                if (previewPanel) previewPanel.style.display = 'none';
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }}
            
            function toggleGift(checkbox, optId) {{
                const row = checkbox.closest('.gift-option');
                const priceEl = row.querySelector('.gift-price');
                
                if (checkbox.checked) {{
                    if (!selectedGifts.includes(optId)) selectedGifts.push(optId);
                    row.classList.add('is-gift');
                    priceEl.classList.add('gift-strike');
                }} else {{
                    selectedGifts = selectedGifts.filter(id => id !== optId);
                    row.classList.remove('is-gift');
                    priceEl.classList.remove('gift-strike');
                }}
            }}
            
            async function saveGifts() {{
                const btn = document.getElementById('saveGiftsBtn');
                const status = document.getElementById('giftsStatus');
                const discount = parseInt(document.getElementById('discountInput').value) || 0;
                
                btn.disabled = true;
                btn.textContent = '⏳ Сохранение...';
                status.textContent = '';
                status.className = 'gifts-status';
                
                try {{
                    const response = await fetch('{base_url}/api/widget/save-gifts/{lead_id}', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{
                            adminGifts: selectedGifts,
                            discountPercent: discount
                        }})
                    }});
                    
                    const result = await response.json();
                    
                    if (response.ok) {{
                        status.textContent = '✅ ' + (result.message || 'Сохранено!');
                        status.className = 'gifts-status success';
                        setTimeout(() => {{
                            toggleGiftsPanel();
                            location.reload();
                        }}, 1500);
                    }} else {{
                        status.textContent = '❌ ' + (result.detail || 'Ошибка');
                        status.className = 'gifts-status error';
                    }}
                }} catch (err) {{
                    status.textContent = '❌ ' + err.message;
                    status.className = 'gifts-status error';
                }} finally {{
                    btn.disabled = false;
                    btn.textContent = '💾 Сохранить изменения';
                }}
            }}
        </script>
    """


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
        "preparing": {"label": "Готовится", "color": "#eab308"},
        "in_transit": {"label": "В пути", "color": "#3b82f6"},
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
        "preparing": {"label": "Готовится", "color": "#eab308", "bg": "#fefce8"},
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
            min-height: 600px;
        }}
        .widget {{
            max-width: 520px;
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
        .allegro-badge {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: linear-gradient(135deg, {'#7c2d12' if is_dark else '#fff7ed'} 0%, {'#431407' if is_dark else '#ffedd5'} 100%);
            border: 2px solid #f97316;
            border-radius: 10px;
            font-weight: 600;
            font-size: 15px;
            color: #f97316;
        }}
        .allegro-icon {{
            font-size: 20px;
        }}
        .tags-row {{
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }}
        .tag-badge {{
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            background: {'#4c1d95' if is_dark else '#ede9fe'};
            color: {'#c4b5fd' if is_dark else '#7c3aed'};
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }}
        .btn-edit {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 12px 20px;
            background: {'#1e3a5f' if is_dark else '#f0f9ff'};
            border: 2px solid #0ea5e9;
            border-radius: 10px;
            color: {'#38bdf8' if is_dark else '#0284c7'};
            font-weight: 600;
            font-size: 14px;
            text-decoration: none;
            transition: all 0.2s;
        }}
        .btn-edit:hover {{
            background: {'#0c4a6e' if is_dark else '#e0f2fe'};
            transform: translateY(-1px);
        }}
        .btn-edit svg {{
            width: 18px;
            height: 18px;
        }}
        .btn-view {{
            background: {'#1e3a5f' if is_dark else '#dbeafe'};
            color: {'#60a5fa' if is_dark else '#1e40af'};
            border: 1px solid {'#3b82f6' if is_dark else '#93c5fd'};
            padding: 10px 16px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 13px;
            text-decoration: none;
            transition: all 0.2s;
        }}
        .btn-view:hover {{
            background: {'#1e4a7f' if is_dark else '#bfdbfe'};
            transform: translateY(-1px);
        }}
        .btn-gift {{
            background: {'#1e3f2e' if is_dark else '#dcfce7'};
            color: {'#4ade80' if is_dark else '#166534'};
            border: 1px solid {'#22c55e' if is_dark else '#86efac'};
            padding: 10px 16px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 13px;
            text-decoration: none;
            transition: all 0.2s;
        }}
        .btn-gift:hover {{
            background: {'#1e4f3e' if is_dark else '#bbf7d0'};
            transform: translateY(-1px);
        }}
        
        /* Gifts Panel Styles */
        .gifts-panel {{
            margin-top: 16px;
            padding: 16px;
            background: {'#1a2e1a' if is_dark else '#f0fdf4'};
            border: 1px solid {'#22c55e' if is_dark else '#86efac'};
            border-radius: 12px;
        }}
        .gifts-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            font-weight: 600;
            color: {'#4ade80' if is_dark else '#166534'};
        }}
        .gifts-close {{
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: {'#6b7280' if is_dark else '#9ca3af'};
            padding: 4px 8px;
        }}
        .gifts-close:hover {{
            color: {'#ef4444' if is_dark else '#dc2626'};
        }}
        .gifts-discount {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            background: {'#1e3a1e' if is_dark else '#fef3c7'};
            border-radius: 8px;
            margin-bottom: 12px;
        }}
        .gifts-discount label {{
            font-weight: 500;
            color: {'#fbbf24' if is_dark else '#92400e'};
        }}
        .gifts-discount input {{
            width: 60px;
            padding: 6px 10px;
            border: 1px solid {'#fbbf24' if is_dark else '#d1d5db'};
            border-radius: 6px;
            font-size: 14px;
            text-align: center;
            background: {'#1f2937' if is_dark else 'white'};
            color: {'#f3f4f6' if is_dark else '#1f2937'};
        }}
        .gifts-options {{
            max-height: 300px;
            overflow-y: auto;
        }}
        .gift-option {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            margin-bottom: 6px;
            background: {'#1f2937' if is_dark else 'white'};
            border: 1px solid {'#374151' if is_dark else '#e5e7eb'};
            border-radius: 8px;
            transition: all 0.2s;
        }}
        .gift-option.is-gift {{
            background: {'#14532d' if is_dark else '#dcfce7'};
            border-color: {'#22c55e' if is_dark else '#86efac'};
        }}
        .gift-option-info {{
            flex: 1;
        }}
        .gift-cat {{
            display: block;
            font-size: 10px;
            color: {'#9ca3af' if is_dark else '#6b7280'};
            text-transform: uppercase;
        }}
        .gift-name {{
            font-size: 13px;
            color: {'#f3f4f6' if is_dark else '#1f2937'};
        }}
        .gift-option-right {{
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .gift-price {{
            font-size: 13px;
            font-weight: 600;
            color: {'#f3f4f6' if is_dark else '#374151'};
            min-width: 60px;
            text-align: right;
        }}
        .gift-price.gift-strike {{
            text-decoration: line-through;
            color: {'#10b981' if is_dark else '#059669'};
        }}
        .gift-check {{
            cursor: pointer;
        }}
        .gift-check input {{
            display: none;
        }}
        .gift-check span {{
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: {'#374151' if is_dark else '#f3f4f6'};
            border: 2px solid {'#4b5563' if is_dark else '#d1d5db'};
            font-size: 16px;
            transition: all 0.2s;
        }}
        .gift-check input:checked + span {{
            background: {'#14532d' if is_dark else '#dcfce7'};
            border-color: {'#22c55e' if is_dark else '#10b981'};
        }}
        .btn-save-gifts {{
            width: 100%;
            margin-top: 12px;
            padding: 12px;
            background: {'#22c55e' if is_dark else '#10b981'};
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .btn-save-gifts:hover {{
            background: {'#16a34a' if is_dark else '#059669'};
        }}
        .btn-save-gifts:disabled {{
            background: {'#4b5563' if is_dark else '#9ca3af'};
            cursor: not-allowed;
        }}
        .gifts-status {{
            padding: 10px;
            border-radius: 6px;
            margin-top: 10px;
            text-align: center;
            font-size: 13px;
            display: none;
        }}
        .gifts-status.success {{
            display: block;
            background: {'#14532d' if is_dark else '#dcfce7'};
            color: {'#4ade80' if is_dark else '#166534'};
        }}
        .gifts-status.error {{
            display: block;
            background: {'#450a0a' if is_dark else '#fee2e2'};
            color: {'#f87171' if is_dark else '#991b1b'};
        }}
        
        /* Preview Panel Styles */
        .preview-panel {{
            margin-top: 16px;
            padding: 16px;
            background: {'#1e293b' if is_dark else '#f8fafc'};
            border: 1px solid {'#334155' if is_dark else '#e2e8f0'};
            border-radius: 12px;
        }}
        .preview-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            font-weight: 600;
            color: {'#60a5fa' if is_dark else '#1e40af'};
        }}
        .preview-close {{
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: {'#6b7280' if is_dark else '#9ca3af'};
            padding: 4px 8px;
        }}
        .preview-close:hover {{
            color: {'#ef4444' if is_dark else '#dc2626'};
        }}
        .preview-info-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 16px;
        }}
        .preview-info-item {{
            background: {'#0f172a' if is_dark else 'white'};
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid {'#334155' if is_dark else '#e5e7eb'};
        }}
        .preview-info-item.full-width {{
            grid-column: 1 / -1;
        }}
        .preview-label {{
            display: block;
            font-size: 11px;
            color: {'#9ca3af' if is_dark else '#6b7280'};
            margin-bottom: 4px;
        }}
        .preview-value {{
            font-size: 13px;
            color: {'#f3f4f6' if is_dark else '#1f2937'};
            word-break: break-word;
        }}
        .preview-notes {{
            background: {'#1e3a5f' if is_dark else '#fef3c7'};
            padding: 10px 12px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 13px;
            color: {'#fbbf24' if is_dark else '#92400e'};
        }}
        .preview-options-title {{
            font-size: 13px;
            font-weight: 600;
            color: {'#9ca3af' if is_dark else '#374151'};
            margin-bottom: 8px;
        }}
        .preview-options {{
            max-height: 250px;
            overflow-y: auto;
            border: 1px solid {'#334155' if is_dark else '#e5e7eb'};
            border-radius: 8px;
        }}
        .preview-option {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid {'#334155' if is_dark else '#e5e7eb'};
        }}
        .preview-option:last-child {{
            border-bottom: none;
        }}
        .preview-option-info {{
            flex: 1;
        }}
        .preview-cat {{
            display: block;
            font-size: 10px;
            color: {'#6b7280' if is_dark else '#9ca3af'};
            text-transform: uppercase;
        }}
        .preview-name {{
            font-size: 12px;
            color: {'#e5e7eb' if is_dark else '#374151'};
        }}
        .preview-gift-badge {{
            font-size: 11px;
        }}
        .preview-price {{
            font-size: 12px;
            font-weight: 600;
            color: {'#e5e7eb' if is_dark else '#374151'};
        }}
        .preview-price.gift-strike {{
            text-decoration: line-through;
            color: {'#10b981' if is_dark else '#059669'};
        }}
        .preview-summary {{
            margin-top: 12px;
            padding: 12px;
            background: {'#0f172a' if is_dark else 'white'};
            border-radius: 8px;
            border: 1px solid {'#334155' if is_dark else '#e5e7eb'};
        }}
        .preview-summary-row {{
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 13px;
            color: {'#d1d5db' if is_dark else '#4b5563'};
        }}
        .preview-summary-row.total {{
            font-weight: bold;
            font-size: 15px;
            border-top: 1px solid {'#334155' if is_dark else '#e5e7eb'};
            margin-top: 8px;
            padding-top: 8px;
            color: {'#f3f4f6' if is_dark else '#1f2937'};
        }}
        .preview-gift-value {{
            color: {'#10b981' if is_dark else '#059669'};
        }}
    </style>
</head>
<body>
    <div class="widget">>
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
        
        # Check if order has selections (for showing edit buttons)
        has_selections = bool(order.get('selectedOptions')) or bool(order.get('selections'))
        
        # Get total and payment info
        # Different collections use different field names:
        # - balia/sauna: total, totalPrice
        # - greenhouse: dealSum, debtSum, amountDue
        total = (
            order.get('total') or 
            order.get('totalPrice') or 
            order.get('dealSum') or 
            order.get('amountDue') or 
            0
        )
        received_amount = order.get('receivedAmount') or 0
        
        # For greenhouse, debtSum is already calculated
        debt_from_order = order.get('debtSum')
        
        currency = order.get('currencySymbol') or order.get('currency', 'zł')
        
        # Calculate debt
        try:
            total_float = float(total) if total else 0
            received_float = float(received_amount) if received_amount else 0
            
            # Use debtSum if available (greenhouse), otherwise calculate
            if debt_from_order is not None and debt_from_order != '':
                debt = float(debt_from_order)
            else:
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
        
        # Check if important order (Allegro)
        is_important = order.get('isImportant') or order.get('important') or False
        
        # Get tags from amoCRM
        amocrm_tags = order.get('amocrm_tags') or order.get('tags') or []
        
        # Check for OPŁACONE tag (paid on Allegro)
        is_paid_allegro = False
        tag_names = [t.get('name', t) if isinstance(t, dict) else t for t in amocrm_tags]
        if 'OPŁACONE' in tag_names or 'OPLACONE' in tag_names:
            is_paid_allegro = True
        
        html += f"""
        <div class="header">
            <div class="header-title">Информация о заказе</div>
            <div class="header-subtitle">amoCRM ID: {lead_id}</div>
        </div>
        
        <!-- Important Order Badge (Allegro) -->
        {f'''<div class="section">
            <div class="allegro-badge">
                <span class="allegro-icon">🛒</span>
                <span>Заказ Allegro</span>
            </div>
        </div>''' if is_important else ''}
        
        <!-- Tags Section -->
        {f'''<div class="section">
            <div class="tags-row">
                {''.join([f'<span class="tag-badge">{tag.get("name", tag) if isinstance(tag, dict) else tag}</span>' for tag in amocrm_tags])}
            </div>
        </div>''' if amocrm_tags else ''}
        
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
                    <span class="info-value {'success' if is_paid_allegro else ('warning' if debt > 0 else 'success')}">{'✓ Оплачен на Allegro' if is_paid_allegro else f'{debt_formatted} {currency}'}</span>
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
        
        <!-- Edit Button (if order exists and has PDF) -->
        {f'''<div class="section">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn btn-view" style="flex: 1; min-width: 140px;" onclick="togglePreviewPanel()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Просмотр заказа
                </button>
                <button type="button" class="btn btn-gift" style="flex: 1; min-width: 140px;" onclick="toggleGiftsPanel()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                        <polyline points="20 12 20 22 4 22 4 12"/>
                        <rect x="2" y="7" width="20" height="5"/>
                        <line x1="12" y1="22" x2="12" y2="7"/>
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                    </svg>
                    Подарки и скидки
                </button>
            </div>
            <a href="{base_url}/?calc={section}&amocrm_id={lead_id}&edit=true" target="_blank" class="btn btn-edit" style="margin-top: 8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Редактировать заказ полностью
            </a>
        </div>''' if has_selections else ''}
        
        <!-- Inline Preview Panel -->
        {build_preview_panel(order, section) if has_selections else ''}
        
        <!-- Inline Gifts Panel -->
        {build_gifts_panel(order, base_url, lead_id) if has_selections else ''}
"""
        
        # Change history section
        change_history = order.get('changeHistory', []) if order else []
        if change_history and len(change_history) > 0:
            # Sort by timestamp descending and take last 5
            sorted_history = sorted(change_history, key=lambda x: x.get('timestamp', ''), reverse=True)[:5]
            
            history_html = f"""
        <!-- Change History -->
        <div class="section">
            <div class="section-title">📋 История изменений</div>
            <div class="info-card" style="max-height: 200px; overflow-y: auto;">
"""
            for entry in sorted_history:
                timestamp = entry.get('timestamp', '')
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    timestamp_str = dt.strftime('%d.%m.%Y %H:%M')
                except:
                    timestamp_str = timestamp[:16] if timestamp else '-'
                
                changed_by = entry.get('changedBy', entry.get('action', 'system'))
                changes = entry.get('changes', [])
                
                changes_text = ', '.join([f"{c.get('field', '?')}" for c in changes[:3]])
                if len(changes) > 3:
                    changes_text += f" +{len(changes)-3}"
                
                history_html += f"""
                <div class="info-row">
                    <span class="info-label" style="font-size: 12px;">{timestamp_str}</span>
                    <span class="info-value" style="font-size: 12px;">{changed_by}: {changes_text}</span>
                </div>
"""
            
            history_html += """
            </div>
        </div>
"""
            html += history_html
        
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


@router.get("/preview/{lead_id}", response_class=HTMLResponse)
async def preview_order(lead_id: str):
    """Preview order details for amoCRM widget."""
    order, section = get_all_orders_by_amocrm_id(lead_id)
    
    if not order:
        return HTMLResponse(content="""
        <html>
        <head><meta charset="UTF-8"><title>Заказ не найден</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h2>⚠️ Заказ не найден</h2>
            <p>Заказ с amocrm_id={lead_id} не найден в системе.</p>
        </body>
        </html>
        """.replace("{lead_id}", lead_id), status_code=404)
    
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
    
    # Build order details HTML
    order_id = order.get('id', '-')
    client_name = order.get('fullName') or order.get('clientName', '-')
    phone = order.get('phoneNumber') or order.get('phone', '-')
    address = order.get('fullAddress') or order.get('address', '-')
    total = order.get('total', 0)
    discount = order.get('discountPercent', 0)
    admin_gifts = order.get('adminGifts', [])
    model_name = order.get('modelName', '-')
    created_at = order.get('createdAt', '-')
    
    # Format created date
    if created_at and created_at != '-':
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(str(created_at).replace('Z', '+00:00'))
            created_at = dt.strftime('%d.%m.%Y %H:%M')
        except:
            pass
    
    # Build selections HTML
    selections_html = ""
    selections = order.get('selectedOptions', [])
    if isinstance(selections, list):
        for sel in selections:
            if isinstance(sel, dict):
                cat_name = sel.get('categoryName', '')
                opt_name = sel.get('optionName', '')
                opt_price = sel.get('optionPrice', 0)
                if cat_name and opt_name:
                    selections_html += f"""
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{cat_name}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{opt_name}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">{opt_price:,.0f} zł</td>
                    </tr>"""
    
    # Build gifts HTML
    gifts_html = ""
    if admin_gifts:
        gifts_html = "<div style='margin-top: 16px; padding: 12px; background: #dcfce7; border-radius: 8px;'>"
        gifts_html += "<strong style='color: #166534;'>🎁 Подарки:</strong><br>"
        for gift in admin_gifts:
            gifts_html += f"<span style='display: inline-block; margin: 4px; padding: 4px 8px; background: #bbf7d0; border-radius: 4px; font-size: 13px;'>{gift}</span>"
        gifts_html += "</div>"
    
    html = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Заказ {order_id}</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }}
            .container {{ max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
            h1 {{ color: #1f2937; margin-bottom: 8px; }}
            .badge {{ display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; }}
            .badge-sauna {{ background: #fef3c7; color: #92400e; }}
            .badge-balia {{ background: #dbeafe; color: #1e40af; }}
            .info-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; }}
            .info-item {{ padding: 12px; background: #f9fafb; border-radius: 8px; }}
            .info-label {{ font-size: 12px; color: #6b7280; margin-bottom: 4px; }}
            .info-value {{ font-size: 16px; color: #1f2937; font-weight: 500; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; }}
            .total-row {{ background: #fef3c7; font-weight: bold; }}
            .discount {{ color: #dc2626; }}
            .btn {{ display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; transition: all 0.2s; }}
            .btn-primary {{ background: #2563eb; color: white; }}
            .btn-primary:hover {{ background: #1d4ed8; }}
            .btn-secondary {{ background: #e5e7eb; color: #374151; }}
            .btn-secondary:hover {{ background: #d1d5db; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h1>📋 Заказ {order_id}</h1>
                    <span class="badge badge-{section}">{section.upper()}</span>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 24px; font-weight: bold; color: #059669;">{total:,.0f} zł</div>
                    {f'<div class="discount">Скидка: {discount}%</div>' if discount > 0 else ''}
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">👤 Клиент</div>
                    <div class="info-value">{client_name}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">📞 Телефон</div>
                    <div class="info-value">{phone}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">📍 Адрес</div>
                    <div class="info-value">{address}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">📅 Создан</div>
                    <div class="info-value">{created_at}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">🏷️ Модель</div>
                    <div class="info-value">{model_name}</div>
                </div>
            </div>
            
            {gifts_html}
            
            {f'''<table>
                <thead>
                    <tr>
                        <th>Категория</th>
                        <th>Опция</th>
                        <th style="text-align: right;">Цена</th>
                    </tr>
                </thead>
                <tbody>
                    {selections_html}
                </tbody>
            </table>''' if selections_html else ''}
            
            <div style="margin-top: 24px; display: flex; gap: 12px;">
                <a href="{base_url}/api/widget/edit-gifts/{lead_id}" class="btn btn-primary">
                    🎁 Редактировать подарки
                </a>
                <a href="{base_url}/?calc={section}&amocrm_id={lead_id}&edit=true" class="btn btn-secondary">
                    ✏️ Редактировать полностью
                </a>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@router.get("/edit-gifts/{lead_id}", response_class=HTMLResponse)
async def edit_gifts_page(lead_id: str):
    """Page for editing gifts and discounts - shows order preview with gift toggles."""
    order, section = get_all_orders_by_amocrm_id(lead_id)
    
    if not order:
        return HTMLResponse(content=f"""
        <html>
        <head><meta charset="UTF-8"><title>Заказ не найден</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h2>⚠️ Заказ не найден</h2>
            <p>Заказ с amocrm_id={lead_id} не найден в системе.</p>
        </body>
        </html>
        """, status_code=404)
    
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
    
    order_id = order.get('id', '-')
    client_name = order.get('fullName') or order.get('clientName', '-')
    phone = order.get('phoneNumber') or order.get('phone', '-')
    address = order.get('fullAddress') or order.get('address', '-')
    total = order.get('total', 0)
    discount = order.get('discountPercent', 0)
    admin_gifts = order.get('adminGifts', [])
    model_name = order.get('modelName', '-')
    
    # Build selected options HTML with gift toggles
    options_html = ""
    selected_options = order.get('selectedOptions', [])
    
    if isinstance(selected_options, list) and selected_options:
        for sel in selected_options:
            if isinstance(sel, dict):
                opt_id = sel.get('optionId', '')
                cat_name = sel.get('categoryName', '')
                opt_name = sel.get('optionName', '')
                opt_price = sel.get('optionPrice', 0)
                is_gift = opt_id in admin_gifts
                
                if cat_name and opt_name:
                    options_html += f"""
                    <div class="option-row {'is-gift' if is_gift else ''}">
                        <div class="option-info">
                            <span class="option-category">{cat_name}</span>
                            <span class="option-name">{opt_name}</span>
                        </div>
                        <div class="option-actions">
                            <span class="option-price {'gift-price' if is_gift else ''}">{opt_price:,.0f} zł</span>
                            <label class="gift-toggle">
                                <input type="checkbox" name="gifts" value="{opt_id}" data-price="{opt_price}" {'checked' if is_gift else ''}>
                                <span class="toggle-label">🎁</span>
                            </label>
                        </div>
                    </div>"""
    else:
        options_html = "<p style='color: #6b7280; text-align: center;'>Нет выбранных опций в заказе</p>"
    
    # Current gifts display
    gifts_total = sum([sel.get('optionPrice', 0) for sel in selected_options if isinstance(sel, dict) and sel.get('optionId') in admin_gifts])
    
    html = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Подарки - {order_id}</title>
        <style>
            * {{ box-sizing: border-box; }}
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }}
            .container {{ max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }}
            
            .header {{ background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 24px; }}
            .header h1 {{ margin: 0 0 8px 0; font-size: 24px; }}
            .header-info {{ display: flex; justify-content: space-between; align-items: flex-end; }}
            .client-info {{ font-size: 14px; opacity: 0.9; }}
            .total-box {{ text-align: right; }}
            .total-amount {{ font-size: 28px; font-weight: bold; }}
            .discount-badge {{ background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-top: 4px; display: inline-block; }}
            
            .content {{ padding: 24px; }}
            
            .section-title {{ font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }}
            
            .discount-section {{ background: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px; }}
            .discount-section label {{ font-weight: 500; color: #92400e; white-space: nowrap; }}
            .discount-section input {{ width: 80px; padding: 8px 12px; border: 2px solid #fbbf24; border-radius: 6px; font-size: 18px; font-weight: bold; text-align: center; }}
            .discount-section input:focus {{ outline: none; border-color: #f59e0b; }}
            
            .options-list {{ border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }}
            
            .option-row {{ display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; transition: all 0.2s; }}
            .option-row:last-child {{ border-bottom: none; }}
            .option-row:hover {{ background: #f9fafb; }}
            .option-row.is-gift {{ background: #dcfce7; }}
            
            .option-info {{ flex: 1; }}
            .option-category {{ display: block; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }}
            .option-name {{ font-size: 14px; color: #1f2937; }}
            
            .option-actions {{ display: flex; align-items: center; gap: 12px; }}
            .option-price {{ font-size: 14px; font-weight: 600; color: #374151; min-width: 80px; text-align: right; }}
            .option-price.gift-price {{ color: #10b981; text-decoration: line-through; }}
            
            .gift-toggle {{ cursor: pointer; }}
            .gift-toggle input {{ display: none; }}
            .toggle-label {{ display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: #f3f4f6; border: 2px solid #e5e7eb; font-size: 18px; transition: all 0.2s; }}
            .gift-toggle input:checked + .toggle-label {{ background: #dcfce7; border-color: #10b981; }}
            .gift-toggle:hover .toggle-label {{ border-color: #10b981; }}
            
            .summary {{ background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 24px; }}
            .summary-row {{ display: flex; justify-content: space-between; padding: 8px 0; }}
            .summary-row.total {{ font-size: 18px; font-weight: bold; border-top: 2px solid #e5e7eb; margin-top: 8px; padding-top: 16px; }}
            .gift-value {{ color: #10b981; }}
            
            .actions {{ display: flex; gap: 12px; margin-top: 24px; }}
            .btn {{ flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 24px; border-radius: 8px; border: none; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; text-decoration: none; }}
            .btn-save {{ background: #10b981; color: white; }}
            .btn-save:hover {{ background: #059669; }}
            .btn-save:disabled {{ background: #9ca3af; cursor: not-allowed; }}
            .btn-cancel {{ background: #e5e7eb; color: #374151; }}
            .btn-cancel:hover {{ background: #d1d5db; }}
            
            .status {{ padding: 12px; border-radius: 8px; margin-top: 16px; text-align: center; display: none; }}
            .status.success {{ display: block; background: #dcfce7; color: #166534; }}
            .status.error {{ display: block; background: #fee2e2; color: #991b1b; }}
            
            .loading {{ display: none; }}
            .loading.show {{ display: inline-block; animation: spin 1s linear infinite; }}
            @keyframes spin {{ 100% {{ transform: rotate(360deg); }} }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎁 Редактирование подарков</h1>
                <div class="header-info">
                    <div class="client-info">
                        <div><strong>{order_id}</strong></div>
                        <div>{client_name}</div>
                        <div>{model_name}</div>
                    </div>
                    <div class="total-box">
                        <div class="total-amount" id="totalDisplay">{total:,.0f} zł</div>
                        <div class="discount-badge" id="discountBadge" style="{'display:inline-block' if discount > 0 else 'display:none'}">
                            Скидка: <span id="discountDisplay">{discount}</span>%
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="content">
                <form id="giftsForm">
                    <div class="discount-section">
                        <label>📊 Скидка</label>
                        <input type="number" id="discount" value="{discount}" min="0" max="100" step="1">
                        <span style="color: #6b7280;">%</span>
                    </div>
                    
                    <div class="section-title">
                        <span>Выбранные опции</span>
                        <span style="font-weight: normal; font-size: 13px; color: #6b7280;">— нажмите 🎁 чтобы сделать подарком</span>
                    </div>
                    
                    <div class="options-list">
                        {options_html}
                    </div>
                    
                    <div class="summary">
                        <div class="summary-row">
                            <span>Стоимость опций:</span>
                            <span id="optionsTotal">0 zł</span>
                        </div>
                        <div class="summary-row gift-value">
                            <span>🎁 Подарки:</span>
                            <span id="giftsTotal">-{gifts_total:,.0f} zł</span>
                        </div>
                        <div class="summary-row">
                            <span>Скидка:</span>
                            <span id="discountTotal">0 zł</span>
                        </div>
                        <div class="summary-row total">
                            <span>Итого:</span>
                            <span id="finalTotal">{total:,.0f} zł</span>
                        </div>
                    </div>
                    
                    <div id="status" class="status"></div>
                    
                    <div class="actions">
                        <button type="submit" class="btn btn-save" id="saveBtn">
                            <span class="loading" id="loadingSpinner">⏳</span>
                            💾 Сохранить и обновить PDF
                        </button>
                        <a href="javascript:window.close()" class="btn btn-cancel">Закрыть</a>
                    </div>
                </form>
            </div>
        </div>
        
        <script>
            const baseTotal = {total};
            
            function updateSummary() {{
                let optionsTotal = 0;
                let giftsTotal = 0;
                
                document.querySelectorAll('input[name="gifts"]').forEach(cb => {{
                    const price = parseFloat(cb.dataset.price) || 0;
                    optionsTotal += price;
                    if (cb.checked) {{
                        giftsTotal += price;
                    }}
                }});
                
                const discount = parseInt(document.getElementById('discount').value) || 0;
                const discountAmount = Math.round(baseTotal * discount / 100);
                const finalTotal = baseTotal - discountAmount;
                
                document.getElementById('optionsTotal').textContent = optionsTotal.toLocaleString() + ' zł';
                document.getElementById('giftsTotal').textContent = '-' + giftsTotal.toLocaleString() + ' zł';
                document.getElementById('discountTotal').textContent = '-' + discountAmount.toLocaleString() + ' zł';
                document.getElementById('finalTotal').textContent = finalTotal.toLocaleString() + ' zł';
                document.getElementById('totalDisplay').textContent = finalTotal.toLocaleString() + ' zł';
                
                // Update discount badge
                const badge = document.getElementById('discountBadge');
                if (discount > 0) {{
                    badge.style.display = 'inline-block';
                    document.getElementById('discountDisplay').textContent = discount;
                }} else {{
                    badge.style.display = 'none';
                }}
            }}
            
            // Toggle gift visual
            document.querySelectorAll('.gift-toggle input').forEach(cb => {{
                cb.addEventListener('change', function() {{
                    const row = this.closest('.option-row');
                    const priceEl = row.querySelector('.option-price');
                    
                    row.classList.toggle('is-gift', this.checked);
                    priceEl.classList.toggle('gift-price', this.checked);
                    
                    updateSummary();
                }});
            }});
            
            // Discount change
            document.getElementById('discount').addEventListener('input', updateSummary);
            
            // Initial calculation
            updateSummary();
            
            // Form submit
            document.getElementById('giftsForm').addEventListener('submit', async (e) => {{
                e.preventDefault();
                
                const saveBtn = document.getElementById('saveBtn');
                const status = document.getElementById('status');
                const spinner = document.getElementById('loadingSpinner');
                
                saveBtn.disabled = true;
                spinner.classList.add('show');
                status.className = 'status';
                status.textContent = '';
                
                const gifts = [];
                document.querySelectorAll('input[name="gifts"]:checked').forEach(cb => {{
                    gifts.push(cb.value);
                }});
                
                const discount = parseInt(document.getElementById('discount').value) || 0;
                
                try {{
                    const response = await fetch('{base_url}/api/widget/save-gifts/{lead_id}', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{
                            adminGifts: gifts,
                            discountPercent: discount
                        }})
                    }});
                    
                    const result = await response.json();
                    
                    if (response.ok) {{
                        status.className = 'status success';
                        status.textContent = '✅ ' + (result.message || 'Сохранено!');
                        setTimeout(() => window.close(), 2000);
                    }} else {{
                        status.className = 'status error';
                        status.textContent = '❌ ' + (result.detail || 'Ошибка');
                    }}
                }} catch (err) {{
                    status.className = 'status error';
                    status.textContent = '❌ ' + err.message;
                }} finally {{
                    saveBtn.disabled = false;
                    spinner.classList.remove('show');
                }}
            }});
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@router.post("/save-gifts/{lead_id}")
async def save_gifts(lead_id: str, data: dict):
    """Save gifts and discount for an order, regenerate PDF and upload to amoCRM."""
    from routes.amocrm import upload_calculator_pdf_to_amocrm, add_note_to_amocrm, get_amocrm_settings
    
    order, section = get_all_orders_by_amocrm_id(lead_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    order_id = order.get('id')
    admin_gifts = data.get('adminGifts', [])
    discount_percent = data.get('discountPercent', 0)
    
    # Select correct collection
    if section == 'sauna':
        collection = sauna_orders
    elif section == 'balia':
        collection = balia_orders
    else:
        collection = greenhouse_orders
    
    # Track changes
    changes = []
    old_gifts = order.get('adminGifts', [])
    old_discount = order.get('discountPercent', 0)
    
    if set(admin_gifts) != set(old_gifts):
        changes.append({'field': 'adminGifts', 'oldValue': old_gifts, 'newValue': admin_gifts})
    if discount_percent != old_discount:
        changes.append({'field': 'discountPercent', 'oldValue': old_discount, 'newValue': discount_percent})
    
    if not changes:
        return {"message": "Нет изменений для сохранения", "order_id": order_id}
    
    # Update order
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    
    history_entry = {
        'timestamp': now,
        'changes': changes,
        'changedBy': 'amoCRM widget'
    }
    
    change_history = order.get('changeHistory', []) or []
    change_history.append(history_entry)
    
    update_data = {
        'adminGifts': admin_gifts,
        'discountPercent': discount_percent,
        'changeHistory': change_history,
        'updatedAt': now
    }
    
    collection.update_one({'id': order_id}, {'$set': update_data})
    
    # Get base URL for PDF generation
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
    
    # Try to regenerate PDF and upload to amoCRM
    pdf_uploaded = False
    try:
        import httpx
        
        # Get updated order
        updated_order = collection.find_one({'id': order_id}, {'_id': 0})
        
        # Generate PDF
        pdf_endpoint = f"{base_url}/api/sauna/generate-pdf" if section == 'sauna' else f"{base_url}/api/generate-pdf"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            pdf_response = await client.post(pdf_endpoint, json=updated_order)
            
            if pdf_response.status_code == 200:
                pdf_bytes = pdf_response.content
                
                # Upload to amoCRM
                settings = get_amocrm_settings()
                domain = settings.get('amocrm_domain')
                token = settings.get('amocrm_token')
                
                if domain and token:
                    upload_result = await upload_pdf_to_amocrm(
                        lead_id=lead_id,
                        pdf_bytes=pdf_bytes,
                        filename=f"quote_{order_id}.pdf",
                        domain=domain,
                        token=token
                    )
                    pdf_uploaded = upload_result.get('success', False)
                    
                    # Add note about changes
                    changed_fields = ', '.join([c['field'] for c in changes])
                    note_text = f"✏️ Заказ изменён через виджет\n\nИзменения: {changed_fields}"
                    await add_note_to_amocrm(lead_id, note_text, domain, token)
                    
    except Exception as e:
        logger.error(f"Error regenerating PDF: {e}")
    
    return {
        "message": "Изменения сохранены" + (" и PDF обновлён в amoCRM" if pdf_uploaded else ""),
        "order_id": order_id,
        "pdf_uploaded": pdf_uploaded
    }
