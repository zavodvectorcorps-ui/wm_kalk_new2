"""PDF Template management routes."""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import os
import base64
from pymongo import MongoClient

router = APIRouter(prefix="/pdf-templates", tags=["pdf-templates"])

# MongoDB connection
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "wm_calculator")
client = MongoClient(mongo_url)
db = client[db_name]
templates_collection = db["pdf_templates"]
pdf_images_collection = db["pdf_images"]


class PDFBlock(BaseModel):
    id: str
    name: str
    enabled: bool = True
    order: int = 0


class PDFColors(BaseModel):
    primary: str = "#8B4513"  # Brown
    secondary: str = "#D2B48C"  # Light brown
    accent: str = "#CD853F"  # Peru
    text: str = "#333333"
    muted: str = "#666666"


class PDFTexts(BaseModel):
    headerTitle: str = "OFERTA HANDLOWA"
    promoTitle: str = "PROMOCJA"
    promoText: str = "Darmowa balia do schłodzenia<br/>lub beczka z sauną!"
    warrantyText: str = "GWARANCJA: 12 miesiące od daty montażu"
    footerText: str = "Oferta ważna 30 dni od daty wystawienia."
    galleryTitle: str = "GALERIA REALIZACJI"
    companySlogan: str = "WM-Group — Producent saun i bali na wymiar"


class PDFTemplate(BaseModel):
    id: Optional[str] = None
    name: str
    calculator_type: str  # 'sauna' or 'balia'
    isDefault: bool = False
    blocks: List[PDFBlock] = []
    colors: PDFColors = PDFColors()
    texts: PDFTexts = PDFTexts()
    logoImageId: Optional[str] = None
    promoImageId: Optional[str] = None
    galleryImageIds: List[str] = []
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class PDFTemplateCreate(BaseModel):
    name: str
    calculator_type: str
    isDefault: bool = False
    blocks: List[Dict[str, Any]] = []
    colors: Dict[str, str] = {}
    texts: Dict[str, str] = {}
    logoImageId: Optional[str] = None
    promoImageId: Optional[str] = None
    galleryImageIds: List[str] = []


class PDFTemplateUpdate(BaseModel):
    name: Optional[str] = None
    isDefault: Optional[bool] = None
    blocks: Optional[List[Dict[str, Any]]] = None
    colors: Optional[Dict[str, str]] = None
    texts: Optional[Dict[str, str]] = None
    logoImageId: Optional[str] = None
    promoImageId: Optional[str] = None
    galleryImageIds: Optional[List[str]] = None


# Default blocks configuration
DEFAULT_BLOCKS = [
    {"id": "header", "name": "Шапка с логотипом", "enabled": True, "order": 1},
    {"id": "client_info", "name": "Информация о клиенте", "enabled": True, "order": 2},
    {"id": "model_photo", "name": "Модель и фото", "enabled": True, "order": 3},
    {"id": "options", "name": "Опции", "enabled": True, "order": 4},
    {"id": "promo", "name": "Промо-блок с подарком", "enabled": True, "order": 5},
    {"id": "benches", "name": "Информация о лавках", "enabled": True, "order": 6},
    {"id": "total", "name": "Итого", "enabled": True, "order": 7},
    {"id": "gallery", "name": "Галерея", "enabled": True, "order": 8},
    {"id": "footer", "name": "Футер", "enabled": True, "order": 9},
]


@router.get("")
async def get_templates(calculator_type: str = None):
    """Get all PDF templates, optionally filtered by calculator type."""
    query = {}
    if calculator_type:
        query["calculator_type"] = calculator_type
    
    templates = list(templates_collection.find(query, {"_id": 0}).sort("name", 1))
    return templates


