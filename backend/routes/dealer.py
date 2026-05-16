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
    """Dealer creates / saves a sauna order. Defaults to status='draft'.

    Drafts are saved in `sauna_orders` for the dealer's own use (KP generation,
    re-editing) but are filtered OUT of the main company's admin Dealer Orders
    tab. Only orders with status='confirmed' are visible to the main company.

    No amoCRM push is performed — dealers manage their own leads/CRM.
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
    # Status: only "draft" or "confirmed" allowed; default to "draft"
    status = (order_data.get("status") or "draft").lower()
    if status not in ("draft", "confirmed"):
        status = "draft"
    order_data["status"] = status
    if status == "confirmed":
        order_data["confirmedAt"] = order_data.get("confirmedAt") or datetime.now(timezone.utc).isoformat()
    order_data.pop("_id", None)
    order_data.pop("totalCost", None)
    order_data.pop("margin", None)
    await db.sauna_orders.insert_one(order_data)
    order_data.pop("_id", None)

    return {"ok": True, "order": order_data}


@router.put("/api/dealer/sauna/orders/{order_id}")
async def dealer_update_order(order_id: str, order: dict, dealer: dict = Depends(get_current_dealer)):
    """Update a draft order (re-edit before confirming). Confirmed orders are immutable."""
    existing = await db.sauna_orders.find_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    if (existing.get("status") or "draft") == "confirmed":
        raise HTTPException(status_code=409, detail="Confirmed orders cannot be edited")

    update = dict(order)
    # Strip immutable / sensitive fields
    for k in ("id", "dealerId", "dealerName", "dealerUsername", "createdBy",
              "createdAt", "source", "status", "confirmedAt", "_id",
              "totalCost", "margin", "dealerContractNumber"):
        update.pop(k, None)
    update["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db.sauna_orders.update_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"$set": update},
    )
    fresh = await db.sauna_orders.find_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"_id": 0, "totalCost": 0, "margin": 0},
    )
    return {"ok": True, "order": fresh}


@router.post("/api/dealer/sauna/orders/{order_id}/confirm")
async def dealer_confirm_order(order_id: str, payload: dict, dealer: dict = Depends(get_current_dealer)):
    """Promote a draft order to status='confirmed'.

    Required payload: {clientConfirmed: bool, dealerContractNumber: str}.
    Once confirmed, the order becomes visible in the company's admin Dealer
    Orders tab and cannot be edited by the dealer anymore.
    """
    if not payload.get("clientConfirmed"):
        raise HTTPException(status_code=400, detail="clientConfirmed must be true")
    contract_number = (payload.get("dealerContractNumber") or "").strip()
    if not contract_number:
        raise HTTPException(status_code=400, detail="dealerContractNumber is required")

    existing = await db.sauna_orders.find_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"_id": 0, "status": 1},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    if (existing.get("status") or "draft") == "confirmed":
        raise HTTPException(status_code=409, detail="Order already confirmed")

    update = {
        "status": "confirmed",
        "clientConfirmed": True,
        "dealerContractNumber": contract_number,
        "confirmedAt": datetime.now(timezone.utc).isoformat(),
    }
    if payload.get("deliveryDate"):
        update["deliveryDate"] = payload["deliveryDate"]
    if payload.get("notes"):
        update["confirmationNotes"] = payload["notes"]

    await db.sauna_orders.update_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"$set": update},
    )
    fresh = await db.sauna_orders.find_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"_id": 0, "totalCost": 0, "margin": 0},
    )

    # Notify the company's Telegram channel about the new confirmed dealer order
    try:
        from services.telegram_service import notify_new_order
        notify_payload = dict(fresh or {})
        # Map dealer fields to fields the notifier expects
        notify_payload.setdefault("fullName", notify_payload.get("customerName") or notify_payload.get("clientName") or "—")
        notify_payload.setdefault("phoneNumber", notify_payload.get("customerPhone") or notify_payload.get("phone") or "")
        notify_payload["dealerOrder"] = True
        notify_payload["dealerName"] = dealer.get("name") or dealer["username"]
        notify_payload["dealerContractNumber"] = update.get("dealerContractNumber", "")
        # Try to attach a short offer PDF too (best-effort)
        pdf_bytes = None
        try:
            from services.dealer_pdf import generate_dealer_offer_pdf
            pdf_bytes = generate_dealer_offer_pdf(notify_payload, dealer)
        except Exception as pdf_err:
            logger.warning(f"Dealer-confirm PDF generation skipped: {pdf_err}")
        await notify_new_order(notify_payload, order_type="sauna", is_web_order=False, pdf_data=pdf_bytes)
    except Exception as e:
        logger.warning(f"Telegram notify on dealer-confirm failed for {order_id}: {e}")

    return {"ok": True, "order": fresh}


@router.delete("/api/dealer/sauna/orders/{order_id}")
async def dealer_delete_order(order_id: str, dealer: dict = Depends(get_current_dealer)):
    """Delete a draft. Confirmed orders cannot be deleted."""
    existing = await db.sauna_orders.find_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"_id": 0, "status": 1},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    if (existing.get("status") or "draft") == "confirmed":
        raise HTTPException(status_code=409, detail="Confirmed orders cannot be deleted")
    await db.sauna_orders.delete_one({"id": order_id, "dealerId": dealer["id"]})
    return {"ok": True}


@router.get("/api/dealer/sauna/orders")
async def dealer_list_orders(
    status: str | None = None,
    dealer: dict = Depends(get_current_dealer),
):
    """List dealer's own orders. Optional `?status=draft|confirmed` filter."""
    query = {"dealerId": dealer["id"]}
    if status in ("draft", "confirmed"):
        # Treat missing status field as "draft" for legacy orders
        if status == "draft":
            query["$or"] = [{"status": "draft"}, {"status": {"$exists": False}}]
        else:
            query["status"] = "confirmed"
    orders = await db.sauna_orders.find(
        query,
        {"_id": 0, "totalCost": 0, "margin": 0},
    ).sort("createdAt", -1).to_list(length=500)
    return {"orders": orders}


