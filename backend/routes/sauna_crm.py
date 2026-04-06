"""Sauna CRM routes - Mini CRM for sauna orders with amoCRM integration."""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from database import db
from services.cloudinary_service import upload_pdf as cloudinary_upload_pdf, is_cloudinary_configured
from routes.amocrm import add_note_to_amocrm
import httpx
import os
import logging
import uuid
import asyncio

router = APIRouter(prefix="/sauna-crm", tags=["Sauna CRM"])
logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")


def get_amo_settings_sync():
    from pymongo import MongoClient
    c = MongoClient(MONGO_URL)
    d = c[DB_NAME]
    return d["integration_settings"].find_one({"type": "amocrm"}, {"_id": 0}) or {}


# ============== MODELS ==============

class CRMFieldConfig(BaseModel):
    id: str
    name: str
    amoFieldId: str = ""
    fieldType: str = "text"  # text, number, date, select, money
    category: str = "custom"  # client, payment, production, custom
    enabled: bool = True
    sortOrder: int = 1


class CRMStageConfig(BaseModel):
    id: str
    name: str
    amoStageId: str = ""
    amoPipelineId: str = ""
    color: str = "#3b82f6"
    sortOrder: int = 1
    collapsed: bool = False


class CRMSettings(BaseModel):
    fields: List[CRMFieldConfig] = []
    stages: List[CRMStageConfig] = []
    syncBackFields: List[Dict[str, str]] = []  # [{fieldId, amoFieldId}]
    autoSyncEnabled: bool = False
    autoSyncIntervalMinutes: int = 15
    lastSyncAt: Optional[str] = None
    clientNameFieldId: Optional[str] = None  # amoCRM field ID for client name
    modelFieldId: Optional[str] = None  # amoCRM field ID for sauna model
    calendarDateField: Optional[str] = None  # Which field to use for calendar & date filtering (e.g. "field_3", "prepaymentDate")
    commentFieldId: Optional[str] = None  # amoCRM field ID for manager comment
    advanceFieldId: Optional[str] = None  # amoCRM field ID for advance payment
    remainingFieldId: Optional[str] = None  # amoCRM field ID for remaining amount


class CRMLead(BaseModel):
    id: str = Field(default_factory=lambda: f"CRM-{uuid.uuid4().hex[:8].upper()}")
    stageId: str
    clientName: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    amocrm_id: Optional[str] = None
    amocrm_link: Optional[str] = None
    field_1: Optional[str] = None
    field_2: Optional[str] = None
    field_3: Optional[str] = None
    field_4: Optional[str] = None
    field_5: Optional[str] = None
    field_6: Optional[str] = None
    field_7: Optional[str] = None
    field_8: Optional[str] = None
    field_9: Optional[str] = None
    field_10: Optional[str] = None
    readyDate: Optional[str] = None  # Production ready date
    productionDate: Optional[str] = None
    deliveryDate: Optional[str] = None
    modelName: Optional[str] = None
    totalAmount: Optional[float] = None
    advancePayment: Optional[float] = None
    remainingAmount: Optional[float] = None
    paidAmount: Optional[float] = None
    documents: List[Dict[str, Any]] = []
    calculatorData: Optional[Dict[str, Any]] = None
    calculatorPdfUrl: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: Optional[str] = None
    stageHistory: List[Dict[str, Any]] = []
    changeLog: List[Dict[str, Any]] = []
    hasUnreviewedChanges: bool = False
    amoComment: str = ""
    notes: str = ""
    isImportant: bool = False


# ============== DEFAULT SETTINGS ==============

def get_default_settings() -> dict:
    return {
        "fields": [
            {"id": "field_1", "name": "Модель", "amoFieldId": "", "fieldType": "text", "category": "production", "enabled": True, "sortOrder": 1},
            {"id": "field_2", "name": "Сумма заказа", "amoFieldId": "", "fieldType": "money", "category": "payment", "enabled": True, "sortOrder": 2},
            {"id": "field_3", "name": "Предоплата", "amoFieldId": "", "fieldType": "money", "category": "payment", "enabled": True, "sortOrder": 3},
            {"id": "field_4", "name": "Дата производства", "amoFieldId": "", "fieldType": "date", "category": "production", "enabled": True, "sortOrder": 4},
            {"id": "field_5", "name": "Дата готовности", "amoFieldId": "", "fieldType": "date", "category": "production", "enabled": True, "sortOrder": 5},
            {"id": "field_6", "name": "Поле 6", "amoFieldId": "", "fieldType": "text", "category": "custom", "enabled": False, "sortOrder": 6},
            {"id": "field_7", "name": "Поле 7", "amoFieldId": "", "fieldType": "text", "category": "custom", "enabled": False, "sortOrder": 7},
            {"id": "field_8", "name": "Поле 8", "amoFieldId": "", "fieldType": "text", "category": "custom", "enabled": False, "sortOrder": 8},
            {"id": "field_9", "name": "Поле 9", "amoFieldId": "", "fieldType": "text", "category": "custom", "enabled": False, "sortOrder": 9},
            {"id": "field_10", "name": "Поле 10", "amoFieldId": "", "fieldType": "text", "category": "custom", "enabled": False, "sortOrder": 10},
        ],
        "stages": [
            {"id": "invoice_sent", "name": "Выставлен счёт", "amoStageId": "", "amoPipelineId": "", "color": "#3b82f6", "sortOrder": 1},
            {"id": "prepayment_received", "name": "Предоплата получена", "amoStageId": "", "amoPipelineId": "", "color": "#f59e0b", "sortOrder": 2},
            {"id": "approved_by_production", "name": "Согласован производством", "amoStageId": "", "amoPipelineId": "", "color": "#06b6d4", "sortOrder": 3},
            {"id": "in_production", "name": "В производстве", "amoStageId": "", "amoPipelineId": "", "color": "#22c55e", "sortOrder": 4},
            {"id": "ready", "name": "Готов", "amoStageId": "", "amoPipelineId": "", "color": "#10b981", "sortOrder": 5},
            {"id": "delivered", "name": "Доставлен", "amoStageId": "", "amoPipelineId": "", "color": "#059669", "sortOrder": 6},
            {"id": "completed", "name": "Заказ выполнен", "amoStageId": "", "amoPipelineId": "", "color": "#6b7280", "sortOrder": 7, "collapsed": True},
        ],
        "syncBackFields": [],
        "commentFieldId": "",
        "advanceFieldId": "",
        "remainingFieldId": "",
        "autoSyncEnabled": False,
        "autoSyncIntervalMinutes": 15,
        "lastSyncAt": None
    }


# ============== SETTINGS ==============

@router.get("/settings")
async def get_crm_settings():
    settings = await db.sauna_crm_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = get_default_settings()
        await db.sauna_crm_settings.insert_one(settings)
    return settings


@router.post("/settings")
async def save_crm_settings(settings: CRMSettings):
    settings_dict = settings.model_dump()
    await db.sauna_crm_settings.update_one({}, {"$set": settings_dict}, upsert=True)
    return {"status": "ok", "message": "Settings saved"}


@router.put("/settings/fields")
async def update_field_settings(fields: List[CRMFieldConfig]):
    fields_dict = [f.model_dump() for f in fields]
    await db.sauna_crm_settings.update_one({}, {"$set": {"fields": fields_dict}}, upsert=True)
    return {"status": "ok", "message": "Fields updated"}


