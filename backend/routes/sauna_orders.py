"""Sauna orders CRUD operations."""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import logging

from database import db
from models.sauna import SaunaOrder, SaunaPDFRequest
from services.telegram_service import notify_new_order
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
async def get_sauna_orders(username: str = None, role: str = None):
    """Get sauna orders - admins see all, managers see only their own"""
    query = {}
    
    # If user is a manager (not admin), filter by createdBy
    if role and role != 'admin' and username:
        query['createdBy'] = username
    
    orders = await db.sauna_orders.find(query, {"_id": 0}).to_list(1000)
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