@router.get("/api/dealer/sauna/orders/{order_id}")
async def dealer_get_order(order_id: str, dealer: dict = Depends(get_current_dealer)):
    """Fetch a single dealer order by id (e.g. to re-load a draft for editing)."""
    order = await db.sauna_orders.find_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"_id": 0, "totalCost": 0, "margin": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/api/dealer/sauna/orders/{order_id}/pdf")
async def dealer_order_pdf(
    order_id: str,
    type: str = "offer",
    dealer: dict = Depends(get_current_dealer),
):
    """Generate a PDF for the dealer's order.

    `type=offer` (default) — short 1-page commercial offer with dealer branding.
    `type=full`            — full multi-page sauna PDF (same template as managers use).
    """
    pdf_type = (type or "offer").lower()
    order = await db.sauna_orders.find_one(
        {"id": order_id, "dealerId": dealer["id"]},
        {"_id": 0, "totalCost": 0, "margin": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if pdf_type == "full":
        # Try to render the standard manager-style multi-page sauna PDF.
        try:
            from models.sauna import SaunaPDFRequest
            from routes.sauna import generate_sauna_pdf_bytes
            req = _dealer_order_to_pdf_request(order)
            pdf_bytes = await generate_sauna_pdf_bytes(SaunaPDFRequest(**req))
        except Exception as e:
            import traceback as _tb
            logger.warning(
                "Full sauna PDF failed for dealer order %s: %s: %s\n%s",
                order_id, e.__class__.__name__, e, _tb.format_exc()[-800:]
            )
            from services.dealer_pdf import generate_dealer_offer_pdf
            pdf_bytes = generate_dealer_offer_pdf(order, dealer)
    else:
        from services.dealer_pdf import generate_dealer_offer_pdf
        pdf_bytes = generate_dealer_offer_pdf(order, dealer)

    safe_id = "".join(c for c in order_id if c.isalnum() or c in "-_") or "offer"
    fname_prefix = "oferta-pelna" if pdf_type == "full" else "oferta"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname_prefix}-{safe_id}.pdf"'},
    )


