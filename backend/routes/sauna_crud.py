"""CRUD operations for sauna models, categories, and options."""
from fastapi import APIRouter, HTTPException, Response, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from urllib.parse import quote
import io
import logging

from database import db
from models.sauna import SaunaModel, SaunaOption, SaunaCategory, SaunaPriceData
from data.sauna_defaults import default_sauna_prices
from services.auth_service import get_admin_user
from services import sauna_excel

logger = logging.getLogger(__name__)

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
# EXCEL / CSV EXPORT & IMPORT (admin only)
# =============================================

async def _load_prices_doc() -> dict:
    doc = await db.sauna_prices.find_one({"_id": "default"})
    if not doc:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        doc = dict(default_sauna_prices)
    else:
        doc.pop("_id", None)
    return doc


async def _load_overrides(dealer_id: str) -> list[dict]:
    return await db.dealer_price_overrides.find(
        {"dealerId": dealer_id}, {"_id": 0}
    ).to_list(length=10000)


@router.get("/prices/export")
async def export_sauna_prices(
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    dealerId: str | None = None,
    _: dict = Depends(get_admin_user),
):
    """Export sauna prices to XLSX or CSV.

    Optional `dealerId` adds a `dealerPrice` column populated from
    `dealer_price_overrides`.
    """
    doc = await _load_prices_doc()
    overrides = None
    dealer_name = ""
    if dealerId:
        dealer = await db.dealers.find_one({"id": dealerId})
        if not dealer:
            raise HTTPException(404, "Dealer not found")
        dealer_name = (dealer.get("username") or dealerId).replace(" ", "_")
        overrides = await _load_overrides(dealerId)

    if format == "csv":
        data = sauna_excel.export_csv(doc, overrides)
        media_type = "text/csv; charset=utf-8"
        ext = "csv"
    else:
        data = sauna_excel.export_xlsx(doc, overrides)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ext = "xlsx"

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    suffix = f"_{dealer_name}" if dealer_name else ""
    filename = f"sauna_prices{suffix}_{ts}.{ext}"
    safe_filename = quote(filename)

    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{safe_filename}"
        },
    )


@router.post("/prices/import/dry-run")
async def dry_run_import_sauna_prices(
    file: UploadFile = File(...),
    dealerId: str | None = Form(None),
    _: dict = Depends(get_admin_user),
):
    """Parse the uploaded file and return a diff vs current DB. Does NOT write anything."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    try:
        parsed = sauna_excel.parse_file(file.filename or "", content)
    except Exception as e:
        logger.exception("Failed to parse uploaded prices file")
        raise HTTPException(400, f"Failed to parse file: {e}")

    doc = await _load_prices_doc()
    overrides_lookup = None
    include_dealer = False
    if dealerId:
        if not await db.dealers.find_one({"id": dealerId}):
            raise HTTPException(404, "Dealer not found")
        include_dealer = True
        overrides_lookup = sauna_excel.build_overrides_lookup(
            await _load_overrides(dealerId)
        )

    result = sauna_excel.diff_rows(doc, parsed, overrides_lookup, include_dealer)
    result["totalRows"] = len(parsed)
    result["dealerId"] = dealerId
    return result


@router.post("/prices/import/commit")
async def commit_import_sauna_prices(
    file: UploadFile = File(...),
    dealerId: str | None = Form(None),
    admin: dict = Depends(get_admin_user),
):
    """Apply the uploaded file's changes to DB (base prices + optional dealer overrides)."""
    import uuid as _uuid

    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    try:
        parsed = sauna_excel.parse_file(file.filename or "", content)
    except Exception as e:
        logger.exception("Failed to parse uploaded prices file")
        raise HTTPException(400, f"Failed to parse file: {e}")

    doc = await _load_prices_doc()
    include_dealer = bool(dealerId)
    dealer_name = ""
    if include_dealer:
        dealer = await db.dealers.find_one({"id": dealerId})
        if not dealer:
            raise HTTPException(404, "Dealer not found")
        dealer_name = dealer.get("name") or dealer.get("username") or ""

    # Snapshot BEFORE writes (for rollback)
    snapshot_prices = doc  # already a copy from _load_prices_doc (mongo doc, _id removed)
    snapshot_overrides = (
        await _load_overrides(dealerId) if include_dealer else None
    )

    updated_doc, override_changes, summary = sauna_excel.apply_rows(
        doc, parsed, include_dealer
    )

    # Write base prices
    updated_doc.pop("_id", None)
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": updated_doc},
        upsert=True,
    )

    # Upsert dealer overrides (only those present in file)
    upserted = 0
    if include_dealer and override_changes:
        now = datetime.now(timezone.utc).isoformat()
        for ov in override_changes:
            filt = {
                "dealerId": dealerId,
                "kind": ov["kind"],
                "modelId": ov.get("modelId"),
                "variantId": ov.get("variantId"),
                "optionId": ov.get("optionId"),
                "optionVariantId": ov.get("optionVariantId"),
            }
            set_doc = {**filt, "price": ov["price"], "updatedAt": now}
            await db.dealer_price_overrides.update_one(
                filt, {"$set": set_doc}, upsert=True
            )
            upserted += 1

    # Persist audit entry
    history_id = str(_uuid.uuid4())
    await db.sauna_price_import_history.insert_one({
        "id": history_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "adminUsername": admin.get("username") or admin.get("sub") or "admin",
        "filename": file.filename or "",
        "dealerId": dealerId,
        "dealerName": dealer_name,
        "summary": summary,
        "overridesUpserted": upserted,
        "totalRows": len(parsed),
        "snapshotPrices": snapshot_prices,
        "snapshotOverrides": snapshot_overrides,
        "rolledBack": False,
    })

    # Cap history to last 50 entries per scope (dealerId or global)
    scope_filter = {"dealerId": dealerId}
    total = await db.sauna_price_import_history.count_documents(scope_filter)
    if total > 50:
        # Delete oldest entries beyond the cap
        excess = total - 50
        oldest = await db.sauna_price_import_history.find(
            scope_filter, {"id": 1, "_id": 0}
        ).sort("timestamp", 1).limit(excess).to_list(length=excess)
        old_ids = [o["id"] for o in oldest]
        if old_ids:
            await db.sauna_price_import_history.delete_many({"id": {"$in": old_ids}})

    return {
        "ok": True,
        "summary": summary,
        "overridesUpserted": upserted,
        "totalRows": len(parsed),
        "dealerId": dealerId,
        "historyId": history_id,
    }


