"""Telegram notification service for order alerts and backup delivery."""
import os
import httpx
import logging
from typing import Optional, Dict, Any, List
from io import BytesIO

logger = logging.getLogger(__name__)

def get_telegram_config():
    """Get Telegram configuration from environment."""
    return {
        'bot_token': os.environ.get('TELEGRAM_BOT_TOKEN', ''),
        'chat_id': os.environ.get('TELEGRAM_CHAT_ID', ''),
        'backup_chat_id': os.environ.get('TELEGRAM_BACKUP_CHAT_ID', ''),
        'enabled': os.environ.get('TELEGRAM_NOTIFICATIONS_ENABLED', 'true').lower() == 'true'
    }


def get_production_telegram_config():
    """Get Telegram configuration for the SEPARATE production/forum bot.

    Uses a dedicated bot + supergroup (with Topics enabled) so it never
    interferes with the order-notification / backup bot above.
    """
    return {
        'bot_token': os.environ.get('TELEGRAM_PRODUCTION_BOT_TOKEN', ''),
        'chat_id': os.environ.get('TELEGRAM_PRODUCTION_CHAT_ID', ''),
    }


async def create_forum_topic(
    name: str,
    chat_id: str = None,
    bot_token: str = None,
    icon_color: int = None,
    icon_custom_emoji_id: str = None,
) -> Dict[str, Any]:
    """Create a forum topic (Topic) in a Telegram supergroup.

    Calls Bot API `createForumTopic`. The supergroup must have Topics/Forum
    enabled and the bot must be an admin with `can_manage_topics` rights.

    Args:
        name: Topic name (1-128 chars), e.g. "#1234 Kowalski — Sauna Kwadro 4m"
        chat_id: Target supergroup chat id (defaults to production chat)
        bot_token: Bot token (defaults to production bot)
        icon_color: Optional topic icon color (RGB int accepted by Telegram)
        icon_custom_emoji_id: Optional custom-emoji icon id (from getForumTopicIconStickers)

    Returns:
        Dict with success status. On success includes `message_thread_id`.
    """
    config = get_production_telegram_config()

    token = bot_token or config['bot_token']
    target_chat_id = chat_id or config['chat_id']

    if not token:
        return {"success": False, "error": "TELEGRAM_PRODUCTION_BOT_TOKEN not configured"}

    if not target_chat_id:
        return {"success": False, "error": "TELEGRAM_PRODUCTION_CHAT_ID not configured"}

    url = f"https://api.telegram.org/bot{token}/createForumTopic"

    payload = {
        "chat_id": target_chat_id,
        "name": name[:128],
    }
    if icon_custom_emoji_id is not None:
        payload["icon_custom_emoji_id"] = icon_custom_emoji_id
    elif icon_color is not None:
        payload["icon_color"] = icon_color

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=15.0)

            data = response.json()
            if response.status_code == 200 and data.get('ok'):
                result = data.get('result', {})
                return {
                    "success": True,
                    "message_thread_id": result.get('message_thread_id'),
                    "name": result.get('name', name),
                }
            else:
                error_desc = data.get('description', f"HTTP {response.status_code}")
                logger.error(f"Telegram createForumTopic error: {error_desc}")
                return {"success": False, "error": error_desc}
    except Exception as e:
        logger.error(f"Failed to create forum topic: {e}")
        return {"success": False, "error": str(e)}


async def _forum_topic_action(method: str, payload: dict, bot_token: str = None) -> Dict[str, Any]:
    """Generic Bot API call for forum-topic management (edit/close/reopen)."""
    config = get_production_telegram_config()
    token = bot_token or config['bot_token']
    if not token:
        return {"success": False, "error": "TELEGRAM_PRODUCTION_BOT_TOKEN not configured"}
    url = f"https://api.telegram.org/bot{token}/{method}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=15.0)
            data = response.json()
            if response.status_code == 200 and data.get('ok'):
                return {"success": True}
            return {"success": False, "error": data.get('description', f"HTTP {response.status_code}")}
    except Exception as e:
        logger.error(f"Telegram {method} failed: {e}")
        return {"success": False, "error": str(e)}


async def edit_forum_topic(message_thread_id: int, name: str = None, icon_color: int = None,
                           icon_custom_emoji_id: str = None,
                           chat_id: str = None, bot_token: str = None) -> Dict[str, Any]:
    """Edit a forum topic name / icon (Bot API editForumTopic).

    Note: editForumTopic supports name + icon_custom_emoji_id. icon_color is
    only reliably applied at creation, so custom-emoji icons are preferred here.
    """
    config = get_production_telegram_config()
    payload = {"chat_id": chat_id or config['chat_id'], "message_thread_id": message_thread_id}
    if name is not None:
        payload["name"] = name[:128]
    if icon_custom_emoji_id is not None:
        payload["icon_custom_emoji_id"] = icon_custom_emoji_id
    elif icon_color is not None:
        payload["icon_color"] = icon_color
    return await _forum_topic_action("editForumTopic", payload, bot_token)


