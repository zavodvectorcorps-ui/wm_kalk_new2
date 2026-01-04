"""amoCRM webhook integration routes."""
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import json
import logging
from urllib.parse import parse_qs

router = APIRouter(prefix="/api/integrations/amocrm", tags=["amocrm"])

# MongoDB connection
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
greenhouse_orders = db["greenhouse_orders"]
integration_settings = db["integration_settings"]
webhook_logs = db["webhook_logs"]

logger = logging.getLogger(__name__)


class AmoCRMSettings(BaseModel):
    enabled: bool = False
    secret_key: str = ""
    pipeline_id: Optional[str] = None
    status_id: Optional[str] = None
    field_mapping: Dict[str, str] = {
        "fullName": "name",  # amoCRM field -> our field
        "phoneNumber": "phone",
        "fullAddress": "address",
        "notes": "notes"
    }


class AmoCRMSettingsResponse(BaseModel):
    enabled: bool
    secret_key: str
    pipeline_id: Optional[str]
    status_id: Optional[str]
    field_mapping: Dict[str, str]
    webhook_url: str


def get_amocrm_settings():
    """Get amoCRM integration settings from database."""
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        return {
            "type": "amocrm",
            "enabled": False,
            "secret_key": "",
            "pipeline_id": None,
            "status_id": None,
            "field_mapping": {
                "fullName": "name",
                "phoneNumber": "phone",
                "fullAddress": "address",
                "notes": "notes"
            }
        }
    return settings


def parse_amocrm_webhook(body: bytes) -> Dict[str, Any]:
    """Parse amoCRM webhook data (URL-encoded or JSON)."""
    try:
        # Try JSON first
        return json.loads(body)
    except:
        pass
    
    # Parse as URL-encoded
    try:
        decoded = body.decode('utf-8')
        parsed = parse_qs(decoded)
        
        # Convert to nested structure
        result = {}
        for key, values in parsed.items():
            # Handle nested keys like leads[update][0][id]
            parts = key.replace(']', '').split('[')
            current = result
            for i, part in enumerate(parts[:-1]):
                if part.isdigit():
                    part = int(part)
                if part not in current:
                    # Check if next part is digit to create list
                    next_part = parts[i + 1] if i + 1 < len(parts) else None
                    if next_part and next_part.isdigit():
                        current[part] = []
                    else:
                        current[part] = {}
                current = current[part]
            
            last_key = parts[-1]
            if last_key.isdigit():
                last_key = int(last_key)
            current[last_key] = values[0] if len(values) == 1 else values
        
        return result
    except Exception as e:
        logger.error(f"Failed to parse webhook body: {e}")
        return {}


def extract_lead_data(data: Dict[str, Any], field_mapping: Dict[str, str]) -> Dict[str, Any]:
    """Extract lead data from amoCRM webhook payload."""
    lead_data = {}
    
    # Find lead in various possible locations
    leads = None
    if "leads" in data:
        if "update" in data["leads"]:
            leads = data["leads"]["update"]
        elif "add" in data["leads"]:
            leads = data["leads"]["add"]
        elif "status" in data["leads"]:
            leads = data["leads"]["status"]
    
    if not leads:
        return lead_data
    
    # Get first lead
    lead = leads[0] if isinstance(leads, list) else leads.get("0") or leads
    
    if isinstance(lead, dict):
        # Basic fields
        lead_data["amocrm_id"] = str(lead.get("id", ""))
        lead_data["amocrm_name"] = lead.get("name", "")
        lead_data["pipeline_id"] = str(lead.get("pipeline_id", ""))
        lead_data["status_id"] = str(lead.get("status_id", ""))
        lead_data["price"] = lead.get("price", 0)
        
        # Extract custom fields
        custom_fields = lead.get("custom_fields", [])
        if isinstance(custom_fields, list):
            for field in custom_fields:
                field_name = field.get("name", "").lower()
                values = field.get("values", [])
                value = values[0].get("value", "") if values else ""
                
                # Map to our fields
                if "телефон" in field_name or "phone" in field_name:
                    lead_data["phoneNumber"] = value
                elif "адрес" in field_name or "address" in field_name:
                    lead_data["fullAddress"] = value
                elif "имя" in field_name or "name" in field_name or "контакт" in field_name:
                    lead_data["fullName"] = value
        
        # Fallback to lead name if no contact name
        if not lead_data.get("fullName"):
            lead_data["fullName"] = lead_data.get("amocrm_name", "")
    
    return lead_data


@router.get("/settings", response_model=AmoCRMSettingsResponse)
async def get_settings(request: Request):
    """Get amoCRM integration settings."""
    settings = get_amocrm_settings()
    
    # Generate webhook URL
    base_url = str(request.base_url).rstrip('/')
    webhook_url = f"{base_url}/api/integrations/amocrm/webhook"
    if settings.get("secret_key"):
        webhook_url += f"?key={settings['secret_key']}"
    
    return {
        "enabled": settings.get("enabled", False),
        "secret_key": settings.get("secret_key", ""),
        "pipeline_id": settings.get("pipeline_id"),
        "status_id": settings.get("status_id"),
        "field_mapping": settings.get("field_mapping", {}),
        "webhook_url": webhook_url
    }


