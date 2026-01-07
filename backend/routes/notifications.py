"""Notifications API - Push notifications and Telegram for drivers."""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import logging
import json
import httpx
import base64

from pymongo import MongoClient
from services.auth_service import get_current_user, get_admin_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
notification_subscriptions = db["notification_subscriptions"]
notification_settings = db["notification_settings"]
notification_history = db["notification_history"]  # History of sent notifications
drivers_collection = db["drivers"]


def convert_pem_to_raw_vapid(pem_key: str) -> str:
    """Convert PEM format VAPID private key to raw base64url format."""
    if not pem_key.startswith("-----BEGIN"):
        return pem_key  # Already in raw format
    
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend
        
        # Load the PEM key
        private_key = serialization.load_pem_private_key(
            pem_key.encode(),
            password=None,
            backend=default_backend()
        )
        
        # Extract raw private value (32 bytes for P-256)
        private_numbers = private_key.private_numbers()
        raw_private = private_numbers.private_value.to_bytes(32, 'big')
        
        # Convert to base64url (no padding)
        raw_base64url = base64.urlsafe_b64encode(raw_private).rstrip(b'=').decode('ascii')
        logger.info(f"Converted PEM VAPID key to raw format: {raw_base64url[:20]}...")
        return raw_base64url
    except Exception as e:
        logger.error(f"Failed to convert PEM to raw VAPID: {e}")
        return pem_key  # Return original on error


def get_vapid_private_key() -> str:
    """Get VAPID private key in correct raw base64url format."""
    key = os.environ.get("VAPID_PRIVATE_KEY", "")
    return convert_pem_to_raw_vapid(key)
drivers_collection = db["drivers"]
trips_collection = db["trips"]


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict
    userId: Optional[str] = None
    driverId: Optional[str] = None


class TelegramSettings(BaseModel):
    botToken: str
    enabled: bool = True


class DriverTelegramLink(BaseModel):
    driverId: str
    chatId: str


# ============= Push Notifications =============

@router.get("/vapid-check")
async def check_vapid_keys():
    """Check if VAPID keys are properly configured."""
    vapid_private_raw = os.environ.get("VAPID_PRIVATE_KEY", "")
    vapid_private_converted = get_vapid_private_key()  # Auto-converted
    vapid_public = os.environ.get("VAPID_PUBLIC_KEY", "")
    vapid_email = os.environ.get("VAPID_CLAIMS_EMAIL", "")
    
    is_pem = vapid_private_raw.startswith("-----BEGIN")
    
    result = {
        "original_key_length": len(vapid_private_raw),
        "original_key_format": "PEM" if is_pem else "raw base64url",
        "converted_key_length": len(vapid_private_converted),
        "auto_converted": is_pem,
        "public_key_length": len(vapid_public),
        "claims_email": vapid_email,
        "valid": False,
        "error": None
    }
    
    # Try to use the converted key
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info={"endpoint": "https://test.invalid", "keys": {"p256dh": "test", "auth": "test"}},
            data="test",
            vapid_private_key=vapid_private_converted,
            vapid_claims={"sub": vapid_email or "mailto:test@test.com"}
        )
    except WebPushException as e:
        error_str = str(e)
        if "Could not deserialize key" in error_str:
            result["error"] = "Ключ не может быть десериализован даже после конвертации"
        else:
            # Any other WebPushException means the key format is valid
            result["valid"] = True
    except Exception as e:
        # Other exceptions also likely mean key is valid
        result["valid"] = True
    
    result["original_key_preview"] = vapid_private_raw[:25] + "..." if vapid_private_raw else "не задан"
    result["converted_key_preview"] = vapid_private_converted[:25] + "..." if vapid_private_converted else "не задан"
    result["public_key_preview"] = vapid_public[:30] + "..." if vapid_public else "не задан"
    
    if is_pem and result["valid"]:
        result["message"] = "PEM ключ автоматически конвертирован в raw формат ✅"
    
    return result


