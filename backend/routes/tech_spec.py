"""Technical Specification admin routes."""
from fastapi import APIRouter, HTTPException
import logging

from database import db
from models.tech_spec import TechSpecCategory, TechSpecOption, TechSpecData
from data.tech_spec_defaults import default_tech_spec_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tech-spec", tags=["Tech Spec Admin"])


@router.get("/categories")
async def get_tech_spec_categories():
    """Get all tech spec categories with options"""
    data = await db.tech_spec_config.find_one({"_id": "default"})
    if not data:
        await db.tech_spec_config.insert_one({"_id": "default", **default_tech_spec_data})
        return default_tech_spec_data
    
    data.pop('_id', None)
    return data


@router.post("/categories")
async def update_tech_spec_categories(data: TechSpecData):
    """Update all tech spec categories"""
    data_dict = data.model_dump()
    await db.tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": data_dict},
        upsert=True
    )
    return {"message": "Tech spec categories updated successfully"}


# =============================================
# CATEGORY CRUD
# =============================================
@router.post("/category")
async def add_category(category: TechSpecCategory):
    """Add a new category"""
    data = await db.tech_spec_config.find_one({"_id": "default"})
    if not data:
        await db.tech_spec_config.insert_one({"_id": "default", **default_tech_spec_data})
        data = default_tech_spec_data.copy()
    
    categories = data.get("categories", [])
    if any(c["id"] == category.id for c in categories):
        raise HTTPException(status_code=400, detail="Category with this ID already exists")
    
    categories.append(category.model_dump())
    await db.tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category added successfully", "category": category}


@router.put("/category/{category_id}")
async def update_category(category_id: str, category: TechSpecCategory):
    """Update an existing category"""
    data = await db.tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    categories = data.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    categories[cat_index] = category.model_dump()
    await db.tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category updated successfully", "category": category}


@router.delete("/category/{category_id}")
async def delete_category(category_id: str):
    """Delete a category"""
    data = await db.tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    categories = data.get("categories", [])
    new_categories = [c for c in categories if c["id"] != category_id]
    
    if len(new_categories) == len(categories):
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": new_categories}}
    )
    return {"message": "Category deleted successfully"}


@router.post("/category/{category_id}/move")
async def move_category(category_id: str, direction: str):
    """Move category up or down"""
    data = await db.tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    categories = data.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if direction == "up" and cat_index > 0:
        categories[cat_index], categories[cat_index - 1] = categories[cat_index - 1], categories[cat_index]
    elif direction == "down" and cat_index < len(categories) - 1:
        categories[cat_index], categories[cat_index + 1] = categories[cat_index + 1], categories[cat_index]
    
    # Update sort orders
    for i, cat in enumerate(categories):
        cat["sortOrder"] = i + 1
    
    await db.tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category moved successfully"}


# =============================================
# OPTION CRUD
# =============================================
@router.post("/category/{category_id}/option")
async def add_option(category_id: str, option: TechSpecOption):
    """Add an option to a category"""
    data = await db.tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    categories = data.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    if any(o["id"] == option.id for o in options):
        raise HTTPException(status_code=400, detail="Option with this ID already exists")
    
    options.append(option.model_dump())
    categories[cat_index]["options"] = options
    
    await db.tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option added successfully", "option": option}


@router.put("/category/{category_id}/option/{option_id}")
async def update_option(category_id: str, option_id: str, option: TechSpecOption):
    """Update an option in a category"""
    data = await db.tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    categories = data.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    opt_index = next((i for i, o in enumerate(options) if o["id"] == option_id), None)
    
    if opt_index is None:
        raise HTTPException(status_code=404, detail="Option not found")
    
    options[opt_index] = option.model_dump()
    categories[cat_index]["options"] = options
    
    await db.tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option updated successfully", "option": option}


@router.delete("/category/{category_id}/option/{option_id}")
async def delete_option(category_id: str, option_id: str):
    """Delete an option from a category"""
    data = await db.tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    categories = data.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    new_options = [o for o in options if o["id"] != option_id]
    
    if len(new_options) == len(options):
        raise HTTPException(status_code=404, detail="Option not found")
    
    categories[cat_index]["options"] = new_options
    
    await db.tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option deleted successfully"}
