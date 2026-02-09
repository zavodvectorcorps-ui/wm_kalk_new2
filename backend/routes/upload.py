"""File upload routes for images with MongoDB storage and Cloudinary support."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
import uuid
import logging
import base64
from pathlib import Path
from PIL import Image
import io

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
    """Serve an uploaded file from MongoDB with caching and CORS headers."""
    # Extract ID from filename (remove extension)
    file_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Find image in MongoDB
    image_doc = await db.images.find_one({"id": file_id})
    
    if not image_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Decode base64 content
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
async def delete_image(filename: str):
    """Delete an uploaded image from MongoDB."""
    # Extract ID from filename
    file_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Delete from MongoDB
    result = await db.images.delete_one({"id": file_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    
    logger.info(f"Deleted image from MongoDB: {filename}")
    
    return {"message": "File deleted successfully"}
