"""Content generator routes - AI image processing for sauna photos."""
import os
import uuid
import base64
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from database import db
from services.cloudinary_service import upload_base64_image, is_cloudinary_configured

load_dotenv()

router = APIRouter(prefix="/api/content", tags=["content"])

# Default prompt for sauna background replacement
DEFAULT_SAUNA_PROMPT = """Это фотография уличной мобильной сауны. Сохрани вид и пропорции сауны, цвет дерева и все детали конструкции. Замени реальный фон на простой загородный участок в Польше: небольшой неслишком современный дачный дом, немного сада, деревья, натуральная земля и трава. Дом должен выглядеть обычным, аккуратным, без дорогого дизайна, без ярких цветов. Сохрани естественный дневной свет и тени, как на исходном фото. Если через окна или стеклянные двери видно улицу или здания, тоже замени их на тот же дачный фон, чтобы сцена выглядела цельной. Сделай картинку чистой и пригодной для каталога и рекламы, без лишних объектов, автомобилей и людей."""

# MongoDB collections
def get_jobs_collection():
    return db.content_jobs

def get_images_collection():
    return db.content_images


class ProcessingJob(BaseModel):
    job_id: str
    status: str  # pending, processing, completed, error
    total_images: int
    processed_images: int
    results: List[dict]
    error: Optional[str] = None
    created_at: str


async def process_single_image(image_bytes: bytes, prompt: str, filename: str) -> dict:
    """Process a single image through Nano Banana Pro API and save to Cloudinary."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return {
            "success": False,
            "original_filename": filename,
            "error": "EMERGENT_LLM_KEY not configured"
        }
    
    try:
        # Encode image to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Create chat instance
        chat = LlmChat(
            api_key=api_key, 
            session_id=f"sauna-edit-{uuid.uuid4()}", 
            system_message="You are an AI image editor specializing in background replacement."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        # Create message with image
        msg = UserMessage(
            text=prompt,
            file_contents=[ImageContent(image_base64)]
        )
        
        # Send and get response
        text, images = await chat.send_message_multimodal_response(msg)
        
        if images and len(images) > 0:
            # Generate unique filename
            output_filename = f"processed_{uuid.uuid4().hex[:8]}_{filename.rsplit('.', 1)[0]}"
            
            # Upload to Cloudinary
            if is_cloudinary_configured():
                cloudinary_result = await upload_base64_image(
                    images[0]['data'], 
                    output_filename, 
                    folder="sauna-processed"
                )
                
                if cloudinary_result:
                    # Store metadata in MongoDB (without image data)
                    await get_images_collection().insert_one({
                        "filename": output_filename,
                        "original_filename": filename,
                        "cloudinary_url": cloudinary_result["url"],
                        "cloudinary_public_id": cloudinary_result["public_id"],
                        "created_at": datetime.now().isoformat()
                    })
                    
                    return {
                        "success": True,
                        "original_filename": filename,
                        "processed_filename": output_filename,
                        "url": cloudinary_result["url"],
                        "text_response": text[:200] if text else None
                    }
                else:
                    return {
                        "success": False,
                        "original_filename": filename,
                        "error": "Failed to upload to Cloudinary"
                    }
            else:
                return {
                    "success": False,
                    "original_filename": filename,
                    "error": "Cloudinary not configured"
                }
        else:
            return {
                "success": False,
                "original_filename": filename,
                "error": "No image returned from AI"
            }
            
    except Exception as e:
        return {
            "success": False,
            "original_filename": filename,
            "error": str(e)
        }


@router.post("/process-sauna-image")
async def process_sauna_image(
    file: UploadFile = File(...),
    prompt: str = Form(default=DEFAULT_SAUNA_PROMPT)
):
    """Process a single sauna image - replace background with countryside scene."""
    
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images are supported")
    
    # Read file content
    image_bytes = await file.read()
    
    # Process image
    result = await process_single_image(image_bytes, prompt, file.filename)
    
    if result["success"]:
        return JSONResponse(content=result)
    else:
        raise HTTPException(status_code=502, detail=result.get("error", "Image processing failed"))


@router.post("/process-batch")
async def process_batch_images(
    files: List[UploadFile] = File(...),
    prompt: str = Form(default=DEFAULT_SAUNA_PROMPT)
):
    """Start batch processing of multiple images. Returns job_id for status tracking."""
    
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images allowed per batch")
    
    # Validate all files
    for file in files:
        if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.filename}")
    
    # Create job
    job_id = str(uuid.uuid4())
    job_data = {
        "job_id": job_id,
        "status": "pending",
        "total_images": len(files),
        "processed_images": 0,
        "results": [],
        "error": None,
        "created_at": datetime.now().isoformat()
    }
    
    # Save job to MongoDB
    await get_jobs_collection().insert_one(job_data)
    
    # Read all files into memory before starting async processing
    files_data = []
    for file in files:
        content = await file.read()
        files_data.append({
            "filename": file.filename,
            "content": content
        })
    
    # Start background processing
    asyncio.create_task(process_batch_background(job_id, files_data, prompt))
    
    return {"job_id": job_id, "status": "pending", "total_images": len(files)}


async def process_batch_background(job_id: str, files_data: List[dict], prompt: str):
    """Background task to process images one by one."""
    
    jobs_collection = get_jobs_collection()
    await jobs_collection.update_one({"job_id": job_id}, {"$set": {"status": "processing"}})
    
    results = []
    for i, file_info in enumerate(files_data):
        try:
            result = await process_single_image(
                file_info["content"], 
                prompt, 
                file_info["filename"]
            )
            results.append(result)
        except Exception as e:
            results.append({
                "success": False,
                "original_filename": file_info["filename"],
                "error": str(e)
            })
        
        # Update progress in MongoDB
        await jobs_collection.update_one(
            {"job_id": job_id}, 
            {"$set": {"results": results, "processed_images": i + 1}}
        )
    
    # Mark as completed
    await jobs_collection.update_one(
        {"job_id": job_id}, 
        {"$set": {"status": "completed", "results": results, "processed_images": len(files_data)}}
    )


@router.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Get the status and results of a batch processing job."""
    
    job = await get_jobs_collection().find_one({"job_id": job_id}, {"_id": 0})
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job


