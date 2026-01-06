"""Notifications API - Push notifications and Telegram for drivers."""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import logging
import json
import httpx

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


async def send_push_notification(user_id: str = None, driver_id: str = None, title: str = "", body: str = "", data: dict = None):
    """Send push notification to user or driver."""
    try:
        # Find subscriptions
        query = {"active": True}
        if driver_id:
            query["driverId"] = driver_id
        elif user_id:
            query["userId"] = user_id
        else:
            return
        
        subscriptions = list(notification_subscriptions.find(query, {"_id": 0}))
        
        if not subscriptions:
            logger.info(f"No push subscriptions found for driver={driver_id}, user={user_id}")
            return
        
        # Get VAPID keys from settings
        settings = notification_settings.find_one({"type": "vapid"}, {"_id": 0})
        if not settings:
            logger.warning("VAPID keys not configured")
            return
        
        # Note: Actual push sending requires pywebpush library
        # For now, we'll store notifications for polling
        for sub in subscriptions:
            db.pending_notifications.insert_one({
                "subscription": sub,
                "title": title,
                "body": body,
                "data": data or {},
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "sent": False
            })
        
        logger.info(f"Push notification queued for {len(subscriptions)} subscribers")
        
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")


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


@router.post("/send-custom")
async def send_custom_notification(
    request: CustomNotificationRequest,
    admin: dict = Depends(get_admin_user)
):
    """Send a custom notification message to a driver."""
    driver = drivers_collection.find_one({"id": request.driverId}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    
    telegram_sent = False
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
    
    if not telegram_sent:
        method_used = "Push (в очереди)"
        # Queue push notification
        await send_push_notification(
            request.driverId,
            "Сообщение",
            request.message
        )
    
    return {
        "status": "sent" if telegram_sent else "queued",
        "method": method_used,
        "message": f"Отправлено водителю {driver.get('name')}"
    }
