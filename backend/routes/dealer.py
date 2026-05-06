"""Dealer portal API routes (public + dealer-authenticated).

All dealer-facing endpoints live under /api/dealer/*.
Admin-facing dealer management endpoints live under /api/admin/dealers/*.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import logging

from models.dealer import (
    Dealer, DealerCreate, DealerUpdate, DealerLogin,
    DealerPriceOverride, DealerPriceOverridesBulk,
)
from services.auth_service import (
    hash_password, verify_password, get_admin_user,
)
from services.dealer_auth import create_dealer_token, get_current_dealer
from database import db

router = APIRouter()
logger = logging.getLogger(__name__)


# ==========================================================================
# DEALER AUTH (public)
# ==========================================================================

@router.post("/api/dealer/auth/login")
async def dealer_login(body: DealerLogin):
    dealer = await db.dealers.find_one({"username": body.username.lower().strip()})
    if not dealer or not verify_password(body.password, dealer.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not dealer.get("isActive", True):
        raise HTTPException(status_code=403, detail="Account deactivated")
    token = create_dealer_token(dealer)
    safe = {k: v for k, v in dealer.items() if k not in ("_id", "password")}
    return {"token": token, "dealer": safe}


@router.get("/api/dealer/auth/me")
async def dealer_me(dealer: dict = Depends(get_current_dealer)):
    return dealer


# ==========================================================================
# DEALER — SAUNA PRICES (with overrides applied)
# ==========================================================================

async def _apply_overrides(prices_doc: dict, dealer_id: str) -> dict:
    """Mutate the prices doc in place: replace every price with dealer's override if any."""
    if not prices_doc:
        return prices_doc
    overrides = await db.dealer_price_overrides.find(
        {"dealerId": dealer_id}, {"_id": 0}
    ).to_list(length=5000)
    if not overrides:
        return prices_doc

    # Build lookup tables for O(1) access
    by_model = {}         # modelId -> price
    by_model_variant = {} # (modelId, variantId) -> price
    by_option = {}        # optionId -> price
    by_opt_variant = {}   # (optionId, optionVariantId) -> price
    for o in overrides:
        kind = o.get("kind")
        price = int(o.get("price") or 0)
        if kind == "model" and o.get("modelId"):
            by_model[o["modelId"]] = price
        elif kind == "model_variant" and o.get("modelId") and o.get("variantId"):
            by_model_variant[(o["modelId"], o["variantId"])] = price
        elif kind == "option" and o.get("optionId"):
            by_option[o["optionId"]] = price
        elif kind == "option_variant" and o.get("optionId") and o.get("optionVariantId"):
            by_opt_variant[(o["optionId"], o["optionVariantId"])] = price

    # Apply to models
    for m in prices_doc.get("models", []) or []:
        mid = m.get("id")
        if mid in by_model:
            m["basePrice"] = by_model[mid]
        for v in m.get("variants", []) or []:
            key = (mid, v.get("id"))
            if key in by_model_variant:
                v["price"] = by_model_variant[key]

    # Apply to options (flat and inside categories)
    def _fix_options_list(opts: list):
        for opt in opts or []:
            oid = opt.get("id")
            if oid in by_option:
                opt["price"] = by_option[oid]
            for v in opt.get("variants", []) or []:
                key = (oid, v.get("id"))
                if key in by_opt_variant:
                    v["price"] = by_opt_variant[key]

    _fix_options_list(prices_doc.get("options", []))
    for cat in prices_doc.get("categories", []) or []:
        _fix_options_list(cat.get("options", []))
    return prices_doc


@router.get("/api/dealer/sauna/prices")
async def dealer_get_prices(dealer: dict = Depends(get_current_dealer)):
    """Return sauna prices with this dealer's overrides applied. Removes costPrice fields
    (dealers must NOT see internal cost)."""
    # Read from the same collection the admin uses (`sauna_prices`, _id="default").
    doc = await db.sauna_prices.find_one({"_id": "default"})
    if doc:
        doc.pop("_id", None)
    if not doc:
        doc = {"models": [], "categories": [], "options": []}
    await _apply_overrides(doc, dealer["id"])

    # Strip admin-only cost fields before returning to dealer
    def _strip_cost(obj):
        if isinstance(obj, dict):
            obj.pop("costPrice", None)
            for v in obj.values():
                _strip_cost(v)
        elif isinstance(obj, list):
            for item in obj:
                _strip_cost(item)
    _strip_cost(doc)
    return doc