# ----------------------------------------------------------------------------
# Import HISTORY (audit log + rollback)
# ----------------------------------------------------------------------------

@router.get("/prices/import/history")
async def list_import_history(
    dealerId: str | None = None,
    limit: int = 20,
    _: dict = Depends(get_admin_user),
):
    """List recent price-import commits. Scope by dealerId or global (dealerId=None)."""
    limit = max(1, min(int(limit or 20), 100))
    cursor = db.sauna_price_import_history.find(
        {"dealerId": dealerId},
        # exclude heavy snapshot blobs in list view
        {"_id": 0, "snapshotPrices": 0, "snapshotOverrides": 0},
    ).sort("timestamp", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items, "dealerId": dealerId}


@router.post("/prices/import/history/{history_id}/rollback")
async def rollback_import(
    history_id: str,
    _: dict = Depends(get_admin_user),
):
    """Restore the snapshot captured before this import commit."""
    entry = await db.sauna_price_import_history.find_one({"id": history_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "History entry not found")
    if entry.get("rolledBack"):
        raise HTTPException(400, "Already rolled back")

    snapshot_prices = entry.get("snapshotPrices") or {}
    snapshot_prices.pop("_id", None)
    if snapshot_prices:
        await db.sauna_prices.update_one(
            {"_id": "default"},
            {"$set": snapshot_prices},
            upsert=True,
        )

    # Restore dealer overrides if this entry was dealer-scoped
    dealer_id = entry.get("dealerId")
    if dealer_id is not None and entry.get("snapshotOverrides") is not None:
        await db.dealer_price_overrides.delete_many({"dealerId": dealer_id})
        now = datetime.now(timezone.utc).isoformat()
        docs = []
        for ov in entry["snapshotOverrides"]:
            d = dict(ov)
            d.pop("_id", None)
            d["dealerId"] = dealer_id
            d["updatedAt"] = now
            docs.append(d)
        if docs:
            await db.dealer_price_overrides.insert_many(docs)

    await db.sauna_price_import_history.update_one(
        {"id": history_id},
        {"$set": {"rolledBack": True, "rolledBackAt": datetime.now(timezone.utc).isoformat()}},
    )

    return {
        "ok": True,
        "restoredOverrides": len(entry.get("snapshotOverrides") or []) if dealer_id else None,
        "dealerId": dealer_id,
    }


@router.delete("/prices/import/history/{history_id}")
async def delete_import_history(
    history_id: str,
    _: dict = Depends(get_admin_user),
):
    """Permanently delete a history entry (snapshot blob included)."""
    res = await db.sauna_price_import_history.delete_one({"id": history_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "History entry not found")
    return {"ok": True}


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


# =============================================
# PUBLIC API FOR WEBSITE
# =============================================

@router.get("/public/models")
async def get_public_models(response: Response, lang: str = "pl"):
    """
    Public API for external website — returns all active sauna models
    with variants, images, layouts, comparison data, and website descriptions.
    
    Query params:
        lang: "pl" or "ru" (default: "pl")
    
    No authentication required.
    """
    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0})
    if not prices:
        return {"models": []}
    
    models = prices.get("models", [])
    categories = prices.get("categories", [])
    
    result = []
    for model in models:
        if not model.get("active", True):
            continue
        
        # Resolve linked variants
        variants = model.get("variants", [])
        linked_id = model.get("linkedVariantsModelId")
        if linked_id and not variants:
            linked_model = next((m for m in models if m.get("id") == linked_id), None)
            if linked_model:
                variants = linked_model.get("variants", [])
        
        # Build variant data
        variant_list = []
        comparison_rows = []
        for v in variants:
            name = v.get("namePl", "") or v.get("name", "") if lang == "pl" else v.get("name", "") or v.get("namePl", "")
            hint = v.get("hintPl", "") or v.get("hint", "") if lang == "pl" else v.get("hint", "") or v.get("hintPl", "")
            category = v.get("categoryPl", "") or v.get("category", "") if lang == "pl" else v.get("category", "") or v.get("categoryPl", "")
            
            variant_item = {
                "id": v.get("id"),
                "name": name,
                "price": v.get("price", 0),
                "imageUrl": v.get("imageUrl", ""),
                "description": hint,
                "category": category,
                "capacity": v.get("capacity", ""),
                "terraceSize": v.get("terraceSize", ""),
                "relaxRoomSize": v.get("relaxRoomSize", ""),
                "steamRoomSize": v.get("steamRoomSize", ""),
                "entranceSide": v.get("entranceSide", ""),
            }
            variant_list.append(variant_item)
            
            # Build comparison row
            comparison_rows.append({
                "name": name,
                "capacity": v.get("capacity", ""),
                "relaxRoomSize": v.get("relaxRoomSize", ""),
                "steamRoomSize": v.get("steamRoomSize", ""),
                "terraceSize": v.get("terraceSize", ""),
                "entranceSide": v.get("entranceSide", ""),
                "price": v.get("price", 0),
            })
        
        # Website description
        if lang == "pl":
            description = model.get("websiteDescriptionPl", "") or model.get("websiteDescription", "") or model.get("hint", "")
        else:
            description = model.get("websiteDescription", "") or model.get("websiteDescriptionPl", "") or model.get("hint", "")
        
        model_item = {
            "id": model.get("id"),
            "name": model.get("name", ""),
            "basePrice": model.get("basePrice", 0),
            "foundationPrice": model.get("foundationPrice", 0),
            "discount": model.get("discount", 0),
            "imageUrl": model.get("imageUrl", ""),
            "galleryImages": model.get("galleryImages", []),
            "description": description,
            "capacity": model.get("capacity", ""),
            "relaxRoomSize": model.get("relaxRoomSize", ""),
            "steamRoomSize": model.get("steamRoomSize", ""),
            "layoutSize": model.get("layoutSize", ""),
            "variants": variant_list,
            "comparisonTable": {
                "headers": [
                    "Wariant" if lang == "pl" else "Вариант",
                    "Osoby" if lang == "pl" else "Кол-во человек",
                    "Pokój wypoczynkowy" if lang == "pl" else "Комната отдыха",
                    "Pokój parowy" if lang == "pl" else "Парная",
                    "Taras" if lang == "pl" else "Терраса",
                    "Wejście" if lang == "pl" else "Вход",
                    "Cena" if lang == "pl" else "Цена",
                ],
                "rows": comparison_rows,
            } if comparison_rows else None,
        }
        
        result.append(model_item)
    
    # Cache for 5 minutes
    response.headers["Cache-Control"] = "public, max-age=300"
    response.headers["Access-Control-Allow-Origin"] = "*"
    
    return {"models": result, "lang": lang}


