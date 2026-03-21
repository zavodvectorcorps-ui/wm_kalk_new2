"""Sauna CRM routes - Mini CRM for sauna orders with amoCRM integration."""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from database import db
from services.cloudinary_service import upload_pdf as cloudinary_upload_pdf, is_cloudinary_configured
import httpx
import os
import logging
import uuid

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


class CRMSettings(BaseModel):
    fields: List[CRMFieldConfig] = []
    stages: List[CRMStageConfig] = []
    syncBackFields: List[Dict[str, str]] = []  # [{fieldId, amoFieldId}]
    autoSyncEnabled: bool = True
    lastSyncAt: Optional[str] = None
    clientNameFieldId: Optional[str] = None  # amoCRM field ID for client name
    modelFieldId: Optional[str] = None  # amoCRM field ID for sauna model


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
    paidAmount: Optional[float] = None
    documents: List[Dict[str, Any]] = []
    calculatorData: Optional[Dict[str, Any]] = None
    calculatorPdfUrl: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: Optional[str] = None
    stageHistory: List[Dict[str, Any]] = []
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
            {"id": "new", "name": "Новый заказ", "amoStageId": "", "amoPipelineId": "", "color": "#3b82f6", "sortOrder": 1},
            {"id": "in_production", "name": "В производстве", "amoStageId": "", "amoPipelineId": "", "color": "#f59e0b", "sortOrder": 2},
            {"id": "ready", "name": "Готов", "amoStageId": "", "amoPipelineId": "", "color": "#22c55e", "sortOrder": 3},
        ],
        "syncBackFields": [],
        "autoSyncEnabled": True,
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
    # Date filters on readyDate
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to + "T23:59:59"
        query["readyDate"] = date_q

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
    
    # Remove _id if present
    data.pop("_id", None)
    data.pop("id", None)
    
    await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": data})
    updated = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


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
    """Get orders for production calendar grouped by readyDate."""
    leads = await db.sauna_crm_leads.find(
        {"readyDate": {"$exists": True, "$ne": None, "$nin": [""]}},
        {"_id": 0}
    ).to_list(5000)
    
    # Filter by month/year and group by date
    by_date = {}
    for lead in leads:
        rd = lead.get("readyDate", "")
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
                    "readyDate": rd,
                    "stageId": lead.get("stageId"),
                    "totalAmount": lead.get("totalAmount") or lead.get("field_2"),
                    "phone": lead.get("phone", ""),
                })
        except (ValueError, TypeError):
            continue
    
    return {"month": month, "year": year, "byDate": by_date, "totalOrders": sum(len(v) for v in by_date.values())}


# ============== CALCULATOR LINK ==============

