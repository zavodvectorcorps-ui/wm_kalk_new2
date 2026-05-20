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

    # First-login onboarding: if a default markup is configured and we haven't
    # onboarded yet, apply it once and stamp `onboardedAt`. Best-effort — any
    # failure is logged but never blocks the login.
    onboarding_applied = None
    pct = dealer.get("defaultMarkupPercent")
    if pct is not None and not dealer.get("onboardedAt"):
        try:
            base = (dealer.get("defaultMarkupBase") or "wm").lower()
            scope = (dealer.get("defaultMarkupScope") or "all").lower()
            if base not in ("b2b", "wm"):
                base = "wm"
            if scope not in ("all", "models", "options"):
                scope = "all"
            res = await dealer_bulk_markup(
                {"percent": float(pct), "base": base, "scope": scope, "overwrite": False},
                dealer,
            )
            now_iso = datetime.now(timezone.utc).isoformat()
            await db.dealers.update_one(
                {"id": dealer["id"]},
                {"$set": {"onboardedAt": now_iso}},
            )
            dealer["onboardedAt"] = now_iso
            onboarding_applied = {
                "percent": float(pct),
                "base": base,
                "scope": scope,
                "touched": res.get("touched", 0),
            }
            logger.info(f"Dealer {dealer['username']} onboarded with {pct}% markup, touched={res.get('touched', 0)}")
        except Exception as e:
            logger.warning(f"Dealer onboarding markup failed for {dealer['username']}: {e}")

    token = create_dealer_token(dealer)
    safe = {k: v for k, v in dealer.items() if k not in ("_id", "password")}
    return {"token": token, "dealer": safe, "onboardingApplied": onboarding_applied}


@router.get("/api/dealer/auth/me")
async def dealer_me(dealer: dict = Depends(get_current_dealer)):
    return dealer


# ==========================================================================
# DEALER — SAUNA PRICES (with overrides applied)
# ==========================================================================