@router.get("/default-prompt")
async def get_default_prompt():
    """Get the default prompt for sauna image processing."""
    return {"prompt": DEFAULT_SAUNA_PROMPT}


@router.get("/processed-images")
async def list_processed_images():
    """List all processed images from MongoDB (with Cloudinary URLs)."""
    
    images_cursor = get_images_collection().find(
        {}, 
        {"filename": 1, "original_filename": 1, "cloudinary_url": 1, "created_at": 1, "_id": 0}
    ).sort("created_at", -1).limit(100)
    
    # Use to_list() for async iteration with Motor
    images_list = await images_cursor.to_list(length=100)
    
    images = []
    for img in images_list:
        images.append({
            "filename": img["filename"],
            "original_filename": img.get("original_filename", ""),
            "url": img.get("cloudinary_url", ""),
            "created_at": img.get("created_at", "")
        })
    
    return {"images": images}


@router.delete("/images/{filename}")
async def delete_processed_image(filename: str):
    """Delete a processed image metadata from MongoDB."""
    import cloudinary.uploader
    
    # Find image in DB
    image_doc = await get_images_collection().find_one({"filename": filename})
    
    if not image_doc:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Try to delete from Cloudinary
    try:
        if image_doc.get("cloudinary_public_id"):
            cloudinary.uploader.destroy(image_doc["cloudinary_public_id"])
    except Exception as e:
        print(f"Warning: Could not delete from Cloudinary: {e}")
    
    # Delete from MongoDB
    await get_images_collection().delete_one({"filename": filename})
    
    return {"success": True, "deleted": filename}

