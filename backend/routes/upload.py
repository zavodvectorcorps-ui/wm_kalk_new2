"""File upload routes for images with MongoDB storage and Cloudinary support."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
import uuid
import logging
import base64
from pathlib import Path
from PIL import Image
import io
import cloudinary
import cloudinary.uploader

from database import db
from services.cloudinary_service import (
    is_cloudinary_configured, 
    upload_image as cloudinary_upload,
    delete_image as cloudinary_delete,
    generate_signature
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Upload"])

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB upload limit
MAX_IMAGE_DIMENSION = 1200  # Max width/height after resize
JPEG_QUALITY = 85  # Quality for JPEG compression


def optimize_image(content: bytes, max_size: int = MAX_IMAGE_DIMENSION) -> tuple[bytes, str]:
    """
    Optimize image: resize if too large and compress.
    Returns optimized image bytes and extension.
    """
    try:
        img = Image.open(io.BytesIO(content))
        
        # Convert RGBA to RGB for JPEG (remove alpha channel)
        if img.mode in ('RGBA', 'P'):
            # Create white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[3] if len(img.split()) > 3 else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize if too large (preserve aspect ratio)
        width, height = img.size
        if width > max_size or height > max_size:
            ratio = min(max_size / width, max_size / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        
        # Save as optimized JPEG
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=JPEG_QUALITY, optimize=True)
        optimized_content = output.getvalue()
        
        original_size = len(content)
        new_size = len(optimized_content)
        logger.info(f"Optimized image: {original_size/1024:.1f}KB -> {new_size/1024:.1f}KB ({100-new_size*100/original_size:.0f}% reduction)")
        
        return optimized_content, '.jpg'
        
    except Exception as e:
        logger.warning(f"Could not optimize image: {e}")
        # Return original if optimization fails
        return content, None


@router.post("/upload/image")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file, optimize it, and store in Cloudinary or MongoDB."""
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
        )
    
    # Optimize the image
    optimized_content, new_ext = optimize_image(content)
    if new_ext:
        file_ext = new_ext
    
    # Generate unique filename
    unique_id = uuid.uuid4().hex
    unique_filename = f"{unique_id}{file_ext}"
    
    # Try Cloudinary first if configured
    if is_cloudinary_configured():
        result = await cloudinary_upload(optimized_content, unique_filename, folder="wm-calculator")
        if result:
            # Store reference in MongoDB for tracking
            image_doc = {
                "id": unique_id,
                "filename": unique_filename,
                "cloudinary_url": result["url"],
                "cloudinary_public_id": result["public_id"],
                "storage": "cloudinary",
                "size": len(optimized_content)
            }
            await db.images.insert_one(image_doc)
            
            logger.info(f"Uploaded image to Cloudinary: {result['url']}")
            
            return {
                "filename": unique_filename,
                "url": result["url"]  # Return Cloudinary URL directly
            }
    
    # Fallback to MongoDB storage
    base64_content = base64.b64encode(optimized_content).decode('utf-8')
    
    image_doc = {
        "id": unique_id,
        "filename": unique_filename,
        "content": base64_content,
        "content_type": "image/jpeg",
        "storage": "mongodb",
        "size": len(optimized_content)
    }
    
    await db.images.insert_one(image_doc)
    
    logger.info(f"Uploaded image to MongoDB: {unique_filename} ({len(optimized_content)/1024:.1f}KB)")
    
    return {
        "filename": unique_filename,
        "url": f"/api/uploads/{unique_filename}"
    }


