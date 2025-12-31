"""File upload routes for images with optimization."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import os
import uuid
import logging
from pathlib import Path
from PIL import Image
import io

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Upload"])

# Create uploads directory
UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
    """Upload an image file, optimize it, and return its URL."""
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
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save optimized file
    with open(file_path, "wb") as f:
        f.write(optimized_content)
    
    logger.info(f"Uploaded optimized image: {unique_filename} ({len(optimized_content)/1024:.1f}KB)")
    
    # Return the URL path (relative to API)
    return {
        "filename": unique_filename,
        "url": f"/api/uploads/{unique_filename}"
    }


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve an uploaded file with caching and CORS headers."""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Security check - prevent path traversal
    if not file_path.resolve().is_relative_to(UPLOAD_DIR.resolve()):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine media type
    ext = file_path.suffix.lower()
    media_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    }
    media_type = media_types.get(ext, 'application/octet-stream')
    
    # Add cache and CORS headers for better performance
    return FileResponse(
        file_path,
        media_type=media_type,
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
    """Delete an uploaded image."""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Security check
    if not file_path.resolve().is_relative_to(UPLOAD_DIR.resolve()):
        raise HTTPException(status_code=403, detail="Access denied")
    
    os.remove(file_path)
    logger.info(f"Deleted image: {filename}")
    
    return {"message": "File deleted successfully"}