async def _apply_overrides(prices_doc: dict, dealer_id: str) -> dict:
    """Mutate the prices doc in place.

    For every catalog price we:
      * Replace the **displayed** price with the dealer's *retail* override
        (``dealerRetailPrice``) if set — falling back to the original WM Brutto.
      * Attach a parallel ``b2bPrice`` field equal to the dealer's *B2B*
        override (``price``) if set, else the same WM Brutto.

    Net effect: the SaunaCalculator (which only reads ``basePrice``/``price``)
    keeps rendering the dealer's retail like a normal manager catalog, while
    the dealer panel can also read ``b2bPrice`` from the same response to
    compute live margins.
    """
    if not prices_doc:
        return prices_doc

    # 1. Build override lookups
    overrides = await db.dealer_price_overrides.find(
        {"dealerId": dealer_id}, {"_id": 0}
    ).to_list(length=5000)
    by_model = {}              # modelId -> {retail?, b2b?}
    by_model_variant = {}      # (modelId, variantId) -> {retail?, b2b?}
    by_option = {}             # optionId -> {retail?, b2b?}
    by_opt_variant = {}        # (optionId, optionVariantId) -> {retail?, b2b?}

    def _pack(o):
        return {
            "retail": (int(o["dealerRetailPrice"]) if o.get("dealerRetailPrice") is not None else None),
            "b2b": (int(o["price"]) if o.get("price") is not None else None),
        }

    for o in overrides:
        kind = o.get("kind")
        if kind == "model" and o.get("modelId"):
            by_model[o["modelId"]] = _pack(o)
        elif kind == "model_variant" and o.get("modelId") and o.get("variantId"):
            by_model_variant[(o["modelId"], o["variantId"])] = _pack(o)
        elif kind == "option" and o.get("optionId"):
            by_option[o["optionId"]] = _pack(o)
        elif kind == "option_variant" and o.get("optionId") and o.get("optionVariantId"):
            by_opt_variant[(o["optionId"], o["optionVariantId"])] = _pack(o)

    # 2. Apply to models + variants
    for m in prices_doc.get("models", []) or []:
        mid = m.get("id")
        base = int(m.get("basePrice") or 0)
        ov = by_model.get(mid) or {}
        if ov.get("retail") is not None:
            m["basePrice"] = ov["retail"]
        m["b2bPrice"] = ov.get("b2b") if ov.get("b2b") is not None else base
        m["baseRetailWm"] = base  # keep original WM Brutto for reference

        for v in m.get("variants", []) or []:
            vbase = int(v.get("price") or 0)
            key = (mid, v.get("id"))
            ovv = by_model_variant.get(key) or {}
            if ovv.get("retail") is not None:
                v["price"] = ovv["retail"]
            v["b2bPrice"] = ovv.get("b2b") if ovv.get("b2b") is not None else vbase
            v["baseRetailWm"] = vbase

    # 3. Apply to options (flat and inside categories)
    def _fix_options_list(opts: list):
        for opt in opts or []:
            oid = opt.get("id")
            obase = int(opt.get("price") or 0)
            ovo = by_option.get(oid) or {}
            if ovo.get("retail") is not None:
                opt["price"] = ovo["retail"]
            opt["b2bPrice"] = ovo.get("b2b") if ovo.get("b2b") is not None else obase
            opt["baseRetailWm"] = obase
            for v in opt.get("variants", []) or []:
                vbase = int(v.get("price") or 0)
                key = (oid, v.get("id"))
                ovv = by_opt_variant.get(key) or {}
                if ovv.get("retail") is not None:
                    v["price"] = ovv["retail"]
                v["b2bPrice"] = ovv.get("b2b") if ovv.get("b2b") is not None else vbase
                v["baseRetailWm"] = vbase

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
    """Replace the dealer's *retail* prices in bulk.

    The dealer can ONLY touch ``dealerRetailPrice`` from this endpoint.
    The ``price`` (B2B WM→dealer) of each row is preserved if a matching
    row already exists. Rows with empty retail are removed.
    """
    incoming = body.overrides or []

    # 1. Snapshot existing B2B prices keyed by the same compound key.
    existing = await db.dealer_price_overrides.find(
        {"dealerId": dealer["id"]}, {"_id": 0}
    ).to_list(length=5000)
    b2b_by_key: dict[tuple, int | None] = {}
    for o in existing:
        key = (o.get("kind"), o.get("modelId") or None, o.get("variantId") or None,
               o.get("optionId") or None, o.get("optionVariantId") or None)
        b2b_by_key[key] = (int(o["price"]) if o.get("price") is not None else None)

    # 2. Wipe and re-insert combined rows
    await db.dealer_price_overrides.delete_many({"dealerId": dealer["id"]})
    keys_seen: set[tuple] = set()
    docs: list[dict] = []
    for o in incoming:
        d = o.model_dump()
        d["dealerId"] = dealer["id"]
        retail = d.get("dealerRetailPrice")
        try:
            retail = int(retail) if retail not in (None, "") else None
        except (TypeError, ValueError):
            retail = None
        d["dealerRetailPrice"] = retail
        key = (d.get("kind"), d.get("modelId") or None, d.get("variantId") or None,
               d.get("optionId") or None, d.get("optionVariantId") or None)
        keys_seen.add(key)
        # Preserve existing B2B unless the dealer payload explicitly carries one
        # (dealers normally don't, but admin-style payloads do).
        if d.get("price") in (None, ""):
            d["price"] = b2b_by_key.get(key)
        else:
            try:
                d["price"] = int(d["price"])
            except (TypeError, ValueError):
                d["price"] = b2b_by_key.get(key)
        # Skip rows with no meaningful data at all.
        if d.get("dealerRetailPrice") is None and d.get("price") is None:
            continue
        d["updatedAt"] = datetime.now(timezone.utc).isoformat()
        docs.append(d)

    # 3. Preserve B2B-only rows the dealer didn't touch.
    for key, b2b in b2b_by_key.items():
        if key in keys_seen or b2b is None:
            continue
        kind, modelId, variantId, optionId, optionVariantId = key
        docs.append({
            "id": str(__import__("uuid").uuid4()),
            "dealerId": dealer["id"],
            "kind": kind,
            "modelId": modelId,
            "variantId": variantId,
            "optionId": optionId,
            "optionVariantId": optionVariantId,
            "price": b2b,
            "dealerRetailPrice": None,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        })

    if docs:
        await db.dealer_price_overrides.insert_many(docs)
    return {"ok": True, "count": len(docs)}