@router.get("/cloudinary/signature")
async def get_cloudinary_signature(folder: str = "wm-calculator"):
    """Get signed upload params for direct frontend upload to Cloudinary"""
    if not is_cloudinary_configured():
        raise HTTPException(status_code=503, detail="Cloudinary not configured")
    
    signature = generate_signature(folder)
    if not signature:
        raise HTTPException(status_code=500, detail="Failed to generate signature")
    
    return signature


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve an uploaded file from MongoDB or redirect to Cloudinary."""
    # Extract ID from filename (remove extension)
    file_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Find image in MongoDB
    image_doc = await db.images.find_one({"id": file_id})
    
    if not image_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # If stored in Cloudinary, redirect to CDN URL
    if image_doc.get("storage") == "cloudinary" and image_doc.get("cloudinary_url"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=image_doc["cloudinary_url"], status_code=302)
    
    # Decode base64 content for MongoDB storage
    if "content" not in image_doc:
        raise HTTPException(status_code=404, detail="File content not found")
    
    try:
        content = base64.b64decode(image_doc["content"])
    except Exception as e:
        logger.error(f"Failed to decode image: {e}")
        raise HTTPException(status_code=500, detail="Failed to decode image")
    
    content_type = image_doc.get("content_type", "image/jpeg")
    
    # Return with cache and CORS headers
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
            "X-Content-Type-Options": "nosniff"
        }
    )


@router.delete("/upload/image/{filename}")
async def delete_uploaded_image(filename: str):
    """Delete an uploaded image from Cloudinary or MongoDB."""
    # Extract ID from filename
    file_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Find in MongoDB first
    image_doc = await db.images.find_one({"id": file_id})
    
    if not image_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # If stored in Cloudinary, delete from there too
    if image_doc.get("storage") == "cloudinary" and image_doc.get("cloudinary_public_id"):
        cloudinary_delete(image_doc["cloudinary_public_id"])
        logger.info(f"Deleted image from Cloudinary: {image_doc['cloudinary_public_id']}")
    
    # Delete from MongoDB
    result = await db.images.delete_one({"id": file_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    
    logger.info(f"Deleted image record: {filename}")
    
    return {"message": "File deleted successfully"}


@router.get("/upload/storage-status")
async def get_storage_status():
    """Check which storage backend is active"""
    cloudinary_active = is_cloudinary_configured()
    
    # Count images by storage type
    mongodb_count = await db.images.count_documents({"storage": {"$ne": "cloudinary"}})
    cloudinary_count = await db.images.count_documents({"storage": "cloudinary"})
    
    return {
        "cloudinary_configured": cloudinary_active,
        "primary_storage": "cloudinary" if cloudinary_active else "mongodb",
        "images_in_mongodb": mongodb_count,
        "images_in_cloudinary": cloudinary_count
    }


@router.post("/upload/migrate-to-cloudinary")
async def migrate_images_to_cloudinary():
    """Migrate all base64 images from prices to Cloudinary.
    
    This will significantly reduce the size of /api/prices responses.
    Should only be run once.
    """
    import re
    
    if not is_cloudinary_configured():
        raise HTTPException(status_code=400, detail="Cloudinary not configured")
    
    def is_base64_image(value: str) -> bool:
        """Check if a string is a base64 encoded image"""
        if not isinstance(value, str):
            return False
        if value.startswith('data:image'):
            return True
        if len(value) > 1000 and not value.startswith('http') and not value.startswith('/'):
            try:
                clean = re.sub(r'\s', '', value)
                if re.match(r'^[A-Za-z0-9+/]+=*$', clean[:100]):
                    return True
            except:
                pass
        return False
    
    def upload_base64(base64_data: str, public_id: str, folder: str) -> str:
        """Upload base64 to Cloudinary"""
        try:
            if base64_data.startswith("data:"):
                upload_data = base64_data
            else:
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
            return result.get("secure_url")
        except Exception as e:
            logger.error(f"Upload failed for {public_id}: {e}")
            return None
    
    def process_dict(data: dict, path: str = "", folder: str = "wm-calculator"):
        """Recursively process dict and upload base64 images"""
        if not isinstance(data, dict):
            return data, 0, 0
        
        result = {}
        found = 0
        uploaded = 0
        
        for key, value in data.items():
            current_path = f"{path}.{key}" if path else key
            
            if isinstance(value, str) and is_base64_image(value):
                found += 1
                safe_path = re.sub(r'[^a-zA-Z0-9_-]', '_', current_path)[:50]
                public_id = f"{folder}/{safe_path}"
                
                url = upload_base64(value, public_id, folder)
                if url:
                    result[key] = url
                    uploaded += 1
                    logger.info(f"Migrated: {current_path} ({len(value)} chars) -> {url}")
                else:
                    result[key] = value
                    
            elif isinstance(value, dict):
                processed, f, u = process_dict(value, current_path, folder)
                result[key] = processed
                found += f
                uploaded += u
                
            elif isinstance(value, list):
                processed_list = []
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        processed, f, u = process_dict(item, f"{current_path}[{i}]", folder)
                        processed_list.append(processed)
                        found += f
                        uploaded += u
                    elif isinstance(item, str) and is_base64_image(item):
                        found += 1
                        safe_path = re.sub(r'[^a-zA-Z0-9_-]', '_', f"{current_path}_{i}")[:50]
                        public_id = f"{folder}/{safe_path}"
                        url = upload_base64(item, public_id, folder)
                        if url:
                            processed_list.append(url)
                            uploaded += 1
                        else:
                            processed_list.append(item)
                    else:
                        processed_list.append(item)
                result[key] = processed_list
            else:
                result[key] = value
        
        return result, found, uploaded
    
    results = {
        "sauna": {"found": 0, "uploaded": 0, "original_size": 0, "new_size": 0},
        "balia": {"found": 0, "uploaded": 0, "original_size": 0, "new_size": 0}
    }
    
    import json
    
    # Migrate SAUNA prices
    sauna_prices = await db.sauna_prices.find_one({"_id": "default"})
    if sauna_prices:
        results["sauna"]["original_size"] = len(json.dumps(sauna_prices, default=str))
        
        processed, found, uploaded = process_dict(sauna_prices, folder="wm-calculator/sauna")
        results["sauna"]["found"] = found
        results["sauna"]["uploaded"] = uploaded
        
        if uploaded > 0:
            processed.pop('_id', None)
            await db.sauna_prices.update_one({"_id": "default"}, {"$set": processed})
            results["sauna"]["new_size"] = len(json.dumps(processed, default=str))
    
    # Migrate BALIA prices
    balia_prices = await db.prices.find_one({"_id": "default"})
    if balia_prices:
        results["balia"]["original_size"] = len(json.dumps(balia_prices, default=str))
        
        processed, found, uploaded = process_dict(balia_prices, folder="wm-calculator/balia")
        results["balia"]["found"] = found
        results["balia"]["uploaded"] = uploaded
        
        if uploaded > 0:
            processed.pop('_id', None)
            await db.prices.update_one({"_id": "default"}, {"$set": processed})
            results["balia"]["new_size"] = len(json.dumps(processed, default=str))
    
    total_found = results["sauna"]["found"] + results["balia"]["found"]
    total_uploaded = results["sauna"]["uploaded"] + results["balia"]["uploaded"]
    
    original_total = results["sauna"]["original_size"] + results["balia"]["original_size"]
    new_total = results["sauna"]["new_size"] + results["balia"]["new_size"]
    
    return {
        "status": "ok",
        "message": f"Migrated {total_uploaded} images to Cloudinary",
        "details": results,
        "total_found": total_found,
        "total_uploaded": total_uploaded,
        "size_reduction_kb": (original_total - new_total) / 1024 if new_total else 0,
        "size_reduction_percent": ((1 - new_total / original_total) * 100) if original_total and new_total else 0
    }