async def link_calculator_order(amocrm_id: str, crm_lead: dict) -> dict:
    """Find calculator order by amocrm_id and attach PDF as document."""
    result = {"linked": False, "pdf_attached": False}
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        # Search across all calculator order collections
        for collection_name in ["sauna_orders", "balia_orders", "greenhouse_orders"]:
            calc_order = await db[collection_name].find_one(
                {"amocrm_id": amocrm_id},
                {"_id": 0, "id": 1, "fullName": 1, "modelName": 1, "totalAmount": 1}
            )
            if calc_order:
                crm_lead["calculatorOrderId"] = calc_order.get("id")
                crm_lead["calculatorCollection"] = collection_name
                if calc_order.get("modelName"):
                    crm_lead["modelName"] = calc_order["modelName"]
                result["linked"] = True
                break
        
        # Search for PDF in calculator_pdfs collection
        from pymongo import MongoClient
        sync_client = MongoClient(MONGO_URL)
        sync_db = sync_client[DB_NAME]
        
        pdf_doc = sync_db["calculator_pdfs"].find_one(
            {"amocrm_id": amocrm_id},
            {"pdf_data": 0}  # Don't load binary data, just metadata
        )
        
        if not pdf_doc:
            # Try searching by order_id from linked calculator order
            if crm_lead.get("calculatorOrderId"):
                pdf_doc = sync_db["calculator_pdfs"].find_one(
                    {"order_id": crm_lead["calculatorOrderId"]},
                    {"pdf_data": 0}
                )
        
        if pdf_doc:
            # Get Cloudinary URL — check calculator_pdfs first, then webhook_logs
            cloudinary_url = pdf_doc.get("cloudinary_url")
            
            if not cloudinary_url:
                log_entry = sync_db["webhook_logs"].find_one(
                    {"type": "calculator_pdf_upload", "amocrm_id": amocrm_id, "cloudinary_url": {"$exists": True, "$ne": None}},
                    {"_id": 0, "cloudinary_url": 1},
                    sort=[("timestamp", -1)]
                )
                if log_entry:
                    cloudinary_url = log_entry.get("cloudinary_url")
            
            if not cloudinary_url and crm_lead.get("calculatorOrderId"):
                # Also try by order_id
                log_entry = sync_db["webhook_logs"].find_one(
                    {"type": "calculator_pdf_upload", "order_id": crm_lead["calculatorOrderId"], "cloudinary_url": {"$exists": True, "$ne": None}},
                    {"_id": 0, "cloudinary_url": 1},
                    sort=[("timestamp", -1)]
                )
                if log_entry:
                    cloudinary_url = log_entry.get("cloudinary_url")
            
            if cloudinary_url:
                # Remove old kp documents to avoid duplicates
                crm_lead["documents"] = [d for d in crm_lead.get("documents", []) if d.get("type") != "kp"]
                pdf_document = {
                    "id": str(uuid.uuid4())[:8],
                    "type": "kp",
                    "name": f"КП {crm_lead.get('clientName', '')}".strip(),
                    "url": cloudinary_url,
                    "filename": pdf_doc.get("filename", "КП.pdf"),
                    "uploadedAt": now,
                    "source": "calculator_auto"
                }
                crm_lead["documents"].append(pdf_document)
                crm_lead["calculatorPdfUrl"] = cloudinary_url
                result["pdf_attached"] = True
                logger.info(f"PDF attached to CRM lead from calculator: amocrm_id={amocrm_id}")
    except Exception as e:
        logger.error(f"Error linking calculator order: {e}")
    
    return result


# ============== AMOCRM SYNC ==============

async def sync_stage_to_amocrm(lead_id: str, stage_id: str):
    """Sync stage change to amoCRM."""
    try:
        lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead or not lead.get("amocrm_id"):
            return
        settings = await get_crm_settings()
        stage_config = next((s for s in settings.get("stages", []) if s["id"] == stage_id), None)
        if not stage_config or not stage_config.get("amoStageId"):
            return
        amo = get_amo_settings_sync()
        domain = amo.get("amocrm_domain", "")
        token = amo.get("amocrm_token", "")
        if not domain or not token:
            return
        payload = {"status_id": int(stage_config["amoStageId"])}
        if stage_config.get("amoPipelineId"):
            payload["pipeline_id"] = int(stage_config["amoPipelineId"])
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.patch(
                f"https://{domain}/api/v4/leads/{lead['amocrm_id']}",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload
            )
            if resp.status_code == 200:
                await db.sauna_crm_leads.update_one({"id": lead_id}, {"$set": {"lastAmoSyncAt": datetime.now(timezone.utc).isoformat()}})
                logger.info(f"CRM stage synced to amoCRM: lead={lead_id}, stage={stage_id}")
    except Exception as e:
        logger.error(f"Error syncing stage to amoCRM: {e}")


