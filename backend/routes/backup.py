"""
Backup and restore functionality for the application.
Supports export/import of orders, users, prices, and images.
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

@router.post("/export")
async def export_backup():
    """
    Export all data as a ZIP file containing JSON files for each collection.
    Includes: orders, sauna_orders, web_orders, users, prices (balia & sauna)
    """
    try:
        # Create in-memory ZIP file
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            backup_manifest = {
                "version": "1.0",
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
            
            # Export Web orders
            web_orders = await db.web_orders.find({}).to_list(10000)
            if web_orders:
                web_orders = [serialize_for_json(o) for o in web_orders]
                zip_file.writestr("web_orders.json", json.dumps(web_orders, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "web_orders", "count": len(web_orders)})
                logger.info(f"Exported {len(web_orders)} web orders")
            
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
            
            # Export Sauna prices (including images as base64)
            sauna_prices = await db.prices.find_one({"type": "sauna_prices"})
            if sauna_prices:
                sauna_prices = serialize_for_json(sauna_prices)
                base_url = os.environ.get('REACT_APP_BACKEND_URL', os.environ.get('API_BASE_URL', ''))
                if base_url:
                    sauna_prices = await embed_images_in_data(sauna_prices, base_url)
                zip_file.writestr("sauna_prices.json", json.dumps(sauna_prices, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "sauna_prices", "count": 1})
                logger.info("Exported sauna prices with embedded images")
            
            # Export Tech specs
            tech_specs = await db.tech_specs.find({}).to_list(1000)
            if tech_specs:
                tech_specs = [serialize_for_json(t) for t in tech_specs]
                zip_file.writestr("tech_specs.json", json.dumps(tech_specs, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "tech_specs", "count": len(tech_specs)})
                logger.info(f"Exported {len(tech_specs)} tech specs")
            
            # Export Customer fields
            customer_fields = await db.customer_fields.find({}).to_list(100)
            if customer_fields:
                customer_fields = [serialize_for_json(f) for f in customer_fields]
                zip_file.writestr("customer_fields.json", json.dumps(customer_fields, ensure_ascii=False, indent=2))
                backup_manifest["collections"].append({"name": "customer_fields", "count": len(customer_fields)})
                logger.info(f"Exported {len(customer_fields)} customer fields")
            
            # Export Backup settings
            backup_settings = await db.settings.find_one({"type": "backup_settings"})
            if backup_settings:
                backup_settings = serialize_for_json(backup_settings)
                zip_file.writestr("backup_settings.json", json.dumps(backup_settings, ensure_ascii=False, indent=2))
            
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
            
            # Import Balia orders
            if "balia_orders.json" in file_list:
                try:
                    data = json.loads(zip_file.read("balia_orders.json").decode('utf-8'))
                    count = 0
                    for order in data:
                        order.pop('_id', None)  # Remove _id to allow new insertion
                        # Check if order with same orderId exists
                        existing = await db.orders.find_one({"orderId": order.get("orderId")})
                        if not existing:
                            await db.orders.insert_one(order)
                            count += 1
                    import_stats["imported"]["balia_orders"] = count
                    logger.info(f"Imported {count} balia orders")
                except Exception as e:
                    import_stats["errors"].append(f"balia_orders: {str(e)}")
            
            # Import Sauna orders
            if "sauna_orders.json" in file_list:
                try:
                    data = json.loads(zip_file.read("sauna_orders.json").decode('utf-8'))
                    count = 0
                    for order in data:
                        order.pop('_id', None)
                        existing = await db.sauna_orders.find_one({"orderId": order.get("orderId")})
                        if not existing:
                            await db.sauna_orders.insert_one(order)
                            count += 1
                    import_stats["imported"]["sauna_orders"] = count
                    logger.info(f"Imported {count} sauna orders")
                except Exception as e:
                    import_stats["errors"].append(f"sauna_orders: {str(e)}")
            
            # Import Web orders
            if "web_orders.json" in file_list:
                try:
                    data = json.loads(zip_file.read("web_orders.json").decode('utf-8'))
                    count = 0
                    for order in data:
                        order.pop('_id', None)
                        existing = await db.web_orders.find_one({"orderId": order.get("orderId")})
                        if not existing:
                            await db.web_orders.insert_one(order)
                            count += 1
                    import_stats["imported"]["web_orders"] = count
                    logger.info(f"Imported {count} web orders")
                except Exception as e:
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
                    # Replace existing balia prices
                    await db.prices.delete_one({"type": "balia_prices"})
                    await db.prices.insert_one(data)
                    import_stats["imported"]["balia_prices"] = 1
                    logger.info("Imported balia prices")
                except Exception as e:
                    import_stats["errors"].append(f"balia_prices: {str(e)}")
            
            # Import Sauna prices
            if "sauna_prices.json" in file_list:
                try:
                    data = json.loads(zip_file.read("sauna_prices.json").decode('utf-8'))
                    data.pop('_id', None)
                    await db.prices.delete_one({"type": "sauna_prices"})
                    await db.prices.insert_one(data)
                    import_stats["imported"]["sauna_prices"] = 1
                    logger.info("Imported sauna prices")
                except Exception as e:
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
                        await db.customer_fields.insert_one(field)
                    import_stats["imported"]["customer_fields"] = len(data)
                    logger.info(f"Imported {len(data)} customer fields")
                except Exception as e:
                    import_stats["errors"].append(f"customer_fields: {str(e)}")
        
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
    Called by a scheduled task or manually.
    """
    try:
        # Create backup data
        backup_data = {
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "collections": {}
        }
        
        # Collect all data
        balia_orders = await db.orders.find({}).to_list(10000)
        backup_data["collections"]["balia_orders"] = [serialize_for_json(o) for o in balia_orders]
        
        sauna_orders = await db.sauna_orders.find({}).to_list(10000)
        backup_data["collections"]["sauna_orders"] = [serialize_for_json(o) for o in sauna_orders]
        
        web_orders = await db.web_orders.find({}).to_list(10000)
        backup_data["collections"]["web_orders"] = [serialize_for_json(o) for o in web_orders]
        
        users = await db.users.find({}).to_list(1000)
        backup_data["collections"]["users"] = [serialize_for_json(u) for u in users]
        
        balia_prices = await db.prices.find_one({"type": "balia_prices"})
        if balia_prices:
            backup_data["collections"]["balia_prices"] = serialize_for_json(balia_prices)
        
        sauna_prices = await db.prices.find_one({"type": "sauna_prices"})
        if sauna_prices:
            backup_data["collections"]["sauna_prices"] = serialize_for_json(sauna_prices)
        
        tech_specs = await db.tech_specs.find({}).to_list(1000)
        backup_data["collections"]["tech_specs"] = [serialize_for_json(t) for t in tech_specs]
        
        customer_fields = await db.customer_fields.find({}).to_list(100)
        backup_data["collections"]["customer_fields"] = [serialize_for_json(f) for f in customer_fields]
        
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
        
        return {
            "success": True,
            "backupId": str(result.inserted_id),
            "createdAt": backup_data["createdAt"],
            "size": backup_data["size"]
        }
        
    except Exception as e:
        logger.error(f"Auto backup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