@router.post("/api/dealer/sauna/overrides/bulk-markup")
async def dealer_bulk_markup(payload: dict, dealer: dict = Depends(get_current_dealer)):
    """Apply a percentage markup to set ``dealerRetailPrice`` in bulk.

    Body::

        { "percent": 15,
          "base": "b2b" | "wm",   # markup baseline
          "scope": "all" | "models" | "options",
          "overwrite": true }      # if false, only fill blanks

    ``base="b2b"`` → ``retail = b2b * (1 + percent/100)`` for each row that
    has a B2B price. ``base="wm"`` uses the WM base brutto from sauna_prices.
    """
    try:
        percent = float(payload.get("percent") or 0)
    except (TypeError, ValueError):
        raise HTTPException(400, "percent must be a number")
    base = (payload.get("base") or "b2b").lower()
    scope = (payload.get("scope") or "all").lower()
    overwrite = bool(payload.get("overwrite", True))
    if base not in ("b2b", "wm"):
        raise HTTPException(400, "base must be 'b2b' or 'wm'")
    if scope not in ("all", "models", "options"):
        raise HTTPException(400, "scope must be 'all', 'models' or 'options'")

    factor = 1.0 + (percent / 100.0)
    prices_doc = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}

    # WM base brutto by key
    wm_by_key: dict[tuple, int] = {}
    for m in (prices_doc.get("models") or []):
        wm_by_key[("model", m.get("id"), None, None, None)] = int(m.get("basePrice") or 0)
        for v in (m.get("variants") or []):
            wm_by_key[("model_variant", m.get("id"), v.get("id"), None, None)] = int(v.get("price") or 0)
    all_opts = list(prices_doc.get("options") or [])
    for cat in (prices_doc.get("categories") or []):
        all_opts.extend(cat.get("options") or [])
    for o in all_opts:
        wm_by_key[("option", None, None, o.get("id"), None)] = int(o.get("price") or 0)
        for v in (o.get("variants") or []):
            wm_by_key[("option_variant", None, None, o.get("id"), v.get("id"))] = int(v.get("price") or 0)

    existing = await db.dealer_price_overrides.find(
        {"dealerId": dealer["id"]}, {"_id": 0}
    ).to_list(length=5000)
    by_key: dict[tuple, dict] = {}
    for o in existing:
        key = (o.get("kind"), o.get("modelId") or None, o.get("variantId") or None,
               o.get("optionId") or None, o.get("optionVariantId") or None)
        by_key[key] = o

    touched = 0

    def _in_scope(kind: str) -> bool:
        if scope == "all":
            return True
        if scope == "models":
            return kind in ("model", "model_variant")
        return kind in ("option", "option_variant")

    # Operate on every WM catalog row (so dealer's blank rows get filled too)
    for key, wm_brutto in wm_by_key.items():
        kind = key[0]
        if not _in_scope(kind):
            continue
        existing_row = by_key.get(key)
        b2b = existing_row.get("price") if existing_row else None
        baseline = b2b if base == "b2b" else wm_brutto
        if baseline is None or baseline <= 0:
            continue
        new_retail = int(round(baseline * factor))

        cur_retail = existing_row.get("dealerRetailPrice") if existing_row else None
        if cur_retail is not None and not overwrite:
            continue
        if existing_row:
            existing_row["dealerRetailPrice"] = new_retail
            existing_row["updatedAt"] = datetime.now(timezone.utc).isoformat()
        else:
            by_key[key] = {
                "id": str(__import__("uuid").uuid4()),
                "dealerId": dealer["id"],
                "kind": kind,
                "modelId": key[1],
                "variantId": key[2],
                "optionId": key[3],
                "optionVariantId": key[4],
                "price": None,
                "dealerRetailPrice": new_retail,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        touched += 1

    # Persist
    await db.dealer_price_overrides.delete_many({"dealerId": dealer["id"]})
    docs = [v for v in by_key.values()
            if v.get("dealerRetailPrice") is not None or v.get("price") is not None]
    if docs:
        await db.dealer_price_overrides.insert_many(docs)
    return {"ok": True, "touched": touched, "total": len(docs)}


# ==========================================================================
# DEALER — ORDERS
# ==========================================================================

async def _compute_manufacturer_totals(dealer_id: str, order_data: dict) -> dict:
    """Recompute the *WM-side* (B2B) totals for a dealer order.

    Returns a dict of fields to ``$set`` on the order::

        {
          "manufacturerBasePrice":   <int>,   # B2B model price
          "manufacturerVariantPrice":<int>,   # B2B model_variant delta (0 if none)
          "manufacturerOptionsTotal":<int>,   # sum of B2B option subtotals
          "manufacturerSubtotal":    <int>,   # base+variant+options (pre-discount, brutto)
          "manufacturerTotal":       <int>,   # subtotal * (1 - discount%/100)
        }

    The dealer-facing ``order.total`` (which is the **retail** total shown to
    the client) is left untouched. The two figures together let the dealer
    panel show a live margin = total − manufacturerTotal.

    Resilient by design: if a price can't be resolved (missing override AND
    missing WM catalog entry), it falls back to whatever the order itself
    stored — never raises.
    """
    # 1. Build B2B lookups (override `price` if set, else WM brutto baseline).
    prices_doc = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
    wm_model: dict[str, int] = {}
    wm_variant: dict[tuple, int] = {}
    wm_option: dict[str, int] = {}
    wm_opt_variant: dict[tuple, int] = {}
    for m in (prices_doc.get("models") or []):
        wm_model[m.get("id")] = int(m.get("basePrice") or 0)
        for v in (m.get("variants") or []):
            wm_variant[(m.get("id"), v.get("id"))] = int(v.get("price") or 0)
    all_opts = list(prices_doc.get("options") or [])
    for cat in (prices_doc.get("categories") or []):
        all_opts.extend(cat.get("options") or [])
    for o in all_opts:
        wm_option[o.get("id")] = int(o.get("price") or 0)
        for v in (o.get("variants") or []):
            wm_opt_variant[(o.get("id"), v.get("id"))] = int(v.get("price") or 0)

    overrides = await db.dealer_price_overrides.find(
        {"dealerId": dealer_id}, {"_id": 0}
    ).to_list(length=5000)
    ov_model: dict[str, int] = {}
    ov_variant: dict[tuple, int] = {}
    ov_option: dict[str, int] = {}
    ov_opt_variant: dict[tuple, int] = {}
    for o in overrides:
        if o.get("price") is None:
            continue  # retail-only row — no B2B value
        p = int(o["price"])
        kind = o.get("kind")
        if kind == "model" and o.get("modelId"):
            ov_model[o["modelId"]] = p
        elif kind == "model_variant" and o.get("modelId") and o.get("variantId"):
            ov_variant[(o["modelId"], o["variantId"])] = p
        elif kind == "option" and o.get("optionId"):
            ov_option[o["optionId"]] = p
        elif kind == "option_variant" and o.get("optionId") and o.get("optionVariantId"):
            ov_opt_variant[(o["optionId"], o["optionVariantId"])] = p

    def b2b_model(mid: str) -> int:
        if mid in ov_model:
            return ov_model[mid]
        return wm_model.get(mid, 0)

    def b2b_variant(mid: str, vid: str) -> int:
        key = (mid, vid)
        if key in ov_variant:
            return ov_variant[key]
        return wm_variant.get(key, 0)

    def b2b_option(oid: str, vid: str | None) -> int:
        if vid:
            key = (oid, vid)
            if key in ov_opt_variant:
                return ov_opt_variant[key]
            base = ov_option.get(oid, wm_option.get(oid, 0))
            return base + wm_opt_variant.get(key, 0)
        if oid in ov_option:
            return ov_option[oid]
        return wm_option.get(oid, 0)

    # 2. Resolve model + variant + options from the order payload
    model_id = order_data.get("selectedModel") or order_data.get("modelId") or ""
    variant_id = order_data.get("selectedModelVariant") or order_data.get("variantId") or None
    m_base = b2b_model(model_id) if model_id else int(order_data.get("basePrice") or 0)
    m_variant = b2b_variant(model_id, variant_id) if (model_id and variant_id) else 0

    options_total = 0
    for opt in (order_data.get("selectedOptions") or []):
        oid = opt.get("optionId") or opt.get("id")
        if not oid:
            continue
        v_id = opt.get("optionVariantId") or opt.get("variantId")
        unit = b2b_option(oid, v_id)
        qty = int(opt.get("quantity") or 1)
        options_total += unit * qty

    subtotal = int(m_base) + int(m_variant) + int(options_total)
    discount_pct = int(order_data.get("discountPercent") or 0)
    total = int(round(subtotal * (1.0 - discount_pct / 100.0)))

    return {
        "manufacturerBasePrice": int(m_base),
        "manufacturerVariantPrice": int(m_variant),
        "manufacturerOptionsTotal": int(options_total),
        "manufacturerSubtotal": int(subtotal),
        "manufacturerTotal": int(total),
    }


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
    # Compute WM-side (B2B) totals so the dealer panel can show live margin.
    try:
        order_data.update(await _compute_manufacturer_totals(dealer["id"], order_data))
    except Exception as e:
        logger.warning(f"manufacturerTotal calc failed on create {order_data.get('id')}: {e}")
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
              "totalCost", "margin", "dealerContractNumber",
              "manufacturerBasePrice", "manufacturerVariantPrice",
              "manufacturerOptionsTotal", "manufacturerSubtotal", "manufacturerTotal"):
        update.pop(k, None)
    update["updatedAt"] = datetime.now(timezone.utc).isoformat()
    # Recompute WM-side totals from the merged latest order body.
    try:
        merged = {**existing, **update}
        update.update(await _compute_manufacturer_totals(dealer["id"], merged))
    except Exception as e:
        logger.warning(f"manufacturerTotal calc failed on update {order_id}: {e}")
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