@router.get("/api/dealer/sauna/overrides")
async def dealer_get_overrides(dealer: dict = Depends(get_current_dealer)):
    overrides = await db.dealer_price_overrides.find(
        {"dealerId": dealer["id"]}, {"_id": 0}
    ).to_list(length=5000)
    return {"overrides": overrides}


@router.put("/api/dealer/sauna/overrides")
async def dealer_put_overrides(
    body: DealerPriceOverridesBulk,
    dealer: dict = Depends(get_current_dealer),
):
    """Replace all of this dealer's overrides with the given list."""
    await db.dealer_price_overrides.delete_many({"dealerId": dealer["id"]})
    if body.overrides:
        docs = []
        for o in body.overrides:
            doc = o.model_dump()
            doc["dealerId"] = dealer["id"]
            doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
            docs.append(doc)
        if docs:
            await db.dealer_price_overrides.insert_many(docs)
    return {"ok": True, "count": len(body.overrides or [])}


# ==========================================================================
# DEALER — ORDERS
# ==========================================================================

@router.post("/api/dealer/sauna/orders")
async def dealer_create_order(order: dict, dealer: dict = Depends(get_current_dealer)):
    """Dealer creates a sauna order. Stored in `sauna_orders` with dealer tag.

    No amoCRM push is performed — dealers manage their own leads/CRM. The main company
    sees these orders only in the internal Dealer Orders tab of the admin hub.
    """
    import uuid
    order_data = dict(order)
    # Use dealer's custom order prefix if set, otherwise fall back to legacy "WMS-D"
    prefix = (dealer.get("orderPrefix") or "").strip().upper() or "WMS-D"
    order_data["id"] = order_data.get("id") or f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
    order_data["dealerId"] = dealer["id"]
    order_data["dealerName"] = dealer.get("name") or dealer["username"]
    order_data["dealerUsername"] = dealer["username"]
    order_data["createdBy"] = f"dealer:{dealer['username']}"
    order_data["createdAt"] = order_data.get("createdAt") or datetime.now(timezone.utc).isoformat()
    order_data["source"] = "dealer"
    order_data.pop("_id", None)
    order_data.pop("totalCost", None)
    order_data.pop("margin", None)
    await db.sauna_orders.insert_one(order_data)
    order_data.pop("_id", None)

    return {"ok": True, "order": order_data}


@router.get("/api/dealer/sauna/orders")
async def dealer_list_orders(dealer: dict = Depends(get_current_dealer)):
    orders = await db.sauna_orders.find(
        {"dealerId": dealer["id"]},
        {"_id": 0, "totalCost": 0, "margin": 0},
    ).sort("createdAt", -1).to_list(length=500)
    return {"orders": orders}


@router.get("/api/dealer/sauna/orders/{order_id}/pdf")
async def dealer_order_pdf(order_id: str, dealer: dict = Depends(get_current_dealer)):
    """Generate and return a commercial-offer PDF for the dealer's own order."""
    order = await db.sauna_orders.find_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"_id": 0, "totalCost": 0, "margin": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    from services.dealer_pdf import generate_dealer_offer_pdf
    pdf_bytes = generate_dealer_offer_pdf(order, dealer)
    safe_id = "".join(c for c in order_id if c.isalnum() or c in "-_") or "offer"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="oferta-{safe_id}.pdf"'},
    )


@router.get("/api/dealer/stats")
async def dealer_stats(dealer: dict = Depends(get_current_dealer)):
    """Simple stats: total orders, total value, last 12 weeks distribution."""
    orders = await db.sauna_orders.find(
        {"dealerId": dealer["id"]},
        {"_id": 0, "total": 1, "createdAt": 1},
    ).to_list(length=5000)
    total_count = len(orders)
    total_value = sum(int(o.get("total") or 0) for o in orders)

    # Last 12 weeks by week
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(weeks=11)
    buckets = defaultdict(lambda: {"count": 0, "value": 0})
    for o in orders:
        raw = o.get("createdAt")
        if not raw:
            continue
        try:
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except Exception:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt < start:
            continue
        iso = dt.isocalendar()
        key = f"{iso[0]}-W{iso[1]:02d}"
        buckets[key]["count"] += 1
        buckets[key]["value"] += int(o.get("total") or 0)

    weeks = []
    cur = start
    for _ in range(12):
        iso = cur.isocalendar()
        key = f"{iso[0]}-W{iso[1]:02d}"
        weeks.append({"week": key, **buckets.get(key, {"count": 0, "value": 0})})
        cur = cur + timedelta(weeks=1)

    return {
        "totalOrders": total_count,
        "totalValue": total_value,
        "avgOrderValue": int(total_value / total_count) if total_count else 0,
        "weekly": weeks,
    }