@router.post("/sync-from-amocrm")
async def sync_leads_from_amocrm():
    """Import leads from amoCRM based on configured stages."""
    settings = await get_crm_settings()
    amo = get_amo_settings_sync()
    domain = amo.get("amocrm_domain", "")
    token = amo.get("amocrm_token", "")
    if not domain or not token:
        raise HTTPException(status_code=400, detail="amoCRM не настроен")
    
    imported = 0
    updated = 0
    
    try:
        headers_amo = {"Authorization": f"Bearer {token}"}
        field_mappings = {f["amoFieldId"]: f["id"] for f in settings.get("fields", []) if f.get("amoFieldId")}
        
        # Cache users for manager names
        users_cache = {}
        try:
            async with httpx.AsyncClient(timeout=15.0) as uc:
                ur = await uc.get(f"https://{domain}/api/v4/users", headers=headers_amo)
                if ur.status_code == 200:
                    for u in ur.json().get("_embedded", {}).get("users", []):
                        users_cache[u["id"]] = u.get("name", "")
        except Exception:
            pass
        
        async with httpx.AsyncClient(timeout=20.0) as client:
            for stage in settings.get("stages", []):
                if not stage.get("amoStageId") or not stage.get("amoPipelineId"):
                    continue
                
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
                    logger.error(f"amoCRM API error: {resp.status_code}")
                    continue
                
                leads_data = resp.json().get("_embedded", {}).get("leads", [])
                
                for amo_lead in leads_data:
                    amo_id = str(amo_lead["id"])
                    existing = await db.sauna_crm_leads.find_one({"amocrm_id": amo_id})
                    
                    # Extract custom fields
                    custom_fields = amo_lead.get("custom_fields_values", [])
                    field_vals = {}
                    for cf in custom_fields:
                        cf_id = str(cf.get("field_id", ""))
                        if cf_id in field_mappings:
                            vals = cf.get("values", [])
                            if vals:
                                field_vals[field_mappings[cf_id]] = vals[0].get("value", "")
                    
                    # Extract client name from custom amoCRM field (priority: custom field > contact > deal name)
                    custom_client_name = ""
                    custom_model_name = ""
                    client_name_fid = settings.get("clientNameFieldId", "")
                    model_fid = settings.get("modelFieldId", "")
                    for cf in custom_fields:
                        cf_id = str(cf.get("field_id", ""))
                        vals = cf.get("values", [])
                        val = vals[0].get("value", "") if vals else ""
                        if client_name_fid and cf_id == client_name_fid and val:
                            custom_client_name = val
                        if model_fid and cf_id == model_fid and val:
                            custom_model_name = val
                    
                    # Extract contacts
                    contacts = amo_lead.get("_embedded", {}).get("contacts", [])
                    contact_name = contacts[0].get("name", "") if contacts else ""
                    contact_phone = ""
                    if contacts:
                        try:
                            cr = await client.get(f"https://{domain}/api/v4/contacts/{contacts[0]['id']}", headers=headers_amo, timeout=10)
                            if cr.status_code == 200:
                                for cf in cr.json().get("custom_fields_values", []):
                                    if cf.get("field_code") == "PHONE" and cf.get("values"):
                                        contact_phone = cf["values"][0].get("value", "")
                                        break
                        except Exception:
                            pass
                    
                    # Get manager name
                    responsible_id = amo_lead.get("responsible_user_id")
                    manager_name = users_cache.get(responsible_id, "") if responsible_id else ""
                    
                    if existing:
                        # Update existing lead fields from amoCRM
                        update_data = {"updatedAt": datetime.now(timezone.utc).isoformat()}
                        # Priority: custom amoCRM field > contact name > keep existing
                        if custom_client_name:
                            update_data["clientName"] = custom_client_name
                        elif contact_name:
                            update_data["clientName"] = contact_name
                        if custom_model_name:
                            update_data["modelName"] = custom_model_name
                        if contact_phone:
                            update_data["phone"] = contact_phone
                        if manager_name:
                            update_data["manager"] = manager_name
                        update_data.update(field_vals)
                        if amo_lead.get("price"):
                            update_data["totalAmount"] = amo_lead["price"]
                        await db.sauna_crm_leads.update_one({"amocrm_id": amo_id}, {"$set": update_data})
                        updated += 1
                    else:
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
                            "notes": "",
                            "isImportant": False,
                            **field_vals
                        }
                        
                        # Link with calculator order and attach PDF
                        await link_calculator_order(amo_id, new_lead)
                        
                        await db.sauna_crm_leads.insert_one(new_lead)
                        imported += 1
        
        await db.sauna_crm_settings.update_one({}, {"$set": {"lastSyncAt": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        return {"status": "ok", "imported": imported, "updated": updated, "message": f"Импортировано: {imported}, обновлено: {updated}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    from routes.contract_template import generate_contract_with_kp

    lead_id = request.get("leadId")
    if not lead_id:
        raise HTTPException(status_code=400, detail="leadId is required")

    return await generate_contract_with_kp(lead_id)
