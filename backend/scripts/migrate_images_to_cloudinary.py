"""
Migration script: Move base64 images from MongoDB prices to Cloudinary.
This will significantly reduce the size of prices API response.
"""
import asyncio
import os
import sys
import base64
import logging
import re
from typing import Optional, Dict, List, Tuple

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cloudinary
import cloudinary.uploader
from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Cloudinary
def init_cloudinary():
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    api_key = os.environ.get("CLOUDINARY_API_KEY")
    api_secret = os.environ.get("CLOUDINARY_API_SECRET")
    
    if cloud_name and api_key and api_secret:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        logger.info("Cloudinary configured")
        return True
    else:
        logger.error("Cloudinary not configured!")
        return False

def is_base64_image(value: str) -> bool:
    """Check if a string is a base64 encoded image"""
    if not isinstance(value, str):
        return False
    # Check for data URI or raw base64 that looks like image data
    if value.startswith('data:image'):
        return True
    # Check if it's a very long string that could be base64 (images are usually >1KB)
    if len(value) > 1000 and not value.startswith('http') and not value.startswith('/'):
        # Try to detect base64 pattern
        try:
            # Remove whitespace and check if it's valid base64
            clean = re.sub(r'\s', '', value)
            if re.match(r'^[A-Za-z0-9+/]+=*$', clean[:100]):
                return True
        except:
            pass
    return False