# ==========================================================================
# ADMIN — DEALER MANAGEMENT
# ==========================================================================

@router.get("/api/admin/dealers")
async def admin_list_dealers(_: dict = Depends(get_admin_user)):
    dealers = await db.dealers.find({}, {"_id": 0, "password": 0}).sort("createdAt", -1).to_list(length=500)
    # enrich with order count
    for d in dealers:
        d["orderCount"] = await db.sauna_orders.count_documents({"dealerId": d["id"]})
    return {"dealers": dealers}


@router.post("/api/admin/dealers")
async def admin_create_dealer(body: DealerCreate, _: dict = Depends(get_admin_user)):
    uname = body.username.strip().lower()
    if not uname or not body.password:
        raise HTTPException(400, "username and password required")
    if await db.dealers.find_one({"username": uname}):
        raise HTTPException(409, "Username already taken")
    dealer = Dealer(
        username=uname,
        password=hash_password(body.password),
        name=body.name or "",
        email=(body.email or "").strip(),
        phone=(body.phone or "").strip(),
        notes=body.notes or "",
        orderPrefix=(body.orderPrefix or "").strip().upper(),
    )
    doc = dealer.model_dump()
    await db.dealers.insert_one(doc)
    doc.pop("password", None)
    doc.pop("_id", None)
    return doc


@router.put("/api/admin/dealers/{dealer_id}")
async def admin_update_dealer(dealer_id: str, body: DealerUpdate, _: dict = Depends(get_admin_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "password" in update and update["password"]:
        update["password"] = hash_password(update["password"])
    elif "password" in update:
        update.pop("password")
    update["updatedAt"] = datetime.now(timezone.utc).isoformat()
    res = await db.dealers.update_one({"id": dealer_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Dealer not found")
    d = await db.dealers.find_one({"id": dealer_id}, {"_id": 0, "password": 0})
    return d


@router.delete("/api/admin/dealers/{dealer_id}")
async def admin_delete_dealer(dealer_id: str, _: dict = Depends(get_admin_user)):
    """Soft delete = deactivate (keeps historical orders)."""
    res = await db.dealers.update_one(
        {"id": dealer_id},
        {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Dealer not found")
    return {"ok": True}


@router.get("/api/admin/dealers/{dealer_id}/overrides")
async def admin_get_dealer_overrides(dealer_id: str, _: dict = Depends(get_admin_user)):
    overrides = await db.dealer_price_overrides.find(
        {"dealerId": dealer_id}, {"_id": 0}
    ).to_list(length=5000)
    return {"overrides": overrides}


@router.put("/api/admin/dealers/{dealer_id}/overrides")
async def admin_put_dealer_overrides(
    dealer_id: str,
    body: DealerPriceOverridesBulk,
    _: dict = Depends(get_admin_user),
):
    if not await db.dealers.find_one({"id": dealer_id}):
        raise HTTPException(404, "Dealer not found")
    await db.dealer_price_overrides.delete_many({"dealerId": dealer_id})
    if body.overrides:
        docs = []
        for o in body.overrides:
            doc = o.model_dump()
            doc["dealerId"] = dealer_id
            doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
            docs.append(doc)
        if docs:
            await db.dealer_price_overrides.insert_many(docs)
    return {"ok": True, "count": len(body.overrides or [])}


@router.get("/api/admin/dealer-orders")
async def admin_list_dealer_orders(_: dict = Depends(get_admin_user)):
    """All orders created by any dealer (for the Dealer Orders tab in CRM)."""
    orders = await db.sauna_orders.find(
        {"dealerId": {"$exists": True, "$ne": None}},
        {"_id": 0},
    ).sort("createdAt", -1).to_list(length=2000)
    return {"orders": orders}
