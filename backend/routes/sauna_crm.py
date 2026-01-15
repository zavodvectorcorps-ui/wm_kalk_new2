"""Sauna CRM routes - Kanban board for sauna leads management."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from database import db
import httpx

router = APIRouter(prefix="/sauna-crm", tags=["Sauna CRM"])


# ============== MODELS ==============

class CRMFieldConfig(BaseModel):
    """Configuration for a custom CRM field mapped to amoCRM"""
    id: str
    name: str  # Display name in UI
    amoFieldId: str = ""  # amoCRM custom field ID
    fieldType: str = "text"  # text, number, date, select
    enabled: bool = True
    sortOrder: int = 1


class CRMStageConfig(BaseModel):
    """Configuration for CRM stage mapped to amoCRM pipeline stage"""
    id: str
    name: str  # Display name (e.g., "Новая заявка")
    amoStageId: str = ""  # amoCRM stage ID
    amoPipelineId: str = ""  # amoCRM pipeline ID
    color: str = "#3b82f6"  # Stage color for UI
    sortOrder: int = 1


class CRMSettings(BaseModel):
    """CRM settings including field mappings and stage configurations"""
    fields: List[CRMFieldConfig] = []
    stages: List[CRMStageConfig] = []
    autoSyncEnabled: bool = True
    lastSyncAt: Optional[str] = None


class CRMLead(BaseModel):
    """Lead/order in the CRM kanban board"""
    id: str = Field(default_factory=lambda: f"CRM-{datetime.now().strftime('%Y%m%d%H%M%S')}")
    stageId: str  # Current stage ID
    
    # Client info
    clientName: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    
    # amoCRM data
    amocrm_id: Optional[str] = None
    amocrm_link: Optional[str] = None
    
    # Custom fields (field_1 through field_10)
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
    
    # Calculator link data
    calculatorData: Optional[Dict[str, Any]] = None  # Data to pass to calculator
    calculatorPdfUrl: Optional[str] = None  # Generated PDF URL
    
    # Timestamps
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: Optional[str] = None
    
    # History
    stageHistory: List[Dict[str, Any]] = []  # Stage change history
    
    notes: str = ""
    isImportant: bool = False


# ============== DEFAULT SETTINGS ==============

def get_default_settings() -> dict:
    """Get default CRM settings"""
    return {
        "fields": [
            {"id": "field_1", "name": "Поле 1", "amoFieldId": "", "fieldType": "text", "enabled": True, "sortOrder": 1},
            {"id": "field_2", "name": "Поле 2", "amoFieldId": "", "fieldType": "text", "enabled": True, "sortOrder": 2},
            {"id": "field_3", "name": "Поле 3", "amoFieldId": "", "fieldType": "text", "enabled": True, "sortOrder": 3},
            {"id": "field_4", "name": "Поле 4", "amoFieldId": "", "fieldType": "text", "enabled": True, "sortOrder": 4},
            {"id": "field_5", "name": "Поле 5", "amoFieldId": "", "fieldType": "text", "enabled": True, "sortOrder": 5},
            {"id": "field_6", "name": "Поле 6", "amoFieldId": "", "fieldType": "text", "enabled": False, "sortOrder": 6},
            {"id": "field_7", "name": "Поле 7", "amoFieldId": "", "fieldType": "text", "enabled": False, "sortOrder": 7},
            {"id": "field_8", "name": "Поле 8", "amoFieldId": "", "fieldType": "text", "enabled": False, "sortOrder": 8},
            {"id": "field_9", "name": "Поле 9", "amoFieldId": "", "fieldType": "text", "enabled": False, "sortOrder": 9},
            {"id": "field_10", "name": "Поле 10", "amoFieldId": "", "fieldType": "text", "enabled": False, "sortOrder": 10},
        ],
        "stages": [
            {"id": "new", "name": "Новая заявка", "amoStageId": "", "amoPipelineId": "", "color": "#3b82f6", "sortOrder": 1},
            {"id": "qualified", "name": "Квалифицированная заявка", "amoStageId": "", "amoPipelineId": "", "color": "#f59e0b", "sortOrder": 2},
            {"id": "kp_created", "name": "Создано КП", "amoStageId": "", "amoPipelineId": "", "color": "#22c55e", "sortOrder": 3},
        ],
        "autoSyncEnabled": True,
        "lastSyncAt": None
    }


# ============== SETTINGS ENDPOINTS ==============

@router.get("/settings")
async def get_crm_settings():
    """Get CRM settings"""
    settings = await db.sauna_crm_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = get_default_settings()
        await db.sauna_crm_settings.insert_one(settings)
    return settings


@router.post("/settings")
async def save_crm_settings(settings: CRMSettings):
    """Save CRM settings"""
    settings_dict = settings.model_dump()
    await db.sauna_crm_settings.update_one(
        {},
        {"$set": settings_dict},
        upsert=True
    )
    return {"status": "ok", "message": "Settings saved"}


@router.put("/settings/fields")
async def update_field_settings(fields: List[CRMFieldConfig]):
    """Update field configurations"""
    fields_dict = [f.model_dump() for f in fields]
    await db.sauna_crm_settings.update_one(
        {},
        {"$set": {"fields": fields_dict}},
        upsert=True
    )
    return {"status": "ok", "message": "Fields updated"}


@router.put("/settings/stages")
async def update_stage_settings(stages: List[CRMStageConfig]):
    """Update stage configurations"""
    stages_dict = [s.model_dump() for s in stages]
    await db.sauna_crm_settings.update_one(
        {},
        {"$set": {"stages": stages_dict}},
        upsert=True
    )
    return {"status": "ok", "message": "Stages updated"}


# ============== LEADS ENDPOINTS ==============

@router.get("/leads")
async def get_all_leads():
    """Get all CRM leads grouped by stage"""
    leads = await db.sauna_crm_leads.find({}, {"_id": 0}).to_list(1000)
    settings = await get_crm_settings()
    
    # Group leads by stage
    stages_data = {}
    for stage in settings.get("stages", []):
        stages_data[stage["id"]] = {
            "stage": stage,
            "leads": []
        }
    
    for lead in leads:
        stage_id = lead.get("stageId", "new")
        if stage_id in stages_data:
            stages_data[stage_id]["leads"].append(lead)
    
    return {
        "leads": leads,
        "byStage": stages_data,
        "settings": settings
    }


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: str):
    """Get a single lead by ID"""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.post("/leads")
async def create_lead(lead: CRMLead):
    """Create a new lead"""
    lead_dict = lead.model_dump()
    lead_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    
    # Add initial stage to history
    lead_dict["stageHistory"] = [{
        "stageId": lead.stageId,
        "timestamp": lead_dict["createdAt"],
        "action": "created"
    }]
    
    await db.sauna_crm_leads.insert_one(lead_dict)
    return {"status": "ok", "lead": lead_dict}


@router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, lead: CRMLead):
    """Update a lead"""
    existing = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead_dict = lead.model_dump()
    lead_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    # Track stage change
    if existing.get("stageId") != lead.stageId:
        history = existing.get("stageHistory", [])
        history.append({
            "fromStage": existing.get("stageId"),
            "toStage": lead.stageId,
            "timestamp": lead_dict["updatedAt"],
            "action": "stage_changed"
        })
        lead_dict["stageHistory"] = history
        
        # Sync to amoCRM if configured
        await sync_stage_to_amocrm(lead_id, lead.stageId)
    
    await db.sauna_crm_leads.update_one(
        {"id": lead_id},
        {"$set": lead_dict}
    )
    
    updated = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


@router.put("/leads/{lead_id}/stage")
async def change_lead_stage(lead_id: str, stage_id: str):
    """Change lead stage (for drag-and-drop)"""
    existing = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Add to history
    history = existing.get("stageHistory", [])
    history.append({
        "fromStage": existing.get("stageId"),
        "toStage": stage_id,
        "timestamp": now,
        "action": "stage_changed"
    })
    
    await db.sauna_crm_leads.update_one(
        {"id": lead_id},
        {"$set": {
            "stageId": stage_id,
            "updatedAt": now,
            "stageHistory": history
        }}
    )
    
    # Sync to amoCRM
    await sync_stage_to_amocrm(lead_id, stage_id)
    
    updated = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead"""
    result = await db.sauna_crm_leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"status": "ok", "message": "Lead deleted"}