async def close_forum_topic(message_thread_id: int, chat_id: str = None, bot_token: str = None) -> Dict[str, Any]:
    """Close (not delete) a forum topic — history stays (Bot API closeForumTopic)."""
    config = get_production_telegram_config()
    payload = {"chat_id": chat_id or config['chat_id'], "message_thread_id": message_thread_id}
    return await _forum_topic_action("closeForumTopic", payload, bot_token)


async def reopen_forum_topic(message_thread_id: int, chat_id: str = None, bot_token: str = None) -> Dict[str, Any]:
    """Reopen a previously closed forum topic (Bot API reopenForumTopic)."""
    config = get_production_telegram_config()
    payload = {"chat_id": chat_id or config['chat_id'], "message_thread_id": message_thread_id}
    return await _forum_topic_action("reopenForumTopic", payload, bot_token)

async def send_telegram_message(text: str, chat_id: str = None, bot_token: str = None, message_thread_id: int = None) -> bool:
    """Send a message to Telegram chat.

    If message_thread_id is provided, the message is posted into that forum
    topic (Topic). When omitted, behaviour is unchanged (backward compatible).
    """
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
    
    payload = {
        "chat_id": target_chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    if message_thread_id is not None:
        payload["message_thread_id"] = message_thread_id

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)
            
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
    elif order.get('dealerOrder'):
        header = f"🤝 <b>NOWE ZAMÓWIENIE OD DEALERA</b>\n📍 Kalkulator: <b>{type_name}</b>"
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
    dealer_block = ""
    if order.get('dealerOrder'):
        dealer_name = order.get('dealerName') or '—'
        contract = order.get('dealerContractNumber') or ''
        dealer_block = f"\n🏢 <b>Dealer:</b> {dealer_name}"
        if contract:
            dealer_block += f"\n📄 <b>Nr umowy:</b> {contract}"

    message = f"""{header}

🔢 <b>Nr:</b> {order_id}
👤 <b>Klient:</b> {customer_name}
📞 <b>Tel:</b> {phone}{dealer_block}

{type_emoji} <b>Model:</b> {model_name}{heater_text}{options_text}

💰 <b>Suma:</b> {total_formatted} {currency_symbol}
"""
    
    return message


async def notify_new_order(order: Dict[str, Any], order_type: str = 'balia', is_web_order: bool = False, pdf_data: bytes = None) -> bool:
    """Send notification about a new order, optionally with PDF attachment.
    
    Args:
        order: Order data dictionary
        order_type: 'balia' or 'sauna'
        is_web_order: True if order came from website iframe
        pdf_data: Optional PDF file bytes to attach
    """
    try:
        message = format_order_notification(order, order_type, is_web_order)
        
        # If PDF provided, send as document with caption
        if pdf_data:
            order_id = order.get('id') or order.get('orderId', 'unknown')
            customer_name = order.get('fullName') or order.get('customerName', 'Klient')
            safe_name = customer_name.replace(' ', '_')
            safe_name = ''.join(c for c in safe_name if c not in '<>:"/\\|?*')
            
            type_prefix = "BALIA" if order_type == 'balia' else "SAUNA"
            filename = f"{type_prefix}_{safe_name}_{order_id}.pdf"
            
            result = await send_telegram_file(
                file_data=pdf_data,
                filename=filename,
                caption=message,
                chat_id=None,  # Use default from config
                bot_token=None
            )
            return result.get('success', False)
        else:
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