@router.put("/settings/stages")
async def update_stage_settings(stages: List[CRMStageConfig]):
    stages_dict = [s.model_dump() for s in stages]
    await db.sauna_crm_settings.update_one({}, {"$set": {"stages": stages_dict}}, upsert=True)
    return {"status": "ok", "message": "Stages updated"}


# ============== LEADS CRUD ==============

@router.get("/leads")
async def get_all_leads(
    manager_username: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    query = {}
    # Manager filter: look up the user's amoCRM name, then filter leads by manager
    if manager_username:
        user = await db.users.find_one({"username": manager_username}, {"_id": 0})
        if user:
            amocrm_name = user.get("amocrm_name", "")
            if amocrm_name:
                query["manager"] = {"$regex": amocrm_name, "$options": "i"}
            else:
                # Fallback: match by username
                query["manager"] = {"$regex": manager_username, "$options": "i"}
    # Date filters — use field configured in settings (calendarDateField)
    if date_from or date_to:
        settings = await db.sauna_crm_settings.find_one({}, {"_id": 0})
        date_field = (settings or {}).get("calendarDateField") or "prepaymentDate"
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to + "T23:59:59"
        query[date_field] = date_q

    leads = await db.sauna_crm_leads.find(query, {"_id": 0}).to_list(1000)
    settings = await get_crm_settings()
    stages_data = {}
    for stage in settings.get("stages", []):
        stages_data[stage["id"]] = {"stage": stage, "leads": []}
    for lead in leads:
        sid = lead.get("stageId", "new")
        if sid in stages_data:
            stages_data[sid]["leads"].append(lead)
    return {"leads": leads, "byStage": stages_data, "settings": settings}


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: str):
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.post("/leads")
async def create_lead(lead: CRMLead):
    lead_dict = lead.model_dump()
    lead_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    lead_dict["stageHistory"] = [{"stageId": lead.stageId, "timestamp": lead_dict["createdAt"], "action": "created"}]
    await db.sauna_crm_leads.insert_one(lead_dict)
    lead_dict.pop("_id", None)
    return {"status": "ok", "lead": lead_dict}


@router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, data: dict):
    existing = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    now = datetime.now(timezone.utc).isoformat()
    data["updatedAt"] = now
    
    # Track stage change
    if "stageId" in data and existing.get("stageId") != data["stageId"]:
        history = existing.get("stageHistory", [])
        history.append({"fromStage": existing["stageId"], "toStage": data["stageId"], "timestamp": now, "action": "stage_changed"})
        data["stageHistory"] = history
        await sync_stage_to_amocrm(lead_id, data["stageId"])
    
    # Check if production dates changed — push to amoCRM
    production_date_fields = ["productionDate", "readyDate", "deliveryDate"]
    dates_changed = {}
    for df in production_date_fields:
        if df in data and data[df] != existing.get(df):
            dates_changed[df] = data[df]
    
    # Remove _id if present
    data.pop("_id", None)
    data.pop("id", None)
    
    await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": data})
    
    # Push changed production dates to amoCRM as a note
    if dates_changed and existing.get("amocrm_id"):
        await push_production_dates_to_amocrm(lead_id, existing["amocrm_id"], dates_changed)
    
    updated = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