@router.get("/default/{calculator_type}")
async def get_default_template(calculator_type: str):
    """Get the default template for a calculator type."""
    template = templates_collection.find_one(
        {"calculator_type": calculator_type, "isDefault": True},
        {"_id": 0}
    )
    
    if not template:
        # Return a default template structure
        return {
            "id": None,
            "name": "Domyślny szablon",
            "calculator_type": calculator_type,
            "isDefault": True,
            "blocks": DEFAULT_BLOCKS,
            "colors": PDFColors().model_dump(),
            "texts": PDFTexts().model_dump(),
            "logoImageId": None,
            "promoImageId": None,
            "galleryImageIds": []
        }
    
    return template


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get a specific template by ID."""
    template = templates_collection.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("")
async def create_template(template: PDFTemplateCreate):
    """Create a new PDF template."""
    now = datetime.now(timezone.utc).isoformat()
    template_id = f"tpl-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(ObjectId())[:8]}"
    
    # Use default blocks if not provided
    blocks = template.blocks if template.blocks else DEFAULT_BLOCKS
    
    # Merge with default colors and texts
    default_colors = PDFColors().model_dump()
    default_texts = PDFTexts().model_dump()
    
    colors = {**default_colors, **template.colors}
    texts = {**default_texts, **template.texts}
    
    template_dict = {
        "id": template_id,
        "name": template.name,
        "calculator_type": template.calculator_type,
        "isDefault": template.isDefault,
        "blocks": blocks,
        "colors": colors,
        "texts": texts,
        "logoImageId": template.logoImageId,
        "promoImageId": template.promoImageId,
        "galleryImageIds": template.galleryImageIds,
        "createdAt": now,
        "updatedAt": now
    }
    
    # If this is set as default, unset other defaults for this calculator type
    if template.isDefault:
        templates_collection.update_many(
            {"calculator_type": template.calculator_type, "isDefault": True},
            {"$set": {"isDefault": False}}
        )
    
    templates_collection.insert_one(template_dict)
    
    result = templates_collection.find_one({"id": template_id}, {"_id": 0})
    return result


@router.put("/{template_id}")
async def update_template(template_id: str, template: PDFTemplateUpdate):
    """Update a PDF template."""
    existing = templates_collection.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = {k: v for k, v in template.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    # If setting as default, unset other defaults
    if template.isDefault:
        templates_collection.update_many(
            {"calculator_type": existing["calculator_type"], "isDefault": True, "id": {"$ne": template_id}},
            {"$set": {"isDefault": False}}
        )
    
    templates_collection.update_one({"id": template_id}, {"$set": update_data})
    
    result = templates_collection.find_one({"id": template_id}, {"_id": 0})
    return result


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    """Delete a PDF template."""
    result = templates_collection.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deleted", "id": template_id}


# ========== IMAGE MANAGEMENT ==========

@router.post("/images/upload")
async def upload_image(
    file: UploadFile = File(...),
    image_type: str = "gallery",  # 'logo', 'promo', 'gallery'
    calculator_type: str = "sauna"
):
    """Upload an image for PDF templates."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file content
    content = await file.read()
    
    # Convert to base64 for storage
    base64_content = base64.b64encode(content).decode('utf-8')
    
    now = datetime.now(timezone.utc).isoformat()
    image_id = f"img-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(ObjectId())[:8]}"
    
    image_doc = {
        "id": image_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "image_type": image_type,
        "calculator_type": calculator_type,
        "data": base64_content,
        "size": len(content),
        "createdAt": now
    }
    
    pdf_images_collection.insert_one(image_doc)
    
    return {
        "id": image_id,
        "filename": file.filename,
        "image_type": image_type,
        "size": len(content)
    }


@router.get("/images")
async def get_images(image_type: str = None, calculator_type: str = None):
    """Get list of uploaded images (without data)."""
    query = {}
    if image_type:
        query["image_type"] = image_type
    if calculator_type:
        query["calculator_type"] = calculator_type
    
    images = list(pdf_images_collection.find(query, {"_id": 0, "data": 0}).sort("createdAt", -1))
    return images


@router.get("/images/{image_id}")
async def get_image(image_id: str):
    """Get image data by ID."""
    image = pdf_images_collection.find_one({"id": image_id}, {"_id": 0})
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.get("/images/{image_id}/data")
async def get_image_data(image_id: str):
    """Get raw image data for display."""
    from fastapi.responses import Response
    
    image = pdf_images_collection.find_one({"id": image_id})
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Decode base64
    image_data = base64.b64decode(image["data"])
    
    return Response(content=image_data, media_type=image["content_type"])


@router.delete("/images/{image_id}")
async def delete_image(image_id: str):
    """Delete an uploaded image."""
    result = pdf_images_collection.delete_one({"id": image_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"status": "deleted", "id": image_id}


# ========== SEED DEFAULT TEMPLATE ==========

@router.post("/seed-defaults")
async def seed_default_templates():
    """Create default templates for both calculator types."""
    created = []
    
    for calc_type in ["sauna", "balia"]:
        existing = templates_collection.find_one({
            "calculator_type": calc_type,
            "isDefault": True
        })
        
        if not existing:
            now = datetime.now(timezone.utc).isoformat()
            template_id = f"tpl-default-{calc_type}"
            
            template = {
                "id": template_id,
                "name": f"Szablon domyślny - {calc_type.upper()}",
                "calculator_type": calc_type,
                "isDefault": True,
                "blocks": DEFAULT_BLOCKS,
                "colors": PDFColors().model_dump(),
                "texts": PDFTexts().model_dump(),
                "logoImageId": None,
                "promoImageId": None,
                "galleryImageIds": [],
                "createdAt": now,
                "updatedAt": now
            }
            
            templates_collection.insert_one(template)
            created.append(calc_type)
    
    return {"status": "ok", "created": created}