# ============== CALCULATOR INTEGRATION ==============

@router.post("/leads/{lead_id}/open-calculator")
async def get_calculator_data(lead_id: str):
    """Get lead data formatted for opening in calculator"""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Format data for calculator pre-fill
    calculator_data = {
        "crmLeadId": lead_id,
        "fullName": lead.get("clientName", ""),
        "phoneNumber": lead.get("phone", ""),
        "email": lead.get("email", ""),
        "fullAddress": lead.get("address", ""),
        "amocrm_id": lead.get("amocrm_id"),
        "amocrm_link": lead.get("amocrm_link"),
        # Include any calculator data that was previously saved
        **(lead.get("calculatorData") or {})
    }
    
    return {"calculatorData": calculator_data}


@router.put("/leads/{lead_id}/calculator-data")
async def save_calculator_data(lead_id: str, data: dict):
    """Save calculator data back to lead"""
    existing = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.sauna_crm_leads.update_one(
        {"id": lead_id},
        {"$set": {
            "calculatorData": data.get("calculatorData"),
            "calculatorPdfUrl": data.get("pdfUrl"),
            "updatedAt": now
        }}
    )
    
    return {"status": "ok", "message": "Calculator data saved"}


# ============== AMOCRM SYNC ==============

async def sync_stage_to_amocrm(lead_id: str, stage_id: str):
    """Sync stage change to amoCRM"""
    try:
        lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead or not lead.get("amocrm_id"):
            return
        
        settings = await get_crm_settings()
        
        # Find stage config
        stage_config = None
        for stage in settings.get("stages", []):
            if stage["id"] == stage_id:
                stage_config = stage
                break
        
        if not stage_config or not stage_config.get("amoStageId"):
            return
        
        # Get amoCRM settings
        amo_settings = await db.amocrm_settings.find_one({}, {"_id": 0})
        if not amo_settings or not amo_settings.get("access_token"):
            return
        
        # Update lead status in amoCRM
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"https://{amo_settings['subdomain']}.amocrm.ru/api/v4/leads/{lead['amocrm_id']}",
                headers={
                    "Authorization": f"Bearer {amo_settings['access_token']}",
                    "Content-Type": "application/json"
                },
                json={
                    "status_id": int(stage_config["amoStageId"]),
                    "pipeline_id": int(stage_config["amoPipelineId"]) if stage_config.get("amoPipelineId") else None
                },
                timeout=30
            )
            
            if response.status_code == 200:
                await db.sauna_crm_leads.update_one(
                    {"id": lead_id},
                    {"$set": {"lastAmoSyncAt": datetime.now(timezone.utc).isoformat()}}
                )
    except Exception as e:
        print(f"Error syncing to amoCRM: {e}")