@router.get("/subscriptions")
async def list_all_subscriptions(admin: dict = Depends(get_admin_user)):
    """List all push subscriptions (admin only)."""
    subscriptions = list(notification_subscriptions.find({}, {"_id": 0, "keys": 0}))
    
    # Get driver names
    drivers = {d["id"]: d.get("name", "Unknown") for d in drivers_collection.find({}, {"_id": 0, "id": 1, "name": 1})}
    
    result = []
    for sub in subscriptions:
        result.append({
            "userId": sub.get("userId"),
            "driverId": sub.get("driverId"),
            "driverName": drivers.get(sub.get("driverId"), "Unknown"),
            "active": sub.get("active", True),
            "endpoint_preview": sub.get("endpoint", "")[:60] + "...",
            "createdAt": sub.get("createdAt")
        })
    
    return {"count": len(result), "subscriptions": result}


@router.post("/subscribe")
async def subscribe_to_push(
    subscription: PushSubscription,
    current_user: dict = Depends(get_current_user)
):
    """Subscribe to push notifications."""
    user_id = current_user.get("sub")
    
    # Find driver linked to user
    driver = drivers_collection.find_one({"userId": user_id}, {"_id": 0})
    driver_id = driver.get("id") if driver else None
    
    # Save subscription
    sub_data = {
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "userId": user_id,
        "driverId": driver_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "active": True
    }
    
    # Upsert by endpoint
    notification_subscriptions.update_one(
        {"endpoint": subscription.endpoint},
        {"$set": sub_data},
        upsert=True
    )
    
    logger.info(f"Push subscription saved for user {user_id}")
    return {"status": "ok", "message": "Подписка сохранена"}


@router.delete("/unsubscribe")
async def unsubscribe_from_push(
    endpoint: str,
    current_user: dict = Depends(get_current_user)
):
    """Unsubscribe from push notifications."""
    result = notification_subscriptions.delete_one({"endpoint": endpoint})
    
    if result.deleted_count > 0:
        return {"status": "ok", "message": "Подписка удалена"}
    return {"status": "not_found", "message": "Подписка не найдена"}


async def send_push_notification(user_id: str = None, driver_id: str = None, title: str = "", body: str = "", data: dict = None) -> dict:
    """Send push notification to user or driver. Returns dict with result details."""
    result = {"success": False, "sent": 0, "total": 0, "errors": [], "removed": 0}
    
    try:
        # Find subscriptions - check both userId and driverId
        query = {"active": True}
        if user_id and driver_id:
            query["$or"] = [{"userId": user_id}, {"driverId": driver_id}]
        elif driver_id:
            query["driverId"] = driver_id
        elif user_id:
            query["userId"] = user_id
        else:
            logger.warning("No user_id or driver_id provided for push notification")
            result["errors"].append("No user_id or driver_id provided")
            return result
        
        subscriptions = list(notification_subscriptions.find(query, {"_id": 0}))
        result["total"] = len(subscriptions)
        
        if not subscriptions:
            logger.info(f"No push subscriptions found for driver={driver_id}, user={user_id}")
            return result
        
        logger.info(f"Found {len(subscriptions)} subscriptions for driver={driver_id}, user={user_id}")
        
        # Get VAPID keys - auto-convert PEM to raw format
        vapid_private_key = get_vapid_private_key()
        vapid_claims_email = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:admin@wm-kalkulator.pl")
        
        if not vapid_private_key:
            logger.warning("VAPID private key not configured in environment")
            result["errors"].append("VAPID ключ не настроен на сервере")
            return result
        
        # Send push notifications using pywebpush
        from pywebpush import webpush, WebPushException
        import json
        
        payload = json.dumps({
            "title": title,
            "body": body,
            "data": data or {},
            "icon": "/logo192.png",
            "badge": "/logo192.png"
        })
        
        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.get("endpoint"),
                    "keys": sub.get("keys", {})
                }
                
                endpoint_short = sub.get('endpoint', '')[:60]
                logger.info(f"Sending push to endpoint: {endpoint_short}...")
                
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=vapid_private_key,
                    vapid_claims={"sub": vapid_claims_email}
                )
                result["sent"] += 1
                logger.info(f"Push sent successfully")
            except WebPushException as e:
                error_msg = str(e)
                status_code = e.response.status_code if e.response else None
                logger.error(f"WebPush failed (status={status_code}): {error_msg[:200]}")
                
                # Simplify error message for user
                if status_code == 410:
                    result["errors"].append("Подписка устарела (410 Gone)")
                    notification_subscriptions.delete_one({"endpoint": sub.get("endpoint")})
                    result["removed"] += 1
                elif status_code == 404:
                    result["errors"].append("Подписка не найдена (404)")
                    notification_subscriptions.delete_one({"endpoint": sub.get("endpoint")})
                    result["removed"] += 1
                elif status_code == 401:
                    result["errors"].append("Ошибка авторизации VAPID (401)")
                elif status_code == 403:
                    result["errors"].append("VAPID ключи не совпадают (403)")
                else:
                    result["errors"].append(f"WebPush ошибка ({status_code})")
                    
            except Exception as e:
                error_msg = str(e)[:100]
                logger.error(f"Push error: {error_msg}")
                result["errors"].append(f"Ошибка: {error_msg}")
        
        result["success"] = result["sent"] > 0
        logger.info(f"Push result: sent={result['sent']}/{result['total']}, removed={result['removed']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in send_push_notification: {e}")
        result["errors"].append(f"Внутренняя ошибка: {str(e)[:100]}")
        return result


