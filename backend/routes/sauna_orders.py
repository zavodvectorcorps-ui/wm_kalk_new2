"""Sauna orders CRUD operations."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import logging

from database import db
from models.sauna import SaunaOrder, SaunaPDFRequest
from services.telegram_service import notify_new_order
from services.auth_service import get_admin_user
from routes.amocrm import add_note_to_amocrm, get_amocrm_settings

logger = logging.getLogger(__name__)
# No prefix - will be included in main sauna router
router = APIRouter(tags=["Sauna Orders"])


async def generate_sauna_pdf_bytes_import(request: SaunaPDFRequest) -> bytes:
    """Import the PDF generation function from sauna module."""
    from routes.sauna import generate_sauna_pdf_bytes
    return await generate_sauna_pdf_bytes(request)


@router.post("/orders", response_model=SaunaOrder)
async def create_sauna_order(order: SaunaOrder):
    """Create a new sauna order"""
    order_dict = order.model_dump()
    
    # Save order first
    await db.sauna_orders.insert_one(order_dict)
    
    # Log certificate usage if applied
    if order_dict.get('certificateDiscount'):
        try:
            cert_log = {
                "orderId": order_dict.get('id', ''),
                "clientName": order_dict.get('fullName', ''),
                "modelName": order_dict.get('modelName', ''),
                "subtotal": order_dict.get('subtotal', 0),
                "discountPercent": order_dict.get('discountPercent', 0),
                "totalAfterDiscount": order_dict.get('total', 0),
                "certificateSavings": round((order_dict.get('subtotal', 0) * (1 - order_dict.get('discountPercent', 0) / 100)) * 0.18),
                "createdBy": order_dict.get('createdBy', ''),
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.certificate_history.insert_one(cert_log)
        except Exception as e:
            logger.warning(f"Failed to log certificate usage: {e}")
    
    # Then send Telegram notification with PDF
    pdf_generated = False
    try:
        pdf_request = SaunaPDFRequest(
            orderId=order_dict.get('id', ''),
            fullName=order_dict.get('fullName', ''),
            phoneNumber=order_dict.get('phoneNumber', ''),
            fullAddress=order_dict.get('fullAddress', ''),
            email=order_dict.get('email', ''),
            orderDate=order_dict.get('orderDate', order_dict.get('createdAt', datetime.now().isoformat())),
            selectedModel=order_dict.get('selectedModel', ''),
            modelName=order_dict.get('modelName', ''),
            basePrice=order_dict.get('basePrice', 0),
            selections=order_dict.get('selections', {}),
            quantities=order_dict.get('quantities', {}),
            notes=order_dict.get('notes', ''),
            total=order_dict.get('total', 0)
        )
        pdf_data = await generate_sauna_pdf_bytes_import(pdf_request)
        pdf_generated = True
        await notify_new_order(order_dict, order_type='sauna', is_web_order=False, pdf_data=pdf_data)
    except Exception as e:
        logger.warning(f"Failed to send Telegram notification with PDF for sauna order: {e}")
        try:
            await notify_new_order(order_dict, order_type='sauna', is_web_order=False)
        except Exception:
            pass
    
    # Update order with PDF status
    if pdf_generated:
        await db.sauna_orders.update_one(
            {"id": order_dict.get('id')},
            {"$set": {"pdfGenerated": True, "pdfGeneratedAt": datetime.now(timezone.utc).isoformat()}}
        )
    
    return order


@router.get("/orders")
async def get_sauna_orders(username: str = None, role: str = None, for_logistics: bool = False):
    """Get sauna orders - admins see all, managers see only their own.
    
    Args:
        for_logistics: If True, only return orders from amoCRM (for logistics page)
    """
    query = {}
    
    # If user is a manager (not admin), filter by createdBy
    if role and role != 'admin' and username:
        query['createdBy'] = username
    
    # Filter for logistics - ONLY amoCRM orders
    if for_logistics:
        query["$or"] = [
            {"source": "amocrm"},
            {"amocrm_id": {"$exists": True, "$ne": None, "$ne": ""}},
        ]
    
    orders = await db.sauna_orders.find(query, {"_id": 0}).sort("createdAt", -1).to_list(5000)
    return orders


@router.get("/orders/{order_id}")
async def get_sauna_order(order_id: str):
    """Get a single sauna order by ID"""
    order = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/orders/{order_id}")
async def update_sauna_order(order_id: str, order: SaunaOrder):
    """Update an existing sauna order with change history tracking"""
    # Get existing order to track changes
    existing = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_dict = order.model_dump()
    now = datetime.now(timezone.utc).isoformat()
    
    # Track what fields changed
    changes = []
    tracked_fields = [
        'fullName', 'clientName', 'phoneNumber', 'phone', 'fullAddress',
        'orderContents', 'notes', 'dealSum', 'debtSum', 'totalPrice', 'amountDue',
        'deliveryStatus', 'deliveryComment', 'isImportant',
        'tripId', 'tripName', 'tripDriverName', 'tripDepartureDate', 'tripOrderStatus',
        'modelName', 'total', 'discountPercent'
    ]
    
    for field in tracked_fields:
        old_val = existing.get(field)
        new_val = order_dict.get(field)
        if old_val != new_val:
            changes.append({
                'field': field,
                'oldValue': old_val,
                'newValue': new_val
            })
    
    # If there are changes, add to history
    if changes:
        history_entry = {
            'timestamp': now,
            'changes': changes,
            'changedBy': order_dict.get('updatedBy', 'system')
        }
        
        change_history = existing.get('changeHistory', []) or []
        change_history.append(history_entry)
        order_dict['changeHistory'] = change_history
        order_dict['updatedAt'] = now
    
    result = await db.sauna_orders.update_one(
        {"id": order_id},
        {"$set": order_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Log certificate usage if newly applied
    if order_dict.get('certificateDiscount') and not existing.get('certificateDiscount'):
        try:
            cert_log = {
                "orderId": order_id,
                "clientName": order_dict.get('fullName', ''),
                "modelName": order_dict.get('modelName', ''),
                "subtotal": order_dict.get('subtotal', 0),
                "discountPercent": order_dict.get('discountPercent', 0),
                "totalAfterDiscount": order_dict.get('total', 0),
                "certificateSavings": round((order_dict.get('subtotal', 0) * (1 - order_dict.get('discountPercent', 0) / 100)) * 0.18),
                "createdBy": order_dict.get('updatedBy', order_dict.get('createdBy', '')),
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.certificate_history.insert_one(cert_log)
        except Exception as e:
            logger.warning(f"Failed to log certificate usage on update: {e}")
    
    # Return updated order
    updated = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    
    # Send note to amoCRM if order has amocrm_id and there were changes
    if changes and updated.get('amocrm_id'):
        try:
            settings = get_amocrm_settings()
            domain = settings.get('amocrm_domain')
            token = settings.get('amocrm_token')
            
            if domain and token:
                changed_fields = [c['field'] for c in changes]
                changed_by = order_dict.get('updatedBy', 'система')
                note_text = f"✏️ Заказ изменён пользователем {changed_by}\n\nИзменённые поля: {', '.join(changed_fields)}"
                
                await add_note_to_amocrm(updated['amocrm_id'], note_text, domain, token)
                logger.info(f"Note sent to amoCRM for sauna order {order_id}")
        except Exception as e:
            logger.error(f"Failed to send note to amoCRM: {e}")
    
    return updated


@router.delete("/orders/{order_id}")
async def delete_sauna_order(order_id: str):
    """Delete a sauna order"""
    result = await db.sauna_orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted successfully"}


@router.patch("/orders/{order_id}/assign")
async def assign_order_responsible(order_id: str, data: dict):
    """Assign a new responsible user to an order (admin/manager only)"""
    new_responsible = data.get("createdBy")
    assigned_by = data.get("assignedBy", "system")
    
    if not new_responsible:
        raise HTTPException(status_code=400, detail="createdBy is required")
    
    # Get existing order
    existing = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_responsible = existing.get("createdBy", "")
    now = datetime.now(timezone.utc).isoformat()
    
    # Track change in history
    history_entry = {
        "timestamp": now,
        "changes": [{
            "field": "createdBy",
            "oldValue": old_responsible,
            "newValue": new_responsible
        }],
        "changedBy": assigned_by
    }
    
    change_history = existing.get("changeHistory", []) or []
    change_history.append(history_entry)
    
    # Update the order
    result = await db.sauna_orders.update_one(
        {"id": order_id},
        {"$set": {
            "createdBy": new_responsible,
            "updatedAt": now,
            "updatedBy": assigned_by,
            "changeHistory": change_history
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Return updated order
    updated = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    
    logger.info(f"Order {order_id} reassigned from '{old_responsible}' to '{new_responsible}' by {assigned_by}")
    
    return updated


# =============================================
# LAYOUT CONFIGURATOR ENDPOINTS
# =============================================

@router.put("/orders/{order_id}/layout-config")
async def save_order_layout_config(order_id: str, config: dict):
    """Save layout configurator data to an order.
    
    Expected config:
    {
        "imageData": "base64...",  # PNG image of canvas
        "canvasJson": {...},       # Canvas state for editing later
        "selectedVariants": {"optionId": "variantId", ...},  # Applied variants
        "configuredBy": "username"
    }
    """
    from services.cloudinary_service import upload_base64_image, is_cloudinary_configured
    
    existing = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "layoutConfiguredAt": now,
        "layoutConfiguredBy": config.get("configuredBy", "system"),
        "updatedAt": now,
    }
    
    # Upload image to Cloudinary if available
    image_data = config.get("imageData")
    if image_data:
        if is_cloudinary_configured():
            result = await upload_base64_image(
                image_data,
                f"order-layout-{order_id}",
                folder="order-layouts"
            )
            if result:
                update_data["layoutConfigImage"] = result["url"]
        else:
            # Store as data URL (not recommended for production)
            update_data["layoutConfigImage"] = f"data:image/png;base64,{image_data}"
    
    # Store canvas JSON
    canvas_json = config.get("canvasJson")
    if canvas_json:
        import json
        update_data["layoutConfigJson"] = json.dumps(canvas_json)
    
    # Store selected variants
    variants = config.get("selectedVariants")
    if variants:
        update_data["layoutConfigVariants"] = variants
    
    # Update order
    await db.sauna_orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    # Return updated order
    updated = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    logger.info(f"Layout config saved for order {order_id}")
    
    return {"success": True, "order": updated}


@router.get("/orders/{order_id}/layout-config")
async def get_order_layout_config(order_id: str):
    """Get layout configurator data for an order."""
    order = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    import json
    canvas_json = None
    if order.get("layoutConfigJson"):
        try:
            canvas_json = json.loads(order["layoutConfigJson"])
        except:
            pass
    
    return {
        "imageUrl": order.get("layoutConfigImage"),
        "canvasJson": canvas_json,
        "selectedVariants": order.get("layoutConfigVariants", {}),
        "configuredAt": order.get("layoutConfiguredAt"),
        "configuredBy": order.get("layoutConfiguredBy"),
    }


# =============================================
# TECH SPEC ENDPOINTS
# =============================================

@router.put("/orders/{order_id}/tech-spec")
async def update_order_tech_spec(order_id: str, tech_spec: dict):
    """Update technical specification for an order"""
    result = await db.sauna_orders.update_one(
        {"id": order_id},
        {"$set": {"techSpec": tech_spec}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Tech spec updated successfully"}


@router.get("/orders/{order_id}/tech-spec")
async def get_order_tech_spec(order_id: str):
    """Get technical specification for an order"""
    order = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order.get("techSpec", {})


@router.get("/certificate-history")
async def get_certificate_history(limit: int = 50, skip: int = 0):
    """Get certificate discount usage history."""
    cursor = db.certificate_history.find({}, {"_id": 0}).sort("createdAt", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.certificate_history.count_documents({})
    return {"items": items, "total": total}


# ============================================================
# RECOMPUTE MARGINS — refresh totalCost from current sauna_prices.
# ============================================================
VAT_RATE = 0.23


def _flatten_options(prices: dict) -> dict:
    """Return {optionId: {price, costPrice, variants:{varId: {price, costPrice}}}}."""
    out: dict[str, dict] = {}
    for o in (prices.get("options") or []):
        out[o["id"]] = o
    for cat in (prices.get("categories") or []):
        for o in (cat.get("options") or []):
            out[o["id"]] = o
    return out


def _recompute_one(order: dict, prices: dict, opt_index: dict) -> dict | None:
    """Recompute totalCost + VAT-aware margin for one order using current prices.

    Returns dict with new values to $set, or None if essential data is missing.
    """
    model_id = order.get("selectedModel")
    variant_id = order.get("selectedModelVariant")
    selected = order.get("selectedOptions") or []
    total = float(order.get("total") or 0)

    model = next((m for m in (prices.get("models") or []) if m.get("id") == model_id), None)
    if not model:
        return None

    model_cost = float(model.get("costPrice") or 0)
    retail_extra = float(model.get("retailExtraCost") or 0)
    if variant_id:
        v = next((v for v in (model.get("variants") or []) if v.get("id") == variant_id), None)
        if v:
            model_cost += float(v.get("costPrice") or 0)
            retail_extra += float(v.get("retailExtraCost") or 0)

    opts_cost = 0.0
    for sel in selected:
        opt_id = sel.get("optionId") or sel.get("id")
        qty = int(sel.get("quantity") or 1)
        o = opt_index.get(opt_id)
        if not o:
            continue
        # Variant-cost if present, else option cost
        chosen_var_id = sel.get("variantId") or sel.get("optionVariantId")
        chosen_var = None
        if chosen_var_id:
            chosen_var = next((v for v in (o.get("variants") or []) if v.get("id") == chosen_var_id), None)
        if chosen_var:
            cost = float(chosen_var.get("costPrice") or 0)
            extra = float(chosen_var.get("retailExtraCost") or 0)
        else:
            cost = float(o.get("costPrice") or 0)
            extra = float(o.get("retailExtraCost") or 0)
        q = max(1, qty)
        opts_cost += cost * q
        retail_extra += extra * q

    total_cost = int(round(model_cost + opts_cost))
    retail_extra_int = int(round(retail_extra))
    # VAT-aware margin: brutto → netto, then subtract production cost AND retail-only extras.
    total_netto = total / (1 + VAT_RATE) if total > 0 else 0
    margin = int(round(total_netto - total_cost - retail_extra_int))
    return {
        "totalCost": total_cost,
        "retailExtraCost": retail_extra_int,
        "margin": margin,
        "marginRecomputedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/orders/recompute-margins")
async def recompute_all_margins(_: dict = Depends(get_admin_user)):
    """Iterate over all sauna orders and refresh totalCost + margin from current
    sauna_prices.costPrice values, using VAT-aware netto margin (total / 1.23 − cost).
    """
    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
    opt_index = _flatten_options(prices)

    updated = 0
    skipped = 0
    unchanged = 0
    cursor = db.sauna_orders.find({}, {"_id": 0})
    async for o in cursor:
        patch = _recompute_one(o, prices, opt_index)
        if patch is None:
            skipped += 1
            continue
        if (
            int(o.get("totalCost") or 0) == patch["totalCost"]
            and int(o.get("margin") or 0) == patch["margin"]
            and int(o.get("retailExtraCost") or 0) == patch["retailExtraCost"]
        ):
            unchanged += 1
            continue
        await db.sauna_orders.update_one({"id": o["id"]}, {"$set": patch})
        updated += 1
    return {"ok": True, "updated": updated, "unchanged": unchanged, "skipped": skipped}


@router.get("/orders/{order_id}/recompute-preview")
async def recompute_one_preview(order_id: str, _: dict = Depends(get_admin_user)):
    """Preview the refreshed totalCost/margin for a single order without saving."""
    o = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    prices = await db.sauna_prices.find_one({"_id": "default"}, {"_id": 0}) or {}
    patch = _recompute_one(o, prices, _flatten_options(prices))
    if not patch:
        raise HTTPException(400, "Cannot recompute — model not found in current prices")
    return {
        "current": {"totalCost": o.get("totalCost"), "margin": o.get("margin")},
        "recomputed": patch,
        "total": o.get("total"),
    }