@router.get("/api/admin/dealers/comparison")
async def admin_dealers_comparison(_: dict = Depends(get_admin_user)):
    """Pricing comparison across all dealers.

    Returns one row per catalog position (model / model_variant / option /
    option_variant) with the base retail brutto and each dealer's override
    (or null if the dealer uses the base price).
    """
    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
    dealers = await db.dealers.find(
        {"isActive": {"$ne": False}}, {"_id": 0, "password": 0},
    ).sort("name", 1).to_list(length=500)
    overrides = await db.dealer_price_overrides.find({}, {"_id": 0}).to_list(length=20000)

    # Build override lookup: {dealerId: {(kind,modelId,variantId,optionId,optionVariantId): price}}
    ov_by_dealer: dict[str, dict] = {}
    for o in overrides:
        p = o.get("price")
        if p is None:
            continue  # retail-only override row — not relevant to B2B comparison
        ov_by_dealer.setdefault(o.get("dealerId"), {})[(
            o.get("kind"),
            o.get("modelId") or "",
            o.get("variantId") or "",
            o.get("optionId") or "",
            o.get("optionVariantId") or "",
        )] = int(p)

    rows: list[dict] = []

    def push(kind, model_id, variant_id, option_id, option_variant_id, name, retail):
        key = (kind, model_id or "", variant_id or "", option_id or "", option_variant_id or "")
        per_dealer = []
        prices_set: list[int] = []
        for d in dealers:
            p = ov_by_dealer.get(d["id"], {}).get(key)
            per_dealer.append({"dealerId": d["id"], "dealerName": d.get("name") or d.get("username"), "price": p})
            if p is not None:
                prices_set.append(p)
        rows.append({
            "kind": kind,
            "modelId": model_id, "variantId": variant_id,
            "optionId": option_id, "optionVariantId": option_variant_id,
            "name": name,
            "retailBrutto": int(retail or 0),
            "dealers": per_dealer,
            "minDealerPrice": min(prices_set) if prices_set else None,
            "maxDealerPrice": max(prices_set) if prices_set else None,
            "avgDealerPrice": int(round(sum(prices_set) / len(prices_set))) if prices_set else None,
            "overrideCount": len(prices_set),
        })

    # Models + variants
    for m in (prices.get("models") or []):
        push("model", m.get("id"), None, None, None, m.get("name") or m.get("id"), m.get("basePrice"))
        for v in (m.get("variants") or []):
            push(
                "model_variant", m.get("id"), v.get("id"), None, None,
                f"{m.get('name','?')} — {v.get('name') or v.get('namePl') or v.get('id','?')}",
                int(m.get("basePrice") or 0) + int(v.get("price") or 0),
            )

    # Options (top-level + nested)
    all_opts = list(prices.get("options") or [])
    for cat in (prices.get("categories") or []):
        for o in (cat.get("options") or []):
            all_opts.append({**o, "_catName": cat.get("name") or ""})
    for o in all_opts:
        cat_prefix = f"{o.get('_catName')} · " if o.get("_catName") else ""
        push("option", None, None, o.get("id"), None, f"{cat_prefix}{o.get('name','?')}", o.get("price"))
        for ov in (o.get("variants") or []):
            push(
                "option_variant", None, None, o.get("id"), ov.get("id"),
                f"{cat_prefix}{o.get('name','?')} — {ov.get('name') or ov.get('namePl') or ov.get('id','?')}",
                ov.get("price"),
            )

    return {
        "dealers": [{"id": d["id"], "name": d.get("name") or d.get("username"),
                     "username": d.get("username"), "isActive": d.get("isActive", True)} for d in dealers],
        "rows": rows,
        "totalRows": len(rows),
    }


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
        defaultMarkupPercent=body.defaultMarkupPercent,
        defaultMarkupBase=(body.defaultMarkupBase or None),
        defaultMarkupScope=(body.defaultMarkupScope or None),
    )
    doc = dealer.model_dump()
    await db.dealers.insert_one(doc)
    doc.pop("password", None)
    doc.pop("_id", None)
    return doc