# ============= Telegram Notifications =============

@router.get("/telegram/settings")
async def get_telegram_settings(admin: dict = Depends(get_admin_user)):
    """Get Telegram bot settings."""
    settings = notification_settings.find_one({"type": "telegram"}, {"_id": 0})
    if not settings:
        return {"enabled": False, "botToken": "", "botUsername": ""}
    
    # Mask token for security
    token = settings.get("botToken", "")
    masked_token = token[:10] + "..." + token[-5:] if len(token) > 15 else "***"
    
    return {
        "enabled": settings.get("enabled", False),
        "botToken": masked_token,
        "botUsername": settings.get("botUsername", ""),
        "linkedDrivers": settings.get("linkedDriversCount", 0)
    }


@router.post("/telegram/settings")
async def save_telegram_settings(
    settings: TelegramSettings,
    admin: dict = Depends(get_admin_user)
):
    """Save Telegram bot settings."""
    # Verify bot token
    bot_username = ""
    if settings.botToken and settings.enabled:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"https://api.telegram.org/bot{settings.botToken}/getMe")
                data = response.json()
                if data.get("ok"):
                    bot_username = data["result"].get("username", "")
                else:
                    raise HTTPException(status_code=400, detail="Неверный токен бота")
        except httpx.RequestError:
            raise HTTPException(status_code=400, detail="Не удалось проверить токен")
    
    notification_settings.update_one(
        {"type": "telegram"},
        {"$set": {
            "type": "telegram",
            "botToken": settings.botToken,
            "enabled": settings.enabled,
            "botUsername": bot_username,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"status": "ok", "botUsername": bot_username}


@router.post("/telegram/link-driver")
async def link_driver_telegram(
    link: DriverTelegramLink,
    admin: dict = Depends(get_admin_user)
):
    """Link Telegram chat ID to a driver."""
    # Update driver with telegram chat ID
    result = drivers_collection.update_one(
        {"id": link.driverId},
        {"$set": {
            "telegramChatId": link.chatId,
            "telegramLinkedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    
    # Update linked count
    linked_count = drivers_collection.count_documents({"telegramChatId": {"$exists": True, "$ne": None}})
    notification_settings.update_one(
        {"type": "telegram"},
        {"$set": {"linkedDriversCount": linked_count}}
    )
    
    return {"status": "ok", "message": "Telegram привязан к водителю"}


@router.get("/telegram/link-code/{driver_id}")
async def get_telegram_link_code(driver_id: str, admin: dict = Depends(get_admin_user)):
    """Generate a link code for driver to connect Telegram."""
    import uuid
    
    # Generate unique code
    code = uuid.uuid4().hex[:8].upper()
    
    # Store code with driver ID
    db.telegram_link_codes.update_one(
        {"driverId": driver_id},
        {"$set": {
            "driverId": driver_id,
            "code": code,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "used": False
        }},
        upsert=True
    )
    
    # Get bot username
    settings = notification_settings.find_one({"type": "telegram"}, {"_id": 0})
    bot_username = settings.get("botUsername", "") if settings else ""
    
    return {
        "code": code,
        "botUsername": bot_username,
        "deepLink": f"https://t.me/{bot_username}?start={code}" if bot_username else None
    }


async def send_telegram_notification(driver_id: str, message: str, parse_mode: str = "HTML"):
    """Send Telegram notification to a driver."""
    try:
        # Get driver's telegram chat ID
        driver = drivers_collection.find_one({"id": driver_id}, {"_id": 0})
        if not driver or not driver.get("telegramChatId"):
            logger.info(f"Driver {driver_id} has no Telegram linked")
            return False
        
        chat_id = driver["telegramChatId"]
        
        # Get bot token
        settings = notification_settings.find_one({"type": "telegram"}, {"_id": 0})
        if not settings or not settings.get("enabled") or not settings.get("botToken"):
            logger.info("Telegram notifications disabled or not configured")
            return False
        
        bot_token = settings["botToken"]
        
        # Send message
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": parse_mode
                }
            )
            
            if response.status_code == 200:
                logger.info(f"Telegram notification sent to driver {driver_id}")
                return True
            else:
                logger.error(f"Telegram API error: {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Error sending Telegram notification: {e}")
        return False


# ============= Webhook for Telegram Bot =============

@router.post("/telegram/webhook")
async def telegram_webhook(request_data: dict):
    """Handle incoming Telegram messages (for /start command with link code)."""
    try:
        message = request_data.get("message", {})
        text = message.get("text", "")
        chat_id = message.get("chat", {}).get("id")
        
        if not chat_id:
            return {"ok": True}
        
        # Handle /start command with link code
        if text.startswith("/start "):
            code = text.split(" ", 1)[1].strip().upper()
            
            # Find link code
            link_data = db.telegram_link_codes.find_one({"code": code, "used": False})
            
            if link_data:
                driver_id = link_data["driverId"]
                
                # Link driver to this chat
                drivers_collection.update_one(
                    {"id": driver_id},
                    {"$set": {
                        "telegramChatId": str(chat_id),
                        "telegramLinkedAt": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Mark code as used
                db.telegram_link_codes.update_one(
                    {"code": code},
                    {"$set": {"used": True, "usedAt": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Get driver name
                driver = drivers_collection.find_one({"id": driver_id}, {"_id": 0})
                driver_name = driver.get("name", "Водитель") if driver else "Водитель"
                
                # Send confirmation
                settings = notification_settings.find_one({"type": "telegram"}, {"_id": 0})
                if settings and settings.get("botToken"):
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"https://api.telegram.org/bot{settings['botToken']}/sendMessage",
                            json={
                                "chat_id": chat_id,
                                "text": f"✅ Привет, {driver_name}!\n\nВаш аккаунт успешно привязан. Теперь вы будете получать уведомления о новых рейсах."
                            }
                        )
                
                # Update linked count
                linked_count = drivers_collection.count_documents({"telegramChatId": {"$exists": True, "$ne": None}})
                notification_settings.update_one(
                    {"type": "telegram"},
                    {"$set": {"linkedDriversCount": linked_count}}
                )
                
        elif text == "/start":
            # Just /start without code
            settings = notification_settings.find_one({"type": "telegram"}, {"_id": 0})
            if settings and settings.get("botToken"):
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://api.telegram.org/bot{settings['botToken']}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": "👋 Привет! Это бот WM-Group для уведомлений водителей.\n\nДля привязки аккаунта используйте ссылку из системы логистики."
                        }
                    )
        
        return {"ok": True}
        
    except Exception as e:
        logger.error(f"Error in Telegram webhook: {e}")
        return {"ok": True}


# ============= Notification Trigger Functions =============

async def notify_driver_new_trip(trip_id: str, driver_id: str, background_tasks: BackgroundTasks = None):
    """Notify driver about new trip assignment."""
    trip = trips_collection.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        return
    
    driver = drivers_collection.find_one({"id": driver_id}, {"_id": 0})
    driver_name = driver.get("name", "Водитель") if driver else "Водитель"
    
    orders_count = len(trip.get("orderIds", []))
    departure_date = trip.get("departureDate", "")
    if departure_date:
        try:
            dt = datetime.fromisoformat(departure_date.replace("Z", "+00:00"))
            departure_date = dt.strftime("%d.%m.%Y")
        except:
            pass
    
    # Build message
    message = f"""🚛 <b>Новый рейс!</b>

<b>Рейс:</b> {trip.get('name', 'Без названия')}
<b>Заказов:</b> {orders_count}
<b>Дата:</b> {departure_date or 'Не указана'}

Откройте кабинет водителя для просмотра деталей."""

    push_body = f"Рейс: {trip.get('name')} • {orders_count} заказов"
    
    # Send notifications
    await send_telegram_notification(driver_id, message)
    await send_push_notification(
        driver_id=driver_id,
        title="Новый рейс назначен",
        body=push_body,
        data={"tripId": trip_id, "action": "open_trip"}
    )


@router.post("/test/{driver_id}")
async def send_test_notification(
    driver_id: str,
    admin: dict = Depends(get_admin_user)
):
    """Send test notification to driver."""
    driver = drivers_collection.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    
    # Send test telegram
    telegram_sent = await send_telegram_notification(
        driver_id,
        "🔔 <b>Тестовое уведомление</b>\n\nЭто тестовое сообщение из системы WM-Group."
    )
    
    # Send test push
    await send_push_notification(
        driver_id=driver_id,
        title="Тестовое уведомление",
        body="Это тестовое push-уведомление",
        data={"test": True}
    )
    
    return {
        "status": "ok",
        "telegram": "sent" if telegram_sent else "not_linked",
        "push": "queued"
    }



class CustomNotificationRequest(BaseModel):
    driverId: str
    message: str


@router.get("/debug/driver/{driver_id}")
async def debug_driver_notifications(
    driver_id: str,
    admin: dict = Depends(get_admin_user)
):
    """Debug endpoint to check driver notification setup."""
    # Get driver info
    driver = drivers_collection.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        return {"error": "Водитель не найден", "driver_id": driver_id}
    
    driver_user_id = driver.get("userId")
    
    # Find all subscriptions for this driver
    query = {"active": True}
    if driver_user_id:
        query["$or"] = [{"userId": driver_user_id}, {"driverId": driver_id}]
    else:
        query["driverId"] = driver_id
    
    subscriptions = list(notification_subscriptions.find(query, {"_id": 0}))
    
    # Get VAPID key status
    vapid_configured = bool(os.environ.get("VAPID_PRIVATE_KEY", ""))
    
    # Get telegram status
    telegram_settings = notification_settings.find_one({"type": "telegram"}, {"_id": 0})
    telegram_enabled = telegram_settings and telegram_settings.get("enabled") and telegram_settings.get("botToken")
    
    return {
        "driver": {
            "id": driver_id,
            "name": driver.get("name"),
            "userId": driver_user_id,
            "telegramChatId": driver.get("telegramChatId")
        },
        "push_notifications": {
            "vapid_configured": vapid_configured,
            "subscriptions_count": len(subscriptions),
            "subscriptions": [{
                "userId": s.get("userId"),
                "driverId": s.get("driverId"),
                "endpoint_prefix": s.get("endpoint", "")[:50] + "...",
                "created": s.get("createdAt")
            } for s in subscriptions]
        },
        "telegram": {
            "enabled": telegram_enabled,
            "driver_linked": bool(driver.get("telegramChatId"))
        },
        "can_receive_notifications": len(subscriptions) > 0 or bool(driver.get("telegramChatId"))
    }


@router.post("/send-custom")
async def send_custom_notification(
    request: CustomNotificationRequest,
    admin: dict = Depends(get_admin_user)
):
    """Send a custom notification message to a driver."""
    driver = drivers_collection.find_one({"id": request.driverId}, {"_id": 0})
    if not driver:
        # Try to find by name as fallback
        logger.warning(f"Driver not found by id: {request.driverId}")
        raise HTTPException(status_code=404, detail=f"Водитель не найден (ID: {request.driverId})")
    
    logger.info(f"Sending notification to driver: {driver.get('name')}, userId: {driver.get('userId')}")
    
    telegram_sent = False
    push_sent = False
    method_used = ""
    
    # Try Telegram first
    telegram_chat_id = driver.get("telegramChatId")
    if telegram_chat_id:
        settings = notification_settings.find_one({"type": "telegram"}, {"_id": 0})
        if settings and settings.get("enabled") and settings.get("botToken"):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"https://api.telegram.org/bot{settings['botToken']}/sendMessage",
                        json={
                            "chat_id": telegram_chat_id,
                            "text": f"📢 {request.message}",
                            "parse_mode": "HTML"
                        }
                    )
                    if response.status_code == 200:
                        telegram_sent = True
                        method_used = "Telegram"
                        logger.info(f"Custom notification sent to driver {driver.get('name')} via Telegram")
            except Exception as e:
                logger.error(f"Failed to send Telegram message: {e}")
    
    # Always try push as well (not as fallback)
    driver_user_id = driver.get("userId")
    logger.info(f"Looking for push subscriptions: userId={driver_user_id}, driverId={request.driverId}")
    
    # Send push notification - now returns detailed result
    push_result = await send_push_notification(
        user_id=driver_user_id,
        driver_id=request.driverId,
        title="Сообщение",
        body=request.message
    )
    
    push_sent = push_result.get("success", False)
    
    if push_sent:
        if telegram_sent:
            method_used = "Telegram + Push"
        else:
            method_used = "Push ✅"
    elif not telegram_sent:
        # Provide specific reason
        if not driver_user_id:
            method_used = "Водитель не связан с учётной записью"
        elif push_result["total"] == 0:
            method_used = "Водитель не подписался на push-уведомления (нужно нажать 🔔 в Панели водителя)"
        else:
            # Subscriptions exist but push failed - show specific errors
            errors = push_result.get("errors", [])
            unique_errors = list(set(errors))[:3]  # First 3 unique errors
            error_text = "; ".join(unique_errors) if unique_errors else "неизвестная ошибка"
            removed_info = f", удалено устаревших: {push_result['removed']}" if push_result.get("removed", 0) > 0 else ""
            method_used = f"Ошибка push ({error_text}){removed_info}"
    
    # Save to notification history
    from uuid import uuid4
    history_entry = {
        "id": str(uuid4()),
        "driverId": request.driverId,
        "driverName": driver.get("name"),
        "driverUserId": driver_user_id,
        "message": request.message,
        "sentAt": datetime.now(timezone.utc).isoformat(),
        "status": "sent" if (telegram_sent or push_sent) else "not_delivered",
        "method": method_used,
        "telegramSent": telegram_sent,
        "pushSent": push_sent,
        "sentBy": admin.get("username", "admin")
    }
    notification_history.insert_one(history_entry)
    logger.info(f"Notification saved to history: {history_entry['id']}")
    
    return {
        "status": "sent" if (telegram_sent or push_sent) else "not_delivered",
        "method": method_used,
        "message": f"Водитель: {driver.get('name')}",
        "debug": {
            "driver_id": request.driverId,
            "driver_user_id": driver_user_id,
            "push_result": push_result,
            "telegram_linked": bool(telegram_chat_id),
            "telegram_sent": telegram_sent,
            "push_sent": push_sent
        }
    }


@router.get("/history/driver/{driver_id}")
async def get_driver_notification_history(
    driver_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get notification history for a specific driver."""
    # Find notifications for this driver
    notifications = list(notification_history.find(
        {"driverId": driver_id},
        {"_id": 0}
    ).sort("sentAt", -1).limit(limit))
    
    return {
        "count": len(notifications),
        "notifications": notifications
    }


@router.get("/history/me")
async def get_my_notification_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get notification history for the current logged-in driver."""
    user_id = current_user.get("sub")
    
    # Find driver by userId
    driver = drivers_collection.find_one({"userId": user_id}, {"_id": 0})
    if not driver:
        return {"count": 0, "notifications": [], "message": "Водитель не найден для этого пользователя"}
    
    driver_id = driver.get("id")
    
    # Find notifications for this driver
    notifications = list(notification_history.find(
        {"$or": [{"driverId": driver_id}, {"driverUserId": user_id}]},
        {"_id": 0}
    ).sort("sentAt", -1).limit(limit))
    
    return {
        "count": len(notifications),
        "driverId": driver_id,
        "driverName": driver.get("name"),
        "notifications": notifications
    }
