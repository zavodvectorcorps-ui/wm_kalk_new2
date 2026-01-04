"""amoCRM webhook integration routes."""
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import json
import logging
import httpx
from urllib.parse import parse_qs

router = APIRouter(prefix="/api/integrations/amocrm", tags=["amocrm"])

# MongoDB connection
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
greenhouse_orders = db["greenhouse_orders"]
balia_orders = db["orders"]  # Balia orders collection
sauna_orders = db["sauna_orders"]
integration_settings = db["integration_settings"]
webhook_logs = db["webhook_logs"]

logger = logging.getLogger(__name__)


class FieldMapping(BaseModel):
    fullName: str = ""
    phoneNumber: str = ""
    orderNumber: str = ""
    # Address - can be single field or 3 separate
    fullAddress: str = ""
    addressIndex: str = ""
    addressCity: str = ""
    addressStreet: str = ""
    # Order details
    orderContents: str = ""
    orderComment: str = ""
    dealSum: str = ""
    debtSum: str = ""


class AmoCRMSettings(BaseModel):
    enabled: bool = False
    # Field mapping - user-specified amoCRM field IDs
    field_mapping: FieldMapping = FieldMapping()
    # amoCRM API credentials for syncing back
    amocrm_domain: str = ""  # e.g., "mycompany.amocrm.ru"
    amocrm_token: str = ""  # Long-lived token
    # Field IDs for status sync
    status_field_id: str = ""  # Custom field ID for delivery status
    comment_field_id: str = ""  # Custom field ID for comments/date


def get_default_settings():
    """Get default amoCRM settings."""
    return {
        "type": "amocrm",
        "enabled": False,
        "field_mapping": {
            "fullName": "",
            "phoneNumber": "",
            "orderNumber": "",
            "fullAddress": "",
            "addressIndex": "",
            "addressCity": "",
            "addressStreet": "",
            "orderContents": "",
            "orderComment": "",
            "dealSum": "",
            "debtSum": ""
        },
        "amocrm_domain": "",
        "amocrm_token": "",
        "status_field_id": "",
        "comment_field_id": ""
    }


def get_amocrm_settings():
    """Get amoCRM integration settings from database."""
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        return get_default_settings()
    # Ensure all fields exist (for backward compatibility)
    defaults = get_default_settings()
    for key, value in defaults.items():
        if key not in settings:
            settings[key] = value
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
        
        # Convert to nested structure (supporting both dicts and arrays)
        result = {}
        for key, values in parsed.items():
            # Handle nested keys like leads[status][0][id]
            parts = key.replace(']', '').split('[')
            current = result
            
            for i, part in enumerate(parts[:-1]):
                next_part = parts[i + 1] if i + 1 < len(parts) else None
                
                # Determine if next level should be dict
                # We use dict with string keys for everything (simpler)
                if part not in current:
                    current[part] = {}
                
                current = current[part]
            
            last_key = parts[-1]
            current[last_key] = values[0] if len(values) == 1 else values
        
        return result
    except Exception as e:
        logger.error(f"Failed to parse webhook body: {e}")
        return {}