@router.get("/public/models/{model_id}")
async def get_public_model_detail(model_id: str, response: Response, lang: str = "pl"):
    """
    Public API — get a single model with full details including options.
    
    No authentication required.
    """
    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0})
    if not prices:
        raise HTTPException(status_code=404, detail="Model not found")
    
    models = prices.get("models", [])
    model = next((m for m in models if m.get("id") == model_id), None)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Use the list endpoint logic for consistency
    # (we re-use the same response format)
    response.headers["Cache-Control"] = "public, max-age=300"
    response.headers["Access-Control-Allow-Origin"] = "*"
    
    # Resolve linked variants
    variants = model.get("variants", [])
    linked_id = model.get("linkedVariantsModelId")
    if linked_id and not variants:
        linked_model = next((m for m in models if m.get("id") == linked_id), None)
        if linked_model:
            variants = linked_model.get("variants", [])
    
    variant_list = []
    comparison_rows = []
    for v in variants:
        name = v.get("namePl", "") or v.get("name", "") if lang == "pl" else v.get("name", "") or v.get("namePl", "")
        hint = v.get("hintPl", "") or v.get("hint", "") if lang == "pl" else v.get("hint", "") or v.get("hintPl", "")
        category = v.get("categoryPl", "") or v.get("category", "") if lang == "pl" else v.get("category", "") or v.get("categoryPl", "")
        
        variant_list.append({
            "id": v.get("id"),
            "name": name,
            "price": v.get("price", 0),
            "imageUrl": v.get("imageUrl", ""),
            "description": hint,
            "category": category,
            "capacity": v.get("capacity", ""),
            "terraceSize": v.get("terraceSize", ""),
            "relaxRoomSize": v.get("relaxRoomSize", ""),
            "steamRoomSize": v.get("steamRoomSize", ""),
            "entranceSide": v.get("entranceSide", ""),
        })
        comparison_rows.append({
            "name": name,
            "capacity": v.get("capacity", ""),
            "relaxRoomSize": v.get("relaxRoomSize", ""),
            "steamRoomSize": v.get("steamRoomSize", ""),
            "terraceSize": v.get("terraceSize", ""),
            "entranceSide": v.get("entranceSide", ""),
            "price": v.get("price", 0),
        })
    
    if lang == "pl":
        description = model.get("websiteDescriptionPl", "") or model.get("websiteDescription", "") or model.get("hint", "")
    else:
        description = model.get("websiteDescription", "") or model.get("websiteDescriptionPl", "") or model.get("hint", "")
    
    # Get available options for this model
    categories = prices.get("categories", [])
    options_list = []
    for cat in categories:
        cat_options = []
        for opt in cat.get("options", []):
            if not opt.get("active", True):
                continue
            opt_variants = opt.get("variants", []) or opt.get("subOptions", []) or []
            cat_options.append({
                "id": opt.get("id"),
                "name": opt.get("namePl", "") or opt.get("name", "") if lang == "pl" else opt.get("name", "") or opt.get("namePl", ""),
                "price": opt.get("price", 0),
                "imageUrl": opt.get("imageUrl", ""),
                "variants": [{
                    "id": ov.get("id"),
                    "name": ov.get("namePl", "") or ov.get("name", "") if lang == "pl" else ov.get("name", "") or ov.get("namePl", ""),
                    "price": ov.get("price", 0),
                    "imageUrl": ov.get("imageUrl", ""),
                } for ov in opt_variants],
            })
        if cat_options:
            options_list.append({
                "id": cat.get("id"),
                "name": cat.get("namePl", "") or cat.get("name", "") if lang == "pl" else cat.get("name", "") or cat.get("namePl", ""),
                "options": cat_options,
            })
    
    return {
        "id": model.get("id"),
        "name": model.get("name", ""),
        "basePrice": model.get("basePrice", 0),
        "foundationPrice": model.get("foundationPrice", 0),
        "discount": model.get("discount", 0),
        "imageUrl": model.get("imageUrl", ""),
        "galleryImages": model.get("galleryImages", []),
        "description": description,
        "capacity": model.get("capacity", ""),
        "relaxRoomSize": model.get("relaxRoomSize", ""),
        "steamRoomSize": model.get("steamRoomSize", ""),
        "layoutSize": model.get("layoutSize", ""),
        "variants": variant_list,
        "comparisonTable": {
            "headers": [
                "Wariant" if lang == "pl" else "Вариант",
                "Osoby" if lang == "pl" else "Кол-во человек",
                "Pokój wypoczynkowy" if lang == "pl" else "Комната отдыха",
                "Pokój parowy" if lang == "pl" else "Парная",
                "Taras" if lang == "pl" else "Терраса",
                "Wejście" if lang == "pl" else "Вход",
                "Cena" if lang == "pl" else "Цена",
            ],
            "rows": comparison_rows,
        } if comparison_rows else None,
        "availableOptions": options_list,
        "lang": lang,
    }