@router.put("/api/admin/dealers/{dealer_id}")
async def admin_update_dealer(dealer_id: str, body: DealerUpdate, _: dict = Depends(get_admin_user)):
    payload = body.model_dump(exclude_none=True)
    update = {k: v for k, v in payload.items() if k != "resetOnboarding"}
    if "password" in update and update["password"]:
        update["password"] = hash_password(update["password"])
    elif "password" in update:
        update.pop("password")
    if payload.get("resetOnboarding"):
        update["onboardedAt"] = None
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


@router.delete("/api/admin/dealers/{dealer_id}/hard-delete")
async def admin_hard_delete_dealer(
    dealer_id: str,
    delete_confirmed: bool = False,
    _: dict = Depends(get_admin_user),
):
    """**Permanently** remove a dealer.

    Always deletes:
      * the dealer profile (`dealers`)
      * all of the dealer's price overrides (`dealer_price_overrides`)
      * all of the dealer's markup presets (`dealer_markup_presets`)
      * all DRAFT dealer orders (`sauna_orders` where status='draft' / missing)

    Confirmed orders are preserved as historical revenue records BUT marked
    with ``dealerDeleted=true`` + snapshot ``deletedDealerName`` so WM-side
    reports still attribute the revenue correctly.

    Pass ``?delete_confirmed=true`` to ALSO delete confirmed orders
    (full cascade — use with caution).
    """
    dealer = await db.dealers.find_one({"id": dealer_id}, {"_id": 0})
    if not dealer:
        raise HTTPException(404, "Dealer not found")

    snapshot_name = dealer.get("name") or dealer.get("username") or dealer_id
    now_iso = datetime.now(timezone.utc).isoformat()

    overrides_deleted = (await db.dealer_price_overrides.delete_many({"dealerId": dealer_id})).deleted_count
    presets_deleted = (await db.dealer_markup_presets.delete_many({"dealerId": dealer_id})).deleted_count

    if delete_confirmed:
        orders_affected = (await db.sauna_orders.delete_many({"dealerId": dealer_id})).deleted_count
        orders_archived = 0
    else:
        # Delete drafts only
        drafts_deleted = (await db.sauna_orders.delete_many({
            "dealerId": dealer_id,
            "$or": [{"status": "draft"}, {"status": {"$exists": False}}],
        })).deleted_count
        # Mark confirmed as detached
        archive_res = await db.sauna_orders.update_many(
            {"dealerId": dealer_id, "status": "confirmed"},
            {"$set": {
                "dealerDeleted": True,
                "deletedDealerName": snapshot_name,
                "deletedDealerAt": now_iso,
            }},
        )
        orders_affected = drafts_deleted
        orders_archived = archive_res.modified_count

    dealer_deleted = (await db.dealers.delete_one({"id": dealer_id})).deleted_count

    return {
        "ok": True,
        "dealerDeleted": bool(dealer_deleted),
        "overridesDeleted": overrides_deleted,
        "presetsDeleted": presets_deleted,
        "ordersDeleted": orders_affected,
        "confirmedOrdersArchived": orders_archived,
    }


