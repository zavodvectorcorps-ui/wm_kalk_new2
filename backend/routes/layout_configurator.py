"""Layout Configurator API - Drag & drop sauna layout designer."""
import os
import uuid
import base64
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from database import db
from services.cloudinary_service import upload_base64_image, is_cloudinary_configured

router = APIRouter(prefix="/api/layout-configurator", tags=["layout-configurator"])


# ============ MODELS ============

class ElementAsset(BaseModel):
    """Uploaded graphic element (heater, bench, etc.)"""
    id: str
    name: str
    namePl: Optional[str] = ""
    nameRu: Optional[str] = ""
    type: str  # heater, bench, door, window, shower, divider, other
    modelId: Optional[str] = None  # null = global, or specific model ID
    imageUrl: str
    width: int = 100
    height: int = 100
    createdAt: str


class ElementInstance(BaseModel):
    """Instance of an element placed on canvas"""
    id: str
    assetId: str  # Reference to ElementAsset
    type: str
    x: float
    y: float
    rotation: float = 0
    scale: float = 1.0
    zIndex: int = 0


class LayoutConfig(BaseModel):
    """Saved layout configuration"""
    id: str
    name: str
    namePl: Optional[str] = ""
    nameRu: Optional[str] = ""
    modelId: str  # Sauna model ID
    modelName: Optional[str] = ""
    canvasWidth: int = 800
    canvasHeight: int = 400
    backgroundUrl: Optional[str] = None  # Sauna outline/background
    elements: List[ElementInstance] = []
    # Metadata for layout catalog
    modelSize: Optional[str] = None  # e.g., "2m", "3m"
    capacity: Optional[str] = None
    description: Optional[str] = None
    descriptionPl: Optional[str] = None
    # Export
    exportedImageUrl: Optional[str] = None
    # Status
    isPublished: bool = False  # Show in calculator catalog
    sortOrder: int = 0
    createdAt: str
    updatedAt: str
    createdBy: Optional[str] = None


# ============ ELEMENT ASSETS ============

def get_assets_collection():
    return db.layout_element_assets


def get_layouts_collection():
    return db.configurator_layouts


@router.get("/element-types")
async def get_element_types():
    """Get available element types."""
    return {
        "types": [
            {"id": "heater", "name": "Печь", "namePl": "Piec"},
            {"id": "bench", "name": "Лавка", "namePl": "Ławka"},
            {"id": "door", "name": "Дверь", "namePl": "Drzwi"},
            {"id": "window", "name": "Окно", "namePl": "Okno"},
            {"id": "shower", "name": "Душ", "namePl": "Prysznic"},
            {"id": "divider", "name": "Перегородка", "namePl": "Ścianka"},
            {"id": "stairs", "name": "Ступеньки", "namePl": "Schody"},
            {"id": "terrace", "name": "Терраса", "namePl": "Taras"},
            {"id": "other", "name": "Другое", "namePl": "Inne"},
        ]
    }


