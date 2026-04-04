"""
Konkurencja Live - Competitive Intelligence Module
Completely isolated from other app modules. Read-only access to WM Group data.
All collections prefixed with 'konkurencja_' to avoid conflicts.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from datetime import datetime, timezone
from typing import Optional, List
import httpx
import asyncio
import re
import os
import json
import logging
from bs4 import BeautifulSoup
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/konkurencja", tags=["konkurencja"])

# Isolated DB connection
MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections - all prefixed
competitors_col = db["konkurencja_competitors"]
products_col = db["konkurencja_products"]
price_history_col = db["konkurencja_price_history"]
parse_logs_col = db["konkurencja_parse_logs"]
alerts_col = db["konkurencja_alerts"]
settings_col = db["konkurencja_settings"]

# --- SEED DATA ---
SEED_COMPETITORS = [
    {
        "id": "koba-sauna",
        "brand_name": "KOBA Sauna",
        "primary_url": "https://kobasauna.pl",
        "alternate_urls": ["https://koba-sauna.pl"],
        "source_type": "producer",
        "region_focus": "cala_polska",
        "priority_level": "high",
        "active_categories": ["sauna_beczka", "sauna_kwadratowa", "sauna_panoramiczna", "balia_ogrodowa", "sauna_plus_balia_2w1"],
        "notes_for_sales_team": "10+ lat doswiadczenia, 1300+ realizacji, 5 lat gwarancji, AR, DIY, 2w1, serwis, Thermowood. Silna marka.",
        "tags": [],
        "warsaw_priority": True,
    },
    {
        "id": "polska-bania",
        "brand_name": "Polska Bania",
        "primary_url": "https://polskabania.pl",
        "alternate_urls": [],
        "source_type": "producer",
        "region_focus": "cala_polska",
        "priority_level": "high",
        "active_categories": ["sauna_beczka", "balia_ogrodowa"],
        "notes_for_sales_team": "Fokus na banie i balie. Sprawdz oferte sezonowa.",
        "tags": [],
        "warsaw_priority": False,
    },
    {
        "id": "polska-sauna",
        "brand_name": "Polska Sauna",
        "primary_url": "http://www.polskasauna.pl",
        "alternate_urls": [],
        "source_type": "producer",
        "region_focus": "cala_polska",
        "priority_level": "high",
        "active_categories": ["sauna_beczka", "sauna_kwadratowa", "sauna_panoramiczna"],
        "notes_for_sales_team": "Duzy producent, szeroka oferta saun.",
        "tags": [],
        "warsaw_priority": False,
    },
    {
        "id": "dream-of-wood",
        "brand_name": "Dream of Wood",
        "primary_url": "https://dreamofwood.pl",
        "alternate_urls": [],
        "source_type": "producer",
        "region_focus": "cala_polska",
        "priority_level": "high",
        "active_categories": ["sauna_beczka", "sauna_kwadratowa", "balia_ogrodowa"],
        "notes_for_sales_team": "Premium segment, thermodrewno, nowoczesny design.",
        "tags": ["premium"],
        "warsaw_priority": False,
    },
    {
        "id": "beczka-z-paczki",
        "brand_name": "Beczka z Paczki",
        "primary_url": "https://beczkazpaczki.pl",
        "alternate_urls": [],
        "source_type": "producer",
        "region_focus": "cala_polska",
        "priority_level": "medium",
        "active_categories": ["sauna_beczka", "diy_sauna"],
        "notes_for_sales_team": "DIY kits, niska cena wejscia. Klient moze porownywac ceny.",
        "tags": ["diy", "budget"],
        "warsaw_priority": False,
    },
    {
        "id": "puravia",
        "brand_name": "Puravia",
        "primary_url": "https://www.puravia.pl",
        "alternate_urls": [],
        "source_type": "producer",
        "region_focus": "cala_polska",
        "priority_level": "medium",
        "active_categories": ["sauna_beczka", "sauna_kwadratowa", "balia_ogrodowa"],
        "notes_for_sales_team": "Sredni segment, sprawdz aktualna oferte.",
        "tags": [],
        "warsaw_priority": False,
    },
    {
        "id": "filanest",
        "brand_name": "Filanest",
        "primary_url": "https://filanest.com",
        "alternate_urls": [],
        "source_type": "producer",
        "region_focus": "cala_polska",
        "priority_level": "medium",
        "active_categories": ["sauna_beczka", "sauna_kwadratowa", "balia_ogrodowa"],
        "notes_for_sales_team": "Sprawdz pozycjonowanie cenowe.",
        "tags": [],
        "warsaw_priority": False,
    },
    {
        "id": "dorako",
        "brand_name": "Dorako",
        "primary_url": "https://dorako.pl",
        "alternate_urls": [],
        "source_type": "regional",
        "region_focus": "mazowieckie",
        "priority_level": "medium",
        "active_categories": ["sauna_beczka", "balia_ogrodowa"],
        "notes_for_sales_team": "Regionalny gracz, Mazowieckie. Moze byc aktywny w Warszawie.",
        "tags": ["warsaw-focus"],
        "warsaw_priority": True,
    },
    {
        "id": "kitra",
        "brand_name": "Kitra",
        "primary_url": "https://kitra.pl",
        "alternate_urls": [],
        "source_type": "regional",
        "region_focus": "mazowieckie",
        "priority_level": "medium",
        "active_categories": ["sauna_beczka", "balia_ogrodowa"],
        "notes_for_sales_team": "Regionalny gracz. Sprawdz dostepnosc i ceny.",
        "tags": ["warsaw-focus"],
        "warsaw_priority": True,
    },
    {
        "id": "beskidzka-balia",
        "brand_name": "Beskidzka Balia",
        "primary_url": "https://beskidzkabalia.pl",
        "alternate_urls": [],
        "source_type": "regional",
        "region_focus": "malopolskie",
        "priority_level": "low",
        "active_categories": ["balia_ogrodowa"],
        "notes_for_sales_team": "Fokus na balie, region poludniowy. Mniejsze znaczenie dla Warszawy.",
        "tags": ["balia-strong"],
        "warsaw_priority": False,
    },
    {
        "id": "allegro",
        "brand_name": "Allegro",
        "primary_url": "https://allegro.pl",
        "alternate_urls": [],
        "source_type": "marketplace",
        "region_focus": "cala_polska",
        "priority_level": "high",
        "active_categories": ["sauna_beczka", "balia_ogrodowa", "diy_sauna"],
        "notes_for_sales_team": "Marketplace. Niskie ceny, czesto DIY. Klienci czesto porownuja.",
        "tags": ["marketplace", "budget"],
        "warsaw_priority": True,
    },
    {
        "id": "olx-warszawa",
        "brand_name": "OLX Warszawa",
        "primary_url": "https://www.olx.pl",
        "alternate_urls": [],
        "source_type": "marketplace",
        "region_focus": "warszawa",
        "priority_level": "medium",
        "active_categories": ["sauna_beczka", "balia_ogrodowa"],
        "notes_for_sales_team": "Ogłoszenia lokalne. Warszawa i okolice. Czesto uzywane lub tanie nowe.",
        "tags": ["marketplace", "budget", "warsaw-focus"],
        "warsaw_priority": True,
    },
]

CATEGORIES = {
    "sauna_beczka": "Sauna beczka",
    "sauna_kwadratowa": "Sauna kwadratowa",
    "sauna_panoramiczna": "Sauna panoramiczna",
    "sauna_owalna": "Sauna owalna",
    "sauna_loft": "Sauna loft",
    "balia_ogrodowa": "Balia ogrodowa",
    "sauna_plus_balia_2w1": "Sauna + Balia 2w1",
    "diy_sauna": "DIY Sauna",
    "spa_set": "SPA Set",
    "jacuzzi": "Jacuzzi / Hot Tub",
}

# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/dashboard")
async def get_dashboard():
    """Dashboard stats - completely isolated."""
    total_competitors = await competitors_col.count_documents({})
    total_products = await products_col.count_documents({})
    
    now = datetime.now(timezone.utc)
    day_ago = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    week_ago_ts = now.timestamp() - 7 * 86400
    
    products_24h = await products_col.count_documents({"updated_at": {"$gte": day_ago.isoformat()}})
    
    new_products_7d = await products_col.count_documents({
        "first_seen_at": {"$gte": datetime.fromtimestamp(week_ago_ts, tz=timezone.utc).isoformat()}
    })
    
    # Active alerts
    active_alerts = await alerts_col.count_documents({"read": False})
    
    # Recent alerts
    recent_alerts = await alerts_col.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    
    # Price stats by category
    pipeline = [
        {"$match": {"current_price": {"$gt": 0}}},
        {"$group": {
            "_id": "$category",
            "avg_price": {"$avg": "$current_price"},
            "min_price": {"$min": "$current_price"},
            "max_price": {"$max": "$current_price"},
            "count": {"$sum": 1}
        }}
    ]
    category_stats = await products_col.aggregate(pipeline).to_list(50)
    
    # Warsaw priority competitors
    warsaw_competitors = await competitors_col.find(
        {"warsaw_priority": True}, {"_id": 0}
    ).to_list(20)
    
    # Parse status
    last_logs = await parse_logs_col.find({}, {"_id": 0}).sort("started_at", -1).to_list(5)
    
    # Products needing review
    needs_review = await products_col.count_documents({"needs_review_flag": True})
    
    # Products with promotions
    promo_products = await products_col.count_documents({
        "old_price": {"$gt": 0}, "current_price": {"$gt": 0}
    })
    
    return {
        "total_competitors": total_competitors,
        "total_products": total_products,
        "products_updated_24h": products_24h,
        "new_products_7d": new_products_7d,
        "active_alerts": active_alerts,
        "recent_alerts": recent_alerts,
        "category_stats": category_stats,
        "warsaw_competitors": warsaw_competitors,
        "last_parse_logs": last_logs,
        "needs_review": needs_review,
        "promo_products": promo_products,
        "categories": CATEGORIES,
    }


@router.get("/competitors")
async def get_competitors():
    """List all competitors."""
    comps = await competitors_col.find({}, {"_id": 0}).sort("priority_level", 1).to_list(100)
    for c in comps:
        c["product_count"] = await products_col.count_documents({"competitor_id": c["id"]})
    return {"competitors": comps}


@router.get("/competitors/{comp_id}")
async def get_competitor(comp_id: str):
    comp = await competitors_col.find_one({"id": comp_id}, {"_id": 0})
    if not comp:
        raise HTTPException(404, "Competitor not found")
    comp["products"] = await products_col.find(
        {"competitor_id": comp_id}, {"_id": 0}
    ).sort("current_price", -1).to_list(500)
    return comp


@router.put("/competitors/{comp_id}")
async def update_competitor(comp_id: str, data: dict):
    data.pop("_id", None)
    data.pop("id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await competitors_col.update_one({"id": comp_id}, {"$set": data})
    return {"ok": True}


@router.get("/products")
async def get_products(
    competitor_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    warsaw_only: bool = False,
    needs_review: bool = False,
    has_promo: bool = False,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = "updated_at",
    sort_dir: int = -1,
    skip: int = 0,
    limit: int = 100,
):
    """Products table with filters."""
    query = {}
    if competitor_id:
        query["competitor_id"] = competitor_id
    if category:
        query["category"] = category
    if needs_review:
        query["needs_review_flag"] = True
    if has_promo:
        query["old_price"] = {"$gt": 0}
    if min_price is not None:
        query["current_price"] = query.get("current_price", {})
        query["current_price"]["$gte"] = min_price
    if max_price is not None:
        query.setdefault("current_price", {})["$lte"] = max_price
    if search:
        query["$or"] = [
            {"product_name": {"$regex": search, "$options": "i"}},
            {"competitor_name": {"$regex": search, "$options": "i"}},
        ]
    if warsaw_only:
        # Get warsaw competitor ids
        wc = await competitors_col.find({"warsaw_priority": True}, {"id": 1, "_id": 0}).to_list(50)
        wc_ids = [c["id"] for c in wc]
        query["competitor_id"] = {"$in": wc_ids}
    
    total = await products_col.count_documents(query)
    products = await products_col.find(query, {"_id": 0}).sort(sort_by, sort_dir).skip(skip).limit(limit).to_list(limit)
    return {"products": products, "total": total}


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    prod = await products_col.find_one({"id": product_id}, {"_id": 0})
    if not prod:
        raise HTTPException(404, "Product not found")
    # Price history
    history = await price_history_col.find(
        {"product_id": product_id}, {"_id": 0}
    ).sort("checked_at", -1).to_list(100)
    prod["price_history"] = history
    return prod


@router.put("/products/{product_id}")
async def update_product(product_id: str, data: dict):
    """Manual edit/review of a product."""
    data.pop("_id", None)
    data.pop("id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["manually_verified"] = True
    data["verified_at"] = datetime.now(timezone.utc).isoformat()
    await products_col.update_one({"id": product_id}, {"$set": data})
    return {"ok": True}


@router.get("/alerts")
async def get_alerts(unread_only: bool = False, limit: int = 50):
    query = {"read": False} if unread_only else {}
    alerts = await alerts_col.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"alerts": alerts}


@router.post("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str):
    await alerts_col.update_one({"id": alert_id}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/alerts/read-all")
async def mark_all_alerts_read():
    await alerts_col.update_many({"read": False}, {"$set": {"read": True}})
    return {"ok": True}


@router.get("/parse-logs")
async def get_parse_logs(limit: int = 50):
    logs = await parse_logs_col.find({}, {"_id": 0}).sort("started_at", -1).to_list(limit)
    return {"logs": logs}


@router.get("/wm-products")
async def get_wm_products():
    """Read-only access to WM Group products from calculators."""
    sauna_models = await db.sauna_models.find({}, {"_id": 0}).to_list(200)
    balia_models = await db.balia_models.find({}, {"_id": 0}).to_list(200)
    
    wm_products = []
    for m in sauna_models:
        wm_products.append({
            "id": f"wm-sauna-{m.get('id', '')}",
            "source": "sauna_calculator",
            "name": m.get("name", ""),
            "category": _guess_sauna_category(m),
            "base_price": m.get("basePrice", 0),
            "dimensions": m.get("dimensions", ""),
            "capacity_people": m.get("capacity", ""),
            "material": m.get("material", ""),
            "image_url": m.get("imageUrl", ""),
        })
    for m in balia_models:
        wm_products.append({
            "id": f"wm-balia-{m.get('id', '')}",
            "source": "balia_calculator",
            "name": m.get("name", ""),
            "category": "balia_ogrodowa",
            "base_price": m.get("basePrice", 0),
            "dimensions": m.get("dimensions", ""),
            "capacity_people": m.get("capacity", ""),
            "material": m.get("material", ""),
            "image_url": m.get("imageUrl", ""),
            "heater_variants": m.get("heaterVariants", []),
        })
    return {"products": wm_products}


def _guess_sauna_category(model):
    name = (model.get("name", "") + " " + model.get("description", "")).lower()
    if "beczk" in name: return "sauna_beczka"
    if "panoram" in name: return "sauna_panoramiczna"
    if "owaln" in name: return "sauna_owalna"
    if "loft" in name: return "sauna_loft"
    if "kwadrat" in name or "nowoczesn" in name: return "sauna_kwadratowa"
    return "sauna_kwadratowa"


# ============================================================
# SEED & SYNC
# ============================================================

@router.post("/seed")
async def seed_competitors():
    """Seed initial competitor data."""
    count = 0
    for comp in SEED_COMPETITORS:
        existing = await competitors_col.find_one({"id": comp["id"]})
        if not existing:
            comp["created_at"] = datetime.now(timezone.utc).isoformat()
            comp["updated_at"] = comp["created_at"]
            comp["last_sync_at"] = None
            comp["product_count"] = 0
            await competitors_col.insert_one(comp)
            count += 1
    return {"seeded": count, "total": len(SEED_COMPETITORS)}


@router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks, competitor_id: Optional[str] = None):
    """Trigger manual sync for one or all competitors."""
    background_tasks.add_task(run_sync, competitor_id)
    return {"status": "sync_started", "competitor_id": competitor_id or "all"}


@router.get("/sync-status")
async def get_sync_status():
    """Get current sync status."""
    s = await settings_col.find_one({"key": "sync_status"}, {"_id": 0})
    return s or {"key": "sync_status", "running": False, "progress": 0}


# ============================================================
# SCRAPING ENGINE
# ============================================================

async def run_sync(competitor_id: Optional[str] = None):
    """Background task to scrape competitor data."""
    await settings_col.update_one(
        {"key": "sync_status"},
        {"$set": {"running": True, "progress": 0, "started_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    try:
        if competitor_id:
            comps = await competitors_col.find({"id": competitor_id}, {"_id": 0}).to_list(1)
        else:
            comps = await competitors_col.find({}, {"_id": 0}).to_list(50)
        
        total = len(comps)
        for i, comp in enumerate(comps):
            log_id = f"log-{comp['id']}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
            log_entry = {
                "id": log_id,
                "competitor_id": comp["id"],
                "competitor_name": comp["brand_name"],
                "started_at": datetime.now(timezone.utc).isoformat(),
                "status": "running",
                "products_found": 0,
                "products_updated": 0,
                "errors": [],
            }
            
            try:
                await scrape_competitor(comp, log_entry)
                log_entry["status"] = "success" if not log_entry["errors"] else "partial"
            except Exception as e:
                log_entry["status"] = "failed"
                log_entry["errors"].append(str(e))
                logger.error(f"Sync error for {comp['id']}: {e}")
            
            log_entry["finished_at"] = datetime.now(timezone.utc).isoformat()
            await parse_logs_col.insert_one(log_entry)
            
            await competitors_col.update_one(
                {"id": comp["id"]},
                {"$set": {"last_sync_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            progress = int((i + 1) / total * 100)
            await settings_col.update_one(
                {"key": "sync_status"},
                {"$set": {"progress": progress}}
            )
    finally:
        await settings_col.update_one(
            {"key": "sync_status"},
            {"$set": {"running": False, "progress": 100, "finished_at": datetime.now(timezone.utc).isoformat()}}
        )


async def scrape_competitor(comp: dict, log_entry: dict):
    """Scrape a single competitor website."""
    url = comp["primary_url"]
    comp_id = comp["id"]
    
    # Skip marketplaces for now (need special handling)
    if comp["source_type"] == "marketplace":
        log_entry["status"] = "skipped"
        log_entry["errors"].append("Marketplace scraping not yet implemented")
        return
    
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, verify=False) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        log_entry["errors"].append(f"HTTP error: {str(e)}")
        return
    
    # Parse main page to find product links
    soup = BeautifulSoup(html, "lxml")
    text_content = soup.get_text(separator=" ", strip=True)[:5000]
    
    # Extract competitor profile signals
    profile = extract_competitor_signals(text_content, comp)
    if profile:
        await competitors_col.update_one(
            {"id": comp_id},
            {"$set": {"profile": profile, "profile_updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Find product links on the page
    product_links = find_product_links(soup, url)
    
    # Also try common product page patterns
    for path in ["/produkty", "/sklep", "/oferta", "/sauny", "/balie", "/sauna-beczka", "/sauna", "/balia"]:
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True, verify=False) as client:
                sub_resp = await client.get(url.rstrip("/") + path, headers=headers)
                if sub_resp.status_code == 200:
                    sub_soup = BeautifulSoup(sub_resp.text, "lxml")
                    product_links.extend(find_product_links(sub_soup, url))
        except Exception:
            pass
    
    # Deduplicate links
    seen = set()
    unique_links = []
    for link in product_links:
        if link not in seen:
            seen.add(link)
            unique_links.append(link)
    
    log_entry["products_found"] = len(unique_links)
    
    # Scrape individual product pages (limit to 30 per competitor)
    for purl in unique_links[:30]:
        try:
            product = await scrape_product_page(purl, comp, headers)
            if product:
                await save_product(product, comp_id)
                log_entry["products_updated"] = log_entry.get("products_updated", 0) + 1
        except Exception as e:
            log_entry["errors"].append(f"Product error {purl}: {str(e)[:100]}")
        await asyncio.sleep(1)  # Be polite


def find_product_links(soup: BeautifulSoup, base_url: str) -> list:
    """Find product-like links on a page."""
    links = []
    base = base_url.rstrip("/")
    
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        
        # Skip navigation, social, etc
        if any(x in href.lower() for x in ["facebook", "instagram", "twitter", "youtube", "#", "mailto:", "tel:", "javascript:"]):
            continue
        
        # Look for product-like URLs
        product_signals = ["sauna", "balia", "beczk", "produkt", "sklep", "oferta", "hot-tub", "jacuzzi", "spa"]
        if any(s in href.lower() for s in product_signals) or any(s in text for s in product_signals):
            if href.startswith("/"):
                href = base + href
            elif not href.startswith("http"):
                href = base + "/" + href
            if base in href:
                links.append(href)
    
    return links


async def scrape_product_page(url: str, comp: dict, headers: dict) -> Optional[dict]:
    """Scrape a single product page and extract data."""
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, verify=False) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return None
            html = resp.text
    except Exception:
        return None
    
    soup = BeautifulSoup(html, "lxml")
    
    # Extract basic data
    title = soup.find("h1")
    title_text = title.get_text(strip=True) if title else ""
    if not title_text:
        title = soup.find("title")
        title_text = title.get_text(strip=True) if title else ""
    
    if not title_text or len(title_text) < 3:
        return None
    
    # Skip non-product pages
    skip_words = ["kontakt", "o nas", "regulamin", "polityka", "blog", "galeria", "realizacje"]
    if any(w in title_text.lower() for w in skip_words):
        return None
    
    text = soup.get_text(separator=" ", strip=True)
    
    # Extract price
    price, old_price = extract_prices(soup, text)
    
    # Extract features
    features = extract_features(text)
    
    # Generate product ID
    slug = re.sub(r'[^a-z0-9]+', '-', title_text.lower().strip())[:60]
    product_id = f"{comp['id']}-{slug}"
    
    # Determine category
    category = guess_category(title_text + " " + text[:500])
    
    now = datetime.now(timezone.utc).isoformat()
    
    product = {
        "id": product_id,
        "competitor_id": comp["id"],
        "competitor_name": comp["brand_name"],
        "competitor_site": comp["primary_url"],
        "product_url": url,
        "source_url": url,
        "category": category,
        "product_name": title_text,
        "current_price": price,
        "old_price": old_price,
        "currency": "PLN",
        "price_note": "",
        "dimensions_raw": features.get("dimensions_raw", ""),
        "material": features.get("material", ""),
        "wood_type": features.get("wood_type", ""),
        "thermowood_flag": features.get("thermowood", False),
        "heater_type": features.get("heater_type", ""),
        "panoramic_glass_flag": features.get("panoramic", False),
        "insulation_flag": features.get("insulation", False),
        "terrace_flag": features.get("terrace", False),
        "led_flag": features.get("led", False),
        "diy_flag": features.get("diy", False),
        "key_features_raw": features.get("raw", ""),
        "warranty_info": features.get("warranty", ""),
        "delivery_info": features.get("delivery", ""),
        "data_quality_score": calculate_quality_score(title_text, price, features),
        "needs_review_flag": price == 0,
        "parse_status": "ok" if price > 0 else "partial",
        "first_seen_at": now,
        "last_seen_at": now,
        "updated_at": now,
        "manually_verified": False,
        "source_text_excerpt": text[:500],
    }
    return product


def extract_prices(soup: BeautifulSoup, text: str):
    """Extract current and old price from page."""
    price = 0.0
    old_price = 0.0
    
    # Try structured price elements
    for sel in [".price", ".product-price", "[class*=price]", "[class*=cena]", ".woocommerce-Price-amount"]:
        el = soup.select_one(sel)
        if el:
            p = parse_price(el.get_text())
            if p > 0:
                price = p
                break
    
    # Try del/ins pattern (old/new price)
    del_el = soup.find("del")
    ins_el = soup.find("ins")
    if del_el and ins_el:
        op = parse_price(del_el.get_text())
        np = parse_price(ins_el.get_text())
        if op > 0 and np > 0:
            old_price = op
            price = np
    
    # Fallback: regex in text
    if price == 0:
        patterns = [
            r'(\d[\d\s]*[\d])\s*(?:zł|PLN|pln)',
            r'(?:cena|price|od)\s*:?\s*(\d[\d\s]*[\d])\s*(?:zł|PLN)?',
        ]
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                price = parse_price(m.group(1))
                if price > 0:
                    break
    
    return price, old_price


def parse_price(text: str) -> float:
    """Parse price from text."""
    text = text.replace("\xa0", " ").replace(",", ".").strip()
    nums = re.findall(r'[\d\s]+\.?\d*', text)
    for n in nums:
        n = n.replace(" ", "")
        try:
            val = float(n)
            if 100 < val < 500000:
                return val
        except ValueError:
            pass
    return 0.0


def extract_features(text: str) -> dict:
    """Extract product features from text."""
    text_lower = text.lower()
    features = {"raw": ""}
    
    # Dimensions
    dim_match = re.search(r'(\d{2,4})\s*[xX×]\s*(\d{2,4})(?:\s*[xX×]\s*(\d{2,4}))?', text)
    if dim_match:
        features["dimensions_raw"] = dim_match.group(0)
    
    # Material / wood type
    for wood in ["thermodrewno", "thermo", "modrzew", "swierk", "swierka", "sosna", "cedr", "olcha"]:
        if wood in text_lower:
            features["wood_type"] = wood
            break
    features["thermowood"] = any(w in text_lower for w in ["thermodrewno", "thermo wood", "thermowood", "thermo-wood"])
    features["material"] = features.get("wood_type", "")
    
    # Heater
    if "elektryczn" in text_lower:
        features["heater_type"] = "electric"
    elif "drew" in text_lower and "opalan" in text_lower:
        features["heater_type"] = "wood"
    elif "piec" in text_lower:
        features["heater_type"] = "unknown"
    
    # Features
    features["panoramic"] = any(w in text_lower for w in ["panoram", "szklo panoram"])
    features["insulation"] = any(w in text_lower for w in ["izolac", "ocieplen", "ocieplon"])
    features["terrace"] = "taras" in text_lower
    features["led"] = "led" in text_lower
    features["diy"] = any(w in text_lower for w in ["diy", "do samodzielnego", "zrob to sam", "self assembly"])
    
    # Warranty
    war_match = re.search(r'gwarancj[aie]\s*:?\s*(\d+)\s*(lat|rok|miesi)', text_lower)
    if war_match:
        features["warranty"] = war_match.group(0)
    
    # Delivery
    if "dostaw" in text_lower:
        features["delivery"] = "available"
    
    return features


def guess_category(text: str) -> str:
    """Guess product category from text."""
    t = text.lower()
    if "balia" in t or "hot tub" in t or "balii" in t:
        return "balia_ogrodowa"
    if "beczk" in t:
        return "sauna_beczka"
    if "panoram" in t:
        return "sauna_panoramiczna"
    if "owaln" in t:
        return "sauna_owalna"
    if "loft" in t:
        return "sauna_loft"
    if "kwadrat" in t or "nowoczesn" in t:
        return "sauna_kwadratowa"
    if "2w1" in t or "2 w 1" in t:
        return "sauna_plus_balia_2w1"
    if "diy" in t:
        return "diy_sauna"
    if "sauna" in t:
        return "sauna_beczka"
    return "sauna_kwadratowa"


def calculate_quality_score(title: str, price: float, features: dict) -> int:
    """Calculate data quality score 0-100."""
    score = 0
    if title and len(title) > 5: score += 25
    if price > 0: score += 30
    if features.get("dimensions_raw"): score += 15
    if features.get("material") or features.get("wood_type"): score += 10
    if features.get("heater_type"): score += 10
    if features.get("warranty"): score += 5
    if features.get("delivery"): score += 5
    return min(score, 100)


def extract_competitor_signals(text: str, comp: dict) -> dict:
    """Extract competitor profile signals from homepage text."""
    t = text.lower()
    signals = {}
    
    # Experience
    exp_match = re.search(r'(\d+)\+?\s*lat\s*(?:doswiadcz|na rynku|tradycji)', t)
    if exp_match:
        signals["experience_years"] = int(exp_match.group(1))
    
    # Realizations count
    real_match = re.search(r'(\d+)\+?\s*(?:realizacj|instalacj|klient)', t)
    if real_match:
        signals["realizations_count"] = int(real_match.group(1))
    
    # Warranty
    war_match = re.search(r'(\d+)\s*lat\s*gwarancj', t)
    if war_match:
        signals["warranty_years"] = int(war_match.group(1))
    
    # Key signals
    signals["has_ar"] = "ar " in t or "augmented" in t or "rzeczywistosc rozszerzon" in t
    signals["has_diy"] = "diy" in t or "do samodzielnego" in t
    signals["has_2w1"] = "2w1" in t or "2 w 1" in t
    signals["has_service"] = "serwis" in t
    signals["has_thermowood"] = "thermodrewno" in t or "thermowood" in t
    signals["has_premium"] = "premium" in t
    signals["has_custom"] = any(w in t for w in ["na wymiar", "konfigurat", "personali"])
    signals["has_quick_quote"] = any(w in t for w in ["szybka wycena", "wycena online", "konfigurator"])
    signals["has_delivery_poland"] = "dostawa" in t and ("polska" in t or "cala polsk" in t)
    
    return signals


async def save_product(product: dict, comp_id: str):
    """Save or update product, track price history."""
    existing = await products_col.find_one({"id": product["id"]}, {"_id": 0})
    
    now = datetime.now(timezone.utc).isoformat()
    
    if existing:
        # Track price change
        if existing.get("current_price", 0) != product["current_price"] and product["current_price"] > 0:
            old_p = existing.get("current_price", 0)
            new_p = product["current_price"]
            
            await price_history_col.insert_one({
                "product_id": product["id"],
                "competitor_id": comp_id,
                "old_price": old_p,
                "new_price": new_p,
                "change_pct": round((new_p - old_p) / old_p * 100, 1) if old_p > 0 else 0,
                "checked_at": now,
            })
            
            # Create alert
            direction = "wzrosla" if new_p > old_p else "spadla"
            await alerts_col.insert_one({
                "id": f"alert-{product['id']}-{now}",
                "type": "price_change",
                "severity": "high" if abs(new_p - old_p) / max(old_p, 1) > 0.1 else "medium",
                "title": f"Cena {direction}: {product['product_name']}",
                "description": f"{product['competitor_name']}: {old_p} -> {new_p} PLN",
                "product_id": product["id"],
                "competitor_id": comp_id,
                "created_at": now,
                "read": False,
            })
        
        # Update existing
        product["first_seen_at"] = existing.get("first_seen_at", now)
        product["last_seen_at"] = now
        if existing.get("manually_verified"):
            product["manually_verified"] = True
            product["verified_at"] = existing.get("verified_at")
        await products_col.replace_one({"id": product["id"]}, product)
    else:
        # New product
        product["first_seen_at"] = now
        product["last_seen_at"] = now
        await products_col.insert_one(product)
        
        # Alert for new product
        await alerts_col.insert_one({
            "id": f"alert-new-{product['id']}",
            "type": "new_product",
            "severity": "medium",
            "title": f"Nowy produkt: {product['product_name']}",
            "description": f"{product['competitor_name']} - {product.get('current_price', 0)} PLN",
            "product_id": product["id"],
            "competitor_id": comp_id,
            "created_at": now,
            "read": False,
        })