def _dealer_order_to_pdf_request(order: dict) -> dict:
    """Map a dealer order document into the SaunaPDFRequest shape.

    Modern dealer orders (saved via the embedded SaunaCalculator) already
    contain `selections{}` / `quantities{}` / `selectedOptions[]` in the same
    shape as a regular manager order, so we pass those through as-is.
    Legacy/simple dealer orders have an `options[]` list instead — we rebuild
    selections/quantities from that as a fallback.
    """
    selections = dict(order.get("selections") or {})
    quantities = dict(order.get("quantities") or {})
    selected_options = list(order.get("selectedOptions") or [])

    # Legacy fallback — rebuild from a flat options[] list
    if not selected_options and (order.get("options") or []):
        for o in order["options"]:
            oid = o.get("optionId")
            if not oid:
                continue
            qty = int(o.get("quantity") or 1)
            if o.get("variantId") or o.get("optionVariantId"):
                selections[oid] = o.get("variantId") or o.get("optionVariantId")
            else:
                selections[oid] = True
            quantities[oid] = qty
            selected_options.append({
                "id": oid,
                "name": o.get("optionName") or "",
                "categoryName": o.get("categoryName") or "",
                "price": int(o.get("price") or 0),
                "quantity": qty,
                "totalPrice": int(o.get("totalPrice") or 0),
            })

    return {
        "orderId": order.get("id", ""),
        "fullName": order.get("fullName") or order.get("customerName") or order.get("clientName") or "—",
        "phoneNumber": order.get("phoneNumber") or order.get("customerPhone") or order.get("phone") or "",
        "fullAddress": order.get("fullAddress") or order.get("address") or "",
        "email": order.get("email") or order.get("customerEmail") or "",
        "orderDate": order.get("orderDate") or order.get("createdAt") or "",
        "selectedModel": order.get("selectedModel") or order.get("modelId") or "",
        "selectedModelVariant": order.get("selectedModelVariant") or order.get("variantId"),
        "modelVariantName": order.get("modelVariantName") or order.get("variantName"),
        "modelName": order.get("modelName") or "",
        "modelImageUrl": order.get("modelImageUrl") or "",
        "basePrice": int(order.get("basePrice") or order.get("modelBasePrice") or 0),
        "selections": selections,
        "quantities": quantities,
        "variantSelections": order.get("variantSelections") or {},
        "subSelections": order.get("subSelections") or {},
        "selectedOptions": selected_options,
        "notes": order.get("notes") or "",
        "optionsTotal": int(order.get("optionsTotal") or 0),
        "subtotal": float(order.get("subtotal") or order.get("total") or 0),
        "total": float(order.get("total") or 0),
        "discountPercent": int(order.get("discountPercent") or 0),
        "foundationPrice": int(order.get("foundationPrice") or 0),
        "selectedLayoutId": order.get("selectedLayoutId"),
        "selectedLayoutSize": order.get("selectedLayoutSize"),
        "layoutImageUrl": order.get("layoutImageUrl"),
        "capacity": order.get("capacity"),
        "language": "pl",
    }


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


