"""Telegram notification service for order alerts."""
import os
import httpx
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

def get_telegram_config():
    """Get Telegram configuration from environment."""
    return {
        'bot_token': os.environ.get('TELEGRAM_BOT_TOKEN', ''),
        'chat_id': os.environ.get('TELEGRAM_CHAT_ID', ''),
        'enabled': os.environ.get('TELEGRAM_NOTIFICATIONS_ENABLED', 'true').lower() == 'true'
    }

async def send_telegram_message(text: str, chat_id: str = None, bot_token: str = None) -> bool:
    """Send a message to Telegram chat."""
    config = get_telegram_config()
    
    token = bot_token or config['bot_token']
    target_chat_id = chat_id or config['chat_id']
    
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN not configured")
        return False
    
    if not target_chat_id:
        logger.warning("TELEGRAM_CHAT_ID not configured")
        return False
    
    if not config['enabled']:
        logger.info("Telegram notifications disabled")
        return False
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    
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


def format_order_notification(order: Dict[str, Any], order_type: str = 'balia', is_web_order: bool = False) -> str:
    """Format order data into a Telegram notification message.
    
    Args:
        order: Order data dictionary
        order_type: 'balia' or 'sauna'
        is_web_order: True if order came from website iframe
    """
    
    # Header with emoji based on order type and source
    type_emoji = "🛁" if order_type == 'balia' else "🧖"
    type_name = "BALIA" if order_type == 'balia' else "SAUNA"
    
    if is_web_order:
        header = f"🌐 <b>NOWE ZAMÓWIENIE Z INTERNETU</b>\n📍 Kalkulator: <b>{type_name}</b>"
    else:
        header = f"{type_emoji} <b>NOWE ZAMÓWIENIE - {type_name}</b>"
    
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
            name = opt.get('optionName') or opt.get('name') or opt.get('namePl', '')
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
    
    # Format total with thousands separator
    try:
        total_formatted = f"{float(total):,.0f}".replace(",", " ")
    except:
        total_formatted = str(total)
    
    # Build message
    message = f"""{header}

🔢 <b>Nr:</b> {order_id}
👤 <b>Klient:</b> {customer_name}
📞 <b>Tel:</b> {phone}

{type_emoji} <b>Model:</b> {model_name}{heater_text}{options_text}

💰 <b>Suma:</b> {total_formatted} {currency_symbol}
"""
    
    return message


async def notify_new_order(order: Dict[str, Any], order_type: str = 'balia', is_web_order: bool = False) -> bool:
    """Send notification about a new order.
    
    Args:
        order: Order data dictionary
        order_type: 'balia' or 'sauna'
        is_web_order: True if order came from website iframe
    """
    try:
        message = format_order_notification(order, order_type, is_web_order)
        return await send_telegram_message(message)
    except Exception as e:
        logger.error(f"Failed to send order notification: {e}")
        return False


async def notify_order_status_change(order: Dict[str, Any], new_status: str, order_type: str = 'balia') -> bool:
    """Send notification about order status change."""
    order_id = order.get('id') or order.get('orderId', 'N/A')
    customer_name = order.get('fullName') or order.get('customerName', 'N/A')
    
    type_emoji = "🛁" if order_type == 'balia' else "🧖"
    type_name = "BALIA" if order_type == 'balia' else "SAUNA"
    
    status_emoji = {
        'new': '🆕',
        'processing': '⏳',
        'completed': '✅',
        'cancelled': '❌',
        'transferred': '📤'
    }
    
    emoji = status_emoji.get(new_status, '📋')
    
    message = f"""{emoji} <b>ZMIANA STATUSU - {type_name}</b>

🔢 Nr: {order_id}
👤 Klient: {customer_name}
📊 Nowy status: <b>{new_status}</b>
"""
    
    return await send_telegram_message(message)


async def test_telegram_connection(bot_token: str, chat_id: str) -> Dict[str, Any]:
    """Test Telegram bot connection and send test message."""
    try:
        # First, verify bot token
        async with httpx.AsyncClient() as client:
            bot_response = await client.get(
                f"https://api.telegram.org/bot{bot_token}/getMe",
                timeout=10.0
            )
            
            if bot_response.status_code != 200:
                return {"success": False, "error": "Invalid bot token"}
            
            bot_data = bot_response.json()
            if not bot_data.get('ok'):
                return {"success": False, "error": "Bot token verification failed"}
            
            bot_info = bot_data.get('result', {})
            
            # Try to send test message
            test_response = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": "✅ <b>Test połączenia udany!</b>\n\nBot jest poprawnie skonfigurowany i gotowy do wysyłania powiadomień o zamówieniach.",
                    "parse_mode": "HTML"
                },
                timeout=10.0
            )
            
            if test_response.status_code == 200 and test_response.json().get('ok'):
                return {
                    "success": True,
                    "bot_name": bot_info.get('first_name', ''),
                    "bot_username": bot_info.get('username', ''),
                    "message": "Test message sent successfully"
                }
            else:
                error_desc = test_response.json().get('description', 'Unknown error')
                return {"success": False, "error": f"Failed to send message: {error_desc}"}
                
    except Exception as e:
        return {"success": False, "error": str(e)}
