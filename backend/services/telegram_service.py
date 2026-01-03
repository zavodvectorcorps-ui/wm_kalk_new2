"""Telegram notification service for order alerts."""
import os
import httpx
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')

async def send_telegram_message(text: str, chat_id: str = None) -> bool:
    """Send a message to Telegram chat."""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not configured")
        return False
    
    target_chat_id = chat_id or TELEGRAM_CHAT_ID
    if not target_chat_id:
        logger.warning("TELEGRAM_CHAT_ID not configured")
        return False
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={
                "chat_id": target_chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            }, timeout=10.0)
            
            if response.status_code == 200:
                logger.info(f"Telegram notification sent successfully")
                return True
            else:
                logger.error(f"Telegram API error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")
        return False


def format_order_notification(order: Dict[str, Any], is_web_order: bool = False) -> str:
    """Format order data into a Telegram notification message."""
    
    # Header with emoji based on order type
    if is_web_order:
        header = "🌐 <b>NOWE ZAMÓWIENIE Z INTERNETU</b>"
    else:
        header = "📋 <b>NOWE ZAMÓWIENIE</b>"
    
    # Order ID
    order_id = order.get('id') or order.get('orderId', 'N/A')
    
    # Customer info
    customer_name = order.get('fullName') or order.get('customerName', 'N/A')
    phone = order.get('phoneNumber') or order.get('customerPhone', '')
    
    # Model info
    model_name = order.get('modelName', 'N/A')
    heater_type = order.get('heaterType', '')
    heater_text = ""
    if heater_type:
        heater_text = " (zintegrowany)" if heater_type == 'integrated' else " (zewnętrzny)"
    
    # Options - short list
    options_text = ""
    selected_options = order.get('selectedOptions', [])
    if selected_options:
        option_names = []
        for opt in selected_options[:5]:  # Max 5 options
            name = opt.get('optionName') or opt.get('name', '')
            if name:
                option_names.append(name)
        if option_names:
            options_text = "\n📦 <b>Opcje:</b> " + ", ".join(option_names)
            if len(selected_options) > 5:
                options_text += f" (+{len(selected_options) - 5} więcej)"
    
    # Total
    total = order.get('total', 0)
    currency = order.get('currency', 'PLN')
    currency_symbol = order.get('currencySymbol', 'zł')
    
    # Build message
    message = f"""{header}

🔢 <b>Nr:</b> {order_id}
👤 <b>Klient:</b> {customer_name}
📞 <b>Tel:</b> {phone}

🛁 <b>Model:</b> {model_name}{heater_text}{options_text}

💰 <b>Suma:</b> {total:,.0f} {currency_symbol}
"""
    
    return message


async def notify_new_order(order: Dict[str, Any], is_web_order: bool = False) -> bool:
    """Send notification about a new order."""
    try:
        message = format_order_notification(order, is_web_order)
        return await send_telegram_message(message)
    except Exception as e:
        logger.error(f"Failed to send order notification: {e}")
        return False


async def notify_order_status_change(order: Dict[str, Any], new_status: str) -> bool:
    """Send notification about order status change."""
    order_id = order.get('id') or order.get('orderId', 'N/A')
    customer_name = order.get('fullName') or order.get('customerName', 'N/A')
    
    status_emoji = {
        'new': '🆕',
        'processing': '⏳',
        'completed': '✅',
        'cancelled': '❌',
        'transferred': '📤'
    }
    
    emoji = status_emoji.get(new_status, '📋')
    
    message = f"""{emoji} <b>ZMIANA STATUSU</b>

🔢 Nr: {order_id}
👤 Klient: {customer_name}
📊 Nowy status: <b>{new_status}</b>
"""
    
    return await send_telegram_message(message)