@router.post("/api/admin/dealers/{dealer_id}/overrides/upsert")
async def admin_upsert_dealer_overrides(
    dealer_id: str,
    body: dict,
    _: dict = Depends(get_admin_user),
):
    """Add or update specific dealer overrides without wiping the rest.

    Matches existing overrides on (dealerId, kind, modelId, variantId, optionId, optionVariantId)
    and replaces the price; inserts new ones if not found.
    """
    if not await db.dealers.find_one({"id": dealer_id}):
        raise HTTPException(404, "Dealer not found")
    raw_list = (body or {}).get("overrides") or []
    if not isinstance(raw_list, list) or not raw_list:
        return {"ok": True, "upserted": 0, "modified": 0, "inserted": 0}

    now = datetime.now(timezone.utc).isoformat()
    modified = 0
    inserted = 0
    for raw in raw_list:
        if not isinstance(raw, dict):
            continue
        kind = (raw.get("kind") or "").strip()
        if kind not in ("model", "model_variant", "option", "option_variant"):
            raise HTTPException(400, f"Invalid kind: {kind!r}")
        try:
            price = int(raw.get("price") or 0)
        except (TypeError, ValueError):
            raise HTTPException(400, "price must be an integer")
        doc = {
            "dealerId": dealer_id,
            "kind": kind,
            "modelId": raw.get("modelId") or None,
            "variantId": raw.get("variantId") or None,
            "optionId": raw.get("optionId") or None,
            "optionVariantId": raw.get("optionVariantId") or None,
            "price": price,
            "updatedAt": now,
        }
        key = {
            "dealerId": dealer_id,
            "kind": doc["kind"],
            "modelId": doc["modelId"],
            "variantId": doc["variantId"],
            "optionId": doc["optionId"],
            "optionVariantId": doc["optionVariantId"],
        }
        res = await db.dealer_price_overrides.update_one(
            key, {"$set": doc}, upsert=True,
        )
        if res.upserted_id is not None:
            inserted += 1
        elif res.modified_count > 0:
            modified += 1
    return {"ok": True, "upserted": inserted + modified, "modified": modified, "inserted": inserted}


@router.get("/api/admin/dealer-orders/{order_id}/pdf")
async def admin_dealer_order_pdf(
    order_id: str,
    type: str = "offer",
    _: dict = Depends(get_admin_user),
):
    """Admin downloads a dealer order PDF — the same way the dealer himself can.

    `type=offer` → short branded "Oferta handlowa" with the dealer's contacts.
    `type=full`  → multi-page sauna PDF (manager template).
    """
    pdf_type = (type or "offer").lower()
    order = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    dealer = None
    if order.get("dealerId"):
        dealer = await db.dealers.find_one({"id": order["dealerId"]}, {"_id": 0, "password": 0})
    dealer = dealer or {
        "name": order.get("dealerName") or "WM Saunas",
        "username": order.get("dealerUsername") or "",
        "email": "",
        "phone": "",
    }

    if pdf_type == "full":
        try:
            from models.sauna import SaunaPDFRequest
            from routes.sauna import generate_sauna_pdf_bytes
            req = _dealer_order_to_pdf_request(order)
            pdf_bytes = await generate_sauna_pdf_bytes(SaunaPDFRequest(**req))
        except Exception as e:
            import traceback as _tb
            logger.warning(
                "Admin full PDF failed for dealer order %s: %s: %s\n%s",
                order_id, e.__class__.__name__, e, _tb.format_exc()[-800:],
            )
            from services.dealer_pdf import generate_dealer_offer_pdf
            pdf_bytes = generate_dealer_offer_pdf(order, dealer)
    else:
        from services.dealer_pdf import generate_dealer_offer_pdf
        pdf_bytes = generate_dealer_offer_pdf(order, dealer)

    safe_id = "".join(c for c in order_id if c.isalnum() or c in "-_") or "offer"
    fname_prefix = "oferta-pelna" if pdf_type == "full" else "oferta"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname_prefix}-{safe_id}.pdf"'},
    )


@router.get("/api/admin/dealer-orders")
async def admin_list_dealer_orders(
    status: str = "confirmed",
    _: dict = Depends(get_admin_user),
):
    """List dealer orders. By default only `status=confirmed` (visible to the
    company). Pass `?status=draft` or `?status=all` to override.
    """
    query: dict = {"dealerId": {"$exists": True, "$ne": None}}
    s = (status or "confirmed").lower()
    if s == "draft":
        query["$or"] = [{"status": "draft"}, {"status": {"$exists": False}}]
    elif s == "confirmed":
        query["status"] = "confirmed"
    # 'all' → no extra filter

    orders = await db.sauna_orders.find(
        query,
        {"_id": 0},
    ).sort("createdAt", -1).to_list(length=2000)
    return {"orders": orders}



# ==========================================================================
# PUBLIC OFFER LINK (no auth — clients of dealers view their KP)
# ==========================================================================

