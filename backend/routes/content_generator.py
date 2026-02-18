"""Content generator routes - AI image processing for sauna photos."""
import os
import uuid
import base64
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from database import db

load_dotenv()

router = APIRouter(prefix="/api/content", tags=["content"])

# Default prompt for sauna background replacement
DEFAULT_SAUNA_PROMPT = """Это фотография уличной мобильной сауны. Сохрани вид и пропорции сауны, цвет дерева и все детали конструкции. Замени реальный фон на простой загородный участок в Польше: небольшой неслишком современный дачный дом, немного сада, деревья, натуральная земля и трава. Дом должен выглядеть обычным, аккуратным, без дорогого дизайна, без ярких цветов. Сохрани естественный дневной свет и тени, как на исходном фото. Если через окна или стеклянные двери видно улицу или здания, тоже замени их на тот же дачный фон, чтобы сцена выглядела цельной. Сделай картинку чистой и пригодной для каталога и рекламы, без лишних объектов, автомобилей и людей."""

# Directory for processed images
PROCESSED_DIR = "/app/backend/static/processed"
os.makedirs(PROCESSED_DIR, exist_ok=True)

# MongoDB collection for jobs
def get_jobs_collection():
    return db.content_jobs


class ProcessingJob(BaseModel):
    job_id: str
    status: str  # pending, processing, completed, error
    total_images: int
    processed_images: int
    results: List[dict]
    error: Optional[str] = None
    created_at: str


async def process_single_image(image_bytes: bytes, prompt: str, filename: str) -> dict:
    """Process a single image through Nano Banana Pro API."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
    
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
            # Save the processed image
            output_filename = f"processed_{uuid.uuid4().hex[:8]}_{filename}"
            output_path = os.path.join(PROCESSED_DIR, output_filename)
            
            # Decode and save
            image_data = base64.b64decode(images[0]['data'])
            with open(output_path, 'wb') as f:
                f.write(image_data)
            
            return {
                "success": True,
                "original_filename": filename,
                "processed_filename": output_filename,
                "url": f"/api/content/images/{output_filename}",
                "text_response": text[:200] if text else None
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
    get_jobs_collection().insert_one(job_data)
    
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
    jobs_collection.update_one({"job_id": job_id}, {"$set": {"status": "processing"}})
    
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
        jobs_collection.update_one(
            {"job_id": job_id}, 
            {"$set": {"results": results, "processed_images": i + 1}}
        )
    
    # Mark as completed
    jobs_collection.update_one(
        {"job_id": job_id}, 
        {"$set": {"status": "completed", "results": results, "processed_images": len(files_data)}}
    )


@router.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Get the status and results of a batch processing job."""
    
    job = get_jobs_collection().find_one({"job_id": job_id}, {"_id": 0})
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job


@router.get("/images/{filename}")
async def get_processed_image(filename: str):
    """Serve a processed image."""
    
    file_path = os.path.join(PROCESSED_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Determine content type
    if filename.lower().endswith('.png'):
        media_type = "image/png"
    elif filename.lower().endswith('.webp'):
        media_type = "image/webp"
    else:
        media_type = "image/jpeg"
    
    return FileResponse(file_path, media_type=media_type)


@router.get("/default-prompt")
async def get_default_prompt():
    """Get the default prompt for sauna image processing."""
    return {"prompt": DEFAULT_SAUNA_PROMPT}


@router.get("/processed-images")
async def list_processed_images():
    """List all processed images."""
    
    if not os.path.exists(PROCESSED_DIR):
        return {"images": []}
    
    images = []
    for filename in os.listdir(PROCESSED_DIR):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            file_path = os.path.join(PROCESSED_DIR, filename)
            stat = os.stat(file_path)
            images.append({
                "filename": filename,
                "url": f"/api/content/images/{filename}",
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
    
    # Sort by creation date, newest first
    images.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {"images": images}


@router.delete("/images/{filename}")
async def delete_processed_image(filename: str):
    """Delete a processed image."""
    
    file_path = os.path.join(PROCESSED_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    os.remove(file_path)
    return {"success": True, "deleted": filename}