def upload_base64_to_cloudinary(base64_data: str, public_id: str, folder: str = "wm-calculator") -> Optional[str]:
    """Upload base64 image to Cloudinary and return URL"""
    try:
        # Handle data URI format
        if base64_data.startswith("data:"):
            # Keep the data URI as-is for upload
            upload_data = base64_data
        else:
            # Assume JPEG if no prefix
            upload_data = f"data:image/jpeg;base64,{base64_data}"
        
        result = cloudinary.uploader.upload(
            upload_data,
            public_id=public_id,
            folder=folder,
            resource_type="image",
            overwrite=True,
            transformation=[
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        
        url = result.get("secure_url")
        logger.info(f"Uploaded: {public_id} -> {url}")
        return url
        
    except Exception as e:
        logger.error(f"Failed to upload {public_id}: {e}")
        return None

def process_dict_for_images(data: dict, path: str = "", folder: str = "wm-calculator") -> Tuple[dict, int, int]:
    """
    Recursively process a dictionary and upload any base64 images to Cloudinary.
    Returns: (updated_data, images_found, images_uploaded)
    """
    if not isinstance(data, dict):
        return data, 0, 0
    
    result = {}
    total_found = 0
    total_uploaded = 0
    
    for key, value in data.items():
        current_path = f"{path}.{key}" if path else key
        
        if isinstance(value, str) and is_base64_image(value):
            total_found += 1
            # Generate a unique ID for this image
            safe_path = re.sub(r'[^a-zA-Z0-9_-]', '_', current_path)[:50]
            public_id = f"{folder}/{safe_path}"
            
            # Upload to Cloudinary
            url = upload_base64_to_cloudinary(value, public_id, folder)
            if url:
                result[key] = url
                total_uploaded += 1
                logger.info(f"  Replaced {current_path} ({len(value)} chars) -> {url}")
            else:
                result[key] = value  # Keep original if upload failed
                
        elif isinstance(value, dict):
            processed, found, uploaded = process_dict_for_images(value, current_path, folder)
            result[key] = processed
            total_found += found
            total_uploaded += uploaded
            
        elif isinstance(value, list):
            processed_list = []
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    processed, found, uploaded = process_dict_for_images(item, f"{current_path}[{i}]", folder)
                    processed_list.append(processed)
                    total_found += found
                    total_uploaded += uploaded
                elif isinstance(item, str) and is_base64_image(item):
                    total_found += 1
                    safe_path = re.sub(r'[^a-zA-Z0-9_-]', '_', f"{current_path}_{i}")[:50]
                    public_id = f"{folder}/{safe_path}"
                    url = upload_base64_to_cloudinary(item, public_id, folder)
                    if url:
                        processed_list.append(url)
                        total_uploaded += 1
                    else:
                        processed_list.append(item)
                else:
                    processed_list.append(item)
            result[key] = processed_list
        else:
            result[key] = value
    
    return result, total_found, total_uploaded

async def migrate_sauna_prices(db):
    """Migrate base64 images in sauna prices to Cloudinary"""
    logger.info("=" * 50)
    logger.info("Migrating SAUNA prices...")
    
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        logger.info("No sauna prices found")
        return 0, 0
    
    # Calculate original size
    import json
    original_size = len(json.dumps(prices, default=str))
    logger.info(f"Original sauna prices size: {original_size / 1024:.1f} KB")
    
    # Process and upload images
    processed, found, uploaded = process_dict_for_images(prices, folder="wm-calculator/sauna")
    
    if uploaded > 0:
        # Update database
        processed.pop('_id', None)
        await db.sauna_prices.update_one(
            {"_id": "default"},
            {"$set": processed}
        )
        
        new_size = len(json.dumps(processed, default=str))
        logger.info(f"New sauna prices size: {new_size / 1024:.1f} KB")
        logger.info(f"Size reduction: {(original_size - new_size) / 1024:.1f} KB ({(1 - new_size/original_size) * 100:.1f}%)")
    
    logger.info(f"Sauna: Found {found} base64 images, uploaded {uploaded}")
    return found, uploaded

async def migrate_balia_prices(db):
    """Migrate base64 images in balia prices to Cloudinary"""
    logger.info("=" * 50)
    logger.info("Migrating BALIA prices...")
    
    prices = await db.prices.find_one({"_id": "default"})
    if not prices:
        logger.info("No balia prices found")
        return 0, 0
    
    import json
    original_size = len(json.dumps(prices, default=str))
    logger.info(f"Original balia prices size: {original_size / 1024:.1f} KB")
    
    processed, found, uploaded = process_dict_for_images(prices, folder="wm-calculator/balia")
    
    if uploaded > 0:
        processed.pop('_id', None)
        await db.prices.update_one(
            {"_id": "default"},
            {"$set": processed}
        )
        
        new_size = len(json.dumps(processed, default=str))
        logger.info(f"New balia prices size: {new_size / 1024:.1f} KB")
        logger.info(f"Size reduction: {(original_size - new_size) / 1024:.1f} KB ({(1 - new_size/original_size) * 100:.1f}%)")
    
    logger.info(f"Balia: Found {found} base64 images, uploaded {uploaded}")
    return found, uploaded

async def migrate_mongodb_images(db):
    """Migrate base64 images stored in the images collection to Cloudinary"""
    logger.info("=" * 50)
    logger.info("Migrating MongoDB images collection...")
    
    images = await db.images.find({}).to_list(length=1000)
    if not images:
        logger.info("No images in MongoDB collection")
        return 0, 0
    
    found = 0
    uploaded = 0
    
    for img in images:
        content = img.get("content", "")
        if content and is_base64_image(content):
            found += 1
            img_id = img.get("id", img.get("_id", "unknown"))
            public_id = f"wm-calculator/uploads/{img_id}"
            
            url = upload_base64_to_cloudinary(content, public_id, "wm-calculator/uploads")
            if url:
                uploaded += 1
                # Update the image document with Cloudinary URL
                await db.images.update_one(
                    {"_id": img["_id"]},
                    {"$set": {"cloudinary_url": url}}
                )
    
    logger.info(f"MongoDB images: Found {found} base64 images, uploaded {uploaded}")
    return found, uploaded

async def run_migration():
    """Run the full migration"""
    logger.info("Starting image migration to Cloudinary...")
    
    if not init_cloudinary():
        logger.error("Cannot proceed without Cloudinary configuration")
        return
    
    # Connect to MongoDB
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "wm_kalkulator")
    
    if not mongo_url:
        logger.error("MONGO_URL not set")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    total_found = 0
    total_uploaded = 0
    
    # Migrate sauna prices
    found, uploaded = await migrate_sauna_prices(db)
    total_found += found
    total_uploaded += uploaded
    
    # Migrate balia prices
    found, uploaded = await migrate_balia_prices(db)
    total_found += found
    total_uploaded += uploaded
    
    # Migrate MongoDB images collection
    found, uploaded = await migrate_mongodb_images(db)
    total_found += found
    total_uploaded += uploaded
    
    logger.info("=" * 50)
    logger.info(f"MIGRATION COMPLETE!")
    logger.info(f"Total base64 images found: {total_found}")
    logger.info(f"Total images uploaded to Cloudinary: {total_uploaded}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
