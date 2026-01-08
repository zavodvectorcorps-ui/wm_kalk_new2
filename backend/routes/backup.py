"""
Backup and restore functionality for the application.
Supports export/import of orders, users, prices, and images.
Includes Telegram backup delivery.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import json
import io
import zipfile
import base64
import logging
import httpx
import os
import re
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/backup", tags=["backup"])

# Database reference (will be set from server.py)
db = None

def set_database(database):
    global db
    db = database


async def get_telegram_bot_token():
    """Get Telegram bot token from multiple sources."""
    # 1. Try environment variable first
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if bot_token:
        return bot_token
    
    # 2. Try telegram_settings (order notifications settings)
    tg_settings = await db.settings.find_one({"type": "telegram_settings"})
    if tg_settings and tg_settings.get('bot_token'):
        return tg_settings.get('bot_token', '')
    
    # 3. Try telegram_backup settings
    tg_backup = await db.settings.find_one({"type": "telegram_backup"})
    if tg_backup and tg_backup.get('bot_token'):
        return tg_backup.get('bot_token', '')
    
    return ''


class TelegramBackupConfig(BaseModel):
    chat_id: str
    bot_token: Optional[str] = None
    enabled: bool = True

class BackupSettings(BaseModel):
    enabled: bool = False
    intervalHours: int = 24  # Default: daily backup
    lastBackup: Optional[str] = None
    retainCount: int = 5  # How many backups to keep

class BackupInfo(BaseModel):
    id: str
    createdAt: str
    size: int
    collections: List[str]

def serialize_for_json(obj):
    """Convert MongoDB objects to JSON-serializable format"""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: serialize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_for_json(item) for item in obj]
    return obj


async def safe_collect(collection_name: str, query: dict = None, limit: int = 10000):
    """Safely collect data from a MongoDB collection, returning empty list on error."""
    try:
        collection = db[collection_name]
        if query:
            data = await collection.find(query).to_list(limit)
        else:
            data = await collection.find({}).to_list(limit)
        return [serialize_for_json(item) for item in data]
    except Exception as e:
        logger.warning(f"Failed to collect {collection_name}: {e}")
        return []


async def download_image_as_base64(url: str) -> Optional[str]:
    """Download an image and convert to base64"""
    try:
        if not url or not url.startswith('http'):
            return None
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', 'image/jpeg')
                b64 = base64.b64encode(response.content).decode('utf-8')
                return f"data:{content_type};base64,{b64}"
    except Exception as e:
        logger.warning(f"Failed to download image {url}: {e}")
    return None

def extract_images_from_data(data: dict) -> dict:
    """Extract all image URLs from prices data and create a mapping"""
    images = {}
    
    def process_url(url: str, path: str):
        if url and isinstance(url, str) and (url.startswith('http') or url.startswith('/api/uploads')):
            images[path] = url
    
    # Process models
    for i, model in enumerate(data.get('models', [])):
        if model.get('imageUrl'):
            process_url(model['imageUrl'], f'models.{i}.imageUrl')
        for j, variant in enumerate(model.get('heaterVariants', [])):
            if variant.get('imageUrl'):
                process_url(variant['imageUrl'], f'models.{i}.heaterVariants.{j}.imageUrl')
    
    # Process categories and options
    for i, cat in enumerate(data.get('categories', [])):
        if cat.get('imageUrl'):
            process_url(cat['imageUrl'], f'categories.{i}.imageUrl')
        for j, opt in enumerate(cat.get('options', [])):
            if opt.get('imageUrl'):
                process_url(opt['imageUrl'], f'categories.{i}.options.{j}.imageUrl')
    
    return images

async def embed_images_in_data(data: dict, base_url: str) -> dict:
    """Download images and embed them as base64 in the data"""
    images = extract_images_from_data(data)
    embedded = {}
    
    for path, url in images.items():
        # Make URL absolute if relative
        if url.startswith('/api/uploads'):
            url = f"{base_url}{url}"
        
        b64 = await download_image_as_base64(url)
        if b64:
            embedded[path] = b64
            logger.info(f"Embedded image: {path}")
    
    # Apply embedded images back to data
    def set_nested(d, path, value):
        keys = path.split('.')
        for key in keys[:-1]:
            if key.isdigit():
                d = d[int(key)]
            else:
                d = d[key]
        final_key = keys[-1]
        if final_key.isdigit():
            d[int(final_key)] = value
        else:
            d[final_key] = value
    
    for path, b64 in embedded.items():
        try:
            set_nested(data, path, b64)
        except Exception as e:
            logger.warning(f"Failed to set {path}: {e}")
    
    return data

async def ensure_phone_field_exists():
    """Ensure phone field exists in balia customer fields"""
    try:
        balia_fields = await db.customer_fields.find_one({"calculatorType": "balia"})
        if balia_fields:
            fields_list = balia_fields.get('fields', [])
            field_ids = [f.get('id') for f in fields_list]
            if 'phoneNumber' not in field_ids:
                phone_field = {
                    "id": "phoneNumber",
                    "name": "Phone",
                    "nameRu": "Телефон",
                    "namePl": "Telefon",
                    "fieldType": "phone",
                    "placeholder": "",
                    "placeholderRu": "",
                    "placeholderPl": "",
                    "required": True,
                    "sortOrder": 2,
                    "active": True
                }
                insert_pos = 1
                for i, f in enumerate(fields_list):
                    if f.get('id') == 'fullName':
                        insert_pos = i + 1
                        break
                fields_list.insert(insert_pos, phone_field)
                for i, f in enumerate(fields_list):
                    f['sortOrder'] = i + 1
                await db.customer_fields.update_one(
                    {"calculatorType": "balia"},
                    {"$set": {"fields": fields_list}}
                )
                logger.info("Added missing phoneNumber field to existing balia customer fields")
        else:
            # Create default balia customer fields with phone
            default_fields = {
                "calculatorType": "balia",
                "fields": [
                    {"id": "fullName", "name": "Full Name", "nameRu": "ФИО", "namePl": "Imię i nazwisko", "fieldType": "text", "required": True, "sortOrder": 1, "active": True},
                    {"id": "phoneNumber", "name": "Phone", "nameRu": "Телефон", "namePl": "Telefon", "fieldType": "phone", "required": True, "sortOrder": 2, "active": True},
                    {"id": "email", "name": "Email", "nameRu": "Email", "namePl": "Email", "fieldType": "email", "required": False, "sortOrder": 3, "active": True}
                ]
            }
            await db.customer_fields.insert_one(default_fields)
            logger.info("Created default balia customer fields with phoneNumber")
    except Exception as e:
        logger.error(f"Error ensuring phone field: {e}")


async def convert_url_images_to_base64(data: dict, base_url: str) -> dict:
    """Convert URL images to base64 during import"""
    async def download_image(url: str) -> Optional[str]:
        if not url or url.startswith('data:'):
            return url
        full_url = url if url.startswith('http') else f"{base_url}{url}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(full_url)
                if response.status_code == 200:
                    content_type = response.headers.get('content-type', 'image/jpeg')
                    b64 = base64.b64encode(response.content).decode('utf-8')
                    logger.info(f"Downloaded and converted image: {url[:50]}...")
                    return f"data:{content_type};base64,{b64}"
        except Exception as e:
            logger.warning(f"Failed to download image {url}: {e}")
        return url
    
    # Process models
    for model in data.get('models', []):
        if model.get('imageUrl') and not model['imageUrl'].startswith('data:'):
            model['imageUrl'] = await download_image(model['imageUrl'])
        for variant in model.get('heaterVariants', []):
            if variant.get('imageUrl') and not variant['imageUrl'].startswith('data:'):
                variant['imageUrl'] = await download_image(variant['imageUrl'])
    
    # Process categories and options
    for cat in data.get('categories', []):
        if cat.get('imageUrl') and not cat['imageUrl'].startswith('data:'):
            cat['imageUrl'] = await download_image(cat['imageUrl'])
        for opt in cat.get('options', []):
            if opt.get('imageUrl') and not opt['imageUrl'].startswith('data:'):
                opt['imageUrl'] = await download_image(opt['imageUrl'])
    
    return data


@router.post("/export")
async def export_backup():
    """
    Export all data as a ZIP file containing JSON files for each collection.
    Includes: orders, sauna_orders, greenhouse_orders, web_orders, trips, users, 
    prices (balia & sauna), tech_spec_config, balia_tech_spec_config, 
    images collection, uploaded files, telegram settings, amocrm settings
    """
    try:
        # Create in-memory ZIP file
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            backup_manifest = {
                "version": "3.0",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "collections": []
            }
            
            # Export Balia orders
            balia_orders = await db.orders.find({}).to_list(10000)
            if balia_orders:
                balia_orders = [serialize_for_json(o) for o in balia_orders]
                zip_file.writestr("balia_orders.json", json.dumps(balia_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "balia_orders", "count": len(balia_orders)})
                logger.info(f"Exported {len(balia_orders)} balia orders")
            
            # Export Sauna orders
            sauna_orders = await db.sauna_orders.find({}).to_list(10000)
            if sauna_orders:
                sauna_orders = [serialize_for_json(o) for o in sauna_orders]
                zip_file.writestr("sauna_orders.json", json.dumps(sauna_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "sauna_orders", "count": len(sauna_orders)})
                logger.info(f"Exported {len(sauna_orders)} sauna orders")
            
            # Export Greenhouse orders
            greenhouse_orders = await db.greenhouse_orders.find({}).to_list(10000)
            if greenhouse_orders:
                greenhouse_orders = [serialize_for_json(o) for o in greenhouse_orders]
                zip_file.writestr("greenhouse_orders.json", json.dumps(greenhouse_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "greenhouse_orders", "count": len(greenhouse_orders)})
                logger.info(f"Exported {len(greenhouse_orders)} greenhouse orders")
            
            # Export Web orders
            web_orders = await db.web_orders.find({}).to_list(10000)
            if web_orders:
                web_orders = [serialize_for_json(o) for o in web_orders]
                zip_file.writestr("web_orders.json", json.dumps(web_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "web_orders", "count": len(web_orders)})
                logger.info(f"Exported {len(web_orders)} web orders")
            
            # Export Trips (logistics routes)
            trips = await db.trips.find({}).to_list(10000)
            if trips:
                trips = [serialize_for_json(t) for t in trips]
                zip_file.writestr("trips.json", json.dumps(trips, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "trips", "count": len(trips)})
                logger.info(f"Exported {len(trips)} trips")
            
            # Export Drivers
            drivers = await db.drivers.find({}).to_list(1000)
            if drivers:
                drivers = [serialize_for_json(d) for d in drivers]
                zip_file.writestr("drivers.json", json.dumps(drivers, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "drivers", "count": len(drivers)})
                logger.info(f"Exported {len(drivers)} drivers")
            
            # Export Users (employees)
            users = await db.users.find({}).to_list(1000)
            if users:
                # Remove sensitive data for safety, but keep passwords for restore
                users = [serialize_for_json(u) for u in users]
                zip_file.writestr("users.json", json.dumps(users, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "users", "count": len(users)})
                logger.info(f"Exported {len(users)} users")
            
            # Export Balia prices (including images as base64)
            # Try to find by type first, then by having models
            balia_prices = await db.prices.find_one({"type": "balia_prices"})
            if not balia_prices:
                balia_prices = await db.prices.find_one({"models": {"$exists": True}})
            if balia_prices:
                balia_prices = serialize_for_json(balia_prices)
                # Ensure type is set for import compatibility
                balia_prices["type"] = "balia_prices"
                # Embed images as base64 for portability
                base_url = os.environ.get('API_BASE_URL', os.environ.get('REACT_APP_BACKEND_URL', ''))
                if base_url:
                    try:
                        balia_prices = await embed_images_in_data(balia_prices, base_url)
                    except Exception as e:
                        logger.warning(f"Failed to embed images in balia_prices: {e}")
                zip_file.writestr("balia_prices.json", json.dumps(balia_prices, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "balia_prices", "count": 1})
                logger.info("Exported balia prices with embedded images")
            
            # Export Sauna prices (from sauna_prices collection)
            # Sauna prices are stored in a separate collection, not in 'prices'
            sauna_prices = await db.sauna_prices.find_one({"_id": "default"})
            if not sauna_prices:
                sauna_prices = await db.sauna_prices.find_one({})
            if sauna_prices:
                sauna_prices = serialize_for_json(sauna_prices)
                base_url = os.environ.get('API_BASE_URL', os.environ.get('REACT_APP_BACKEND_URL', ''))
                if base_url:
                    try:
                        sauna_prices = await embed_images_in_data(sauna_prices, base_url)
                    except Exception as e:
                        logger.warning(f"Failed to embed images in sauna_prices: {e}")
                zip_file.writestr("sauna_prices.json", json.dumps(sauna_prices, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "sauna_prices", "count": 1})
                logger.info("Exported sauna prices with embedded images")
            
            # Export Tech specs (legacy)
            tech_specs = await db.tech_specs.find({}).to_list(1000)
            if tech_specs:
                tech_specs = [serialize_for_json(t) for t in tech_specs]
                zip_file.writestr("tech_specs.json", json.dumps(tech_specs, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "tech_specs", "count": len(tech_specs)})
                logger.info(f"Exported {len(tech_specs)} tech specs")
            
            # Export tech_spec_config (Sauna spec configuration)
            tech_spec_config = await db.tech_spec_config.find({}).to_list(100)
            if tech_spec_config:
                tech_spec_config = [serialize_for_json(t) for t in tech_spec_config]
                zip_file.writestr("tech_spec_config.json", json.dumps(tech_spec_config, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "tech_spec_config", "count": len(tech_spec_config)})
                logger.info(f"Exported {len(tech_spec_config)} tech_spec_config")
            
            # Export balia_tech_spec_config (Balia spec configuration)
            balia_tech_spec_config = await db.balia_tech_spec_config.find({}).to_list(100)
            if balia_tech_spec_config:
                balia_tech_spec_config = [serialize_for_json(t) for t in balia_tech_spec_config]
                zip_file.writestr("balia_tech_spec_config.json", json.dumps(balia_tech_spec_config, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "balia_tech_spec_config", "count": len(balia_tech_spec_config)})
                logger.info(f"Exported {len(balia_tech_spec_config)} balia_tech_spec_config")
            
            # Export images collection (image references)
            images_collection = await db.images.find({}).to_list(1000)
            if images_collection:
                images_collection = [serialize_for_json(i) for i in images_collection]
                zip_file.writestr("images_collection.json", json.dumps(images_collection, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "images_collection", "count": len(images_collection)})
                logger.info(f"Exported {len(images_collection)} image references")
            
            # Export Customer fields
            customer_fields = await db.customer_fields.find({}).to_list(100)
            if customer_fields:
                customer_fields = [serialize_for_json(f) for f in customer_fields]
                zip_file.writestr("customer_fields.json", json.dumps(customer_fields, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "customer_fields", "count": len(customer_fields)})
                logger.info(f"Exported {len(customer_fields)} customer fields")
            
            # Export all settings (backup_settings, telegram, amocrm, etc.)
            all_settings = await db.settings.find({}).to_list(100)
            if all_settings:
                all_settings = [serialize_for_json(s) for s in all_settings]
                zip_file.writestr("settings.json", json.dumps(all_settings, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "settings", "count": len(all_settings)})
                logger.info(f"Exported {len(all_settings)} settings")
            
            # Export amoCRM integration settings from both collections
            amocrm_settings = await db.amocrm_settings.find({}).to_list(100)
            # Also check integration_settings for amoCRM
            integration_settings = await db.integration_settings.find({}).to_list(100)
            combined_amocrm = amocrm_settings + [s for s in integration_settings if s.get('type') == 'amocrm']
            if combined_amocrm:
                combined_amocrm = [serialize_for_json(s) for s in combined_amocrm]
                zip_file.writestr("amocrm_settings.json", json.dumps(combined_amocrm, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "amocrm_settings", "count": len(combined_amocrm)})
                logger.info(f"Exported {len(combined_amocrm)} amoCRM settings")
            
            # Export all integration settings
            if integration_settings:
                integration_settings = [serialize_for_json(s) for s in integration_settings]
                zip_file.writestr("integration_settings.json", json.dumps(integration_settings, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "integration_settings", "count": len(integration_settings)})
                logger.info(f"Exported {len(integration_settings)} integration settings")
            
            # Export webhook logs (for audit/debugging)
            webhook_logs = await db.webhook_logs.find({}).to_list(10000)
            if webhook_logs:
                webhook_logs = [serialize_for_json(w) for w in webhook_logs]
                zip_file.writestr("webhook_logs.json", json.dumps(webhook_logs, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "webhook_logs", "count": len(webhook_logs)})
                logger.info(f"Exported {len(webhook_logs)} webhook logs")
            
            # Export notification subscriptions (push notifications)
            notification_subscriptions = await db.notification_subscriptions.find({}).to_list(10000)
            if notification_subscriptions:
                notification_subscriptions = [serialize_for_json(n) for n in notification_subscriptions]
                zip_file.writestr("notification_subscriptions.json", json.dumps(notification_subscriptions, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "notification_subscriptions", "count": len(notification_subscriptions)})
                logger.info(f"Exported {len(notification_subscriptions)} notification subscriptions")
            
            # Export notification settings (Telegram bot, etc.)
            notification_settings = await db.notification_settings.find({}).to_list(100)
            if notification_settings:
                notification_settings = [serialize_for_json(n) for n in notification_settings]
                zip_file.writestr("notification_settings.json", json.dumps(notification_settings, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "notification_settings", "count": len(notification_settings)})
                logger.info(f"Exported {len(notification_settings)} notification settings")
            
            # Export telegram link codes (for driver Telegram linking)
            telegram_link_codes = await db.telegram_link_codes.find({}).to_list(1000)
            if telegram_link_codes:
                telegram_link_codes = [serialize_for_json(t) for t in telegram_link_codes]
                zip_file.writestr("telegram_link_codes.json", json.dumps(telegram_link_codes, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "telegram_link_codes", "count": len(telegram_link_codes)})
                logger.info(f"Exported {len(telegram_link_codes)} telegram link codes")
            
            # Export delivery photos
            delivery_photos = await db.delivery_photos.find({}).to_list(10000)
            if delivery_photos:
                delivery_photos = [serialize_for_json(p) for p in delivery_photos]
                zip_file.writestr("delivery_photos.json", json.dumps(delivery_photos, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "delivery_photos", "count": len(delivery_photos)})
                logger.info(f"Exported {len(delivery_photos)} delivery photos")
            
            # Export amoCRM sync logs (for debugging)
            amocrm_sync_logs = await db.amocrm_sync_logs.find({}).to_list(10000)
            if amocrm_sync_logs:
                amocrm_sync_logs = [serialize_for_json(l) for l in amocrm_sync_logs]
                zip_file.writestr("amocrm_sync_logs.json", json.dumps(amocrm_sync_logs, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "amocrm_sync_logs", "count": len(amocrm_sync_logs)})
                logger.info(f"Exported {len(amocrm_sync_logs)} amoCRM sync logs")
            
            # Export pending notifications
            pending_notifications = await db.pending_notifications.find({}).to_list(10000)
            if pending_notifications:
                pending_notifications = [serialize_for_json(n) for n in pending_notifications]
                zip_file.writestr("pending_notifications.json", json.dumps(pending_notifications, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "pending_notifications", "count": len(pending_notifications)})
                logger.info(f"Exported {len(pending_notifications)} pending notifications")
            
            # Export warehouse history (warehouse status changes log)
            warehouse_history = await db.warehouse_history.find({}).to_list(10000)
            if warehouse_history:
                warehouse_history = [serialize_for_json(w) for w in warehouse_history]
                zip_file.writestr("warehouse_history.json", json.dumps(warehouse_history, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "warehouse_history", "count": len(warehouse_history)})
                logger.info(f"Exported {len(warehouse_history)} warehouse history entries")
            
            # Export greenhouse prices (if exists as separate collection)
            greenhouse_prices = await db.greenhouse_prices.find({}).to_list(100)
            if greenhouse_prices:
                greenhouse_prices = [serialize_for_json(p) for p in greenhouse_prices]
                zip_file.writestr("greenhouse_prices.json", json.dumps(greenhouse_prices, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "greenhouse_prices", "count": len(greenhouse_prices)})
                logger.info(f"Exported {len(greenhouse_prices)} greenhouse prices")
            
            # Export Telegram configuration from .env
            telegram_config = {
                "bot_token": os.environ.get('TELEGRAM_BOT_TOKEN', ''),
                "chat_id": os.environ.get('TELEGRAM_CHAT_ID', '')
            }
            if telegram_config["bot_token"] or telegram_config["chat_id"]:
                zip_file.writestr("telegram_config.json", json.dumps(telegram_config, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "telegram_config", "count": 1})
                logger.info("Exported Telegram configuration")
            
            # Export uploaded files from /backend/uploads/
            uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
            if os.path.exists(uploads_dir):
                uploaded_files = []
                for filename in os.listdir(uploads_dir):
                    filepath = os.path.join(uploads_dir, filename)
                    if os.path.isfile(filepath):
                        try:
                            with open(filepath, 'rb') as f:
                                file_data = f.read()
                                # Store file in ZIP under uploads/ folder
                                zip_file.writestr(f"uploads/{filename}", file_data)
                                uploaded_files.append(filename)
                        except Exception as e:
                            logger.warning(f"Failed to backup file {filename}: {e}")
                if uploaded_files:
                    backup_manifest["collections"].append({"name": "uploaded_files", "count": len(uploaded_files)})
                    logger.info(f"Exported {len(uploaded_files)} uploaded files")
            
            # Write manifest
            zip_file.writestr("manifest.json", json.dumps(backup_manifest, ensure_ascii=False, indent=2))
        
        # Prepare response
        zip_buffer.seek(0)
        filename = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Export backup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/import")
async def import_backup(file: UploadFile = File(...)):
    """
    Import data from a backup ZIP file.
    Merges data with existing records (doesn't delete existing data).
    """
    try:
        if not file.filename.endswith('.zip'):
            raise HTTPException(status_code=400, detail="File must be a ZIP archive")
        
        contents = await file.read()
        zip_buffer = io.BytesIO(contents)
        
        import_stats = {
            "success": True,
            "imported": {},
            "errors": []
        }
        
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            file_list = zip_file.namelist()
            logger.info(f"Found files in backup: {file_list}")
            
            # Import Balia orders - REPLACE ALL (full restore)
            if "balia_orders.json" in file_list:
                try:
                    data = json.loads(zip_file.read("balia_orders.json").decode('utf-8'))
                    # Delete all existing orders and insert from backup
                    await db.orders.delete_many({})
                    count = 0
                    for order in data:
                        order.pop('_id', None)  # Remove _id to allow new insertion
                        await db.orders.insert_one(order)
                        count += 1
                    import_stats["imported"]["balia_orders"] = count
                    logger.info(f"Imported {count} balia orders (replaced all)")
                except Exception as e:
                    logger.error(f"Error importing balia_orders: {e}")
                    import_stats["errors"].append(f"balia_orders: {str(e)}")
            
            # Import Sauna orders - REPLACE ALL (full restore)
            if "sauna_orders.json" in file_list:
                try:
                    data = json.loads(zip_file.read("sauna_orders.json").decode('utf-8'))
                    await db.sauna_orders.delete_many({})
                    count = 0
                    for order in data:
                        order.pop('_id', None)
                        await db.sauna_orders.insert_one(order)
                        count += 1
                    import_stats["imported"]["sauna_orders"] = count
                    logger.info(f"Imported {count} sauna orders (replaced all)")
                except Exception as e:
                    logger.error(f"Error importing sauna_orders: {e}")
                    import_stats["errors"].append(f"sauna_orders: {str(e)}")
            
            # Import Greenhouse orders - REPLACE ALL (full restore)
            if "greenhouse_orders.json" in file_list:
                try:
                    data = json.loads(zip_file.read("greenhouse_orders.json").decode('utf-8'))
                    await db.greenhouse_orders.delete_many({})
                    count = 0
                    for order in data:
                        order.pop('_id', None)
                        await db.greenhouse_orders.insert_one(order)
                        count += 1
                    import_stats["imported"]["greenhouse_orders"] = count
                    logger.info(f"Imported {count} greenhouse orders (replaced all)")
                except Exception as e:
                    logger.error(f"Error importing greenhouse_orders: {e}")
                    import_stats["errors"].append(f"greenhouse_orders: {str(e)}")
            
            # Import Web orders - REPLACE ALL (full restore)
            if "web_orders.json" in file_list:
                try:
                    data = json.loads(zip_file.read("web_orders.json").decode('utf-8'))
                    await db.web_orders.delete_many({})
                    count = 0
                    for order in data:
                        order.pop('_id', None)
                        await db.web_orders.insert_one(order)
                        count += 1
                    import_stats["imported"]["web_orders"] = count
                    logger.info(f"Imported {count} web orders (replaced all)")
                except Exception as e:
                    logger.error(f"Error importing web_orders: {e}")
                    import_stats["errors"].append(f"web_orders: {str(e)}")
            
            # Import Users
            if "users.json" in file_list:
                try:
                    data = json.loads(zip_file.read("users.json").decode('utf-8'))
                    count = 0
                    for user in data:
                        user.pop('_id', None)
                        existing = await db.users.find_one({"username": user.get("username")})
                        if not existing:
                            await db.users.insert_one(user)
                            count += 1
                    import_stats["imported"]["users"] = count
                    logger.info(f"Imported {count} users")
                except Exception as e:
                    import_stats["errors"].append(f"users: {str(e)}")
            
            # Import Balia prices
            if "balia_prices.json" in file_list:
                try:
                    data = json.loads(zip_file.read("balia_prices.json").decode('utf-8'))
                    data.pop('_id', None)
                    data.pop('type', None)
                    
                    # Download images if they are URLs (not base64)
                    base_url = os.environ.get('BACKUP_SOURCE_URL', '')
                    if base_url:
                        data = await convert_url_images_to_base64(data, base_url)
                    
                    # API uses _id: "default" to find prices
                    data["_id"] = "default"
                    # Delete existing prices document
                    await db.prices.delete_one({"_id": "default"})
                    await db.prices.insert_one(data)
                    import_stats["imported"]["balia_prices"] = 1
                    logger.info(f"Imported balia prices with {len(data.get('models', []))} models")
                except Exception as e:
                    logger.error(f"Error importing balia_prices: {e}")
                    import_stats["errors"].append(f"balia_prices: {str(e)}")
            
            # Import Sauna prices (to sauna_prices collection)
            if "sauna_prices.json" in file_list:
                try:
                    data = json.loads(zip_file.read("sauna_prices.json").decode('utf-8'))
                    data.pop('_id', None)
                    
                    # Download images if they are URLs (not base64)
                    base_url = os.environ.get('BACKUP_SOURCE_URL', '')
                    if base_url:
                        data = await convert_url_images_to_base64(data, base_url)
                    
                    data["_id"] = "default"
                    # Sauna prices are in separate collection
                    await db.sauna_prices.delete_one({"_id": "default"})
                    await db.sauna_prices.insert_one(data)
                    import_stats["imported"]["sauna_prices"] = 1
                    logger.info(f"Imported sauna prices with {len(data.get('models', []))} models")
                except Exception as e:
                    logger.error(f"Error importing sauna_prices: {e}")
                    import_stats["errors"].append(f"sauna_prices: {str(e)}")
            
            # Import Tech specs
            if "tech_specs.json" in file_list:
                try:
                    data = json.loads(zip_file.read("tech_specs.json").decode('utf-8'))
                    count = 0
                    for spec in data:
                        spec.pop('_id', None)
                        existing = await db.tech_specs.find_one({"modelId": spec.get("modelId")})
                        if existing:
                            await db.tech_specs.update_one(
                                {"modelId": spec.get("modelId")},
                                {"$set": spec}
                            )
                        else:
                            await db.tech_specs.insert_one(spec)
                        count += 1
                    import_stats["imported"]["tech_specs"] = count
                    logger.info(f"Imported {count} tech specs")
                except Exception as e:
                    import_stats["errors"].append(f"tech_specs: {str(e)}")
            
            # Import Customer fields
            if "customer_fields.json" in file_list:
                try:
                    data = json.loads(zip_file.read("customer_fields.json").decode('utf-8'))
                    # Replace all customer fields
                    await db.customer_fields.delete_many({})
                    for field in data:
                        field.pop('_id', None)
                        # Ensure phone field exists for balia
                        if field.get('calculatorType') == 'balia':
                            fields_list = field.get('fields', [])
                            field_ids = [f.get('id') for f in fields_list]
                            if 'phoneNumber' not in field_ids:
                                # Add phone field after fullName
                                phone_field = {
                                    "id": "phoneNumber",
                                    "name": "Phone",
                                    "nameRu": "Телефон",
                                    "namePl": "Telefon",
                                    "fieldType": "phone",
                                    "placeholder": "",
                                    "placeholderRu": "",
                                    "placeholderPl": "",
                                    "required": True,
                                    "sortOrder": 2,
                                    "active": True
                                }
                                # Insert after fullName (index 1) or at position 1
                                insert_pos = 1
                                for i, f in enumerate(fields_list):
                                    if f.get('id') == 'fullName':
                                        insert_pos = i + 1
                                        break
                                fields_list.insert(insert_pos, phone_field)
                                # Update sortOrder for fields after phone
                                for i, f in enumerate(fields_list):
                                    f['sortOrder'] = i + 1
                                field['fields'] = fields_list
                                logger.info("Added missing phoneNumber field to balia customer fields")
                        await db.customer_fields.insert_one(field)
                    import_stats["imported"]["customer_fields"] = len(data)
                    logger.info(f"Imported {len(data)} customer fields")
                except Exception as e:
                    import_stats["errors"].append(f"customer_fields: {str(e)}")
            
            # Import tech_spec_config (Sauna spec configuration)
            if "tech_spec_config.json" in file_list:
                try:
                    data = json.loads(zip_file.read("tech_spec_config.json").decode('utf-8'))
                    await db.tech_spec_config.delete_many({})
                    for config in data:
                        config.pop('_id', None)
                        await db.tech_spec_config.insert_one(config)
                    import_stats["imported"]["tech_spec_config"] = len(data)
                    logger.info(f"Imported {len(data)} tech_spec_config")
                except Exception as e:
                    import_stats["errors"].append(f"tech_spec_config: {str(e)}")
            
            # Import balia_tech_spec_config (Balia spec configuration)
            if "balia_tech_spec_config.json" in file_list:
                try:
                    data = json.loads(zip_file.read("balia_tech_spec_config.json").decode('utf-8'))
                    await db.balia_tech_spec_config.delete_many({})
                    for config in data:
                        config.pop('_id', None)
                        await db.balia_tech_spec_config.insert_one(config)
                    import_stats["imported"]["balia_tech_spec_config"] = len(data)
                    logger.info(f"Imported {len(data)} balia_tech_spec_config")
                except Exception as e:
                    import_stats["errors"].append(f"balia_tech_spec_config: {str(e)}")
            
            # Import images collection
            if "images_collection.json" in file_list:
                try:
                    data = json.loads(zip_file.read("images_collection.json").decode('utf-8'))
                    await db.images.delete_many({})
                    for img in data:
                        img.pop('_id', None)
                        await db.images.insert_one(img)
                    import_stats["imported"]["images_collection"] = len(data)
                    logger.info(f"Imported {len(data)} image references")
                except Exception as e:
                    import_stats["errors"].append(f"images_collection: {str(e)}")
            
            # Import all settings
            if "settings.json" in file_list:
                try:
                    data = json.loads(zip_file.read("settings.json").decode('utf-8'))
                    for setting in data:
                        setting_type = setting.get('type')
                        if setting_type:
                            setting.pop('_id', None)
                            await db.settings.update_one(
                                {"type": setting_type},
                                {"$set": setting},
                                upsert=True
                            )
                    import_stats["imported"]["settings"] = len(data)
                    logger.info(f"Imported {len(data)} settings")
                except Exception as e:
                    import_stats["errors"].append(f"settings: {str(e)}")
            
            # Import Trips (logistics routes) - REPLACE ALL
            if "trips.json" in file_list:
                try:
                    data = json.loads(zip_file.read("trips.json").decode('utf-8'))
                    await db.trips.delete_many({})
                    count = 0
                    for trip in data:
                        trip.pop('_id', None)
                        await db.trips.insert_one(trip)
                        count += 1
                    import_stats["imported"]["trips"] = count
                    logger.info(f"Imported {count} trips (replaced all)")
                except Exception as e:
                    logger.error(f"Error importing trips: {e}")
                    import_stats["errors"].append(f"trips: {str(e)}")
            
            # Import Drivers - REPLACE ALL
            if "drivers.json" in file_list:
                try:
                    data = json.loads(zip_file.read("drivers.json").decode('utf-8'))
                    await db.drivers.delete_many({})
                    count = 0
                    for driver in data:
                        driver.pop('_id', None)
                        await db.drivers.insert_one(driver)
                        count += 1
                    import_stats["imported"]["drivers"] = count
                    logger.info(f"Imported {count} drivers (replaced all)")
                except Exception as e:
                    logger.error(f"Error importing drivers: {e}")
                    import_stats["errors"].append(f"drivers: {str(e)}")
            
            # Import amoCRM settings
            if "amocrm_settings.json" in file_list:
                try:
                    data = json.loads(zip_file.read("amocrm_settings.json").decode('utf-8'))
                    await db.amocrm_settings.delete_many({})
                    for setting in data:
                        setting.pop('_id', None)
                        # Also save to integration_settings if it has type='amocrm'
                        if setting.get('type') == 'amocrm':
                            await db.integration_settings.update_one(
                                {"type": "amocrm"},
                                {"$set": setting},
                                upsert=True
                            )
                        else:
                            await db.amocrm_settings.insert_one(setting)
                    import_stats["imported"]["amocrm_settings"] = len(data)
                    logger.info(f"Imported {len(data)} amoCRM settings")
                except Exception as e:
                    logger.error(f"Error importing amocrm_settings: {e}")
                    import_stats["errors"].append(f"amocrm_settings: {str(e)}")
            
            # Import integration_settings
            if "integration_settings.json" in file_list:
                try:
                    data = json.loads(zip_file.read("integration_settings.json").decode('utf-8'))
                    for setting in data:
                        setting_type = setting.get('type')
                        setting.pop('_id', None)
                        if setting_type:
                            await db.integration_settings.update_one(
                                {"type": setting_type},
                                {"$set": setting},
                                upsert=True
                            )
                    import_stats["imported"]["integration_settings"] = len(data)
                    logger.info(f"Imported {len(data)} integration settings")
                except Exception as e:
                    logger.error(f"Error importing integration_settings: {e}")
                    import_stats["errors"].append(f"integration_settings: {str(e)}")
            
            # Import webhook_logs
            if "webhook_logs.json" in file_list:
                try:
                    data = json.loads(zip_file.read("webhook_logs.json").decode('utf-8'))
                    await db.webhook_logs.delete_many({})
                    for log in data:
                        log.pop('_id', None)
                        await db.webhook_logs.insert_one(log)
                    import_stats["imported"]["webhook_logs"] = len(data)
                    logger.info(f"Imported {len(data)} webhook logs")
                except Exception as e:
                    logger.error(f"Error importing webhook_logs: {e}")
                    import_stats["errors"].append(f"webhook_logs: {str(e)}")
            
            # Import notification subscriptions
            if "notification_subscriptions.json" in file_list:
                try:
                    data = json.loads(zip_file.read("notification_subscriptions.json").decode('utf-8'))
                    await db.notification_subscriptions.delete_many({})
                    for sub in data:
                        sub.pop('_id', None)
                        await db.notification_subscriptions.insert_one(sub)
                    import_stats["imported"]["notification_subscriptions"] = len(data)
                    logger.info(f"Imported {len(data)} notification subscriptions")
                except Exception as e:
                    logger.error(f"Error importing notification_subscriptions: {e}")
                    import_stats["errors"].append(f"notification_subscriptions: {str(e)}")
            
            # Import notification settings
            if "notification_settings.json" in file_list:
                try:
                    data = json.loads(zip_file.read("notification_settings.json").decode('utf-8'))
                    await db.notification_settings.delete_many({})
                    for setting in data:
                        setting.pop('_id', None)
                        await db.notification_settings.insert_one(setting)
                    import_stats["imported"]["notification_settings"] = len(data)
                    logger.info(f"Imported {len(data)} notification settings")
                except Exception as e:
                    logger.error(f"Error importing notification_settings: {e}")
                    import_stats["errors"].append(f"notification_settings: {str(e)}")
            
            # Import telegram link codes
            if "telegram_link_codes.json" in file_list:
                try:
                    data = json.loads(zip_file.read("telegram_link_codes.json").decode('utf-8'))
                    await db.telegram_link_codes.delete_many({})
                    for code in data:
                        code.pop('_id', None)
                        await db.telegram_link_codes.insert_one(code)
                    import_stats["imported"]["telegram_link_codes"] = len(data)
                    logger.info(f"Imported {len(data)} telegram link codes")
                except Exception as e:
                    logger.error(f"Error importing telegram_link_codes: {e}")
                    import_stats["errors"].append(f"telegram_link_codes: {str(e)}")
            
            # Import delivery photos
            if "delivery_photos.json" in file_list:
                try:
                    data = json.loads(zip_file.read("delivery_photos.json").decode('utf-8'))
                    await db.delivery_photos.delete_many({})
                    for photo in data:
                        photo.pop('_id', None)
                        await db.delivery_photos.insert_one(photo)
                    import_stats["imported"]["delivery_photos"] = len(data)
                    logger.info(f"Imported {len(data)} delivery photos")
                except Exception as e:
                    logger.error(f"Error importing delivery_photos: {e}")
                    import_stats["errors"].append(f"delivery_photos: {str(e)}")
            
            # Import amoCRM sync logs
            if "amocrm_sync_logs.json" in file_list:
                try:
                    data = json.loads(zip_file.read("amocrm_sync_logs.json").decode('utf-8'))
                    await db.amocrm_sync_logs.delete_many({})
                    for log in data:
                        log.pop('_id', None)
                        await db.amocrm_sync_logs.insert_one(log)
                    import_stats["imported"]["amocrm_sync_logs"] = len(data)
                    logger.info(f"Imported {len(data)} amoCRM sync logs")
                except Exception as e:
                    logger.error(f"Error importing amocrm_sync_logs: {e}")
                    import_stats["errors"].append(f"amocrm_sync_logs: {str(e)}")
            
            # Import pending notifications
            if "pending_notifications.json" in file_list:
                try:
                    data = json.loads(zip_file.read("pending_notifications.json").decode('utf-8'))
                    await db.pending_notifications.delete_many({})
                    for notif in data:
                        notif.pop('_id', None)
                        await db.pending_notifications.insert_one(notif)
                    import_stats["imported"]["pending_notifications"] = len(data)
                    logger.info(f"Imported {len(data)} pending notifications")
                except Exception as e:
                    logger.error(f"Error importing pending_notifications: {e}")
                    import_stats["errors"].append(f"pending_notifications: {str(e)}")
            
            # Import warehouse history
            if "warehouse_history.json" in file_list:
                try:
                    data = json.loads(zip_file.read("warehouse_history.json").decode('utf-8'))
                    await db.warehouse_history.delete_many({})
                    for entry in data:
                        entry.pop('_id', None)
                        await db.warehouse_history.insert_one(entry)
                    import_stats["imported"]["warehouse_history"] = len(data)
                    logger.info(f"Imported {len(data)} warehouse history entries")
                except Exception as e:
                    logger.error(f"Error importing warehouse_history: {e}")
                    import_stats["errors"].append(f"warehouse_history: {str(e)}")
            
            # Import greenhouse prices
            if "greenhouse_prices.json" in file_list:
                try:
                    data = json.loads(zip_file.read("greenhouse_prices.json").decode('utf-8'))
                    await db.greenhouse_prices.delete_many({})
                    for price in data:
                        price.pop('_id', None)
                        await db.greenhouse_prices.insert_one(price)
                    import_stats["imported"]["greenhouse_prices"] = len(data)
                    logger.info(f"Imported {len(data)} greenhouse prices")
                except Exception as e:
                    logger.error(f"Error importing greenhouse_prices: {e}")
                    import_stats["errors"].append(f"greenhouse_prices: {str(e)}")
            
            # Import uploaded files
            uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
            os.makedirs(uploads_dir, exist_ok=True)
            uploaded_count = 0
            for name in file_list:
                if name.startswith("uploads/") and not name.endswith("/"):
                    try:
                        filename = name.replace("uploads/", "")
                        file_data = zip_file.read(name)
                        filepath = os.path.join(uploads_dir, filename)
                        with open(filepath, 'wb') as f:
                            f.write(file_data)
                        uploaded_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to restore file {name}: {e}")
            if uploaded_count > 0:
                import_stats["imported"]["uploaded_files"] = uploaded_count
                logger.info(f"Restored {uploaded_count} uploaded files")
            
            # Note about Telegram config
            if "telegram_config.json" in file_list:
                try:
                    data = json.loads(zip_file.read("telegram_config.json").decode('utf-8'))
                    import_stats["telegram_config"] = {
                        "note": "Telegram config found in backup. Update .env manually if needed.",
                        "bot_token_present": bool(data.get("bot_token")),
                        "chat_id_present": bool(data.get("chat_id"))
                    }
                    logger.info("Telegram config found in backup - requires manual .env update")
                except Exception as e:
                    logger.warning(f"Failed to read telegram_config: {e}")
        
        # Ensure phone field exists even if customer_fields was not in backup
        await ensure_phone_field_exists()
        
        if import_stats["errors"]:
            import_stats["success"] = False
        
        return import_stats
        
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")
    except Exception as e:
        logger.error(f"Import backup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.get("/settings")
async def get_backup_settings():
    """Get auto-backup settings"""
    try:
        settings = await db.settings.find_one({"type": "backup_settings"})
        if settings:
            settings.pop('_id', None)
            return settings
        return {
            "type": "backup_settings",
            "enabled": False,
            "intervalHours": 24,
            "lastBackup": None,
            "retainCount": 5
        }
    except Exception as e:
        logger.error(f"Get backup settings error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/settings")
async def update_backup_settings(settings: BackupSettings):
    """Update auto-backup settings"""
    try:
        update_data = {
            "type": "backup_settings",
            "enabled": settings.enabled,
            "intervalHours": settings.intervalHours,
            "retainCount": settings.retainCount
        }
        
        await db.settings.update_one(
            {"type": "backup_settings"},
            {"$set": update_data},
            upsert=True
        )
        
        return {"success": True, "settings": update_data}
    except Exception as e:
        logger.error(f"Update backup settings error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_backups():
    """List stored backups (for auto-backup feature)"""
    try:
        backups = await db.backups.find({}).sort("createdAt", -1).to_list(100)
        return [{
            "id": str(b.get("_id")),
            "createdAt": b.get("createdAt"),
            "size": b.get("size", 0),
            "collections": b.get("collections", [])
        } for b in backups]
    except Exception as e:
        logger.error(f"List backups error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auto")
async def create_auto_backup():
    """
    Create an automatic backup and store it in the database.
    Also sends to Telegram if configured.
    Called by a scheduled task or manually.
    """
    try:
        # Import telegram service - handle if not available
        try:
            from services.telegram_service import send_backup_to_telegram as send_to_tg
        except ImportError as ie:
            logger.warning(f"Telegram service not available: {ie}")
            send_to_tg = None
        
        # Create backup data
        backup_data = {
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "collections": {}
        }
        
        # For Telegram - create ZIP with full data
        backup_manifest = {
            "version": "3.0",
            "createdAt": backup_data["createdAt"],
            "collections": []
        }
        
        logger.info("Starting auto backup collection...")
        
        # Collect all data
        balia_orders = await db.orders.find({}).to_list(10000)
        backup_data["collections"]["balia_orders"] = [serialize_for_json(o) for o in balia_orders]
        if balia_orders:
            backup_manifest["collections"].append({"name": "balia_orders", "count": len(balia_orders)})
        
        sauna_orders = await db.sauna_orders.find({}).to_list(10000)
        backup_data["collections"]["sauna_orders"] = [serialize_for_json(o) for o in sauna_orders]
        if sauna_orders:
            backup_manifest["collections"].append({"name": "sauna_orders", "count": len(sauna_orders)})
        
        greenhouse_orders = await db.greenhouse_orders.find({}).to_list(10000)
        backup_data["collections"]["greenhouse_orders"] = [serialize_for_json(o) for o in greenhouse_orders]
        if greenhouse_orders:
            backup_manifest["collections"].append({"name": "greenhouse_orders", "count": len(greenhouse_orders)})
        
        web_orders = await db.web_orders.find({}).to_list(10000)
        backup_data["collections"]["web_orders"] = [serialize_for_json(o) for o in web_orders]
        if web_orders:
            backup_manifest["collections"].append({"name": "web_orders", "count": len(web_orders)})
        
        trips = await db.trips.find({}).to_list(10000)
        backup_data["collections"]["trips"] = [serialize_for_json(t) for t in trips]
        if trips:
            backup_manifest["collections"].append({"name": "trips", "count": len(trips)})
        
        drivers = await db.drivers.find({}).to_list(1000)
        backup_data["collections"]["drivers"] = [serialize_for_json(d) for d in drivers]
        if drivers:
            backup_manifest["collections"].append({"name": "drivers", "count": len(drivers)})
        
        users = await db.users.find({}).to_list(1000)
        backup_data["collections"]["users"] = [serialize_for_json(u) for u in users]
        if users:
            backup_manifest["collections"].append({"name": "users", "count": len(users)})
        
        balia_prices = await db.prices.find_one({"type": "balia_prices"})
        if not balia_prices:
            balia_prices = await db.prices.find_one({"models": {"$exists": True}})
        if balia_prices:
            backup_data["collections"]["balia_prices"] = serialize_for_json(balia_prices)
            backup_manifest["collections"].append({"name": "balia_prices", "count": 1})
        
        sauna_prices = await db.sauna_prices.find_one({"_id": "default"})
        if not sauna_prices:
            sauna_prices = await db.sauna_prices.find_one({})
        if sauna_prices:
            backup_data["collections"]["sauna_prices"] = serialize_for_json(sauna_prices)
            backup_manifest["collections"].append({"name": "sauna_prices", "count": 1})
        
        tech_specs = await db.tech_specs.find({}).to_list(1000)
        backup_data["collections"]["tech_specs"] = [serialize_for_json(t) for t in tech_specs]
        if tech_specs:
            backup_manifest["collections"].append({"name": "tech_specs", "count": len(tech_specs)})
        
        customer_fields = await db.customer_fields.find({}).to_list(100)
        backup_data["collections"]["customer_fields"] = [serialize_for_json(f) for f in customer_fields]
        if customer_fields:
            backup_manifest["collections"].append({"name": "customer_fields", "count": len(customer_fields)})
        
        # Additional collections for full backup
        tech_spec_config = await db.tech_spec_config.find({}).to_list(100)
        backup_data["collections"]["tech_spec_config"] = [serialize_for_json(t) for t in tech_spec_config]
        if tech_spec_config:
            backup_manifest["collections"].append({"name": "tech_spec_config", "count": len(tech_spec_config)})
        
        balia_tech_spec_config = await db.balia_tech_spec_config.find({}).to_list(100)
        backup_data["collections"]["balia_tech_spec_config"] = [serialize_for_json(t) for t in balia_tech_spec_config]
        if balia_tech_spec_config:
            backup_manifest["collections"].append({"name": "balia_tech_spec_config", "count": len(balia_tech_spec_config)})
        
        images_collection = await db.images.find({}).to_list(1000)
        backup_data["collections"]["images_collection"] = [serialize_for_json(i) for i in images_collection]
        if images_collection:
            backup_manifest["collections"].append({"name": "images_collection", "count": len(images_collection)})
        
        all_settings = await db.settings.find({}).to_list(100)
        backup_data["collections"]["settings"] = [serialize_for_json(s) for s in all_settings]
        if all_settings:
            backup_manifest["collections"].append({"name": "settings", "count": len(all_settings)})
        
        amocrm_settings = await db.amocrm_settings.find({}).to_list(100)
        backup_data["collections"]["amocrm_settings"] = [serialize_for_json(s) for s in amocrm_settings]
        if amocrm_settings:
            backup_manifest["collections"].append({"name": "amocrm_settings", "count": len(amocrm_settings)})
        
        # Integration settings (includes amoCRM settings from integration_settings collection)
        integration_settings = await db.integration_settings.find({}).to_list(100)
        backup_data["collections"]["integration_settings"] = [serialize_for_json(s) for s in integration_settings]
        if integration_settings:
            backup_manifest["collections"].append({"name": "integration_settings", "count": len(integration_settings)})
        
        # Webhook logs (for debugging and audit)
        webhook_logs = await db.webhook_logs.find({}).to_list(10000)
        backup_data["collections"]["webhook_logs"] = [serialize_for_json(w) for w in webhook_logs]
        if webhook_logs:
            backup_manifest["collections"].append({"name": "webhook_logs", "count": len(webhook_logs)})
        
        # Warehouse history (status changes log)
        warehouse_history = await db.warehouse_history.find({}).to_list(10000)
        backup_data["collections"]["warehouse_history"] = [serialize_for_json(w) for w in warehouse_history]
        if warehouse_history:
            backup_manifest["collections"].append({"name": "warehouse_history", "count": len(warehouse_history)})
        
        # Notification subscriptions (push notifications)
        notification_subscriptions = await db.notification_subscriptions.find({}).to_list(10000)
        backup_data["collections"]["notification_subscriptions"] = [serialize_for_json(n) for n in notification_subscriptions]
        if notification_subscriptions:
            backup_manifest["collections"].append({"name": "notification_subscriptions", "count": len(notification_subscriptions)})
        
        # Notification settings
        notification_settings = await db.notification_settings.find({}).to_list(100)
        backup_data["collections"]["notification_settings"] = [serialize_for_json(n) for n in notification_settings]
        if notification_settings:
            backup_manifest["collections"].append({"name": "notification_settings", "count": len(notification_settings)})
        
        # Telegram link codes
        telegram_link_codes = await db.telegram_link_codes.find({}).to_list(1000)
        backup_data["collections"]["telegram_link_codes"] = [serialize_for_json(t) for t in telegram_link_codes]
        if telegram_link_codes:
            backup_manifest["collections"].append({"name": "telegram_link_codes", "count": len(telegram_link_codes)})
        
        # Delivery photos
        delivery_photos = await db.delivery_photos.find({}).to_list(10000)
        backup_data["collections"]["delivery_photos"] = [serialize_for_json(p) for p in delivery_photos]
        if delivery_photos:
            backup_manifest["collections"].append({"name": "delivery_photos", "count": len(delivery_photos)})
        
        # amoCRM sync logs
        amocrm_sync_logs = await db.amocrm_sync_logs.find({}).to_list(10000)
        backup_data["collections"]["amocrm_sync_logs"] = [serialize_for_json(l) for l in amocrm_sync_logs]
        if amocrm_sync_logs:
            backup_manifest["collections"].append({"name": "amocrm_sync_logs", "count": len(amocrm_sync_logs)})
        
        # Pending notifications
        pending_notifications = await db.pending_notifications.find({}).to_list(10000)
        backup_data["collections"]["pending_notifications"] = [serialize_for_json(n) for n in pending_notifications]
        if pending_notifications:
            backup_manifest["collections"].append({"name": "pending_notifications", "count": len(pending_notifications)})
        
        # Calculate size
        backup_json = json.dumps(backup_data)
        backup_data["size"] = len(backup_json)
        
        # Store backup
        result = await db.backups.insert_one(backup_data)
        
        # Update last backup time in settings
        await db.settings.update_one(
            {"type": "backup_settings"},
            {"$set": {"lastBackup": backup_data["createdAt"]}},
            upsert=True
        )
        
        # Clean old backups (keep only retainCount)
        settings = await db.settings.find_one({"type": "backup_settings"})
        retain_count = settings.get("retainCount", 5) if settings else 5
        
        all_backups = await db.backups.find({}).sort("createdAt", -1).to_list(1000)
        if len(all_backups) > retain_count:
            for old_backup in all_backups[retain_count:]:
                await db.backups.delete_one({"_id": old_backup["_id"]})
        
        # Send to Telegram if configured
        telegram_sent = False
        telegram_config = await db.settings.find_one({"type": "telegram_backup"})
        logger.info(f"Auto backup: telegram_config = {telegram_config}")
        
        if telegram_config and telegram_config.get("enabled") and telegram_config.get("chat_id"):
            bot_token = await get_telegram_bot_token()
            logger.info(f"Auto backup: bot_token present = {bool(bot_token)}, chat_id = {telegram_config.get('chat_id')}")
            
            if bot_token:
                try:
                    # Create ZIP for Telegram
                    zip_buffer = io.BytesIO()
                    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                        for name, data in backup_data["collections"].items():
                            if data:
                                zip_file.writestr(f"{name}.json", json.dumps(data, ensure_ascii=False, indent=2))
                        
                        # Add uploaded files
                        uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
                        if os.path.exists(uploads_dir):
                            uploaded_count = 0
                            for filename in os.listdir(uploads_dir):
                                filepath = os.path.join(uploads_dir, filename)
                                if os.path.isfile(filepath):
                                    try:
                                        with open(filepath, 'rb') as f:
                                            zip_file.writestr(f"uploads/{filename}", f.read())
                                            uploaded_count += 1
                                    except:
                                        pass
                            if uploaded_count:
                                backup_manifest["collections"].append({"name": "uploaded_files", "count": uploaded_count})
                        
                        zip_file.writestr("manifest.json", json.dumps(backup_manifest, ensure_ascii=False, indent=2))
                    
                    zip_buffer.seek(0)
                    tg_result = await send_to_tg(
                        backup_data=zip_buffer.getvalue(),
                        backup_info=backup_manifest,
                        chat_id=telegram_config["chat_id"],
                        bot_token=bot_token
                    )
                    telegram_sent = tg_result.get("success", False)
                    logger.info(f"Auto backup Telegram result: {tg_result}")
                    
                    if telegram_sent:
                        await db.settings.update_one(
                            {"type": "telegram_backup"},
                            {"$set": {"last_sent": backup_data["createdAt"]}},
                            upsert=True
                        )
                        logger.info("Auto backup sent to Telegram")
                    else:
                        logger.warning(f"Auto backup Telegram failed: {tg_result.get('error', 'unknown')}")
                except Exception as tg_error:
                    logger.warning(f"Failed to send auto backup to Telegram: {tg_error}")
            else:
                logger.warning("Auto backup: TELEGRAM_BOT_TOKEN not set")
        else:
            logger.info(f"Auto backup: Telegram not configured or disabled. config={telegram_config}")
        
        logger.info(f"Auto backup completed successfully. Size: {backup_data['size']} bytes")
        
        return {
            "success": True,
            "backupId": str(result.inserted_id),
            "createdAt": backup_data["createdAt"],
            "size": backup_data["size"],
            "telegram_sent": telegram_sent
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Auto backup error: {str(e)}\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Auto backup failed: {str(e)}")


@router.get("/download/{backup_id}")
async def download_backup(backup_id: str):
    """Download a stored backup as ZIP file"""
    try:
        from bson import ObjectId
        backup = await db.backups.find_one({"_id": ObjectId(backup_id)})
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        # Create ZIP from stored backup
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            collections = backup.get("collections", {})
            
            manifest = {
                "version": "1.0",
                "createdAt": backup.get("createdAt"),
                "collections": []
            }
            
            for name, data in collections.items():
                if data:
                    if isinstance(data, list):
                        zip_file.writestr(f"{name}.json", json.dumps(data, ensure_ascii=False, indent=2))
                        manifest["collections"].append({"name": name, "count": len(data)})
                    else:
                        zip_file.writestr(f"{name}.json", json.dumps(data, ensure_ascii=False, indent=2))
                        manifest["collections"].append({"name": name, "count": 1})
            
            zip_file.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        
        zip_buffer.seek(0)
        filename = f"backup_{backup.get('createdAt', 'unknown').replace(':', '-')}.zip"
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Download backup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{backup_id}")
async def delete_backup(backup_id: str):
    """Delete a stored backup"""
    try:
        from bson import ObjectId
        result = await db.backups.delete_one({"_id": ObjectId(backup_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Backup not found")
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete backup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# ============== Telegram Backup Endpoints ==============

@router.get("/telegram/debug")
async def debug_telegram_backup_config():
    """Debug endpoint to check telegram configuration status."""
    try:
        bot_token = await get_telegram_bot_token()
        telegram_backup = await db.settings.find_one({"type": "telegram_backup"})
        telegram_settings = await db.settings.find_one({"type": "telegram_settings"})
        
        return {
            "bot_token_found": bool(bot_token),
            "bot_token_source": "env" if os.environ.get('TELEGRAM_BOT_TOKEN') else ("telegram_settings" if telegram_settings and telegram_settings.get('bot_token') else ("telegram_backup" if telegram_backup and telegram_backup.get('bot_token') else "none")),
            "telegram_backup_config": {
                "exists": bool(telegram_backup),
                "enabled": telegram_backup.get('enabled') if telegram_backup else False,
                "chat_id": telegram_backup.get('chat_id', '') if telegram_backup else '',
                "has_bot_token": bool(telegram_backup.get('bot_token')) if telegram_backup else False
            },
            "telegram_settings_config": {
                "exists": bool(telegram_settings),
                "has_bot_token": bool(telegram_settings.get('bot_token')) if telegram_settings else False,
                "chat_id": telegram_settings.get('chat_id', '') if telegram_settings else ''
            },
            "env_bot_token_set": bool(os.environ.get('TELEGRAM_BOT_TOKEN', ''))
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/telegram/config")
async def get_telegram_backup_config():
    """Get Telegram backup configuration."""
    try:
        config = await db.settings.find_one({"type": "telegram_backup"})
        if config:
            config.pop('_id', None)
            return config
        return {
            "type": "telegram_backup",
            "chat_id": os.environ.get('TELEGRAM_BACKUP_CHAT_ID', ''),
            "enabled": False,
            "auto_send": False
        }
    except Exception as e:
        logger.error(f"Get telegram backup config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/telegram/config")
async def save_telegram_backup_config(config: TelegramBackupConfig):
    """Save Telegram backup configuration."""
    try:
        update_data = {
            "type": "telegram_backup",
            "chat_id": config.chat_id,
            "enabled": config.enabled,
            "auto_send": config.enabled  # Auto-send when enabled
        }
        
        # If bot_token provided, save it too
        if config.bot_token:
            update_data["bot_token"] = config.bot_token
        
        await db.settings.update_one(
            {"type": "telegram_backup"},
            {"$set": update_data},
            upsert=True
        )
        
        return {"success": True, "config": update_data}
    except Exception as e:
        logger.error(f"Save telegram backup config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/telegram/test")
async def test_telegram_backup_connection(config: TelegramBackupConfig):
    """Test connection to Telegram backup chat."""
    try:
        from services.telegram_service import test_backup_chat_connection
        
        # Try to get bot token from multiple sources
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        
        # If not in env, try to get from telegram notifications settings
        if not bot_token:
            tg_settings = await db.settings.find_one({"type": "telegram_settings"})
            if tg_settings:
                bot_token = tg_settings.get('bot_token', '')
        
        if not bot_token:
            return {"success": False, "error": "Токен бота не настроен. Сначала настройте Telegram уведомления."}
        
        if not config.chat_id:
            return {"success": False, "error": "Введите Chat ID"}
        
        result = await test_backup_chat_connection(bot_token, config.chat_id)
        return result
    except Exception as e:
        logger.error(f"Test telegram backup error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/telegram/send")
async def send_backup_to_telegram():
    """Create and send backup to Telegram immediately."""
    try:
        from services.telegram_service import send_backup_to_telegram as send_to_tg
        
        # Get config
        config = await db.settings.find_one({"type": "telegram_backup"})
        chat_id = config.get('chat_id') if config else os.environ.get('TELEGRAM_BACKUP_CHAT_ID', '')
        
        if not chat_id:
            raise HTTPException(status_code=400, detail="Chat ID для бэкапов не настроен")
        
        bot_token = await get_telegram_bot_token()
        if not bot_token:
            raise HTTPException(status_code=400, detail="Токен бота не настроен. Сначала настройте Telegram уведомления.")
        
        # Create backup ZIP in memory
        zip_buffer = io.BytesIO()
        backup_manifest = {
            "version": "2.0",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "collections": []
        }
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Export all collections (same as export_backup)
            
            # Balia orders
            balia_orders = await db.orders.find({}).to_list(10000)
            if balia_orders:
                balia_orders = [serialize_for_json(o) for o in balia_orders]
                zip_file.writestr("balia_orders.json", json.dumps(balia_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "balia_orders", "count": len(balia_orders)})
            
            # Sauna orders
            sauna_orders = await db.sauna_orders.find({}).to_list(10000)
            if sauna_orders:
                sauna_orders = [serialize_for_json(o) for o in sauna_orders]
                zip_file.writestr("sauna_orders.json", json.dumps(sauna_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "sauna_orders", "count": len(sauna_orders)})
            
            # Greenhouse orders
            greenhouse_orders = await db.greenhouse_orders.find({}).to_list(10000)
            if greenhouse_orders:
                greenhouse_orders = [serialize_for_json(o) for o in greenhouse_orders]
                zip_file.writestr("greenhouse_orders.json", json.dumps(greenhouse_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "greenhouse_orders", "count": len(greenhouse_orders)})
            
            # Web orders
            web_orders = await db.web_orders.find({}).to_list(10000)
            if web_orders:
                web_orders = [serialize_for_json(o) for o in web_orders]
                zip_file.writestr("web_orders.json", json.dumps(web_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "web_orders", "count": len(web_orders)})
            
            # Trips (logistics routes)
            trips = await db.trips.find({}).to_list(10000)
            if trips:
                trips = [serialize_for_json(t) for t in trips]
                zip_file.writestr("trips.json", json.dumps(trips, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "trips", "count": len(trips)})
            
            # Drivers
            drivers = await db.drivers.find({}).to_list(1000)
            if drivers:
                drivers = [serialize_for_json(d) for d in drivers]
                zip_file.writestr("drivers.json", json.dumps(drivers, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "drivers", "count": len(drivers)})
            
            # Users
            users = await db.users.find({}).to_list(1000)
            if users:
                users = [serialize_for_json(u) for u in users]
                zip_file.writestr("users.json", json.dumps(users, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "users", "count": len(users)})
            
            # Balia prices
            balia_prices = await db.prices.find_one({"type": "balia_prices"})
            if not balia_prices:
                balia_prices = await db.prices.find_one({"models": {"$exists": True}})
            if balia_prices:
                balia_prices = serialize_for_json(balia_prices)
                balia_prices["type"] = "balia_prices"
                base_url = os.environ.get('API_BASE_URL', os.environ.get('REACT_APP_BACKEND_URL', ''))
                if base_url:
                    try:
                        balia_prices = await embed_images_in_data(balia_prices, base_url)
                    except:
                        pass
                zip_file.writestr("balia_prices.json", json.dumps(balia_prices, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "balia_prices", "count": 1})
            
            # Sauna prices
            sauna_prices = await db.sauna_prices.find_one({"_id": "default"})
            if not sauna_prices:
                sauna_prices = await db.sauna_prices.find_one({})
            if sauna_prices:
                sauna_prices = serialize_for_json(sauna_prices)
                zip_file.writestr("sauna_prices.json", json.dumps(sauna_prices, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "sauna_prices", "count": 1})
            
            # Tech spec configs
            tech_spec_config = await db.tech_spec_config.find({}).to_list(100)
            if tech_spec_config:
                tech_spec_config = [serialize_for_json(t) for t in tech_spec_config]
                zip_file.writestr("tech_spec_config.json", json.dumps(tech_spec_config, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "tech_spec_config", "count": len(tech_spec_config)})
            
            balia_tech_spec_config = await db.balia_tech_spec_config.find({}).to_list(100)
            if balia_tech_spec_config:
                balia_tech_spec_config = [serialize_for_json(t) for t in balia_tech_spec_config]
                zip_file.writestr("balia_tech_spec_config.json", json.dumps(balia_tech_spec_config, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "balia_tech_spec_config", "count": len(balia_tech_spec_config)})
            
            # Images collection
            images_collection = await db.images.find({}).to_list(1000)
            if images_collection:
                images_collection = [serialize_for_json(i) for i in images_collection]
                zip_file.writestr("images_collection.json", json.dumps(images_collection, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "images_collection", "count": len(images_collection)})
            
            # Customer fields
            customer_fields = await db.customer_fields.find({}).to_list(100)
            if customer_fields:
                customer_fields = [serialize_for_json(f) for f in customer_fields]
                zip_file.writestr("customer_fields.json", json.dumps(customer_fields, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "customer_fields", "count": len(customer_fields)})
            
            # Settings
            all_settings = await db.settings.find({}).to_list(100)
            if all_settings:
                all_settings = [serialize_for_json(s) for s in all_settings]
                zip_file.writestr("settings.json", json.dumps(all_settings, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "settings", "count": len(all_settings)})
            
            # Telegram config
            # amoCRM settings
            amocrm_settings = await db.amocrm_settings.find({}).to_list(100)
            if amocrm_settings:
                amocrm_settings = [serialize_for_json(s) for s in amocrm_settings]
                zip_file.writestr("amocrm_settings.json", json.dumps(amocrm_settings, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "amocrm_settings", "count": len(amocrm_settings)})
            
            # Integration settings (includes amoCRM from integration_settings collection)
            integration_settings = await db.integration_settings.find({}).to_list(100)
            if integration_settings:
                integration_settings = [serialize_for_json(s) for s in integration_settings]
                zip_file.writestr("integration_settings.json", json.dumps(integration_settings, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "integration_settings", "count": len(integration_settings)})
            
            # Webhook logs (for debugging and audit)
            webhook_logs = await db.webhook_logs.find({}).to_list(10000)
            if webhook_logs:
                webhook_logs = [serialize_for_json(w) for w in webhook_logs]
                zip_file.writestr("webhook_logs.json", json.dumps(webhook_logs, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "webhook_logs", "count": len(webhook_logs)})
            
            telegram_config = {
                "bot_token": os.environ.get('TELEGRAM_BOT_TOKEN', ''),
                "chat_id": os.environ.get('TELEGRAM_CHAT_ID', ''),
                "backup_chat_id": chat_id
            }
            zip_file.writestr("telegram_config.json", json.dumps(telegram_config, ensure_ascii=False, indent=2))
            backup_manifest["collections"].append({"name": "telegram_config", "count": 1})
            
            # Uploaded files
            uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
            if os.path.exists(uploads_dir):
                uploaded_count = 0
                for filename in os.listdir(uploads_dir):
                    filepath = os.path.join(uploads_dir, filename)
                    if os.path.isfile(filepath):
                        try:
                            with open(filepath, 'rb') as f:
                                zip_file.writestr(f"uploads/{filename}", f.read())
                                uploaded_count += 1
                        except:
                            pass
                if uploaded_count:
                    backup_manifest["collections"].append({"name": "uploaded_files", "count": uploaded_count})
            
            # Write manifest
            zip_file.writestr("manifest.json", json.dumps(backup_manifest, ensure_ascii=False, indent=2))
        
        # Send to Telegram
        zip_buffer.seek(0)
        backup_bytes = zip_buffer.getvalue()
        
        result = await send_to_tg(
            backup_data=backup_bytes,
            backup_info=backup_manifest,
            chat_id=chat_id,
            bot_token=bot_token
        )
        
        if result.get('success'):
            # Update last backup time
            await db.settings.update_one(
                {"type": "telegram_backup"},
                {"$set": {"last_sent": datetime.now(timezone.utc).isoformat()}},
                upsert=True
            )
            
            return {
                "success": True,
                "message": "Бэкап отправлен в Telegram",
                "file_size": len(backup_bytes),
                "collections": len(backup_manifest["collections"])
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Ошибка отправки'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send backup to Telegram error: {e}")
        raise HTTPException(status_code=500, detail=str(e))