@router.get("/api/public/dealer-offer/{order_id}")
async def public_get_dealer_offer(order_id: str):
    """Public, no-auth view of a dealer's commercial offer.

    Returns a sanitized payload (no internal IDs / costPrice / margin / dealer
    contact info) so the dealer can share `https://<host>/oferta/{order_id}`
    with their customer over messengers.

    Side effect: increments `clientWebViews` and stamps `firstClientView` /
    `lastClientView` on first viewing — gives the dealer (and us) a signal
    that the customer actually opened the link.
    """
    order = await db.sauna_orders.find_one(
        {"id": order_id},
        {"_id": 0, "totalCost": 0, "margin": 0, "createdBy": 0,
         "dealerUsername": 0, "dealerId": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Offer not found")

    # Track view
    now_iso = datetime.now(timezone.utc).isoformat()
    inc_update = {
        "$inc": {"clientWebViews": 1},
        "$set": {"lastClientView": now_iso},
    }
    if not order.get("firstClientView"):
        inc_update["$set"]["firstClientView"] = now_iso
    try:
        await db.sauna_orders.update_one({"id": order_id}, inc_update)
    except Exception as e:
        logger.warning(f"public offer view tracking failed: {e}")

    # Look up the dealer for branding (name only, no phone/email)
    dealer_brand = {}
    if order.get("dealerName"):
        dealer_brand["name"] = order["dealerName"]

    return {
        "id": order.get("id"),
        "dealer": dealer_brand,
        "customerName": order.get("customerName") or order.get("clientName") or "",
        "modelName": order.get("modelName") or "",
        "modelBasePrice": order.get("modelBasePrice"),
        "variantName": order.get("variantName"),
        "variantPrice": order.get("variantPrice"),
        "options": order.get("options") or [],
        "optionsTotal": order.get("optionsTotal"),
        "subtotal": order.get("subtotal"),
        "total": order.get("total"),
        "notes": order.get("notes") or "",
        "createdAt": order.get("createdAt"),
        "status": order.get("status") or "draft",
        "clientConfirmedByLink": bool(order.get("clientConfirmedByLink")),
        "clientWebConfirmedAt": order.get("clientWebConfirmedAt"),
    }


@router.post("/api/public/dealer-offer/{order_id}/confirm")
async def public_client_confirm_offer(order_id: str, payload: dict | None = None):
    """The customer (no auth) clicks "Potwierdzam zamówienie" on the public KP.

    Marks the order with `clientConfirmedByLink=True` + timestamp + optional
    customer note. Notifies the company's Telegram channel so the dealer
    sees that their customer has agreed before they manually flip the
    internal status. The dealer must still hit "Potwierdź i wyślij" inside
    their panel to officially submit to the main CRM.
    """
    payload = payload or {}
    order = await db.sauna_orders.find_one(
        {"id": order_id},
        {"_id": 0, "totalCost": 0, "margin": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Offer not found")

    if order.get("clientConfirmedByLink"):
        return {"ok": True, "alreadyConfirmed": True}

    update = {
        "clientConfirmedByLink": True,
        "clientWebConfirmedAt": datetime.now(timezone.utc).isoformat(),
    }
    note = (payload.get("note") or "").strip()
    if note:
        update["clientWebNote"] = note[:1000]

    await db.sauna_orders.update_one({"id": order_id}, {"$set": update})

    # Best-effort Telegram heads-up to the dealer's company channel
    try:
        from services.telegram_service import send_telegram_message
        msg = (
            "🟢 <b>Klient potwierdził ofertę przez link</b>\n"
            f"🔢 <b>Nr:</b> {order_id}\n"
            f"👤 <b>Klient:</b> {order.get('customerName') or '—'}\n"
            f"🏢 <b>Dealer:</b> {order.get('dealerName') or '—'}\n"
            f"💰 <b>Suma:</b> {int(order.get('total') or 0):,} PLN".replace(",", " ")
        )
        if note:
            msg += f"\n💬 <b>Komentarz klienta:</b> {note[:300]}"
        await send_telegram_message(msg)
    except Exception as e:
        logger.warning(f"Telegram on public client-confirm failed: {e}")

    return {"ok": True}