@router.put("/leads/{lead_id}/acknowledge-changes")
async def acknowledge_changes(lead_id: str):
    """Mark amoCRM changes as reviewed by production."""
    result = await db.sauna_crm_leads.update_one(
        {"id": lead_id},
        {"$set": {"hasUnreviewedChanges": False, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"status": "ok"}



@router.post("/leads/{lead_id}/sync-from-amocrm")
async def sync_single_lead_from_amocrm(lead_id: str):
    """Fetch latest data for a specific lead from amoCRM and update it."""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    amocrm_id = lead.get("amocrm_id")
    if not amocrm_id:
        raise HTTPException(status_code=400, detail="Lead не привязан к amoCRM")
    
    amo = get_amo_settings_sync()
    domain = amo.get("amocrm_domain", "")
    token = amo.get("amocrm_token", "")
    if not domain or not token:
        raise HTTPException(status_code=400, detail="amoCRM не настроен")
    
    settings = await get_crm_settings()
    field_mappings = {f["amoFieldId"]: f["id"] for f in settings.get("fields", []) if f.get("amoFieldId") and not f["amoFieldId"].startswith("_")}
    
    CHANGE_LABELS = {
        "clientName": "Клиент", "modelName": "Модель", "phone": "Телефон",
        "manager": "Менеджер", "totalAmount": "Бюджет", "amoComment": "Комментарий менеджера",
        "advancePayment": "Аванс", "remainingAmount": "Остаток",
    }
    for fm in settings.get("fields", []):
        CHANGE_LABELS[fm["id"]] = fm["name"]
    
    try:
        headers_amo = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Fetch lead from amoCRM
            resp = await client.get(
                f"https://{domain}/api/v4/leads/{amocrm_id}?with=contacts",
                headers=headers_amo
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"amoCRM вернул ошибку: {resp.status_code}")
            
            amo_lead = resp.json()
            
            # Get contact info
            contact_name = ""
            contact_phone = ""
            contacts = (amo_lead.get("_embedded") or {}).get("contacts") or []
            if contacts:
                contact_id = contacts[0].get("id")
                if contact_id:
                    cr = await client.get(f"https://{domain}/api/v4/contacts/{contact_id}", headers=headers_amo)
                    if cr.status_code == 200:
                        contact_data = cr.json()
                        contact_name = contact_data.get("name", "")
                        for cf in (contact_data.get("custom_fields_values") or []):
                            if cf.get("field_code") == "PHONE":
                                vals = cf.get("values") or []
                                if vals:
                                    contact_phone = vals[0].get("value", "")
            
            # Get manager name
            manager_name = ""
            responsible_id = amo_lead.get("responsible_user_id")
            if responsible_id:
                ur = await client.get(f"https://{domain}/api/v4/users/{responsible_id}", headers=headers_amo)
                if ur.status_code == 200:
                    manager_name = ur.json().get("name", "")
            
            # Extract custom + standard fields
            custom_fields = amo_lead.get("custom_fields_values") or []
            field_vals, custom_client_name, custom_model_name = extract_standard_and_custom_fields(
                amo_lead, custom_fields, field_mappings, settings
            )
            
            comment_fid = settings.get("commentFieldId", "")
            
            # Build proposed changes
            now_ts = datetime.now(timezone.utc).isoformat()
            proposed = {}
            
            if custom_client_name:
                proposed["clientName"] = custom_client_name
            elif contact_name:
                proposed["clientName"] = contact_name
            if custom_model_name:
                proposed["modelName"] = custom_model_name
            if contact_phone:
                proposed["phone"] = contact_phone
            if manager_name:
                proposed["manager"] = manager_name
            proposed.update(field_vals)
            if amo_lead.get("price"):
                proposed["totalAmount"] = amo_lead["price"]
            
            # Extract advance/remaining from amoCRM
            adv_rem = extract_advance_remaining(amo_lead, custom_fields, settings)
            proposed.update(adv_rem)
            
            # Extract comment
            if comment_fid:
                for cf in custom_fields:
                    if str(cf.get("field_id", "")) == comment_fid:
                        vals = cf.get("values") or []
                        new_comment = vals[0].get("value", "") if vals else ""
                        if new_comment != lead.get("amoComment", ""):
                            proposed["amoComment"] = new_comment
                        break
            
            # Detect changes
            change_entries = []
            for key, new_val in proposed.items():
                old_val = lead.get(key, "")
                if str(new_val) != str(old_val) and new_val:
                    change_entries.append({
                        "field": key,
                        "label": CHANGE_LABELS.get(key, key),
                        "oldValue": str(old_val) if old_val else "",
                        "newValue": str(new_val),
                        "timestamp": now_ts,
                        "source": "amocrm"
                    })
            
            update_data = {"updatedAt": now_ts, "amocrm_link": f"https://{domain}/leads/detail/{amocrm_id}"}
            update_data.update(proposed)
            
            if change_entries:
                change_log = lead.get("changeLog", [])
                change_log.extend(change_entries)
                update_data["changeLog"] = change_log[-100:]
                update_data["hasUnreviewedChanges"] = True
            
            await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": update_data})
            
            # If lead has no KP — try to find and link it
            kp_linked = False
            has_kp = any(d.get("type") == "kp" for d in lead.get("documents", []))
            has_pdf_url = bool(lead.get("calculatorPdfUrl"))
            if not has_kp and not has_pdf_url:
                lead_copy = {**lead, **update_data}
                link_result = await link_calculator_order(amocrm_id, lead_copy)
                if link_result.get("pdf_attached") or link_result.get("linked"):
                    link_update = {}
                    for lf in ["calculatorOrderId", "calculatorCollection", "calculatorPdfUrl", "documents"]:
                        if lead_copy.get(lf):
                            link_update[lf] = lead_copy[lf]
                    if link_update:
                        await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": link_update})
                        kp_linked = True
                        logger.info(f"KP linked during single-lead sync: {lead_id}")
            
            logger.info(f"Single lead sync from amoCRM: {lead_id}, changes: {[e['label'] for e in change_entries]}")
            
            changed_fields = [e["label"] for e in change_entries]
            if kp_linked:
                changed_fields.append("КП (подтянуто)")
            
            return {
                "status": "ok",
                "changes": len(change_entries) + (1 if kp_linked else 0),
                "changedFields": changed_fields,
                "kpLinked": kp_linked
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing single lead from amoCRM: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@router.put("/leads/{lead_id}/stage")
async def change_lead_stage(lead_id: str, stage_id: str = Query(...)):
    existing = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    now = datetime.now(timezone.utc).isoformat()
    history = existing.get("stageHistory", [])
    history.append({"fromStage": existing.get("stageId"), "toStage": stage_id, "timestamp": now, "action": "stage_changed"})
    await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": {"stageId": stage_id, "updatedAt": now, "stageHistory": history}})
    await sync_stage_to_amocrm(lead_id, stage_id)
    updated = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    result = await db.sauna_crm_leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"status": "ok"}


# ============== DOCUMENTS ==============

@router.post("/leads/{lead_id}/documents")
async def upload_document(
    lead_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form("other"),  # kp, contract, invoice, other
    doc_name: str = Form("")
):
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    file_bytes = await file.read()
    filename = file.filename or "document"
    display_name = doc_name or filename
    
    # Upload to Cloudinary
    cloudinary_url = None
    if is_cloudinary_configured():
        try:
            is_pdf = filename.lower().endswith('.pdf')
            if is_pdf:
                result = await cloudinary_upload_pdf(file_bytes, filename)
            else:
                from services.cloudinary_service import upload_image
                result = await upload_image(file_bytes, filename, folder="wm-calculator/crm-docs")
            if result and result.get("url"):
                cloudinary_url = result["url"]
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
    
    if not cloudinary_url:
        raise HTTPException(status_code=500, detail="Failed to upload file")
    
    doc = {
        "id": str(uuid.uuid4())[:8],
        "type": doc_type,
        "name": display_name,
        "url": cloudinary_url,
        "filename": filename,
        "uploadedAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sauna_crm_leads.update_one({"id": lead_id}, {"$push": {"documents": doc}})
    
    # Send link to amoCRM as note
    if lead.get("amocrm_id"):
        amo = get_amo_settings_sync()
        domain = amo.get("amocrm_domain", "")
        token = amo.get("amocrm_token", "")
        if domain and token:
            type_labels = {"kp": "КП", "contract": "Договор", "invoice": "Счёт", "other": "Документ"}
            note_text = f"📄 Загружен документ: {type_labels.get(doc_type, doc_type)}\n{display_name}\n{cloudinary_url}"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"https://{domain}/api/v4/leads/{lead['amocrm_id']}/notes",
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        json=[{"note_type": "common", "params": {"text": note_text}}]
                    )
            except Exception as e:
                logger.error(f"Failed to send doc note to amoCRM: {e}")
    
    return {"status": "ok", "document": doc}


@router.delete("/leads/{lead_id}/documents/{doc_id}")
async def delete_document(lead_id: str, doc_id: str):
    await db.sauna_crm_leads.update_one(
        {"id": lead_id},
        {"$pull": {"documents": {"id": doc_id}}}
    )
    return {"status": "ok"}


@router.post("/leads/{lead_id}/documents/link")
async def link_document(lead_id: str, data: dict):
    """Add a document by URL (no file upload needed). Used after PDF generation."""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    url = data.get("url", "")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    doc = {
        "id": str(uuid.uuid4())[:8],
        "type": data.get("type", "kp"),
        "name": data.get("name", "Коммерческое предложение"),
        "url": url,
        "filename": data.get("filename", ""),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "orderId": data.get("orderId"),
    }

    await db.sauna_crm_leads.update_one({"id": lead_id}, {"$push": {"documents": doc}})

    return {"status": "ok", "document": doc}


# ============== CALENDAR ==============

@router.get("/calendar")
async def get_calendar_data(month: int = Query(...), year: int = Query(...)):
    """Get orders for production calendar grouped by configured date field."""
    settings = await db.sauna_crm_settings.find_one({}, {"_id": 0})
    date_field = (settings or {}).get("calendarDateField") or "prepaymentDate"
    
    leads = await db.sauna_crm_leads.find(
        {date_field: {"$exists": True, "$ne": None, "$nin": [""]}},
        {"_id": 0}
    ).to_list(5000)
    
    # Filter by month/year and group by date
    by_date = {}
    for lead in leads:
        rd = lead.get(date_field, "")
        if not rd:
            continue
        try:
            dt = datetime.fromisoformat(rd.replace("Z", "+00:00")) if "T" in rd else datetime.strptime(rd[:10], "%Y-%m-%d")
            if dt.month == month and dt.year == year:
                date_key = dt.strftime("%Y-%m-%d")
                if date_key not in by_date:
                    by_date[date_key] = []
                by_date[date_key].append({
                    "id": lead.get("id"),
                    "clientName": lead.get("clientName", ""),
                    "modelName": lead.get("modelName") or lead.get("field_1", ""),
                    "dateValue": rd,
                    "stageId": lead.get("stageId"),
                    "totalAmount": lead.get("totalAmount") or lead.get("field_2"),
                    "phone": lead.get("phone", ""),
                })
        except (ValueError, TypeError):
            continue
    
    return {"month": month, "year": year, "byDate": by_date, "totalOrders": sum(len(v) for v in by_date.values())}



@router.get("/debug-kp/{amocrm_id}")
async def debug_kp_linking(amocrm_id: str):
    """Debug endpoint to check why KP is not linking for a specific amoCRM lead."""
    result = {"amocrm_id": amocrm_id, "checks": {}}

    # 1. Check sauna_orders
    for coll in ["sauna_orders", "balia_orders", "greenhouse_orders"]:
        order = await db[coll].find_one({"amocrm_id": amocrm_id}, {"_id": 0, "id": 1, "modelName": 1, "amocrm_id": 1})
        if order:
            result["checks"]["calculator_order"] = {"found": True, "collection": coll, "order_id": order.get("id"), "amocrm_id_stored": order.get("amocrm_id")}
            break
    else:
        result["checks"]["calculator_order"] = {"found": False}

    # 2. Check calculator_pdfs by amocrm_id
    pdf_by_amo = await db["calculator_pdfs"].find_one({"amocrm_id": amocrm_id}, {"_id": 0, "pdf_data": 0})
    if pdf_by_amo:
        result["checks"]["pdf_by_amocrm_id"] = {"found": True, "order_id": pdf_by_amo.get("order_id"), "has_cloudinary": bool(pdf_by_amo.get("cloudinary_url")), "cloudinary_url": pdf_by_amo.get("cloudinary_url", ""), "filename": pdf_by_amo.get("filename", "")}
    else:
        result["checks"]["pdf_by_amocrm_id"] = {"found": False}

    # 3. Check calculator_pdfs by order_id (if we found the order)
    order_id = result["checks"].get("calculator_order", {}).get("order_id", "")
    if order_id:
        pdf_by_order = await db["calculator_pdfs"].find_one({"order_id": order_id}, {"_id": 0, "pdf_data": 0})
        if pdf_by_order:
            result["checks"]["pdf_by_order_id"] = {"found": True, "amocrm_id_stored": pdf_by_order.get("amocrm_id"), "has_cloudinary": bool(pdf_by_order.get("cloudinary_url")), "cloudinary_url": pdf_by_order.get("cloudinary_url", ""), "filename": pdf_by_order.get("filename", "")}
        else:
            result["checks"]["pdf_by_order_id"] = {"found": False, "searched_order_id": order_id}

    # 4. Check CRM lead
    crm_lead = await db["sauna_crm_leads"].find_one({"amocrm_id": amocrm_id}, {"_id": 0, "id": 1, "calculatorOrderId": 1, "calculatorPdfUrl": 1, "documents": 1})
    if crm_lead:
        has_kp = any(d.get("type") == "kp" for d in crm_lead.get("documents", []))
        result["checks"]["crm_lead"] = {"found": True, "crm_id": crm_lead.get("id"), "calculatorOrderId": crm_lead.get("calculatorOrderId"), "calculatorPdfUrl": crm_lead.get("calculatorPdfUrl"), "has_kp_doc": has_kp, "doc_count": len(crm_lead.get("documents", []))}
    else:
        result["checks"]["crm_lead"] = {"found": False}

    # 5. List ALL documents in calculator_pdfs (count + last 3)
    total_pdfs = await db["calculator_pdfs"].count_documents({})
    recent_pdfs = await db["calculator_pdfs"].find({}, {"_id": 0, "pdf_data": 0}).sort("created_at", -1).limit(3).to_list(3)
    result["checks"]["calculator_pdfs_stats"] = {"total_count": total_pdfs, "recent": [{"order_id": p.get("order_id"), "amocrm_id": p.get("amocrm_id"), "has_cloudinary": bool(p.get("cloudinary_url")), "created_at": p.get("created_at")} for p in recent_pdfs]}

    return result


# ============== CALCULATOR LINK ==============

async def link_calculator_order(amocrm_id: str, crm_lead: dict) -> dict:
    """Find calculator order by amocrm_id and attach PDF as document."""
    result = {"linked": False, "pdf_attached": False}
    now = datetime.now(timezone.utc).isoformat()

    try:
        # Search across all calculator order collections
        calc_order = None
        for collection_name in ["sauna_orders", "balia_orders", "greenhouse_orders"]:
            calc_order = await db[collection_name].find_one(
                {"amocrm_id": amocrm_id},
                {"_id": 0, "id": 1, "fullName": 1, "modelName": 1, "totalAmount": 1, "kpCloudinaryUrl": 1}
            )
            if calc_order:
                crm_lead["calculatorOrderId"] = calc_order.get("id")
                crm_lead["calculatorCollection"] = collection_name
                if calc_order.get("modelName"):
                    crm_lead["modelName"] = calc_order["modelName"]
                result["linked"] = True
                logger.info(f"Calculator order linked: amocrm_id={amocrm_id}, order_id={calc_order.get('id')}, collection={collection_name}, has_kpUrl={bool(calc_order.get('kpCloudinaryUrl'))}")
                break

        # Search for PDF using motor async (same client as rest of the app)
        pdf_doc = None
        try:
            pdf_doc = await db["calculator_pdfs"].find_one(
                {"amocrm_id": amocrm_id},
                {"pdf_data": 0}
            )
            if pdf_doc:
                logger.info(f"PDF found by amocrm_id={amocrm_id}, has_cloudinary={bool(pdf_doc.get('cloudinary_url'))}")

            if not pdf_doc and crm_lead.get("calculatorOrderId"):
                pdf_doc = await db["calculator_pdfs"].find_one(
                    {"order_id": crm_lead["calculatorOrderId"]},
                    {"pdf_data": 0}
                )
                if pdf_doc:
                    logger.info(f"PDF found by order_id={crm_lead['calculatorOrderId']}, has_cloudinary={bool(pdf_doc.get('cloudinary_url'))}")

            if not pdf_doc:
                logger.info(f"No PDF found in calculator_pdfs for amocrm_id={amocrm_id}, order_id={crm_lead.get('calculatorOrderId')}")
        except Exception as e:
            logger.warning(f"calculator_pdfs query error (non-fatal): {e}")

        # Determine PDF URL
        cloudinary_url = None
        if pdf_doc:
            cloudinary_url = pdf_doc.get("cloudinary_url")

            if not cloudinary_url:
                # Check webhook_logs for cloudinary URL
                try:
                    log_entry = await db["webhook_logs"].find_one(
                        {"type": "calculator_pdf_upload", "amocrm_id": amocrm_id, "cloudinary_url": {"$exists": True, "$ne": None}},
                        {"_id": 0, "cloudinary_url": 1},
                        sort=[("timestamp", -1)]
                    )
                    if log_entry:
                        cloudinary_url = log_entry.get("cloudinary_url")
                except Exception:
                    pass

            if not cloudinary_url and crm_lead.get("calculatorOrderId"):
                try:
                    log_entry = await db["webhook_logs"].find_one(
                        {"type": "calculator_pdf_upload", "order_id": crm_lead["calculatorOrderId"], "cloudinary_url": {"$exists": True, "$ne": None}},
                        {"_id": 0, "cloudinary_url": 1},
                        sort=[("timestamp", -1)]
                    )
                    if log_entry:
                        cloudinary_url = log_entry.get("cloudinary_url")
                except Exception:
                    pass

        if cloudinary_url:
            pdf_url = cloudinary_url
        elif calc_order and calc_order.get("kpCloudinaryUrl"):
            # Fallback: use kpCloudinaryUrl stored directly on the calculator order
            pdf_url = calc_order["kpCloudinaryUrl"]
            logger.info(f"Using kpCloudinaryUrl from order for amocrm_id={amocrm_id}")
        elif pdf_doc:
            # Fallback: use download URL via API endpoint
            dl_order_id = pdf_doc.get("order_id") or crm_lead.get("calculatorOrderId", "")
            if dl_order_id:
                base_url = os.environ.get("APP_DOMAIN", "")
                if base_url:
                    base_url = f"https://{base_url}"
                else:
                    try:
                        with open("/app/frontend/.env", "r") as f:
                            for line in f:
                                if line.startswith("REACT_APP_BACKEND_URL="):
                                    base_url = line.strip().split("=", 1)[1]
                                    break
                    except Exception:
                        base_url = ""
                pdf_url = f"{base_url}/api/integrations/amocrm/calculator-pdf/{dl_order_id}" if base_url else None
            else:
                pdf_url = None
        else:
            pdf_url = None

        if pdf_url:
            crm_lead["documents"] = [d for d in crm_lead.get("documents", []) if d.get("type") != "kp"]
            pdf_document = {
                "id": str(uuid.uuid4())[:8],
                "type": "kp",
                "name": f"КП {crm_lead.get('clientName', '')}".strip(),
                "url": pdf_url,
                "filename": pdf_doc.get("filename", "КП.pdf") if pdf_doc else "КП.pdf",
                "uploadedAt": now,
                "source": "calculator_auto"
            }
            crm_lead["documents"].append(pdf_document)
            crm_lead["calculatorPdfUrl"] = pdf_url
            result["pdf_attached"] = True
            logger.info(f"KP attached: amocrm_id={amocrm_id}, url_type={'cloudinary' if cloudinary_url else 'download'}")
        elif result["linked"]:
            logger.info(f"Order linked but no PDF found for amocrm_id={amocrm_id}")
    except Exception as e:
        logger.error(f"Error linking calculator order: {e}")

    return result


# ============== AMOCRM SYNC ==============

PRODUCTION_DATE_LABELS = {
    "productionDate": "Дата производства",
    "readyDate": "Дата готовности",
    "deliveryDate": "Дата доставки",
}


# Standard amoCRM field IDs (prefix with _)
STANDARD_AMO_FIELDS = {
    "_budget": lambda lead: lead.get("price"),
    "_name": lambda lead: lead.get("name"),
    "_responsible": lambda lead: None,  # handled separately via responsible_user_id
}


def extract_standard_and_custom_fields(amo_lead, custom_fields, field_mappings, settings):
    """Extract field values from both standard and custom amoCRM fields."""
    field_vals = {}
    custom_client_name = ""
    custom_model_name = ""

    client_name_fid = settings.get("clientNameFieldId", "")
    model_fid = settings.get("modelFieldId", "")

    # Build field type lookup: field_id -> fieldType
    field_types = {}
    for f in settings.get("fields", []):
        field_types[f["id"]] = f.get("fieldType", "text")

    # 1) Process custom fields from amoCRM
    for cf in (custom_fields or []):
        fid = str(cf.get("field_id", ""))
        vals = cf.get("values") or []
        val = vals[0].get("value", "") if vals else ""

        if fid == client_name_fid:
            custom_client_name = val
        elif fid == model_fid:
            custom_model_name = val
        elif fid in field_mappings:
            crm_field_id = field_mappings[fid]
            # Convert Unix timestamp to date string for date fields
            if field_types.get(crm_field_id) == "date" and val:
                val = _convert_amo_timestamp_to_date(val)
            field_vals[crm_field_id] = val

    # 2) Process standard field mappings (amoFieldId starts with _)
    all_fields = settings.get("fields", [])
    for f in all_fields:
        amo_fid = f.get("amoFieldId", "")
        if amo_fid in STANDARD_AMO_FIELDS and f.get("enabled", True):
            extractor = STANDARD_AMO_FIELDS[amo_fid]
            val = extractor(amo_lead)
            if val is not None:
                field_vals[f["id"]] = val

    return field_vals, custom_client_name, custom_model_name


def _convert_amo_timestamp_to_date(val) -> str:
    """Convert amoCRM Unix timestamp to YYYY-MM-DD date string.
    amoCRM stores dates as midnight in the user's timezone.
    We use Europe/Warsaw since this is a Polish business app."""
    try:
        ts = int(str(val).split(".")[0])
        if ts > 1000000000:  # Looks like a Unix timestamp
            try:
                from zoneinfo import ZoneInfo
                dt = datetime.fromtimestamp(ts, tz=ZoneInfo("Europe/Warsaw"))
            except Exception:
                # Fallback: add 4 hours to compensate for CET/CEST offset
                dt = datetime.fromtimestamp(ts + 14400, tz=timezone.utc)
            return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError, OSError):
        pass
    return str(val)


def extract_advance_remaining(amo_lead, custom_fields, settings):
    """Extract advancePayment and remainingAmount from amoCRM custom fields."""
    advance_fid = settings.get("advanceFieldId", "")
    remaining_fid = settings.get("remainingFieldId", "")
    result = {}
    
    for cf in (custom_fields or []):
        fid = str(cf.get("field_id", ""))
        vals = cf.get("values") or []
        val = vals[0].get("value", "") if vals else ""
        
        if advance_fid and fid == advance_fid and val:
            try:
                result["advancePayment"] = float(str(val).replace(" ", "").replace(",", "."))
            except (ValueError, TypeError):
                result["advancePayment"] = val
        
        if remaining_fid and fid == remaining_fid and val:
            try:
                result["remainingAmount"] = float(str(val).replace(" ", "").replace(",", "."))
            except (ValueError, TypeError):
                result["remainingAmount"] = val
    
    # Auto-calculate remaining if we have total and advance but no remaining field
    if "advancePayment" in result and "remainingAmount" not in result:
        total = amo_lead.get("price") or 0
        try:
            result["remainingAmount"] = float(total) - float(result["advancePayment"])
        except (ValueError, TypeError):
            pass
    
    return result



async def push_production_dates_to_amocrm(lead_id: str, amocrm_id: str, dates_changed: dict):
    """Push production dates to amoCRM as a note + via syncBackFields custom fields."""
    try:
        amo = get_amo_settings_sync()
        domain = amo.get("amocrm_domain", "")
        token = amo.get("amocrm_token", "")
        if not domain or not token:
            logger.info("Production dates push skipped: amoCRM credentials not configured")
            return
        
        # 1) Push as a note to amoCRM — managers always see it
        lines = ["Обновление дат производства:"]
        for field_key, value in dates_changed.items():
            label = PRODUCTION_DATE_LABELS.get(field_key, field_key)
            lines.append(f"  {label}: {value or '—'}")
        note_text = "\n".join(lines)
        
        await add_note_to_amocrm(amocrm_id, note_text, domain, token)
        logger.info(f"Production dates note sent to amoCRM: lead={lead_id}, amocrm_id={amocrm_id}, fields={list(dates_changed.keys())}")
        
        # 2) Also push via syncBackFields if configured
        settings = await get_crm_settings()
        sync_back = settings.get("syncBackFields", [])
        if sync_back:
            custom_fields = []
            for mapping in sync_back:
                fid = mapping.get("fieldId", "")
                amo_fid = mapping.get("amoFieldId", "")
                if fid in dates_changed and amo_fid:
                    val = dates_changed[fid]
                    if val:
                        custom_fields.append({"field_id": int(amo_fid), "values": [{"value": str(val)}]})
            if custom_fields:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.patch(
                        f"https://{domain}/api/v4/leads/{amocrm_id}",
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        json={"custom_fields_values": custom_fields}
                    )
                    if resp.status_code == 200:
                        logger.info(f"Production dates synced to amoCRM custom fields: lead={lead_id}")
                    else:
                        logger.error(f"amoCRM custom fields sync failed: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        logger.error(f"Error pushing production dates to amoCRM: {e}")


async def sync_stage_to_amocrm(lead_id: str, stage_id: str):
    """Sync stage change to amoCRM — moves the lead card to the mapped pipeline stage."""
    try:
        lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead or not lead.get("amocrm_id"):
            logger.info(f"Stage sync skipped: lead {lead_id} has no amocrm_id")
            return
        settings = await get_crm_settings()
        stage_config = next((s for s in settings.get("stages", []) if s["id"] == stage_id), None)
        if not stage_config or not stage_config.get("amoStageId"):
            logger.info(f"Stage sync skipped: stage '{stage_id}' has no amoStageId mapping")
            return
        if not stage_config.get("amoPipelineId"):
            logger.info(f"Stage sync skipped: stage '{stage_id}' has no amoPipelineId mapping")
            return
        amo = get_amo_settings_sync()
        domain = amo.get("amocrm_domain", "")
        token = amo.get("amocrm_token", "")
        if not domain or not token:
            logger.info("Stage sync skipped: amoCRM credentials not configured")
            return
        payload = {
            "status_id": int(stage_config["amoStageId"]),
            "pipeline_id": int(stage_config["amoPipelineId"])
        }
        logger.info(f"Syncing stage to amoCRM: lead={lead_id}, amocrm_id={lead['amocrm_id']}, pipeline_id={payload['pipeline_id']}, status_id={payload['status_id']}")
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.patch(
                f"https://{domain}/api/v4/leads/{lead['amocrm_id']}",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload
            )
            if resp.status_code == 200:
                await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": {"lastAmoSyncAt": datetime.now(timezone.utc).isoformat()}})
                logger.info(f"amoCRM stage sync OK: lead={lead_id} moved to pipeline={payload['pipeline_id']} stage={payload['status_id']}")
            else:
                logger.error(f"amoCRM stage sync failed: lead={lead_id}, status={resp.status_code}, body={resp.text[:200]}")
    except Exception as e:
        logger.error(f"Error syncing stage to amoCRM: {e}")


@router.post("/sync-from-amocrm")
async def sync_leads_from_amocrm(background_tasks: BackgroundTasks):
    """Import leads from amoCRM based on configured stages. Runs in background to avoid timeout."""
    settings = await get_crm_settings()
    amo = get_amo_settings_sync()
    domain = amo.get("amocrm_domain", "")
    token = amo.get("amocrm_token", "")
    if not domain or not token:
        raise HTTPException(status_code=400, detail="amoCRM не настроен")

    # Check if sync is already running
    existing_sync = await db.sauna_crm_sync_status.find_one({"status": "running"}, {"_id": 0})
    if existing_sync:
        return {"status": "already_running", "message": "Синхронизация уже выполняется", "syncId": existing_sync.get("syncId")}

    sync_id = f"sync-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    # Create sync status document
    await db.sauna_crm_sync_status.delete_many({})  # Clean old statuses
    await db.sauna_crm_sync_status.insert_one({
        "syncId": sync_id,
        "status": "running",
        "startedAt": now,
        "imported": 0,
        "updated": 0,
        "errors": 0,
        "totalStages": len([s for s in settings.get("stages", []) if s.get("amoStageId") and s.get("amoPipelineId")]),
        "processedStages": 0,
        "currentStage": "",
        "message": "Запуск синхронизации..."
    })

    # Launch background task
    background_tasks.add_task(
        _run_sync_background, sync_id, settings, domain, token
    )

    return {"status": "accepted", "message": "Синхронизация запущена в фоновом режиме", "syncId": sync_id}


@router.get("/sync-status")
async def get_sync_status():
    """Get current sync progress."""
    status = await db.sauna_crm_sync_status.find_one({}, {"_id": 0})
    if not status:
        return {"status": "idle", "message": "Нет активных синхронизаций"}
    return status


async def _run_sync_background(sync_id: str, settings: dict, domain: str, token: str):
    """Background task for mass sync from amoCRM."""
    imported = 0
    updated = 0
    errors = 0

    try:
        headers_amo = {"Authorization": f"Bearer {token}"}
        field_mappings = {f["amoFieldId"]: f["id"] for f in settings.get("fields", []) if f.get("amoFieldId") and not f["amoFieldId"].startswith("_")}

        # Cache users for manager names
        users_cache = {}
        try:
            async with httpx.AsyncClient(timeout=15.0) as uc:
                ur = await uc.get(f"https://{domain}/api/v4/users", headers=headers_amo)
                if ur.status_code == 200:
                    for u in (ur.json().get("_embedded") or {}).get("users") or []:
                        users_cache[u["id"]] = u.get("name", "")
        except Exception as e:
            logger.warning(f"Failed to cache amoCRM users: {e}")

        mapped_stages = [s for s in settings.get("stages", []) if s.get("amoStageId") and s.get("amoPipelineId")]

        for stage_idx, stage in enumerate(mapped_stages):
            stage_name = stage.get("name", stage["id"])
            await db.sauna_crm_sync_status.update_one(
                {"syncId": sync_id},
                {"$set": {"currentStage": stage_name, "processedStages": stage_idx, "message": f"Этап: {stage_name}..."}}
            )

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(
                        f"https://{domain}/api/v4/leads",
                        headers=headers_amo,
                        params={
                            "filter[statuses][0][status_id]": stage["amoStageId"],
                            "filter[statuses][0][pipeline_id]": stage["amoPipelineId"],
                            "with": "contacts",
                            "limit": 250
                        }
                    )

                    if resp.status_code == 204:
                        continue
                    if resp.status_code != 200:
                        logger.error(f"amoCRM API error for stage {stage_name}: {resp.status_code}")
                        errors += 1
                        continue

                    resp_data = resp.json() or {}
                    leads_data = (resp_data.get("_embedded") or {}).get("leads") or []

                    # Process leads in batches with limited concurrency
                    batch_size = 5
                    for i in range(0, len(leads_data), batch_size):
                        batch = leads_data[i:i + batch_size]
                        tasks = []
                        for amo_lead in batch:
                            tasks.append(
                                _process_single_amo_lead(
                                    amo_lead, stage, domain, token, headers_amo,
                                    field_mappings, settings, users_cache
                                )
                            )
                        results = await asyncio.gather(*tasks, return_exceptions=True)
                        for r in results:
                            if isinstance(r, Exception):
                                logger.error(f"Error processing lead in batch: {r}")
                                errors += 1
                            elif r == "imported":
                                imported += 1
                            elif r == "updated":
                                updated += 1

                        # Update progress after each batch
                        await db.sauna_crm_sync_status.update_one(
                            {"syncId": sync_id},
                            {"$set": {"imported": imported, "updated": updated, "errors": errors,
                                      "message": f"Этап: {stage_name} ({i + len(batch)}/{len(leads_data)})..."}}
                        )

            except Exception as e:
                logger.error(f"Error processing stage {stage_name}: {e}")
                errors += 1

        # Finalize
        now = datetime.now(timezone.utc).isoformat()
        await db.sauna_crm_settings.update_one({}, {"$set": {"lastSyncAt": now}}, upsert=True)
        await db.sauna_crm_sync_status.update_one(
            {"syncId": sync_id},
            {"$set": {
                "status": "completed",
                "completedAt": now,
                "imported": imported,
                "updated": updated,
                "errors": errors,
                "processedStages": len(mapped_stages),
                "currentStage": "",
                "message": f"Импортировано: {imported}, обновлено: {updated}" + (f", ошибок: {errors}" if errors else "")
            }}
        )
        logger.info(f"Sync completed: imported={imported}, updated={updated}, errors={errors}")

    except Exception as e:
        logger.error(f"Background sync fatal error: {e}")
        await db.sauna_crm_sync_status.update_one(
            {"syncId": sync_id},
            {"$set": {"status": "error", "message": f"Ошибка: {str(e)}", "completedAt": datetime.now(timezone.utc).isoformat()}}
        )


async def _process_single_amo_lead(
    amo_lead: dict, stage: dict, domain: str, token: str, headers_amo: dict,
    field_mappings: dict, settings: dict, users_cache: dict
) -> str:
    """Process a single amoCRM lead during bulk sync. Returns 'imported', 'updated', or raises."""
    amo_id = str(amo_lead["id"])

    existing = await db.sauna_crm_leads.find_one({"amocrm_id": amo_id})

    # Extract custom + standard fields
    custom_fields = amo_lead.get("custom_fields_values") or []
    field_vals, custom_client_name, custom_model_name = extract_standard_and_custom_fields(
        amo_lead, custom_fields, field_mappings, settings
    )

    # Extract contacts
    amo_embedded = amo_lead.get("_embedded") or {}
    contacts = amo_embedded.get("contacts") or []
    contact_name = contacts[0].get("name", "") if contacts else ""
    contact_phone = ""
    if contacts:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                cr = await client.get(f"https://{domain}/api/v4/contacts/{contacts[0]['id']}", headers=headers_amo)
                if cr.status_code == 200:
                    for cf in (cr.json().get("custom_fields_values") or []):
                        if cf.get("field_code") == "PHONE" and (cf.get("values") or []):
                            contact_phone = cf["values"][0].get("value", "")
                            break
        except Exception:
            pass

    # Get manager name
    responsible_id = amo_lead.get("responsible_user_id")
    manager_name = users_cache.get(responsible_id, "") if responsible_id else ""

    if existing:
        now_ts = datetime.now(timezone.utc).isoformat()
        update_data = {"updatedAt": now_ts}

        proposed = {}
        if custom_client_name:
            proposed["clientName"] = custom_client_name
        elif contact_name:
            proposed["clientName"] = contact_name
        if custom_model_name:
            proposed["modelName"] = custom_model_name
        if contact_phone:
            proposed["phone"] = contact_phone
        if manager_name:
            proposed["manager"] = manager_name
        proposed.update(field_vals)
        if amo_lead.get("price"):
            proposed["totalAmount"] = amo_lead["price"]

        adv_rem = extract_advance_remaining(amo_lead, custom_fields, settings)
        proposed.update(adv_rem)

        comment_fid = settings.get("commentFieldId", "")
        if comment_fid:
            for cf in (custom_fields or []):
                if str(cf.get("field_id", "")) == comment_fid:
                    vals = cf.get("values") or []
                    new_comment = vals[0].get("value", "") if vals else ""
                    if new_comment != existing.get("amoComment", ""):
                        proposed["amoComment"] = new_comment
                    break

        CHANGE_LABELS = {
            "clientName": "Клиент", "modelName": "Модель", "phone": "Телефон",
            "manager": "Менеджер", "totalAmount": "Бюджет", "amoComment": "Комментарий менеджера",
            "stageId": "Этап", "advancePayment": "Аванс", "remainingAmount": "Остаток",
        }
        for fm in settings.get("fields", []):
            CHANGE_LABELS[fm["id"]] = fm["name"]

        change_entries = []
        for key, new_val in proposed.items():
            old_val = existing.get(key, "")
            if str(new_val) != str(old_val) and new_val:
                change_entries.append({
                    "field": key,
                    "label": CHANGE_LABELS.get(key, key),
                    "oldValue": str(old_val) if old_val else "",
                    "newValue": str(new_val),
                    "timestamp": now_ts,
                    "source": "amocrm"
                })

        update_data.update(proposed)

        current_stage_id = existing.get("stageId", "")
        if current_stage_id != stage["id"]:
            update_data["stageId"] = stage["id"]
            history = existing.get("stageHistory", [])
            history.append({
                "fromStage": current_stage_id,
                "toStage": stage["id"],
                "timestamp": now_ts,
                "action": "synced_from_amocrm"
            })
            update_data["stageHistory"] = history
            stage_names = {s["id"]: s["name"] for s in settings.get("stages", [])}
            change_entries.append({
                "field": "stageId",
                "label": "Этап",
                "oldValue": stage_names.get(current_stage_id, current_stage_id),
                "newValue": stage_names.get(stage["id"], stage["id"]),
                "timestamp": now_ts,
                "source": "amocrm"
            })

        if change_entries:
            change_log = existing.get("changeLog", [])
            change_log.extend(change_entries)
            update_data["changeLog"] = change_log[-100:]
            update_data["hasUnreviewedChanges"] = True
            logger.info(f"amoCRM changes detected for lead {existing.get('id')}: {[e['label'] for e in change_entries]}")

        update_data["amocrm_link"] = f"https://{domain}/leads/detail/{amo_id}"
        await db.sauna_crm_leads.update_one({"amocrm_id": amo_id}, {"$set": update_data})

        # KP linking for existing leads
        has_kp = any(d.get("type") == "kp" for d in existing.get("documents", []))
        has_pdf_url = bool(existing.get("calculatorPdfUrl"))
        if not has_kp and not has_pdf_url:
            lead_copy = {**existing, **update_data}
            link_result = await link_calculator_order(amo_id, lead_copy)
            if link_result.get("pdf_attached") or link_result.get("linked"):
                link_update = {}
                for lf in ["calculatorOrderId", "calculatorCollection", "calculatorPdfUrl", "documents"]:
                    if lead_copy.get(lf):
                        link_update[lf] = lead_copy[lf]
                if link_update:
                    await db.sauna_crm_leads.update_one({"amocrm_id": amo_id}, {"$set": link_update})
                    logger.info(f"KP linked to existing lead during sync: amocrm_id={amo_id}")

        return "updated"
    else:
        # Extract advance/remaining for new leads
        adv_rem = extract_advance_remaining(amo_lead, custom_fields, settings)

        # Extract comment for new leads
        comment_fid = settings.get("commentFieldId", "")
        amo_comment = ""
        if comment_fid:
            for cf in (custom_fields or []):
                if str(cf.get("field_id", "")) == comment_fid:
                    vals = cf.get("values") or []
                    amo_comment = vals[0].get("value", "") if vals else ""
                    break

        new_lead = {
            "id": f"CRM-{uuid.uuid4().hex[:8].upper()}",
            "stageId": stage["id"],
            "clientName": custom_client_name or contact_name or amo_lead.get("name", ""),
            "modelName": custom_model_name or "",
            "phone": contact_phone,
            "email": "",
            "address": "",
            "manager": manager_name,
            "amocrm_id": amo_id,
            "amocrm_link": f"https://{domain}/leads/detail/{amo_id}",
            "totalAmount": amo_lead.get("price"),
            "documents": [],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "stageHistory": [{"stageId": stage["id"], "timestamp": datetime.now(timezone.utc).isoformat(), "action": "imported_from_amocrm"}],
            "changeLog": [],
            "hasUnreviewedChanges": False,
            "amoComment": amo_comment,
            "notes": "",
            "isImportant": False,
            **field_vals,
            **adv_rem
        }

        await link_calculator_order(amo_id, new_lead)
        await db.sauna_crm_leads.insert_one(new_lead)
        return "imported"


@router.post("/leads/{lead_id}/sync-to-amocrm")
async def sync_lead_to_amocrm(lead_id: str):
    """Push lead changes back to amoCRM (ready date, comments)."""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead or not lead.get("amocrm_id"):
        raise HTTPException(status_code=400, detail="Lead not linked to amoCRM")
    
    settings = await get_crm_settings()
    amo = get_amo_settings_sync()
    domain = amo.get("amocrm_domain", "")
    token = amo.get("amocrm_token", "")
    if not domain or not token:
        raise HTTPException(status_code=400, detail="amoCRM не настроен")
    
    sync_back = settings.get("syncBackFields", [])
    if not sync_back:
        raise HTTPException(status_code=400, detail="Не настроены поля для синхронизации обратно")
    
    custom_fields = []
    for mapping in sync_back:
        field_id = mapping.get("fieldId", "")
        amo_field_id = mapping.get("amoFieldId", "")
        if not field_id or not amo_field_id:
            continue
        value = lead.get(field_id, "")
        if value:
            custom_fields.append({"field_id": int(amo_field_id), "values": [{"value": str(value)}]})
    
    # Also send notes as a comment if changed
    payload = {}
    if custom_fields:
        payload["custom_fields_values"] = custom_fields
    
    if not payload:
        return {"status": "ok", "message": "Нечего синхронизировать"}
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.patch(
                f"https://{domain}/api/v4/leads/{lead['amocrm_id']}",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload
            )
            if resp.status_code == 200:
                await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": {"lastAmoSyncAt": datetime.now(timezone.utc).isoformat()}})
                return {"status": "ok", "message": "Данные отправлены в amoCRM"}
            else:
                return {"status": "error", "message": f"amoCRM: {resp.status_code} - {resp.text[:200]}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== PUSH TO PRODUCTION ==============

@router.post("/leads/{lead_id}/to-production")
async def push_to_production(lead_id: str):
    """Push a CRM lead to the production board."""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.get("inProduction"):
        raise HTTPException(status_code=400, detail="Заказ уже в производстве")

    now = datetime.now(timezone.utc).isoformat()

    # Get default production stage
    prod_settings = await db.sauna_production_settings.find_one({}, {"_id": 0})
    default_stage = "accepted"
    if prod_settings and prod_settings.get("stages"):
        default_stage = prod_settings["stages"][0]["id"]

    await db.sauna_crm_leads.update_one(
        {"id": lead_id},
        {"$set": {
            "inProduction": True,
            "productionStageId": default_stage,
            "productionPushedAt": now,
            "productionHistory": [{"stageId": default_stage, "timestamp": now, "action": "pushed_to_production"}],
            "updatedAt": now,
        }}
    )
    updated = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    return {"status": "ok", "lead": updated}


# ============== CALCULATOR INTEGRATION ==============

@router.get("/leads/{lead_id}/calculator-order")
async def get_linked_calculator_order(lead_id: str):
    """Get the full calculator order linked to a CRM lead."""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    calc_order_id = lead.get("calculatorOrderId")
    calc_collection = lead.get("calculatorCollection", "sauna_orders")
    
    # Try by stored link first
    order = None
    if calc_order_id:
        order = await db[calc_collection].find_one({"id": calc_order_id}, {"_id": 0})
    
    # Fallback: search by amocrm_id across collections
    if not order and lead.get("amocrm_id"):
        for coll in ["sauna_orders", "balia_orders", "greenhouse_orders"]:
            order = await db[coll].find_one({"amocrm_id": lead["amocrm_id"]}, {"_id": 0})
            if order:
                # Update the link for next time
                await db.sauna_crm_leads.update_one(
                    {"id": lead_id},
                    {"$set": {"calculatorOrderId": order["id"], "calculatorCollection": coll}}
                )
                break
    
    if not order:
        return {"order": None, "linked": False}
    
    return {"order": order, "linked": True, "collection": calc_collection}


@router.post("/leads/{lead_id}/link-calculator-order")
async def link_calculator_order_manual(lead_id: str, data: dict):
    """Manually link a calculator order to a CRM lead by order ID."""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    order_id = data.get("orderId", "")
    if not order_id:
        raise HTTPException(status_code=400, detail="orderId is required")
    
    # Search for order across collections
    order = None
    found_collection = None
    for coll in ["sauna_orders", "balia_orders", "greenhouse_orders"]:
        order = await db[coll].find_one({"id": order_id}, {"_id": 0})
        if order:
            found_collection = coll
            break
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found in calculator")
    
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "calculatorOrderId": order_id,
        "calculatorCollection": found_collection,
        "updatedAt": now,
    }
    if order.get("modelName"):
        update["modelName"] = order["modelName"]
    
    await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": update})
    
    updated_lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    return {"status": "ok", "lead": updated_lead, "order": order}


@router.post("/leads/{lead_id}/open-calculator")
async def get_calculator_data(lead_id: str):
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"calculatorData": {
        "crmLeadId": lead_id,
        "fullName": lead.get("clientName", ""),
        "phoneNumber": lead.get("phone", ""),
        "email": lead.get("email", ""),
        "fullAddress": lead.get("address", ""),
        "amocrm_id": lead.get("amocrm_id"),
        "amocrm_link": lead.get("amocrm_link"),
        **(lead.get("calculatorData") or {})
    }}


@router.put("/leads/{lead_id}/calculator-data")
async def save_calculator_data(lead_id: str, data: dict):
    existing = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.sauna_crm_leads.update_one(
        {"id": lead_id},
        {"$set": {"calculatorData": data.get("calculatorData"), "calculatorPdfUrl": data.get("pdfUrl"), "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "ok"}


# ============== CONTRACT GENERATION ==============

@router.post("/generate-contract")
async def generate_contract(request: dict):
    """Generate a sales contract (UMOWA) DOCX from template with lead data, upload to Cloudinary."""
    import traceback
    from routes.contract_template import generate_contract_with_kp

    lead_id = request.get("leadId")
    if not lead_id:
        raise HTTPException(status_code=400, detail="leadId is required")

    try:
        return await generate_contract_with_kp(lead_id)
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Contract generation failed for lead {lead_id}: {e}\n{tb}")
        raise HTTPException(status_code=500, detail=f"Contract generation error: {str(e)}")
