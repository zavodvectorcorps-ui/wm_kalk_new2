"""Cloudinary service for image uploads and management."""
import cloudinary
import cloudinary.uploader
import cloudinary.utils
import os
import time
import logging
from typing import Optional, Dict
import base64
from pathlib import Path
from dotenv import load_dotenv

# Load .env
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Initialize Cloudinary configuration
def init_cloudinary():
    """Initialize Cloudinary with environment variables"""
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
        logger.info("Cloudinary configured successfully")
        return True
    else:
        logger.warning("Cloudinary not configured - missing environment variables")
        return False

def is_cloudinary_configured() -> bool:
    """Check if Cloudinary is properly configured"""
    return bool(
        os.environ.get("CLOUDINARY_CLOUD_NAME") and
        os.environ.get("CLOUDINARY_API_KEY") and
        os.environ.get("CLOUDINARY_API_SECRET")
    )

def generate_signature(folder: str = "wm-calculator") -> Dict:
    """Generate signed upload parameters for frontend upload"""
    if not is_cloudinary_configured():
        return None
    
    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
    }
    
    signature = cloudinary.utils.api_sign_request(
        params,
        os.environ.get("CLOUDINARY_API_SECRET")
    )
    
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.environ.get("CLOUDINARY_API_KEY"),
        "folder": folder,
    }

async def upload_image(file_content: bytes, filename: str, folder: str = "wm-calculator") -> Optional[Dict]:
    """Upload image to Cloudinary from backend"""
    if not is_cloudinary_configured():
        return None
    
    try:
        # Generate a unique public_id from filename
        public_id = f"{folder}/{filename.rsplit('.', 1)[0]}"
        
        result = cloudinary.uploader.upload(
            file_content,
            public_id=public_id,
            folder=folder,
            resource_type="image",
            overwrite=True,
            # Optimize images automatically
            transformation=[
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        
        logger.info(f"Uploaded image to Cloudinary: {result.get('public_id')}")
        
        return {
            "public_id": result.get("public_id"),
            "url": result.get("secure_url"),
            "width": result.get("width"),
            "height": result.get("height"),
            "format": result.get("format"),
            "bytes": result.get("bytes")
        }
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        return None

async def upload_base64_image(base64_data: str, filename: str, folder: str = "wm-calculator") -> Optional[Dict]:
    """Upload base64 encoded image to Cloudinary"""
    if not is_cloudinary_configured():
        return None
    
    try:
        # Handle data URI format
        if base64_data.startswith("data:"):
            base64_data = base64_data.split(",", 1)[1]
        
        result = cloudinary.uploader.upload(
            f"data:image/jpeg;base64,{base64_data}",
            folder=folder,
            resource_type="image",
            overwrite=True,
            transformation=[
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        
        return {
            "public_id": result.get("public_id"),
            "url": result.get("secure_url"),
        }
    except Exception as e:
        logger.error(f"Cloudinary base64 upload failed: {e}")
        return None

def get_optimized_url(public_id: str, width: int = None, height: int = None) -> str:
    """Get optimized URL for an image with optional transformations"""
    if not is_cloudinary_configured():
        return None
    
    transformations = ["f_auto", "q_auto"]
    
    if width:
        transformations.append(f"w_{width}")
    if height:
        transformations.append(f"h_{height}")
    
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    transform_str = ",".join(transformations)
    
    return f"https://res.cloudinary.com/{cloud_name}/image/upload/{transform_str}/{public_id}"

def delete_image(public_id: str) -> bool:
    """Delete image from Cloudinary"""
    if not is_cloudinary_configured():
        return False
    
    try:
        result = cloudinary.uploader.destroy(public_id, invalidate=True)
        return result.get("result") == "ok"
    except Exception as e:
        logger.error(f"Cloudinary delete failed: {e}")
        return False


async def upload_pdf(pdf_bytes: bytes, filename: str, folder: str = "wm-calculator/pdfs") -> Optional[Dict]:
    """Upload PDF to Cloudinary.
    
    Args:
        pdf_bytes: PDF file content as bytes
        filename: Original filename (used for public_id)
        folder: Cloudinary folder path
        
    Returns:
        Dict with url, public_id etc. or None if failed
    """
    if not is_cloudinary_configured():
        logger.warning("Cloudinary not configured - cannot upload PDF")
        return None
    
    try:
        # Generate unique public_id from filename — KEEP the .pdf extension so
        # the delivered raw URL ends with .pdf and browsers save it correctly.
        import uuid
        unique_id = uuid.uuid4().hex[:8]
        base = filename.replace(' ', '_')
        if base.lower().endswith('.pdf'):
            base = base[:-4]
        public_id = f"{folder}/{base}_{unique_id}.pdf"
        
        result = cloudinary.uploader.upload(
            pdf_bytes,
            public_id=public_id,
            resource_type="raw",  # Important: PDF is not an image
            overwrite=True,
            access_mode="public"  # Make it publicly accessible
        )
        
        logger.info(f"Uploaded PDF to Cloudinary: {result.get('public_id')}")
        
        return {
            "public_id": result.get("public_id"),
            "url": result.get("secure_url"),
            "bytes": result.get("bytes"),
            "format": result.get("format"),
            "resource_type": result.get("resource_type")
        }
    except Exception as e:
        logger.error(f"Cloudinary PDF upload failed: {e}")
        return None


# Initialize on module load
init_cloudinary()


async def upload_audio(audio_bytes: bytes, filename: str, folder: str = "wm-calculator/calls") -> Optional[Dict]:
    """Upload audio file (mp3/wav/m4a/etc.) to Cloudinary.

    Cloudinary stores audio under resource_type="video" — that's their convention
    and it works for streaming/direct download.
    """
    if not is_cloudinary_configured():
        logger.warning("Cloudinary not configured — cannot upload audio")
        return None
    try:
        import uuid as _uuid
        unique_id = _uuid.uuid4().hex[:8]
        safe_name = filename.replace(' ', '_').rsplit('.', 1)[0][:60]
        public_id = f"{folder}/{safe_name}_{unique_id}"
        result = cloudinary.uploader.upload(
            audio_bytes,
            public_id=public_id,
            resource_type="video",  # audio uses video resource type in Cloudinary
            overwrite=True,
            access_mode="public",
        )
        logger.info(f"Uploaded audio to Cloudinary: {result.get('public_id')} ({result.get('bytes')} bytes)")
        return {
            "public_id": result.get("public_id"),
            "url": result.get("secure_url"),
            "bytes": result.get("bytes"),
            "format": result.get("format"),
            "duration": result.get("duration"),
        }
    except Exception as e:
        logger.error(f"Cloudinary audio upload failed: {e}")
        return None


def delete_audio(public_id: str) -> bool:
    """Delete audio from Cloudinary."""
    if not is_cloudinary_configured():
        return False
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="video", invalidate=True)
        return result.get("result") == "ok"
    except Exception as e:
        logger.error(f"Cloudinary audio delete failed: {e}")
        return False