# ==========================================================================
# DEALER — MARKUP PRESETS
# ==========================================================================

@router.get("/api/dealer/markup-presets")
async def dealer_list_presets(dealer: dict = Depends(get_current_dealer)):
    presets = await db.dealer_markup_presets.find(
        {"dealerId": dealer["id"]}, {"_id": 0}
    ).sort("createdAt", 1).to_list(length=100)
    return {"presets": presets}


@router.post("/api/dealer/markup-presets")
async def dealer_create_preset(body: dict, dealer: dict = Depends(get_current_dealer)):
    """Save a named markup preset for the current dealer.

    Body::

        { "name": "+15% эконом",
          "percent": 15,
          "base": "b2b" | "wm",
          "scope": "all" | "models" | "options" }
    """
    import uuid as _uuid
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "name is required")
    try:
        percent = float(body.get("percent") or 0)
    except (TypeError, ValueError):
        raise HTTPException(400, "percent must be a number")
    base = (body.get("base") or "b2b").lower()
    scope = (body.get("scope") or "all").lower()
    if base not in ("b2b", "wm"):
        raise HTTPException(400, "base must be 'b2b' or 'wm'")
    if scope not in ("all", "models", "options"):
        raise HTTPException(400, "scope must be 'all', 'models' or 'options'")

    preset = {
        "id": str(_uuid.uuid4()),
        "dealerId": dealer["id"],
        "name": name[:80],
        "percent": percent,
        "base": base,
        "scope": scope,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.dealer_markup_presets.insert_one(preset)
    preset.pop("_id", None)
    return preset


@router.delete("/api/dealer/markup-presets/{preset_id}")
async def dealer_delete_preset(preset_id: str, dealer: dict = Depends(get_current_dealer)):
    res = await db.dealer_markup_presets.delete_one(
        {"id": preset_id, "dealerId": dealer["id"]},
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Preset not found")
    return {"ok": True}


@router.post("/api/dealer/markup-presets/{preset_id}/apply")
async def dealer_apply_preset(
    preset_id: str,
    body: dict | None = None,
    dealer: dict = Depends(get_current_dealer),
):
    """Apply a saved preset by reusing the bulk-markup logic.

    Optional body: ``{"overwrite": true|false}`` — default true.
    """
    preset = await db.dealer_markup_presets.find_one(
        {"id": preset_id, "dealerId": dealer["id"]}, {"_id": 0},
    )
    if not preset:
        raise HTTPException(404, "Preset not found")
    overwrite = bool((body or {}).get("overwrite", True))
    return await dealer_bulk_markup(
        {
            "percent": preset["percent"],
            "base": preset["base"],
            "scope": preset["scope"],
            "overwrite": overwrite,
        },
        dealer,
    )


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
    """Replace the dealer's *B2B* (WM→dealer) prices in bulk.

    Admin can only touch ``price``. Any ``dealerRetailPrice`` already set by
    the dealer is preserved.
    """
    if not await db.dealers.find_one({"id": dealer_id}):
        raise HTTPException(404, "Dealer not found")

    # Snapshot existing dealer-set retail prices.
    existing = await db.dealer_price_overrides.find(
        {"dealerId": dealer_id}, {"_id": 0}
    ).to_list(length=5000)
    retail_by_key: dict[tuple, int | None] = {}
    for o in existing:
        key = (o.get("kind"), o.get("modelId") or None, o.get("variantId") or None,
               o.get("optionId") or None, o.get("optionVariantId") or None)
        retail_by_key[key] = (int(o["dealerRetailPrice"]) if o.get("dealerRetailPrice") is not None else None)

    await db.dealer_price_overrides.delete_many({"dealerId": dealer_id})
    keys_seen: set[tuple] = set()
    docs: list[dict] = []
    for o in (body.overrides or []):
        d = o.model_dump()
        d["dealerId"] = dealer_id
        key = (d.get("kind"), d.get("modelId") or None, d.get("variantId") or None,
               d.get("optionId") or None, d.get("optionVariantId") or None)
        keys_seen.add(key)
        # Admin payload carries `price` (B2B). Coerce to int or None.
        try:
            d["price"] = int(d["price"]) if d.get("price") not in (None, "") else None
        except (TypeError, ValueError):
            d["price"] = None
        # Preserve dealer's retail if admin didn't explicitly set one.
        if d.get("dealerRetailPrice") in (None, ""):
            d["dealerRetailPrice"] = retail_by_key.get(key)
        else:
            try:
                d["dealerRetailPrice"] = int(d["dealerRetailPrice"])
            except (TypeError, ValueError):
                d["dealerRetailPrice"] = retail_by_key.get(key)
        if d.get("price") is None and d.get("dealerRetailPrice") is None:
            continue
        d["updatedAt"] = datetime.now(timezone.utc).isoformat()
        docs.append(d)

    # Preserve retail-only rows admin didn't touch.
    import uuid as _uuid
    for key, retail in retail_by_key.items():
        if key in keys_seen or retail is None:
            continue
        kind, modelId, variantId, optionId, optionVariantId = key
        docs.append({
            "id": str(_uuid.uuid4()),
            "dealerId": dealer_id,
            "kind": kind,
            "modelId": modelId,
            "variantId": variantId,
            "optionId": optionId,
            "optionVariantId": optionVariantId,
            "price": None,
            "dealerRetailPrice": retail,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        })

    if docs:
        await db.dealer_price_overrides.insert_many(docs)
    return {"ok": True, "count": len(docs)}


@router.post("/api/admin/dealers/{dealer_id}/overrides/upsert")
async def admin_upsert_dealer_overrides(
    dealer_id: str,
    body: dict,
    _: dict = Depends(get_admin_user),
):
    """Add or update specific dealer B2B overrides without wiping the rest.

    Matches existing overrides on (dealerId, kind, modelId, variantId, optionId,
    optionVariantId) and replaces ONLY the ``price`` (B2B) field. Any
    ``dealerRetailPrice`` already set by the dealer himself is preserved.
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
        # `price` (B2B) is optional now — caller may want to upsert only
        # `dealerRetailPrice`. At least one of the two must be present.
        has_price = "price" in raw and raw.get("price") is not None
        has_retail = "dealerRetailPrice" in raw and raw.get("dealerRetailPrice") is not None
        if not has_price and not has_retail:
            raise HTTPException(400, "Either `price` or `dealerRetailPrice` must be provided")
        update_fields: dict = {}
        if has_price:
            try:
                update_fields["price"] = int(raw.get("price") or 0)
            except (TypeError, ValueError):
                raise HTTPException(400, "price must be an integer")
        if has_retail:
            try:
                update_fields["dealerRetailPrice"] = int(raw.get("dealerRetailPrice") or 0)
            except (TypeError, ValueError):
                raise HTTPException(400, "dealerRetailPrice must be an integer")
        key = {
            "dealerId": dealer_id,
            "kind": kind,
            "modelId": raw.get("modelId") or None,
            "variantId": raw.get("variantId") or None,
            "optionId": raw.get("optionId") or None,
            "optionVariantId": raw.get("optionVariantId") or None,
        }
        res = await db.dealer_price_overrides.update_one(
            key,
            {"$set": {**key, **update_fields, "updatedAt": now}},
            upsert=True,
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


@router.post("/api/admin/dealer-orders/recompute-manufacturer-totals")
async def admin_recompute_manufacturer_totals(_: dict = Depends(get_admin_user)):
    """Backfill `manufacturerTotal` (and siblings) for every dealer order.

    Useful after enabling the two-price model or after bulk price changes —
    refreshes the WM-side B2B totals based on each dealer's *current* overrides
    + the *current* sauna_prices catalog.
    """
    updated = 0
    skipped = 0
    cursor = db.sauna_orders.find(
        {"source": "dealer", "dealerId": {"$exists": True, "$ne": None}},
        {"_id": 0},
    )
    async for o in cursor:
        try:
            patch = await _compute_manufacturer_totals(o.get("dealerId"), o)
        except Exception:
            skipped += 1
            continue
        await db.sauna_orders.update_one({"id": o["id"]}, {"$set": patch})
        updated += 1
    return {"ok": True, "updated": updated, "skipped": skipped}



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