def extract_lead_data(data: Dict[str, Any], field_mapping: Dict[str, str] = None) -> Dict[str, Any]:
    """Extract lead data from amoCRM webhook payload.
    
    Args:
        data: Parsed webhook data
        field_mapping: Optional dict mapping our fields to amoCRM field IDs
    """
    lead_data = {}
    field_mapping = field_mapping or {}
    
    logger.info(f"Extracting lead data with mapping: {field_mapping}")
    
    # Find lead in various possible locations
    leads = None
    if "leads" in data:
        leads_data = data["leads"]
        if "update" in leads_data:
            leads = leads_data["update"]
        elif "add" in leads_data:
            leads = leads_data["add"]
        elif "status" in leads_data:
            leads = leads_data["status"]
    
    if not leads:
        logger.warning(f"No leads found in data: {data}")
        return lead_data
    
    # Get first lead - handle both list and dict with "0" key
    lead = None
    if isinstance(leads, list):
        lead = leads[0] if leads else None
    elif isinstance(leads, dict):
        lead = leads.get("0") or leads.get(0) or next(iter(leads.values()), None)
    
    logger.info(f"Extracted lead: {lead}")
    
    if not isinstance(lead, dict):
        return lead_data
    
    # Basic fields from lead
    lead_data["amocrm_id"] = str(lead.get("id", ""))
    lead_data["amocrm_name"] = lead.get("name", "")
    lead_data["pipeline_id"] = str(lead.get("pipeline_id", ""))
    lead_data["status_id"] = str(lead.get("status_id", ""))
    lead_data["price"] = lead.get("price", 0)
    
    # Extract custom fields
    custom_fields = lead.get("custom_fields", [])
    fields_list = []
    if isinstance(custom_fields, list):
        fields_list = custom_fields
    elif isinstance(custom_fields, dict):
        fields_list = list(custom_fields.values())
    
    # Build maps of field_id -> value and field_name -> value
    field_values_by_id = {}
    field_values_by_name = {}
    
    for field in fields_list:
        if not isinstance(field, dict):
            continue
        
        field_id = str(field.get("id", ""))
        field_name = str(field.get("name", "")).lower()
        values = field.get("values", [])
        
        # Handle values as dict or list
        value = ""
        if isinstance(values, list) and values:
            value = values[0].get("value", "") if isinstance(values[0], dict) else str(values[0])
        elif isinstance(values, dict):
            first_val = values.get("0") or next(iter(values.values()), {})
            value = first_val.get("value", "") if isinstance(first_val, dict) else str(first_val)
        
        if field_id:
            field_values_by_id[field_id] = value
        if field_name:
            field_values_by_name[field_name] = value
    
    # Helper to get field value by ID or auto-detect by keywords
    def get_field_value(mapping_key, auto_keywords=None):
        if field_mapping.get(mapping_key):
            return field_values_by_id.get(field_mapping[mapping_key], "")
        if auto_keywords:
            for name, value in field_values_by_name.items():
                if any(kw in name for kw in auto_keywords):
                    return value
        return ""
    
    # === MAP ALL FIELDS ===
    
    # Имя клиента
    lead_data["fullName"] = get_field_value("fullName", ["имя", "name", "контакт", "фио", "клиент"])
    if not lead_data["fullName"]:
        lead_data["fullName"] = lead_data.get("amocrm_name", "")
    
    # Телефон клиента
    lead_data["phoneNumber"] = get_field_value("phoneNumber", ["телефон", "phone", "тел", "моб"])
    
    # Номер заказа
    lead_data["orderNumber"] = get_field_value("orderNumber", ["номер заказа", "order number", "№ заказа"])
    
    # Адрес - может быть одним полем или 3 отдельными
    full_address = get_field_value("fullAddress", ["адрес", "address"])
    
    # Если полный адрес пустой, пробуем собрать из 3 полей
    if not full_address:
        address_parts = []
        
        # Индекс
        index_val = get_field_value("addressIndex", ["индекс", "postal", "zip"])
        if index_val:
            address_parts.append(index_val)
        
        # Город
        city_val = get_field_value("addressCity", ["город", "city", "населенный пункт"])
        if city_val:
            address_parts.append(city_val)
        
        # Улица
        street_val = get_field_value("addressStreet", ["улица", "street", "ул."])
        if street_val:
            address_parts.append(street_val)
        
        if address_parts:
            full_address = ", ".join(address_parts)
    
    lead_data["fullAddress"] = full_address
    
    # Состав заказа
    lead_data["orderContents"] = get_field_value("orderContents", ["состав", "комплектация", "товар", "продукт"])
    
    # Комментарий к заказу
    lead_data["orderComment"] = get_field_value("orderComment", ["коммент", "примечан", "note", "comment"])
    
    # Сумма сделки - если не указано поле, берём из бюджета сделки
    deal_sum = get_field_value("dealSum", ["сумма сделки", "стоимость", "итого"])
    if not deal_sum and lead_data.get("price"):
        deal_sum = str(lead_data["price"])
    lead_data["dealSum"] = deal_sum
    
    # Сумма задолженности
    lead_data["debtSum"] = get_field_value("debtSum", ["задолженность", "долг", "остаток", "debt"])
    
    # Для обратной совместимости - notes
    lead_data["notes"] = lead_data.get("orderComment", "")
    
    logger.info(f"Final lead_data: {lead_data}")
    return lead_data


def get_collection_for_section(section: str):
    """Get MongoDB collection for section."""
    if section == "greenhouse":
        return greenhouse_orders
    elif section == "balia":
        return balia_orders
    elif section == "sauna":
        return sauna_orders
    return None