@router.post("/sync-from-amocrm")
async def sync_leads_from_amocrm():
    """Import leads from amoCRM based on configured stages"""
    settings = await get_crm_settings()
    amo_settings = await db.amocrm_settings.find_one({}, {"_id": 0})
    
    if not amo_settings or not amo_settings.get("access_token"):
        raise HTTPException(status_code=400, detail="amoCRM not configured")
    
    imported_count = 0
    
    try:
        async with httpx.AsyncClient() as client:
            for stage in settings.get("stages", []):
                if not stage.get("amoStageId"):
                    continue
                
                # Fetch leads from amoCRM for this stage
                response = await client.get(
                    f"https://{amo_settings['subdomain']}.amocrm.ru/api/v4/leads",
                    headers={
                        "Authorization": f"Bearer {amo_settings['access_token']}"
                    },
                    params={
                        "filter[statuses][0][status_id]": stage["amoStageId"],
                        "filter[statuses][0][pipeline_id]": stage.get("amoPipelineId", ""),
                        "with": "contacts"
                    },
                    timeout=30
                )
                
                if response.status_code != 200:
                    continue
                
                data = response.json()
                leads = data.get("_embedded", {}).get("leads", [])
                
                for amo_lead in leads:
                    # Check if lead already exists
                    existing = await db.sauna_crm_leads.find_one({"amocrm_id": str(amo_lead["id"])})
                    if existing:
                        continue
                    
                    # Create new lead
                    new_lead = {
                        "id": f"CRM-{datetime.now().strftime('%Y%m%d%H%M%S')}-{amo_lead['id']}",
                        "stageId": stage["id"],
                        "clientName": amo_lead.get("name", ""),
                        "phone": "",
                        "email": "",
                        "address": "",
                        "amocrm_id": str(amo_lead["id"]),
                        "amocrm_link": f"https://{amo_settings['subdomain']}.amocrm.ru/leads/detail/{amo_lead['id']}",
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "stageHistory": [{
                            "stageId": stage["id"],
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "action": "imported_from_amocrm"
                        }],
                        "notes": "",
                        "isImportant": False
                    }
                    
                    # Extract custom fields
                    custom_fields = amo_lead.get("custom_fields_values", [])
                    field_mappings = {f["amoFieldId"]: f["id"] for f in settings.get("fields", []) if f.get("amoFieldId")}
                    
                    for cf in custom_fields:
                        cf_id = str(cf.get("field_id", ""))
                        if cf_id in field_mappings:
                            field_key = field_mappings[cf_id]
                            values = cf.get("values", [])
                            if values:
                                new_lead[field_key] = values[0].get("value", "")
                    
                    await db.sauna_crm_leads.insert_one(new_lead)
                    imported_count += 1
        
        # Update last sync time
        await db.sauna_crm_settings.update_one(
            {},
            {"$set": {"lastSyncAt": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"status": "ok", "imported": imported_count}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")


@router.post("/leads/{lead_id}/upload-kp")
async def upload_kp_to_amocrm(lead_id: str, data: dict):
    """Upload КП PDF to amoCRM"""
    lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead or not lead.get("amocrm_id"):
        raise HTTPException(status_code=400, detail="Lead not found or not linked to amoCRM")
    
    pdf_url = data.get("pdfUrl")
    if not pdf_url:
        raise HTTPException(status_code=400, detail="PDF URL required")
    
    amo_settings = await db.amocrm_settings.find_one({}, {"_id": 0})
    if not amo_settings or not amo_settings.get("access_token"):
        raise HTTPException(status_code=400, detail="amoCRM not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            # Download PDF
            pdf_response = await client.get(pdf_url, timeout=30)
            if pdf_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to download PDF")
            
            # Upload to amoCRM
            files = {
                "file": (f"KP_{lead_id}.pdf", pdf_response.content, "application/pdf")
            }
            
            upload_response = await client.post(
                f"https://{amo_settings['subdomain']}.amocrm.ru/api/v4/leads/{lead['amocrm_id']}/files",
                headers={
                    "Authorization": f"Bearer {amo_settings['access_token']}"
                },
                files=files,
                timeout=60
            )
            
            if upload_response.status_code in [200, 201]:
                return {"status": "ok", "message": "КП uploaded to amoCRM"}
            else:
                raise HTTPException(status_code=500, detail=f"amoCRM upload failed: {upload_response.text}")
                
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")