async def send_telegram_file(
    file_data: bytes, 
    filename: str, 
    caption: str = "", 
    chat_id: str = None, 
    bot_token: str = None,
    message_thread_id: int = None
) -> Dict[str, Any]:
    """Send a file to Telegram chat.
    
    Args:
        file_data: File content as bytes
        filename: Name of the file
        caption: Optional caption for the file
        chat_id: Target chat ID (uses backup_chat_id from config if not provided)
        bot_token: Bot token (uses config if not provided)
        message_thread_id: Optional forum topic id to post the file into
    
    Returns:
        Dict with success status and details
    """
    config = get_telegram_config()
    
    token = bot_token or config['bot_token']
    target_chat_id = chat_id or config['backup_chat_id'] or config['chat_id']
    
    if not token:
        return {"success": False, "error": "TELEGRAM_BOT_TOKEN not configured"}
    
    if not target_chat_id:
        return {"success": False, "error": "Chat ID not configured"}
    
    url = f"https://api.telegram.org/bot{token}/sendDocument"
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Prepare multipart form data
            files = {
                'document': (filename, file_data, 'application/zip')
            }
            data = {
                'chat_id': target_chat_id,
                'caption': caption,
                'parse_mode': 'HTML'
            }
            if message_thread_id is not None:
                data['message_thread_id'] = message_thread_id
            
            response = await client.post(url, files=files, data=data)
            
            if response.status_code == 200 and response.json().get('ok'):
                result = response.json().get('result', {})
                document = result.get('document', {})
                return {
                    "success": True,
                    "file_id": document.get('file_id', ''),
                    "file_size": document.get('file_size', 0),
                    "message_id": result.get('message_id', 0)
                }
            else:
                error_desc = response.json().get('description', 'Unknown error')
                logger.error(f"Telegram API error: {response.status_code} - {error_desc}")
                return {"success": False, "error": error_desc}
                
    except Exception as e:
        logger.error(f"Failed to send Telegram file: {e}")
        return {"success": False, "error": str(e)}


async def send_backup_to_telegram(
    backup_data: bytes, 
    backup_info: Dict[str, Any],
    chat_id: str = None,
    bot_token: str = None
) -> Dict[str, Any]:
    """Send backup file to Telegram with formatted caption.
    
    Args:
        backup_data: ZIP file content as bytes
        backup_info: Backup metadata (collections, date, etc.)
        chat_id: Target chat ID
        bot_token: Bot token
    
    Returns:
        Dict with success status and details
    """
    from datetime import datetime
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M')
    filename = f"backup_{timestamp}.zip"
    
    # Format caption with backup info
    collections_info = backup_info.get('collections', [])
    total_items = sum(c.get('count', 0) for c in collections_info)
    
    # Format file size
    size_bytes = len(backup_data)
    if size_bytes > 1024 * 1024:
        size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
    elif size_bytes > 1024:
        size_str = f"{size_bytes / 1024:.1f} KB"
    else:
        size_str = f"{size_bytes} B"
    
    caption = f"""💾 <b>Backup - {timestamp}</b>

📊 <b>Статистика:</b>
• Коллекций: {len(collections_info)}
• Всего записей: {total_items}
• Размер: {size_str}

📁 <b>Содержимое:</b>
"""
    
    # Add collection details (compact)
    for col in collections_info[:8]:  # Max 8 to fit caption limit
        caption += f"• {col.get('name', 'unknown')}: {col.get('count', 0)}\n"
    
    if len(collections_info) > 8:
        caption += f"• ... и ещё {len(collections_info) - 8} коллекций"
    
    return await send_telegram_file(
        file_data=backup_data,
        filename=filename,
        caption=caption,
        chat_id=chat_id,
        bot_token=bot_token
    )


async def test_backup_chat_connection(bot_token: str, chat_id: str) -> Dict[str, Any]:
    """Test connection to backup Telegram chat."""
    try:
        async with httpx.AsyncClient() as client:
            # Verify bot token
            bot_response = await client.get(
                f"https://api.telegram.org/bot{bot_token}/getMe",
                timeout=10.0
            )
            
            if bot_response.status_code != 200:
                return {"success": False, "error": "Неверный токен бота"}
            
            bot_data = bot_response.json()
            if not bot_data.get('ok'):
                return {"success": False, "error": "Ошибка верификации токена"}
            
            bot_info = bot_data.get('result', {})
            
            # Try to send test message
            test_response = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": "✅ <b>Тест подключения для бэкапов успешен!</b>\n\nЭтот чат будет использоваться для автоматических резервных копий.",
                    "parse_mode": "HTML"
                },
                timeout=10.0
            )
            
            if test_response.status_code == 200 and test_response.json().get('ok'):
                return {
                    "success": True,
                    "bot_name": bot_info.get('first_name', ''),
                    "bot_username": bot_info.get('username', ''),
                    "message": "Тестовое сообщение отправлено"
                }
            else:
                error_desc = test_response.json().get('description', 'Unknown error')
                if 'chat not found' in error_desc.lower():
                    return {"success": False, "error": "Чат не найден. Убедитесь, что бот добавлен в чат."}
                return {"success": False, "error": f"Ошибка отправки: {error_desc}"}
                
    except Exception as e:
        return {"success": False, "error": str(e)}
