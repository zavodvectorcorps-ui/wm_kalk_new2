"""CRUD operations for sauna models, categories, and options."""
from fastapi import APIRouter, HTTPException, Response, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from urllib.parse import quote
import io
import re
import asyncio
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

# Rewrites legacy absolute image URLs that point at old preview hosts
# (e.g. https://sauna-catalog.preview.emergentagent.com/api/uploads/xxx) down to
# a relative path (/api/uploads/xxx). The files live in our own DB and are served
# from the current host, so relative paths resolve correctly on any environment.
_ABS_UPLOAD_RE = re.compile(r'https?://[^/\s"]+(/api/(?:uploads|static)/)', re.IGNORECASE)


def _normalize_media_urls(data):
    if isinstance(data, list):
        return [_normalize_media_urls(x) for x in data]
    if isinstance(data, dict):
        return {k: _normalize_media_urls(v) for k, v in data.items()}
    if isinstance(data, str) and ('/api/uploads/' in data or '/api/static/' in data):
        return _ABS_UPLOAD_RE.sub(r'\1', data)
    return data


@router.get("/prices")
async def get_sauna_prices(response: Response):
    """Get sauna pricing data"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        prices = default_sauna_prices
    else:
        prices.pop('_id', None)
    
    prices = _normalize_media_urls(prices)
    
    # Cache for 5 minutes (prices don't change often)
    response.headers["Cache-Control"] = "public, max-age=300"
    
    return prices


# =============================================
# IMAGE INTEGRITY CHECK (admin)
# =============================================

def _collect_image_refs(prices: dict, calc_label: str) -> list:
    """Collect all image references with human-readable context from a prices doc."""
    refs = []

    def add(url, section, item, field):
        if isinstance(url, str) and url.strip():
            refs.append({"calculator": calc_label, "section": section, "item": item or "—", "field": field, "url": url.strip()})

    # Global model hint
    add(prices.get("modelsHintImageUrl"), "Общее", "Подсказка моделей", "modelsHintImageUrl")

    for m in prices.get("models", []) or []:
        mname = m.get("name") or m.get("id") or "Модель"
        add(m.get("imageUrl"), "Модели", mname, "imageUrl")
        add(m.get("hintImageUrl"), "Модели", mname, "hintImageUrl")
        add(m.get("modelGroupImageUrl"), "Модели", mname, "modelGroupImageUrl")
        for i, g in enumerate(m.get("galleryImages", []) or []):
            add(g, "Галерея модели", mname, f"galleryImages[{i}]")
        for v in m.get("variants", []) or []:
            vname = v.get("namePl") or v.get("name") or v.get("nameRu") or v.get("id") or "Вариант"
            add(v.get("imageUrl"), "Варианты модели", f"{mname} → {vname}", "imageUrl")

    for c in prices.get("categories", []) or []:
        cname = c.get("name") or c.get("id") or "Категория"
        for o in c.get("options", []) or []:
            oname = o.get("name") or o.get("id") or "Опция"
            label = f"{cname} → {oname}"
            add(o.get("imageUrl"), "Опции", label, "imageUrl")
            add(o.get("hintImageUrl"), "Опции", label, "hintImageUrl")
            for v in (o.get("variants", []) or []) + (o.get("subOptions", []) or []):
                vname = v.get("namePl") or v.get("name") or v.get("nameRu") or v.get("id") or "Вариант"
                add(v.get("imageUrl"), "Варианты опции", f"{label} → {vname}", "imageUrl")

    return refs


async def _check_url_reachable(url: str, client) -> tuple:
    """Return (status, reason) where status is 'ok' | 'broken' | 'uncertain'.
    Uploads are validated against the DB; external URLs via HTTP.
    - broken   : file definitely missing (404/410, DNS/connection failure, missing DB record)
    - uncertain: host blocks automated checks (401/403/429) or transient 5xx — likely fine in browser
    """
    if url.startswith("data:"):
        return "ok", "data-uri"
    # Files stored in our own DB, served from /api/uploads/<id>
    if "/api/uploads/" in url:
        file_part = url.split("/api/uploads/", 1)[1].split("?", 1)[0].split("#", 1)[0]
        file_id = file_part.rsplit(".", 1)[0] if "." in file_part else file_part
        doc = await db.images.find_one({"id": file_id}, {"_id": 1})
        return ("ok", "db") if doc else ("broken", "нет файла в базе")
    # Internal static or relative path
    if url.startswith("/"):
        target = f"http://localhost:8001{url}"
    elif url.startswith("http://") or url.startswith("https://"):
        target = url
    else:
        return "broken", "неизвестный формат ссылки"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
    }
    last_reason = "недоступно"
    for attempt in range(2):
        try:
            r = await client.get(target, follow_redirects=True, timeout=8.0, headers=headers)
            code = r.status_code
            if code < 400:
                return "ok", str(code)
            if code in (404, 410):
                return "broken", f"HTTP {code} (не найдено)"
            if code in (401, 403, 429):
                last_reason = f"HTTP {code} (хост блокирует проверку)"
                if code == 429 and attempt == 0:
                    await asyncio.sleep(1.0)
                    continue
                return "uncertain", last_reason
            # 5xx and others
            last_reason = f"HTTP {code}"
            return "uncertain", last_reason
        except Exception as e:
            last_reason = f"недоступно ({type(e).__name__})"
            return "broken", last_reason
    return "uncertain", last_reason


@router.post("/translate-options")
async def translate_option_names(payload: dict):
    """Translate a list of Polish option names to Russian using the Emergent LLM key (gpt-5.4)."""
    import os, json as _json, uuid
    texts = payload.get("texts") or []
    texts = [t if isinstance(t, str) else "" for t in texts]
    non_empty = [t for t in texts if t.strip()]
    if not non_empty:
        return {"translations": ["" for _ in texts]}

    from emergentintegrations.llm.chat import LlmChat, UserMessage
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    chat = LlmChat(
        api_key=key,
        session_id=f"translate-{uuid.uuid4()}",
        system_message=(
            "Ты профессиональный переводчик для производителя саун. Переводишь названия опций "
            "с польского на русский естественно и кратко. Верни СТРОГО JSON-массив строк с переводами "
            "в том же порядке и том же количестве, что и на входе. Без пояснений, без markdown."
        ),
    ).with_model("openai", "gpt-5.4")

    prompt = ("Переведи на русский следующие названия (JSON-массив строк). "
              "Сохрани порядок и количество элементов:\n" + _json.dumps(texts, ensure_ascii=False))
    resp = await chat.send_message(UserMessage(text=prompt))
    raw = resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
    raw = (raw or "").strip()

    start, end = raw.find("["), raw.rfind("]")
    translations = []
    if start != -1 and end != -1:
        try:
            translations = _json.loads(raw[start:end + 1])
        except Exception:
            translations = []
    if not isinstance(translations, list) or len(translations) != len(texts):
        # Fall back to original text where translation is missing
        fixed = []
        for i, t in enumerate(texts):
            fixed.append(translations[i] if i < len(translations) and isinstance(translations[i], str) else t)
        translations = fixed
    return {"translations": translations}


@router.get("/check-images")
async def check_broken_images(scope: str = "all"):
    """Scan sauna (and optionally balia) prices for broken/unreachable image URLs.

    scope: 'sauna' | 'balia' | 'all' (default)
    """
    import httpx

    refs = []
    if scope in ("sauna", "all"):
        sauna = await db.sauna_prices.find_one({"_id": "default"}) or {}
        refs += _collect_image_refs(sauna, "Сауны")
    if scope in ("balia", "all"):
        balia = await db.prices.find_one({"_id": "default"}) or {}
        refs += _collect_image_refs(balia, "Бали")

    # De-duplicate URL checks (many refs can share the same URL)
    unique_urls = list({r["url"] for r in refs})
    sem = asyncio.Semaphore(12)
    results = {}

    async with httpx.AsyncClient() as client:
        async def run(u):
            async with sem:
                results[u] = await _check_url_reachable(u, client)
        await asyncio.gather(*(run(u) for u in unique_urls))

    broken, uncertain = [], []
    for r in refs:
        status, reason = results.get(r["url"], ("broken", "не проверено"))
        if status == "broken":
            broken.append({**r, "reason": reason})
        elif status == "uncertain":
            uncertain.append({**r, "reason": reason})

    return {
        "scope": scope,
        "total_images": len(refs),
        "unique_urls": len(unique_urls),
        "broken_count": len(broken),
        "uncertain_count": len(uncertain),
        "broken": broken,
        "uncertain": uncertain,
    }



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

    # Capture AFTER-state for diff view (uses the updated_doc + post-upsert overrides)
    snapshot_after_prices = updated_doc
    snapshot_after_overrides = (
        await _load_overrides(dealerId) if include_dealer else None
    )

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
        "snapshotAfterPrices": snapshot_after_prices,
        "snapshotAfterOverrides": snapshot_after_overrides,
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
        {"_id": 0, "snapshotPrices": 0, "snapshotOverrides": 0,
         "snapshotAfterPrices": 0, "snapshotAfterOverrides": 0},
    ).sort("timestamp", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items, "dealerId": dealerId}


@router.get("/prices/import/history/{history_id}/diff")
async def get_import_history_diff(
    history_id: str,
    _: dict = Depends(get_admin_user),
):
    """Return the before→after diff for this specific commit.

    For older entries that pre-date snapshotAfter capture, falls back to
    comparing the BEFORE snapshot vs CURRENT live prices (with a flag so
    the UI can label it accordingly).
    """
    entry = await db.sauna_price_import_history.find_one({"id": history_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "History entry not found")

    before = entry.get("snapshotPrices") or {}
    before_ov = entry.get("snapshotOverrides")
    after = entry.get("snapshotAfterPrices")
    after_ov = entry.get("snapshotAfterOverrides")
    is_fallback = False

    # Fallback for legacy entries written before snapshotAfter existed
    if after is None:
        is_fallback = True
        after = await _load_prices_doc()
        after_ov = await _load_overrides(entry["dealerId"]) if entry.get("dealerId") else None

    include_dealer = entry.get("dealerId") is not None
    result = sauna_excel.snapshot_diff(
        before, after,
        before_overrides=before_ov, after_overrides=after_ov,
        include_dealer_price=include_dealer,
    )
    result["historyId"] = history_id
    result["isFallback"] = is_fallback
    result["timestamp"] = entry.get("timestamp")
    result["filename"] = entry.get("filename")
    result["adminUsername"] = entry.get("adminUsername")
    result["dealerId"] = entry.get("dealerId")
    result["dealerName"] = entry.get("dealerName")
    result["rolledBack"] = entry.get("rolledBack", False)
    return result


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