@router.post("/settings")
async def save_settings(settings: AmoCRMSettings):
    """Save amoCRM integration settings."""
    settings_data = settings.dict()
    settings_data["type"] = "amocrm"
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    integration_settings.update_one(
        {"type": "amocrm"},
        {"$set": settings_data},
        upsert=True
    )
    
    return {"message": "Settings saved successfully"}


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    key: Optional[str] = None
):
    """Receive webhook from amoCRM when lead moves to specified stage."""
    settings = get_amocrm_settings()
    
    # Log webhook receipt
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "amocrm",
        "status": "received"
    }
    
    # Check if integration is enabled
    if not settings.get("enabled", False):
        log_entry["status"] = "rejected"
        log_entry["reason"] = "Integration disabled"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "Integration disabled"}
    
    # Verify secret key
    secret_key = settings.get("secret_key", "")
    if secret_key and key != secret_key:
        log_entry["status"] = "rejected"
        log_entry["reason"] = "Invalid secret key"
        webhook_logs.insert_one(log_entry)
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    # Parse webhook body
    body = await request.body()
    data = parse_amocrm_webhook(body)
    
    log_entry["raw_data"] = str(body[:1000])  # Truncate for logging
    
    if not data:
        log_entry["status"] = "error"
        log_entry["reason"] = "Failed to parse webhook data"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "No data to process"}
    
    # Extract lead data
    field_mapping = settings.get("field_mapping", {})
    lead_data = extract_lead_data(data, field_mapping)
    
    log_entry["parsed_data"] = lead_data
    
    # Check if this lead matches our pipeline/status filter
    target_pipeline = settings.get("pipeline_id")
    target_status = settings.get("status_id")
    
    if target_pipeline and lead_data.get("pipeline_id") != target_pipeline:
        log_entry["status"] = "skipped"
        log_entry["reason"] = f"Pipeline mismatch: {lead_data.get('pipeline_id')} != {target_pipeline}"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "Pipeline does not match"}
    
    if target_status and lead_data.get("status_id") != target_status:
        log_entry["status"] = "skipped"
        log_entry["reason"] = f"Status mismatch: {lead_data.get('status_id')} != {target_status}"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "Status does not match"}
    
    # Check if order with this amoCRM ID already exists
    existing = greenhouse_orders.find_one({"amocrm_id": lead_data.get("amocrm_id")})
    if existing:
        log_entry["status"] = "skipped"
        log_entry["reason"] = "Order already exists"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "Order already exists"}
    
    # Create greenhouse order
    now = datetime.now(timezone.utc).isoformat()
    order_data = {
        "id": f"AMO-{lead_data.get('amocrm_id', datetime.now().timestamp())}",
        "fullName": lead_data.get("fullName", "Без имени"),
        "phoneNumber": lead_data.get("phoneNumber", ""),
        "fullAddress": lead_data.get("fullAddress", ""),
        "notes": f"Из amoCRM. Сделка: {lead_data.get('amocrm_name', '')}. Бюджет: {lead_data.get('price', 0)}",
        "orderDate": now,
        "createdAt": now,
        "source": "amocrm",
        "status": "new",
        "amocrm_id": lead_data.get("amocrm_id"),
        "amocrm_data": lead_data
    }
    
    greenhouse_orders.insert_one(order_data)
    order_data.pop("_id", None)
    
    log_entry["status"] = "success"
    log_entry["created_order_id"] = order_data["id"]
    webhook_logs.insert_one(log_entry)
    
    logger.info(f"Created greenhouse order from amoCRM: {order_data['id']}")
    
    return {"status": "ok", "order_id": order_data["id"]}


@router.get("/logs")
async def get_webhook_logs(limit: int = 50):
    """Get recent webhook logs."""
    logs = list(webhook_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
    return logs


@router.post("/test")
async def test_webhook():
    """Create a test order to verify integration."""
    now = datetime.now(timezone.utc).isoformat()
    
    order_data = {
        "id": f"TEST-{int(datetime.now().timestamp())}",
        "fullName": "Тест amoCRM",
        "phoneNumber": "+48 000 000 000",
        "fullAddress": "Тестовый адрес, Варшава",
        "notes": "Тестовый заказ для проверки интеграции",
        "orderDate": now,
        "createdAt": now,
        "source": "amocrm_test",
        "status": "new"
    }
    
    greenhouse_orders.insert_one(order_data)
    order_data.pop("_id", None)
    
    return {"status": "ok", "message": "Test order created", "order": order_data}