@router.get("/settings")
async def get_settings(request: Request):
    """Get amoCRM integration settings."""
    settings = get_amocrm_settings()
    
    # Generate webhook URLs for each section
    base_url = str(request.base_url).rstrip('/')
    
    return {
        "enabled": settings.get("enabled", False),
        # Webhook URLs for each section
        "webhook_urls": {
            "greenhouse": f"{base_url}/api/integrations/amocrm/webhook/greenhouse",
            "balia": f"{base_url}/api/integrations/amocrm/webhook/balia",
            "sauna": f"{base_url}/api/integrations/amocrm/webhook/sauna"
        },
        # Field mapping
        "field_mapping": settings.get("field_mapping", {
            "fullName": "",
            "phoneNumber": "",
            "fullAddress": "",
            "notes": ""
        }),
        # Sync settings (for two-way sync)
        "amocrm_domain": settings.get("amocrm_domain", ""),
        "amocrm_token": settings.get("amocrm_token", ""),
        "status_field_id": settings.get("status_field_id", ""),
        "comment_field_id": settings.get("comment_field_id", "")
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



@router.post("/webhook/{section}")
async def receive_webhook_section(
    request: Request,
    section: str
):
    """Receive webhook from amoCRM for a specific section.
    
    section: greenhouse, balia, or sauna
    """
    if section not in ["greenhouse", "balia", "sauna"]:
        raise HTTPException(status_code=400, detail=f"Invalid section: {section}")
    
    settings = get_amocrm_settings()
    
    # Log webhook receipt
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "amocrm",
        "section": section,
        "status": "received"
    }
    
    # Check if integration is enabled
    if not settings.get("enabled", False):
        log_entry["status"] = "rejected"
        log_entry["reason"] = "Integration disabled"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "Integration disabled"}
    
    # Parse webhook body
    body = await request.body()
    data = parse_amocrm_webhook(body)
    
    log_entry["raw_data"] = str(body[:1000])  # Truncate for logging
    
    if not data:
        log_entry["status"] = "error"
        log_entry["reason"] = "Failed to parse webhook data"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "No data to process"}
    
    # Extract lead data with field mapping from settings
    field_mapping = settings.get("field_mapping", {})
    lead_data = extract_lead_data(data, field_mapping)
    log_entry["parsed_data"] = lead_data
    
    # Get collection for this section
    collection = get_collection_for_section(section)
    if collection is None:
        log_entry["status"] = "error"
        log_entry["reason"] = f"Unknown section: {section}"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "Unknown section"}
    
    # Check if order with this amoCRM ID already exists
    amocrm_id = lead_data.get("amocrm_id")
    if amocrm_id:
        existing = collection.find_one({"amocrm_id": amocrm_id})
        if existing:
            log_entry["status"] = "skipped"
            log_entry["reason"] = "Order already exists"
            webhook_logs.insert_one(log_entry)
            return {"status": "ok", "message": "Order already exists"}
    
    # Create order
    now = datetime.now(timezone.utc).isoformat()
    section_prefix = {"greenhouse": "GH", "balia": "BAL", "sauna": "SAU"}
    section_names = {"greenhouse": "Теплицы", "balia": "Купели", "sauna": "Сауны"}
    
    order_data = {
        "id": f"AMO-{section_prefix.get(section, 'X')}-{lead_data.get('amocrm_id', int(datetime.now().timestamp()))}",
        "fullName": lead_data.get("fullName", "Без имени"),
        "phoneNumber": lead_data.get("phoneNumber", ""),
        "fullAddress": lead_data.get("fullAddress", ""),
        "notes": f"Из amoCRM ({section_names.get(section, section)}). Сделка: {lead_data.get('amocrm_name', '')}. Бюджет: {lead_data.get('price', 0)}",
        "orderDate": now,
        "createdAt": now,
        "source": "amocrm",
        "status": "new",
        "deliveryStatus": "pending",
        "deliveryComment": "",
        "amocrm_id": lead_data.get("amocrm_id"),
        "amocrm_data": lead_data
    }
    
    collection.insert_one(order_data)
    order_data.pop("_id", None)
    
    log_entry["status"] = "success"
    log_entry["created_order_id"] = order_data["id"]
    webhook_logs.insert_one(log_entry)
    
    logger.info(f"Created {section} order from amoCRM: {order_data['id']}")
    
    return {"status": "ok", "order_id": order_data["id"], "section": section}


