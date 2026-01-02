"""Technical Specification admin routes for Balia."""
from fastapi import APIRouter, HTTPException
import logging

from database import db
from models.tech_spec import TechSpecCategory, TechSpecOption, TechSpecData, TechSpecMasterCategory

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/balia-tech-spec", tags=["Balia Tech Spec Admin"])

# Default empty structure for Balia tech specs
default_balia_tech_spec_data = {
    "masterCategories": [],
    "categories": []
}


@router.get("/config")
async def get_balia_tech_spec_config():
    """Get full tech spec config for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        await db.balia_tech_spec_config.insert_one({"_id": "default", **default_balia_tech_spec_data})
        return default_balia_tech_spec_data
    
    data.pop('_id', None)
    return data


@router.get("/categories")
async def get_balia_tech_spec_categories():
    """Get all Balia tech spec categories with options"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        await db.balia_tech_spec_config.insert_one({"_id": "default", **default_balia_tech_spec_data})
        return default_balia_tech_spec_data
    
    data.pop('_id', None)
    return data


@router.post("/categories")
async def update_balia_tech_spec_categories(data: TechSpecData):
    """Update all Balia tech spec categories"""
    data_dict = data.model_dump()
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": data_dict},
        upsert=True
    )
    return {"message": "Balia tech spec categories updated successfully"}


# =============================================
# MASTER CATEGORY CRUD
# =============================================
@router.get("/master-categories")
async def get_balia_master_categories():
    """Get all master categories for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        await db.balia_tech_spec_config.insert_one({"_id": "default", **default_balia_tech_spec_data})
        data = default_balia_tech_spec_data.copy()
    
    return data.get("masterCategories", [])


@router.post("/master-category")
async def add_balia_master_category(master_category: TechSpecMasterCategory):
    """Add a new master category for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        await db.balia_tech_spec_config.insert_one({"_id": "default", **default_balia_tech_spec_data})
        data = default_balia_tech_spec_data.copy()
    
    master_categories = data.get("masterCategories", [])
    if any(mc["id"] == master_category.id for mc in master_categories):
        raise HTTPException(status_code=400, detail="Master category with this ID already exists")
    
    master_categories.append(master_category.model_dump())
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"masterCategories": master_categories}}
    )
    return {"message": "Master category added successfully", "masterCategory": master_category}


@router.put("/master-category/{master_category_id}")
async def update_balia_master_category(master_category_id: str, master_category: TechSpecMasterCategory):
    """Update an existing master category for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    master_categories = data.get("masterCategories", [])
    mc_index = next((i for i, mc in enumerate(master_categories) if mc["id"] == master_category_id), None)
    
    if mc_index is None:
        raise HTTPException(status_code=404, detail="Master category not found")
    
    master_categories[mc_index] = master_category.model_dump()
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"masterCategories": master_categories}}
    )
    return {"message": "Master category updated successfully", "masterCategory": master_category}


@router.delete("/master-category/{master_category_id}")
async def delete_balia_master_category(master_category_id: str):
    """Delete a master category for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    master_categories = data.get("masterCategories", [])
    new_master_categories = [mc for mc in master_categories if mc["id"] != master_category_id]
    
    if len(new_master_categories) == len(master_categories):
        raise HTTPException(status_code=404, detail="Master category not found")
    
    # Also remove masterCategoryId from categories
    categories = data.get("categories", [])
    for cat in categories:
        if cat.get("masterCategoryId") == master_category_id:
            cat["masterCategoryId"] = None
    
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"masterCategories": new_master_categories, "categories": categories}}
    )
    return {"message": "Master category deleted successfully"}


@router.post("/master-category/{master_category_id}/move")
async def move_balia_master_category(master_category_id: str, direction: str):
    """Move master category up or down for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    master_categories = data.get("masterCategories", [])
    mc_index = next((i for i, mc in enumerate(master_categories) if mc["id"] == master_category_id), None)
    
    if mc_index is None:
        raise HTTPException(status_code=404, detail="Master category not found")
    
    if direction == "up" and mc_index > 0:
        master_categories[mc_index], master_categories[mc_index - 1] = master_categories[mc_index - 1], master_categories[mc_index]
    elif direction == "down" and mc_index < len(master_categories) - 1:
        master_categories[mc_index], master_categories[mc_index + 1] = master_categories[mc_index + 1], master_categories[mc_index]
    
    # Update sort orders
    for i, mc in enumerate(master_categories):
        mc["sortOrder"] = i + 1
    
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"masterCategories": master_categories}}
    )
    return {"message": "Master category moved successfully"}


# =============================================
# CATEGORY CRUD
# =============================================
@router.post("/category")
async def add_balia_category(category: TechSpecCategory):
    """Add a new category for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        await db.balia_tech_spec_config.insert_one({"_id": "default", **default_balia_tech_spec_data})
        data = default_balia_tech_spec_data.copy()
    
    categories = data.get("categories", [])
    if any(c["id"] == category.id for c in categories):
        raise HTTPException(status_code=400, detail="Category with this ID already exists")
    
    categories.append(category.model_dump())
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category added successfully", "category": category}


@router.put("/category/{category_id}")
async def update_balia_category(category_id: str, category: TechSpecCategory):
    """Update an existing category for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    categories = data.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    categories[cat_index] = category.model_dump()
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category updated successfully", "category": category}


@router.delete("/category/{category_id}")
async def delete_balia_category(category_id: str):
    """Delete a category for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
    if not data:
        raise HTTPException(status_code=404, detail="Config not found")
    
    categories = data.get("categories", [])
    new_categories = [c for c in categories if c["id"] != category_id]
    
    if len(new_categories) == len(categories):
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": new_categories}}
    )
    return {"message": "Category deleted successfully"}


@router.post("/category/{category_id}/move")
async def move_balia_category(category_id: str, direction: str):
    """Move category up or down for Balia"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
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
    
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category moved successfully"}


# =============================================
# OPTION CRUD
# =============================================
@router.post("/category/{category_id}/option")
async def add_balia_option(category_id: str, option: TechSpecOption):
    """Add an option to a Balia category"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
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
    
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option added successfully", "option": option}


@router.put("/category/{category_id}/option/{option_id}")
async def update_balia_option(category_id: str, option_id: str, option: TechSpecOption):
    """Update an option in a Balia category"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
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
    
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option updated successfully", "option": option}


@router.delete("/category/{category_id}/option/{option_id}")
async def delete_balia_option(category_id: str, option_id: str):
    """Delete an option from a Balia category"""
    data = await db.balia_tech_spec_config.find_one({"_id": "default"})
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
    
    await db.balia_tech_spec_config.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option deleted successfully"}
