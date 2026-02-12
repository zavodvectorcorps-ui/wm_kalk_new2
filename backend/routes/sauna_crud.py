"""CRUD operations for sauna models, categories, and options."""
from fastapi import APIRouter, HTTPException
from database import db
from models.sauna import SaunaModel, SaunaOption, SaunaCategory, SaunaPriceData
from data.sauna_defaults import default_sauna_prices

# No prefix - will be included in main sauna router
router = APIRouter(tags=["Sauna CRUD"])


# =============================================
# PRICES
# =============================================

@router.get("/prices")
async def get_sauna_prices(response: Response):
    """Get sauna pricing data"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        prices = default_sauna_prices
    else:
        prices.pop('_id', None)
    
    # Cache for 5 minutes (prices don't change often)
    response.headers["Cache-Control"] = "public, max-age=300"
    
    return prices


@router.post("/prices")
async def update_sauna_prices(prices: SaunaPriceData):
    """Update sauna pricing data"""
    price_dict = prices.model_dump()
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": price_dict},
        upsert=True
    )
    return {"message": "Sauna prices updated successfully"}


# =============================================
# SAUNA MODELS CRUD
# =============================================

@router.post("/models")
async def add_sauna_model(model: SaunaModel):
    """Add a new sauna model"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        prices = default_sauna_prices.copy()
    
    models = prices.get("models", [])
    if any(m["id"] == model.id for m in models):
        raise HTTPException(status_code=400, detail="Model with this ID already exists")
    
    models.append(model.model_dump())
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"models": models}}
    )
    return {"message": "Model added successfully", "model": model}


@router.put("/models/{model_id}")
async def update_sauna_model(model_id: str, model: SaunaModel):
    """Update an existing sauna model"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    models = prices.get("models", [])
    model_index = next((i for i, m in enumerate(models) if m["id"] == model_id), None)
    
    if model_index is None:
        raise HTTPException(status_code=404, detail="Model not found")
    
    models[model_index] = model.model_dump()
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"models": models}}
    )
    return {"message": "Model updated successfully", "model": model}


@router.delete("/models/{model_id}")
async def delete_sauna_model(model_id: str):
    """Delete a sauna model"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    models = prices.get("models", [])
    new_models = [m for m in models if m["id"] != model_id]
    
    if len(new_models) == len(models):
        raise HTTPException(status_code=404, detail="Model not found")
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"models": new_models}}
    )
    return {"message": "Model deleted successfully"}


# =============================================
# SAUNA CATEGORIES CRUD
# =============================================

@router.post("/categories")
async def add_sauna_category(category: SaunaCategory):
    """Add a new sauna category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        prices = default_sauna_prices.copy()
    
    categories = prices.get("categories", [])
    if any(c["id"] == category.id for c in categories):
        raise HTTPException(status_code=400, detail="Category with this ID already exists")
    
    categories.append(category.model_dump())
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category added successfully", "category": category}


@router.put("/categories/{category_id}")
async def update_sauna_category(category_id: str, category: SaunaCategory):
    """Update an existing sauna category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    categories[cat_index] = category.model_dump()
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category updated successfully", "category": category}


@router.delete("/categories/{category_id}")
async def delete_sauna_category(category_id: str):
    """Delete a sauna category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    new_categories = [c for c in categories if c["id"] != category_id]
    
    if len(new_categories) == len(categories):
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": new_categories}}
    )
    return {"message": "Category deleted successfully"}


# =============================================
# SAUNA OPTIONS CRUD
# =============================================

@router.post("/categories/{category_id}/options")
async def add_sauna_option(category_id: str, option: SaunaOption):
    """Add an option to a category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    if any(o["id"] == option.id for o in options):
        raise HTTPException(status_code=400, detail="Option with this ID already exists")
    
    options.append(option.model_dump())
    categories[cat_index]["options"] = options
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option added successfully", "option": option}


@router.put("/categories/{category_id}/options/{option_id}")
async def update_sauna_option(category_id: str, option_id: str, option: SaunaOption):
    """Update an option in a category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    opt_index = next((i for i, o in enumerate(options) if o["id"] == option_id), None)
    
    if opt_index is None:
        raise HTTPException(status_code=404, detail="Option not found")
    
    options[opt_index] = option.model_dump()
    categories[cat_index]["options"] = options
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option updated successfully", "option": option}


@router.delete("/categories/{category_id}/options/{option_id}")
async def delete_sauna_option(category_id: str, option_id: str):
    """Delete an option from a category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    new_options = [o for o in options if o["id"] != option_id]
    
    if len(new_options) == len(options):
        raise HTTPException(status_code=404, detail="Option not found")
    
    categories[cat_index]["options"] = new_options
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option deleted successfully"}