# Keep old endpoint for backward compatibility but simplified
@router.post("/webhook")
async def receive_webhook_legacy(
    request: Request,
    key: Optional[str] = None
):
    """Legacy webhook endpoint - redirects to balia by default."""
    # For backward compatibility, default to balia section
    return await receive_webhook_section(request, "balia")


@router.post("/sync-status")
async def sync_status_to_amocrm(
    amocrm_id: str,
    status: str,
    comment: Optional[str] = None
):
    """Sync delivery status back to amoCRM.
    
    Returns success even if sync is skipped (credentials not configured)
    to avoid breaking the frontend workflow.
    """
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    status_field_id = settings.get("status_field_id", "")
    comment_field_id = settings.get("comment_field_id", "")
    
    # If credentials are not configured, skip silently
    if not domain or not token:
        logger.info(f"Skipping amoCRM sync for {amocrm_id}: credentials not configured")
        return {"status": "skipped", "message": "amoCRM credentials not configured"}
    
    # Build update payload
    custom_fields_values = []
    
    if status_field_id:
        custom_fields_values.append({
            "field_id": int(status_field_id),
            "values": [{"value": status}]
        })
    
    if comment_field_id and comment:
        custom_fields_values.append({
            "field_id": int(comment_field_id),
            "values": [{"value": comment}]
        })
    
    # If no fields configured, skip silently
    if not custom_fields_values:
        logger.info(f"Skipping amoCRM sync for {amocrm_id}: no field IDs configured")
        return {"status": "skipped", "message": "No field IDs configured for sync"}
    
    # Log sync attempt
    sync_log = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "status_sync",
        "amocrm_id": amocrm_id,
        "status": status,
        "comment": comment
    }
    
    # Make API request to amoCRM
    url = f"https://{domain}/api/v4/leads/{amocrm_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "custom_fields_values": custom_fields_values
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                sync_log["result"] = "success"
                webhook_logs.insert_one(sync_log)
                logger.info(f"Successfully synced status '{status}' to amoCRM lead {amocrm_id}")
                return {"status": "ok", "message": "Status synced to amoCRM"}
            else:
                sync_log["result"] = "error"
                sync_log["error"] = response.text
                webhook_logs.insert_one(sync_log)
                logger.error(f"amoCRM API error: {response.status_code} - {response.text}")
                # Return error info but don't throw exception
                return {
                    "status": "error", 
                    "message": f"amoCRM API error: {response.status_code}",
                    "detail": response.text
                }
    except httpx.RequestError as e:
        sync_log["result"] = "error"
        sync_log["error"] = str(e)
        webhook_logs.insert_one(sync_log)
        logger.error(f"amoCRM request error: {e}")
        return {"status": "error", "message": f"Connection error: {str(e)}"}


@router.get("/logs")
async def get_webhook_logs(limit: int = 50):
    """Get recent webhook logs."""
    logs = list(webhook_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
    return logs


@router.post("/test/{section}")
async def test_webhook(section: str):
    """Create a test order in specified section."""
    if section not in ["greenhouse", "balia", "sauna"]:
        raise HTTPException(status_code=400, detail="Invalid section")
    
    collection = get_collection_for_section(section)
    now = datetime.now(timezone.utc).isoformat()
    
    section_names = {"greenhouse": "Теплицы", "balia": "Купели", "sauna": "Сауны"}
    section_prefix = {"greenhouse": "GH", "balia": "BAL", "sauna": "SAU"}
    
    order_data = {
        "id": f"TEST-{section_prefix[section]}-{int(datetime.now().timestamp())}",
        "fullName": f"Тест amoCRM - {section_names[section]}",
        "phoneNumber": "+48 000 000 000",
        "fullAddress": f"Тестовый адрес для {section_names[section]}, Варшава",
        "notes": "Тестовый заказ для проверки интеграции",
        "orderDate": now,
        "createdAt": now,
        "source": "amocrm_test",
        "status": "new",
        "deliveryStatus": "pending",
        "deliveryComment": ""
    }
    
    collection.insert_one(order_data)
    order_data.pop("_id", None)
    
    return {"status": "ok", "message": f"Test order created in {section}", "order": order_data}