@router.post("/assets")
async def upload_asset(
    file: UploadFile = File(...),
    name: str = Form(...),
    namePl: str = Form(default=""),
    nameRu: str = Form(default=""),
    type: str = Form(...),
    modelId: str = Form(default=None),
    width: int = Form(default=100),
    height: int = Form(default=100),
):
    """Upload a new element asset (PNG/SVG)."""
    # Validate file type
    allowed_types = ["image/png", "image/svg+xml", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PNG, SVG, and WebP files are allowed")
    
    # Read file content
    content = await file.read()
    content_base64 = base64.b64encode(content).decode('utf-8')
    
    # Generate unique ID
    asset_id = f"asset-{uuid.uuid4().hex[:12]}"
    
    # Upload to Cloudinary or store as base64
    image_url = None
    if is_cloudinary_configured():
        result = await upload_base64_image(
            content_base64,
            f"layout-asset-{asset_id}",
            folder="layout-assets"
        )
        if result:
            image_url = result["url"]
    
    if not image_url:
        # Store as data URL
        mime_type = file.content_type
        image_url = f"data:{mime_type};base64,{content_base64}"
    
    # Create asset document
    asset_doc = {
        "id": asset_id,
        "name": name,
        "namePl": namePl or name,
        "nameRu": nameRu or name,
        "type": type,
        "modelId": modelId if modelId and modelId != "null" else None,
        "imageUrl": image_url,
        "width": width,
        "height": height,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await get_assets_collection().insert_one(asset_doc)
    
    # Return without _id
    if "_id" in asset_doc:
        del asset_doc["_id"]
    return asset_doc


@router.get("/assets")
async def list_assets(type: Optional[str] = None, modelId: Optional[str] = None):
    """List all element assets, optionally filtered by type or model."""
    query = {}
    if type:
        query["type"] = type
    if modelId:
        # Include global assets (modelId=null) and model-specific assets
        query["$or"] = [
            {"modelId": None},
            {"modelId": modelId}
        ]
    
    cursor = get_assets_collection().find(query, {"_id": 0}).sort("createdAt", -1)
    assets = await cursor.to_list(length=500)
    return {"assets": assets}


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str):
    """Delete an element asset."""
    result = await get_assets_collection().delete_one({"id": asset_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"success": True, "deleted": asset_id}


# ============ LAYOUTS ============

@router.post("/layouts")
async def create_layout(
    name: str = Form(...),
    namePl: str = Form(default=""),
    nameRu: str = Form(default=""),
    modelId: str = Form(...),
    modelName: str = Form(default=""),
    canvasWidth: int = Form(default=800),
    canvasHeight: int = Form(default=400),
    backgroundUrl: str = Form(default=None),
    elements: str = Form(default="[]"),  # JSON string
    modelSize: str = Form(default=None),
    capacity: str = Form(default=None),
    description: str = Form(default=None),
    descriptionPl: str = Form(default=None),
    createdBy: str = Form(default=None),
):
    """Create a new layout."""
    import json
    
    layout_id = f"layout-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        elements_list = json.loads(elements) if elements else []
    except:
        elements_list = []
    
    layout_doc = {
        "id": layout_id,
        "name": name,
        "namePl": namePl or name,
        "nameRu": nameRu or name,
        "modelId": modelId,
        "modelName": modelName,
        "canvasWidth": canvasWidth,
        "canvasHeight": canvasHeight,
        "backgroundUrl": backgroundUrl if backgroundUrl and backgroundUrl != "null" else None,
        "elements": elements_list,
        "modelSize": modelSize if modelSize and modelSize != "null" else None,
        "capacity": capacity if capacity and capacity != "null" else None,
        "description": description if description and description != "null" else None,
        "descriptionPl": descriptionPl if descriptionPl and descriptionPl != "null" else None,
        "exportedImageUrl": None,
        "isPublished": False,
        "sortOrder": 0,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": createdBy if createdBy and createdBy != "null" else None
    }
    
    await get_layouts_collection().insert_one(layout_doc)
    
    return {"layoutId": layout_id, "layout": {k: v for k, v in layout_doc.items() if k != "_id"}}


@router.get("/layouts")
async def list_layouts(modelId: Optional[str] = None, isPublished: Optional[bool] = None):
    """List all layouts, optionally filtered."""
    query = {}
    if modelId:
        query["modelId"] = modelId
    if isPublished is not None:
        query["isPublished"] = isPublished
    
    cursor = get_layouts_collection().find(query, {"_id": 0}).sort([("sortOrder", 1), ("createdAt", -1)])
    layouts = await cursor.to_list(length=500)
    return {"layouts": layouts}


@router.get("/layouts/{layout_id}")
async def get_layout(layout_id: str):
    """Get a specific layout by ID."""
    layout = await get_layouts_collection().find_one({"id": layout_id}, {"_id": 0})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout


@router.put("/layouts/{layout_id}")
async def update_layout(layout_id: str):
    """Update a layout. Accepts form data or JSON."""
    from fastapi import Request
    # This will be handled via JSON body
    pass


@router.put("/layouts/{layout_id}/data")
async def update_layout_data(layout_id: str, data: dict):
    """Update layout with JSON data."""
    # Check exists
    existing = await get_layouts_collection().find_one({"id": layout_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    # Update fields
    update_data = {k: v for k, v in data.items() if k not in ["id", "_id", "createdAt"]}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await get_layouts_collection().update_one(
        {"id": layout_id},
        {"$set": update_data}
    )
    
    updated = await get_layouts_collection().find_one({"id": layout_id}, {"_id": 0})
    return updated


@router.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: str):
    """Delete a layout."""
    result = await get_layouts_collection().delete_one({"id": layout_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Layout not found")
    return {"success": True, "deleted": layout_id}


@router.post("/layouts/{layout_id}/duplicate")
async def duplicate_layout(layout_id: str):
    """Create a copy of an existing layout."""
    # Find original layout
    original = await get_layouts_collection().find_one({"id": layout_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    # Create new layout with copied data
    new_id = f"layout-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    new_layout = {
        **original,
        "id": new_id,
        "name": f"{original.get('name', 'Layout')} (копия)",
        "namePl": f"{original.get('namePl', original.get('name', 'Layout'))} (kopia)",
        "nameRu": f"{original.get('nameRu', original.get('name', 'Layout'))} (копия)",
        "isPublished": False,  # New copy is not published
        "exportedImageUrl": None,  # Need to re-export
        "createdAt": now,
        "updatedAt": now,
    }
    
    # Generate new IDs for elements to avoid conflicts
    if new_layout.get("elements"):
        for el in new_layout["elements"]:
            el["id"] = f"el-{uuid.uuid4().hex[:12]}"
    
    await get_layouts_collection().insert_one(new_layout)
    
    # Remove _id from response
    if "_id" in new_layout:
        del new_layout["_id"]
    
    return {"success": True, "layoutId": new_id, "layout": new_layout}


@router.post("/layouts/{layout_id}/publish")
async def publish_layout(layout_id: str):
    """Publish layout to calculator catalog."""
    existing = await get_layouts_collection().find_one({"id": layout_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    await get_layouts_collection().update_one(
        {"id": layout_id},
        {"$set": {"isPublished": True, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "layoutId": layout_id, "isPublished": True}


@router.post("/layouts/{layout_id}/unpublish")
async def unpublish_layout(layout_id: str):
    """Remove layout from calculator catalog."""
    await get_layouts_collection().update_one(
        {"id": layout_id},
        {"$set": {"isPublished": False, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "layoutId": layout_id, "isPublished": False}


@router.post("/layouts/{layout_id}/export")
async def export_layout_image(layout_id: str, imageData: str = Form(...)):
    """Save exported PNG image for a layout."""
    existing = await get_layouts_collection().find_one({"id": layout_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    # imageData is base64 encoded PNG
    image_url = None
    if is_cloudinary_configured():
        result = await upload_base64_image(
            imageData,
            f"layout-export-{layout_id}",
            folder="layout-exports"
        )
        if result:
            image_url = result["url"]
    
    if not image_url:
        # Store as data URL (not recommended for large images)
        image_url = f"data:image/png;base64,{imageData}"
    
    await get_layouts_collection().update_one(
        {"id": layout_id},
        {"$set": {"exportedImageUrl": image_url, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "imageUrl": image_url}


# ============ SAUNA MODELS & VARIANTS ============

@router.get("/sauna-models")
async def get_sauna_models():
    """Get sauna models with variants from prices collection."""
    prices_doc = await db.sauna_prices.find_one({}, {"_id": 0, "models": 1})
    
    if not prices_doc or not prices_doc.get("models"):
        return {"models": []}
    
    # Return model list with variants
    models = []
    for m in prices_doc["models"]:
        if m.get("active", True):
            # Get variants for this model
            variants = []
            for v in m.get("variants", []):
                variants.append({
                    "id": v.get("id"),
                    "name": v.get("name"),
                    "nameRu": v.get("nameRu", v.get("name")),
                    "namePl": v.get("namePl", v.get("name")),
                    "category": v.get("category", ""),
                    "capacity": v.get("capacity", m.get("capacity")),
                    "hint": v.get("hint", ""),
                })
            
            models.append({
                "id": m.get("id"),
                "name": m.get("name"),
                "layoutSize": m.get("layoutSize"),
                "capacity": m.get("capacity"),
                "imageUrl": m.get("imageUrl", ""),
                "variants": variants,
                "linkedVariantsModelId": m.get("linkedVariantsModelId"),
            })
    
    return {"models": models}


# ============ MODEL OUTLINES (Contours) ============

def get_outlines_collection():
    return db.layout_model_outlines


class ModelOutline(BaseModel):
    """Sauna model/variant outline (contour) configuration."""
    id: str
    modelId: str
    variantId: Optional[str] = None  # null = for all variants of this model
    imageUrl: str  # PNG/SVG outline image
    # Real dimensions in centimeters
    outerWidth: float  # External width in cm
    outerLength: float  # External length in cm
    innerWidth: Optional[float] = None  # Internal width in cm
    innerLength: Optional[float] = None  # Internal length in cm
    wallThickness: Optional[float] = None  # Wall thickness in cm
    # Canvas mapping
    canvasWidth: int = 800
    canvasHeight: int = 400
    # Pixel per cm ratio (calculated from canvas size and real dimensions)
    pixelsPerCm: Optional[float] = None
    createdAt: str
    updatedAt: str


@router.post("/outlines")
async def upload_outline(
    file: UploadFile = File(...),
    modelId: str = Form(...),
    variantId: str = Form(default=None),
    outerWidth: float = Form(...),  # cm
    outerLength: float = Form(...),  # cm
    innerWidth: float = Form(default=None),
    innerLength: float = Form(default=None),
    wallThickness: float = Form(default=None),
    canvasWidth: int = Form(default=800),
    canvasHeight: int = Form(default=400),
):
    """Upload outline image for a model/variant with real dimensions."""
    # Validate file type
    allowed_types = ["image/png", "image/svg+xml", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PNG, SVG, and WebP files are allowed")
    
    # Read file content
    content = await file.read()
    content_base64 = base64.b64encode(content).decode('utf-8')
    
    # Generate unique ID
    outline_id = f"outline-{uuid.uuid4().hex[:12]}"
    
    # Upload to Cloudinary or store as base64
    image_url = None
    if is_cloudinary_configured():
        result = await upload_base64_image(
            content_base64,
            f"outline-{modelId}-{variantId or 'all'}",
            folder="layout-outlines"
        )
        if result:
            image_url = result["url"]
    
    if not image_url:
        mime_type = file.content_type
        image_url = f"data:{mime_type};base64,{content_base64}"
    
    # Calculate pixels per cm based on canvas and real dimensions
    # Use the larger dimension for scaling
    scale_width = canvasWidth / outerLength  # Length maps to canvas width
    scale_height = canvasHeight / outerWidth  # Width maps to canvas height
    pixels_per_cm = min(scale_width, scale_height) * 0.9  # 90% to leave margin
    
    now = datetime.now(timezone.utc).isoformat()
    
    outline_doc = {
        "id": outline_id,
        "modelId": modelId,
        "variantId": variantId if variantId and variantId != "null" else None,
        "imageUrl": image_url,
        "outerWidth": outerWidth,
        "outerLength": outerLength,
        "innerWidth": innerWidth if innerWidth else outerWidth - (wallThickness * 2 if wallThickness else 20),
        "innerLength": innerLength if innerLength else outerLength - (wallThickness * 2 if wallThickness else 20),
        "wallThickness": wallThickness or 10,
        "canvasWidth": canvasWidth,
        "canvasHeight": canvasHeight,
        "pixelsPerCm": pixels_per_cm,
        "createdAt": now,
        "updatedAt": now,
    }
    
    # Upsert - replace if exists for same model/variant
    existing = await get_outlines_collection().find_one({
        "modelId": modelId,
        "variantId": outline_doc["variantId"]
    })
    
    if existing:
        await get_outlines_collection().update_one(
            {"id": existing["id"]},
            {"$set": {**outline_doc, "id": existing["id"], "createdAt": existing["createdAt"]}}
        )
        outline_doc["id"] = existing["id"]
    else:
        await get_outlines_collection().insert_one(outline_doc)
    
    if "_id" in outline_doc:
        del outline_doc["_id"]
    
    return outline_doc


@router.get("/outlines")
async def list_outlines(modelId: str = None):
    """List all outlines, optionally filtered by model."""
    query = {}
    if modelId:
        query["modelId"] = modelId
    
    cursor = get_outlines_collection().find(query, {"_id": 0}).sort("modelId", 1)
    outlines = await cursor.to_list(length=500)
    return {"outlines": outlines}


@router.get("/outlines/{model_id}")
async def get_outline(model_id: str, variant_id: str = None):
    """Get outline for specific model/variant."""
    # First try to find variant-specific outline
    if variant_id:
        outline = await get_outlines_collection().find_one(
            {"modelId": model_id, "variantId": variant_id},
            {"_id": 0}
        )
        if outline:
            return outline
    
    # Fall back to model-level outline (variantId = null)
    outline = await get_outlines_collection().find_one(
        {"modelId": model_id, "variantId": None},
        {"_id": 0}
    )
    
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    
    return outline


@router.delete("/outlines/{outline_id}")
async def delete_outline(outline_id: str):
    """Delete an outline."""
    result = await get_outlines_collection().delete_one({"id": outline_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outline not found")
    return {"success": True, "deleted": outline_id}


# ============ PUBLIC API for Calculator Catalog ============

@router.get("/published-layouts")
async def get_published_layouts(model_size: str = None):
    """Get published layouts in format compatible with LayoutCatalog component."""
    query = {"isPublished": True}
    if model_size:
        query["modelSize"] = model_size
    
    cursor = get_layouts_collection().find(query, {"_id": 0}).sort([("sortOrder", 1), ("createdAt", -1)])
    layouts = await cursor.to_list(length=500)
    
    # Transform to LayoutCatalog format
    result = []
    for layout in layouts:
        result.append({
            "id": layout.get("id"),
            "_id": layout.get("id"),  # For backward compatibility
            "name": layout.get("namePl") or layout.get("name"),
            "nameRu": layout.get("nameRu") or layout.get("name"),
            "modelSize": layout.get("modelSize"),
            "capacity": layout.get("capacity"),
            "description": layout.get("descriptionPl") or layout.get("description"),
            "descriptionRu": layout.get("description"),
            "imageUrl": layout.get("exportedImageUrl"),  # Use exported PNG
            "isActive": True,
            "source": "configurator",  # Mark as from configurator
        })
    
    return result

