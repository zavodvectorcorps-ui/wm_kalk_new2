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


def parse_pipe_separated_value(value: str) -> str:
    """
    Parse value and extract part after '|' separator, preserving line numbering.
    If no separator found, return full value.
    Handles multiple items separated by newlines.
    
    Example:
    "3. LUX Termiczny | LTO, 1 szt" -> "3. LTO, 1 szt"
    "SKU123 | Товар 1" -> "Товар 1"
    "Просто товар без разделителя" -> "Просто товар без разделителя"
    """
    import re
    
    if not value:
        return ""
    
    # Split by newlines to handle multiple items
    lines = value.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    result_lines = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check for numbering at the start (e.g., "3. ", "12. ", "1) ")
        numbering = ""
        numbering_match = re.match(r'^(\d+[\.\)]\s*)', line)
        if numbering_match:
            numbering = numbering_match.group(1)
            line_without_number = line[len(numbering):]
        else:
            line_without_number = line
            
        # Check if line contains '|' separator
        if '|' in line_without_number:
            # Take part after the last '|' and strip whitespace
            parts = line_without_number.split('|')
            extracted_value = parts[-1].strip()
            result_lines.append(numbering + extracted_value)
        else:
            # No separator - keep full line
            result_lines.append(line)
    
    return '\n'.join(result_lines)


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


class SectionFieldMappings(BaseModel):
    greenhouse: FieldMapping = FieldMapping()
    balia: FieldMapping = FieldMapping()
    sauna: FieldMapping = FieldMapping()


class AmoCRMSettings(BaseModel):
    enabled: bool = False
    # Field mapping - separate for each section (Dict to accept any structure)
    field_mapping: Dict[str, Any] = {}
    # amoCRM API credentials for syncing back
    amocrm_domain: str = ""  # e.g., "mycompany.amocrm.ru"
    amocrm_token: str = ""  # Long-lived token
    # Field IDs for status sync
    status_field_id: str = ""  # Custom field ID for delivery status
    comment_field_id: str = ""  # Custom field ID for comments/date
    # Field IDs for trip sync
    trip_number_field_id: str = ""  # Custom field for trip number/name
    trip_driver_field_id: str = ""  # Custom field for driver name
    trip_departure_field_id: str = ""  # Custom field for departure date
    trip_order_status_field_id: str = ""  # Custom field for order status in trip
    # Important order flag
    important_order_field_id: str = ""  # Custom field (checkbox/flag) for important orders
    # Stage sync settings
    stage_sync: Dict[str, Any] = {}
    
    class Config:
        extra = "allow"  # Allow extra fields from frontend


# Default field mapping template
DEFAULT_FIELD_MAPPING = {
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
}


def get_default_settings():
    """Get default amoCRM settings."""
    return {
        "type": "amocrm",
        "enabled": False,
        "field_mapping": {
            "greenhouse": {**DEFAULT_FIELD_MAPPING},
            "balia": {**DEFAULT_FIELD_MAPPING},
            "sauna": {**DEFAULT_FIELD_MAPPING}
        },
        "amocrm_domain": "",
        "amocrm_token": "",
        "status_field_id": "",
        "comment_field_id": "",
        "trip_number_field_id": "",
        "trip_driver_field_id": "",
        "trip_departure_field_id": "",
        "trip_order_status_field_id": "",
        "important_order_field_id": ""
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
    
    # Normalize field_mapping to new structure (separate for each section)
    field_mapping = settings.get("field_mapping", {})
    if field_mapping and "greenhouse" not in field_mapping and "balia" not in field_mapping:
        # Old structure - single mapping, convert to new structure
        old_mapping = field_mapping
        settings["field_mapping"] = {
            "greenhouse": {**DEFAULT_FIELD_MAPPING, **old_mapping},
            "balia": {**DEFAULT_FIELD_MAPPING, **old_mapping},
            "sauna": {**DEFAULT_FIELD_MAPPING, **old_mapping}
        }
    else:
        # Ensure each section has all fields
        for section in ["greenhouse", "balia", "sauna"]:
            if section not in settings["field_mapping"]:
                settings["field_mapping"][section] = {**DEFAULT_FIELD_MAPPING}
            else:
                settings["field_mapping"][section] = {
                    **DEFAULT_FIELD_MAPPING, 
                    **settings["field_mapping"].get(section, {})
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


async def fetch_lead_from_amocrm(lead_id: str, domain: str, token: str) -> Optional[Dict[str, Any]]:
    """Fetch full lead data from amoCRM API.
    
    Rate limit: max 7 requests/sec per integration.
    """
    if not domain or not token or not lead_id:
        logger.warning("Missing amoCRM credentials or lead_id for API fetch")
        return None
    
    url = f"https://{domain}/api/v4/leads/{lead_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Successfully fetched lead {lead_id} from amoCRM API")
                return data
            elif response.status_code == 429:
                logger.warning(f"amoCRM API rate limit exceeded for lead {lead_id}")
                return None
            else:
                logger.error(f"amoCRM API error {response.status_code}: {response.text}")
                return None
    except Exception as e:
        logger.error(f"Failed to fetch lead from amoCRM: {e}")
        return None


async def upload_file_to_amocrm(lead_id: str, file_content: bytes, filename: str, domain: str, token: str) -> Optional[str]:
    """Upload a file to amoCRM and attach it to a lead.
    
    Returns the file ID if successful.
    """
    if not domain or not token or not lead_id:
        logger.warning("Missing amoCRM credentials for file upload")
        return None
    
    try:
        # Step 1: Get upload URL
        upload_url = f"https://{domain}/api/v4/files"
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Upload file as multipart form data
            files = {
                "file": (filename, file_content, "image/jpeg")
            }
            data = {
                "entity_type": "leads",
                "entity_id": str(lead_id)
            }
            
            response = await client.post(upload_url, headers=headers, files=files, data=data)
            
            if response.status_code in [200, 201]:
                result = response.json()
                file_id = result.get("_embedded", {}).get("files", [{}])[0].get("id")
                logger.info(f"File uploaded to amoCRM lead {lead_id}: {file_id}")
                return file_id
            else:
                logger.error(f"amoCRM file upload error {response.status_code}: {response.text}")
                return None
                
    except Exception as e:
        logger.error(f"Failed to upload file to amoCRM: {e}")
        return None


async def add_note_to_amocrm(lead_id: str, note_text: str, domain: str, token: str) -> bool:
    """Add a note to amoCRM lead."""
    if not domain or not token or not lead_id:
        return False
    
    try:
        url = f"https://{domain}/api/v4/leads/{lead_id}/notes"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        data = [{
            "note_type": "common",
            "params": {
                "text": note_text
            }
        }]
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json=data)
            
            if response.status_code in [200, 201]:
                logger.info(f"Note added to amoCRM lead {lead_id}")
                return True
            else:
                logger.error(f"amoCRM note error {response.status_code}: {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Failed to add note to amoCRM: {e}")
        return False


def extract_lead_data_from_api(api_data: Dict[str, Any], field_mapping: Dict[str, str] = None) -> Dict[str, Any]:
    """Extract lead data from amoCRM API response (full data with custom_fields_values).
    
    API response format is different from webhook format.
    Supports both field_id mapping AND auto-detection by field name keywords.
    """
    lead_data = {}
    field_mapping = field_mapping or {}
    
    if not api_data:
        return lead_data
    
    # Basic fields from API response
    lead_data["amocrm_id"] = str(api_data.get("id", ""))
    lead_data["amocrm_name"] = api_data.get("name", "")
    lead_data["pipeline_id"] = str(api_data.get("pipeline_id", ""))
    lead_data["status_id"] = str(api_data.get("status_id", ""))
    lead_data["price"] = api_data.get("price", 0)
    
    # Extract custom_fields_values from API response
    custom_fields = api_data.get("custom_fields_values", [])
    
    # Build maps of field_id -> value AND field_name -> value for auto-detection
    field_values_by_id = {}
    field_values_by_name = {}
    
    for field in custom_fields:
        if not isinstance(field, dict):
            continue
        
        field_id = str(field.get("field_id", ""))
        field_name = str(field.get("field_name", "")).lower()
        field_code = str(field.get("field_code", "")).lower()
        values = field.get("values", [])
        
        # Get first value
        value = ""
        if isinstance(values, list) and values:
            first_val = values[0]
            if isinstance(first_val, dict):
                value = first_val.get("value", "")
            else:
                value = str(first_val)
        
        if field_id and value:
            field_values_by_id[field_id] = value
        if field_name and value:
            field_values_by_name[field_name] = value
        if field_code and value:
            field_values_by_name[field_code] = value
    
    logger.info(f"API extraction - field values by ID: {field_values_by_id}")
    logger.info(f"API extraction - field values by name: {field_values_by_name}")
    
    # Helper to get field value by ID or auto-detect by keywords (same as extract_lead_data)
    def get_field_value(mapping_key, auto_keywords=None):
        # First try by field ID from mapping
        if field_mapping.get(mapping_key):
            val = field_values_by_id.get(field_mapping[mapping_key], "")
            if val:
                return val
        # Then try auto-detection by keywords in field name
        if auto_keywords:
            for name, value in field_values_by_name.items():
                if any(kw in name for kw in auto_keywords):
                    return value
        return ""
    
    # === MAP ALL FIELDS (with auto-keywords like extract_lead_data) ===
    
    # Имя клиента
    lead_data["fullName"] = get_field_value("fullName", ["имя", "name", "контакт", "фио", "клиент"])
    if not lead_data["fullName"]:
        lead_data["fullName"] = lead_data.get("amocrm_name", "")
    
    # Телефон клиента
    lead_data["phoneNumber"] = get_field_value("phoneNumber", ["телефон", "phone", "тел", "моб"])
    
    # Номер заказа
    order_number = get_field_value("orderNumber", ["номер заказа", "order number", "№ заказа"])
    if not order_number:
        order_number = str(lead_data.get("amocrm_id", ""))
    lead_data["orderNumber"] = order_number
    
    # amoCRM link - generate direct link to lead card
    amocrm_id = lead_data.get("amocrm_id")
    if amocrm_id:
        lead_data["amocrm_link"] = f"/leads/detail/{amocrm_id}"
    
    # Адрес - всегда собираем из 3 полей (улица, город, индекс)
    index_val = get_field_value("addressIndex", ["индекс", "postal", "zip", "kod"])
    city_val = get_field_value("addressCity", ["город", "city", "населенный пункт", "miasto"])
    street_val = get_field_value("addressStreet", ["улица", "street", "ул.", "adres", "адрес"])
    
    # Store individual parts for reference
    lead_data["addressIndex"] = index_val or ""
    lead_data["addressCity"] = city_val or ""
    lead_data["addressStreet"] = street_val or ""
    
    # Build full address - put street first, then city, then index
    address_parts = []
    if street_val:
        address_parts.append(street_val)
    if city_val:
        address_parts.append(city_val)
    if index_val:
        address_parts.append(index_val)
    
    full_address = ", ".join(address_parts) if address_parts else ""
    lead_data["fullAddress"] = full_address
    
    # Состав заказа - извлекаем значения после разделителя "|" если он есть
    raw_order_contents = get_field_value("orderContents", ["состав", "комплектация", "товар", "продукт"])
    lead_data["orderContents"] = parse_pipe_separated_value(raw_order_contents)
    
    # Комментарий к заказу
    lead_data["orderComment"] = get_field_value("orderComment", ["коммент", "примечан", "note", "comment"])
    
    # Сумма сделки
    deal_sum = get_field_value("dealSum", ["сумма сделки", "стоимость", "итого"])
    if not deal_sum and lead_data.get("price"):
        deal_sum = str(lead_data["price"])
    lead_data["dealSum"] = deal_sum
    
    # Сумма задолженности
    lead_data["debtSum"] = get_field_value("debtSum", ["задолженность", "долг", "остаток", "debt"])
    
    # Notes for compatibility
    lead_data["notes"] = lead_data.get("orderComment", "")
    
    logger.info(f"Final lead_data from API: {lead_data}")
    return lead_data


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
    # Всегда собираем адрес из 3 полей (улица, город, индекс)
    # Индекс
    index_val = get_field_value("addressIndex", ["индекс", "postal", "zip", "kod"])
    
    # Город
    city_val = get_field_value("addressCity", ["город", "city", "населенный пункт", "miasto"])
    
    # Улица
    street_val = get_field_value("addressStreet", ["улица", "street", "ул.", "adres", "адрес"])
    
    # Store individual parts
    lead_data["addressIndex"] = index_val if index_val else ""
    lead_data["addressCity"] = city_val if city_val else ""
    lead_data["addressStreet"] = street_val if street_val else ""
    
    # Build full address - put street first, then city, then index
    address_parts = []
    if street_val:
        address_parts.append(street_val)
    if city_val:
        address_parts.append(city_val)
    if index_val:
        address_parts.append(index_val)
    
    full_address = ", ".join(address_parts) if address_parts else ""
    lead_data["fullAddress"] = full_address
    
    # Состав заказа - извлекаем значения после разделителя "|" если он есть
    raw_order_contents = get_field_value("orderContents", ["состав", "комплектация", "товар", "продукт"])
    lead_data["orderContents"] = parse_pipe_separated_value(raw_order_contents)
    
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
    
    default_mapping = {
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
    }
    
    # Get field mapping from settings, ensure structure for each section
    saved_mapping = settings.get("field_mapping", {})
    field_mapping = {}
    # Webhook sections (for order import)
    for section in ["greenhouse", "balia", "sauna"]:
        section_mapping = saved_mapping.get(section, {})
        # Merge default with saved, preserving saved values
        field_mapping[section] = {**default_mapping, **section_mapping}
    # Calculator sections (for opening from amoCRM) - no defaults needed
    for calc_section in ["calculatorBalia", "calculatorSauna"]:
        field_mapping[calc_section] = saved_mapping.get(calc_section, {})
    
    return {
        "enabled": settings.get("enabled", False),
        # Webhook URLs for each section
        "webhook_urls": {
            "greenhouse": f"{base_url}/api/integrations/amocrm/webhook/greenhouse",
            "balia": f"{base_url}/api/integrations/amocrm/webhook/balia",
            "sauna": f"{base_url}/api/integrations/amocrm/webhook/sauna"
        },
        # Field mapping - separate for each section
        "field_mapping": field_mapping,
        # Sync settings (for two-way sync)
        "amocrm_domain": settings.get("amocrm_domain", ""),
        "amocrm_token": settings.get("amocrm_token", ""),
        "status_field_id": settings.get("status_field_id", ""),
        "comment_field_id": settings.get("comment_field_id", ""),
        # Trip sync fields
        "trip_number_field_id": settings.get("trip_number_field_id", ""),
        "trip_driver_field_id": settings.get("trip_driver_field_id", ""),
        "trip_departure_field_id": settings.get("trip_departure_field_id", ""),
        "trip_order_status_field_id": settings.get("trip_order_status_field_id", ""),
        # Important order field
        "important_order_field_id": settings.get("important_order_field_id", "")
    }


@router.get("/debug-info")
async def get_debug_info():
    """Get debug information about PDF upload system - V7-chunked version."""
    
    # Get last 20 PDF upload logs
    pdf_logs = list(webhook_logs.find(
        {"type": "calculator_pdf_upload"},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20))
    
    # Get amoCRM settings (without token)
    settings = get_amocrm_settings()
    
    return {
        "code_version": "V7-chunked",
        "debug_endpoint_version": "2026-01-17",
        "amocrm_configured": bool(settings.get("amocrm_domain") and settings.get("amocrm_token")),
        "amocrm_domain": settings.get("amocrm_domain", ""),
        "recent_pdf_uploads": pdf_logs,
        "total_pdf_logs": webhook_logs.count_documents({"type": "calculator_pdf_upload"})
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
    
    # Get field mapping for this specific section
    all_mappings = settings.get("field_mapping", {})
    # Support both old (flat) and new (per-section) structure
    if section in all_mappings:
        field_mapping = all_mappings[section]
    else:
        field_mapping = all_mappings  # Old flat structure
    
    # First extract basic data from webhook to get lead ID
    basic_lead_data = extract_lead_data(data, field_mapping)
    lead_id = basic_lead_data.get("amocrm_id")
    
    log_entry["webhook_lead_id"] = lead_id
    
    # Get collection for this section
    collection = get_collection_for_section(section)
    if collection is None:
        log_entry["status"] = "error"
        log_entry["reason"] = f"Unknown section: {section}"
        webhook_logs.insert_one(log_entry)
        return {"status": "ok", "message": "Unknown section"}
    
    # Check if order with this amoCRM ID already exists
    if lead_id:
        existing = collection.find_one({"amocrm_id": lead_id})
        if existing:
            log_entry["status"] = "skipped"
            log_entry["reason"] = "Order already exists"
            webhook_logs.insert_one(log_entry)
            return {"status": "ok", "message": "Order already exists"}
    
    # Try to fetch full lead data from amoCRM API
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    lead_data = basic_lead_data  # Default to webhook data
    
    if domain and token and lead_id:
        log_entry["api_fetch_attempt"] = True
        api_data = await fetch_lead_from_amocrm(lead_id, domain, token)
        
        if api_data:
            # Use API data which includes custom_fields_values
            lead_data = extract_lead_data_from_api(api_data, field_mapping)
            log_entry["api_fetch_success"] = True
            log_entry["api_data_fields"] = list(api_data.get("custom_fields_values", []))[:5]  # Log first 5 fields
        else:
            log_entry["api_fetch_success"] = False
            log_entry["api_fetch_note"] = "Using webhook data (API fetch failed)"
    else:
        log_entry["api_fetch_attempt"] = False
        log_entry["api_fetch_note"] = "API credentials not configured - using webhook data only"
    
    log_entry["parsed_data"] = lead_data
    
    # Create order with all mapped fields
    now = datetime.now(timezone.utc).isoformat()
    section_prefix = {"greenhouse": "GH", "balia": "BAL", "sauna": "SAU"}
    section_names = {"greenhouse": "Теплицы", "balia": "Купели", "sauna": "Сауны"}
    
    # Build notes from various fields
    notes_parts = []
    notes_parts.append(f"Из amoCRM ({section_names.get(section, section)})")
    if lead_data.get("amocrm_name"):
        notes_parts.append(f"Сделка: {lead_data['amocrm_name']}")
    if lead_data.get("orderContents"):
        notes_parts.append(f"Состав: {lead_data['orderContents']}")
    if lead_data.get("orderComment"):
        notes_parts.append(f"Комментарий: {lead_data['orderComment']}")
    
    # Generate full amoCRM link with domain
    amocrm_link = ""
    domain = settings.get("amocrm_domain", "")
    if domain and lead_data.get("amocrm_id"):
        # Remove protocol if present
        domain_clean = domain.replace("https://", "").replace("http://", "").rstrip("/")
        amocrm_link = f"https://{domain_clean}/leads/detail/{lead_data.get('amocrm_id')}"
    
    # Check if order is important based on amoCRM flag field
    is_important = False
    important_field_id = settings.get("important_order_field_id", "")
    if important_field_id and api_data:
        custom_fields = api_data.get("custom_fields_values", [])
        for field in custom_fields:
            if str(field.get("field_id", "")) == important_field_id:
                values = field.get("values", [])
                if values:
                    # Checkbox fields in amoCRM return value as boolean or "1"/"true"
                    first_val = values[0] if isinstance(values, list) else values
                    if isinstance(first_val, dict):
                        val = first_val.get("value", False)
                    else:
                        val = first_val
                    # Check for truthy values
                    is_important = val in [True, "true", "1", 1, "да", "yes"]
                break
        logger.info(f"Important field check: field_id={important_field_id}, is_important={is_important}")
    
    order_data = {
        "id": f"AMO-{section_prefix.get(section, 'X')}-{lead_data.get('amocrm_id', int(datetime.now().timestamp()))}",
        "fullName": lead_data.get("fullName", "") or "Без имени",
        "phoneNumber": lead_data.get("phoneNumber", ""),
        "fullAddress": lead_data.get("fullAddress", ""),
        "orderNumber": lead_data.get("orderNumber", "") or str(lead_data.get("amocrm_id", "")),
        "orderContents": lead_data.get("orderContents", ""),
        "orderComment": lead_data.get("orderComment", ""),
        "dealSum": lead_data.get("dealSum", ""),
        "debtSum": lead_data.get("debtSum", ""),
        "notes": ". ".join(notes_parts),
        "orderDate": now,
        "createdAt": now,
        "transferredAt": now,  # Date/time of transfer from amoCRM
        "source": "amocrm",
        "status": "new",
        "deliveryStatus": "pending",  # pending, delivering, delivered, cancelled
        "deliveryComment": "",
        "isImportant": is_important,  # Flag from amoCRM
        "amocrm_id": lead_data.get("amocrm_id"),
        "amocrm_link": amocrm_link,
        "amocrm_data": lead_data,
        "changeHistory": []  # Initialize empty change history
    }
    
    collection.insert_one(order_data)
    order_data.pop("_id", None)
    
    log_entry["status"] = "success"
    log_entry["created_order_id"] = order_data["id"]
    webhook_logs.insert_one(log_entry)
    
    logger.info(f"Created {section} order from amoCRM: {order_data['id']}")
    
    return {"status": "ok", "order_id": order_data["id"], "section": section}


@router.delete("/orders/{section}")
async def delete_amocrm_orders(section: str):
    """Delete all amoCRM orders from a section.
    
    Useful for clearing test orders before reconfiguring.
    """
    if section not in ["greenhouse", "balia", "sauna", "all"]:
        raise HTTPException(status_code=400, detail=f"Invalid section: {section}")
    
    deleted_count = 0
    
    if section == "all" or section == "greenhouse":
        result = greenhouse_orders.delete_many({"source": "amocrm"})
        deleted_count += result.deleted_count
    
    if section == "all" or section == "balia":
        result = balia_orders.delete_many({"source": "amocrm"})
        deleted_count += result.deleted_count
    
    if section == "all" or section == "sauna":
        result = sauna_orders.delete_many({"source": "amocrm"})
        deleted_count += result.deleted_count
    
    logger.info(f"Deleted {deleted_count} amoCRM orders from {section}")
    
    return {"status": "ok", "deleted_count": deleted_count, "section": section}


@router.post("/sync-missing/{section}")
async def sync_missing_orders(
    section: str,
    lead_ids: List[str] = []
):
    """Sync missing orders from amoCRM by their lead IDs.
    
    Fetches lead data from amoCRM API and creates orders in the local database.
    Uses the same field extraction logic as the main webhook sync.
    """
    if section not in ["greenhouse", "balia", "sauna"]:
        raise HTTPException(status_code=400, detail=f"Invalid section: {section}")
    
    # Get amoCRM settings
    settings = integration_settings.find_one({"type": "amocrm"}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=400, detail="amoCRM not configured")
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        raise HTTPException(status_code=400, detail="amoCRM credentials not set")
    
    # Get collection for section
    collection = {
        "greenhouse": greenhouse_orders,
        "balia": balia_orders,
        "sauna": sauna_orders
    }[section]
    
    # Get field mapping for this section (same logic as webhook)
    all_mappings = settings.get("field_mapping", {})
    # Support both old (flat) and new (per-section) structure
    if section in all_mappings:
        section_mapping = all_mappings[section]
    else:
        section_mapping = all_mappings  # Old flat structure
    
    results = {
        "synced": [],
        "failed": [],
        "already_exists": []
    }
    
    section_prefix = {"greenhouse": "GH", "balia": "BAL", "sauna": "SAU"}
    section_names = {"greenhouse": "Теплицы", "balia": "Купели", "sauna": "Сауны"}
    
    for lead_id in lead_ids:
        try:
            # Check if order already exists
            existing = collection.find_one({"amocrm_id": str(lead_id)})
            if existing:
                results["already_exists"].append(lead_id)
                continue
            
            # Fetch lead data from amoCRM API
            api_data = await fetch_lead_from_amocrm(str(lead_id), domain, token)
            
            if not api_data:
                results["failed"].append({"id": lead_id, "reason": "Lead not found in amoCRM"})
                continue
            
            # Use the same extraction function as webhook
            lead_data = extract_lead_data_from_api(api_data, section_mapping)
            
            if not lead_data:
                results["failed"].append({"id": lead_id, "reason": "Failed to extract lead data"})
                continue
            
            # Build notes from various fields (same as webhook)
            notes_parts = []
            notes_parts.append(f"Из amoCRM ({section_names.get(section, section)})")
            if lead_data.get("amocrm_name"):
                notes_parts.append(f"Сделка: {lead_data['amocrm_name']}")
            if lead_data.get("orderContents"):
                notes_parts.append(f"Состав: {lead_data['orderContents']}")
            if lead_data.get("orderComment"):
                notes_parts.append(f"Комментарий: {lead_data['orderComment']}")
            
            # Generate full amoCRM link with domain
            amocrm_link = ""
            domain_clean = domain.replace("https://", "").replace("http://", "").rstrip("/")
            if lead_data.get("amocrm_id"):
                amocrm_link = f"https://{domain_clean}/leads/detail/{lead_data.get('amocrm_id')}"
            
            # Check if order is important based on amoCRM flag field
            is_important = False
            important_field_id = settings.get("important_order_field_id", "")
            if important_field_id and api_data:
                custom_fields = api_data.get("custom_fields_values", [])
                for field in custom_fields:
                    if str(field.get("field_id", "")) == important_field_id:
                        values = field.get("values", [])
                        if values:
                            first_val = values[0] if isinstance(values, list) else values
                            if isinstance(first_val, dict):
                                val = first_val.get("value", False)
                            else:
                                val = first_val
                            is_important = val in [True, "true", "1", 1, "да", "yes"]
                        break
            
            # Create order with ALL fields (same as webhook)
            now = datetime.now(timezone.utc).isoformat()
            order_id = f"AMO-{section_prefix.get(section, 'X')}-{lead_data.get('amocrm_id', int(datetime.now().timestamp()))}"
            
            order_data = {
                "id": order_id,
                "fullName": lead_data.get("fullName", "") or "Без имени",
                "phoneNumber": lead_data.get("phoneNumber", ""),
                "fullAddress": lead_data.get("fullAddress", ""),
                "addressIndex": lead_data.get("addressIndex", ""),
                "addressCity": lead_data.get("addressCity", ""),
                "addressStreet": lead_data.get("addressStreet", ""),
                "orderNumber": lead_data.get("orderNumber", "") or str(lead_data.get("amocrm_id", "")),
                "orderContents": lead_data.get("orderContents", ""),
                "orderComment": lead_data.get("orderComment", ""),
                "dealSum": lead_data.get("dealSum", ""),
                "debtSum": lead_data.get("debtSum", ""),
                "notes": ". ".join(notes_parts),
                "orderDate": now,
                "createdAt": now,
                "transferredAt": now,  # Date/time of transfer from amoCRM
                "source": "amocrm",
                "status": "new",
                "deliveryStatus": "pending",
                "deliveryComment": "",
                "warehouseStatus": "request",
                "isImportant": is_important,
                "amocrm_id": lead_data.get("amocrm_id"),
                "amocrm_link": amocrm_link,
                "amocrm_data": lead_data,
                "changeHistory": []  # Initialize empty change history
            }
            
            # Insert order
            collection.insert_one(order_data)
            order_data.pop("_id", None)
            
            results["synced"].append({
                "id": order_id,
                "amocrm_id": lead_id,
                "name": order_data.get("fullName")
            })
            
            logger.info(f"Synced missing order from amoCRM: {order_id} with all fields")
            
        except Exception as e:
            logger.error(f"Error syncing lead {lead_id}: {e}")
            results["failed"].append({"id": lead_id, "reason": str(e)})
    
    return {
        "status": "ok",
        "section": section,
        "synced_count": len(results["synced"]),
        "failed_count": len(results["failed"]),
        "already_exists_count": len(results["already_exists"]),
        "details": results
    }


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


@router.get("/stage-stats/{pipeline_id}/{status_id}")
async def get_stage_statistics(pipeline_id: int, status_id: int):
    """Get statistics for a specific pipeline stage from amoCRM.
    
    Returns count and sum of leads on the specified stage.
    """
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        return {"error": "amoCRM не настроен", "count": 0, "sum": 0}
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Fetch leads from specific pipeline and status
        url = f"https://{domain}/api/v4/leads"
        params = {
            "filter[statuses][0][pipeline_id]": pipeline_id,
            "filter[statuses][0][status_id]": status_id,
            "limit": 250  # Max allowed
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                leads = data.get("_embedded", {}).get("leads", [])
                
                total_count = len(leads)
                total_sum = sum(lead.get("price", 0) or 0 for lead in leads)
                
                # Get lead IDs for comparison
                lead_ids = [str(lead.get("id")) for lead in leads]
                
                return {
                    "count": total_count,
                    "sum": total_sum,
                    "lead_ids": lead_ids,
                    "pipeline_id": pipeline_id,
                    "status_id": status_id
                }
            elif response.status_code == 204:
                return {"count": 0, "sum": 0, "lead_ids": []}
            else:
                logger.error(f"amoCRM stage stats error: {response.status_code} - {response.text}")
                return {"error": f"Ошибка API: {response.status_code}", "count": 0, "sum": 0}
                
    except Exception as e:
        logger.error(f"Failed to get stage stats: {e}")
        return {"error": str(e), "count": 0, "sum": 0}


@router.get("/pipelines")
async def get_pipelines():
    """Get all pipelines and their stages from amoCRM."""
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        return {"error": "amoCRM не настроен", "pipelines": []}
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        url = f"https://{domain}/api/v4/leads/pipelines"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                pipelines = data.get("_embedded", {}).get("pipelines", [])
                
                result = []
                for pipeline in pipelines:
                    statuses = pipeline.get("_embedded", {}).get("statuses", [])
                    result.append({
                        "id": pipeline.get("id"),
                        "name": pipeline.get("name"),
                        "statuses": [
                            {
                                "id": s.get("id"),
                                "name": s.get("name"),
                                "color": s.get("color")
                            }
                            for s in statuses
                        ]
                    })
                
                return {"pipelines": result}
            else:
                return {"error": f"Ошибка API: {response.status_code}", "pipelines": []}
                
    except Exception as e:
        logger.error(f"Failed to get pipelines: {e}")
        return {"error": str(e), "pipelines": []}


@router.post("/upload-delivery-photo")
async def upload_delivery_photo_to_amocrm(
    amocrm_id: str,
    order_id: str,
    driver_name: str = "",
    received_amount: str = ""
):
    """Upload delivery photo to amoCRM and add a note.
    
    Adds a note with delivery info and uploads the photo as a file to amoCRM.
    """
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        return {"status": "skipped", "message": "amoCRM credentials not configured"}
    
    # Get photo from delivery_photos collection
    delivery_photos = db["delivery_photos"]
    photo_record = delivery_photos.find_one({"orderId": order_id}, {"_id": 0})
    
    if not photo_record or not photo_record.get("photoUrl"):
        return {"status": "error", "message": "Photo not found"}
    
    # Add note with delivery info
    note_text = f"""✅ Доставка подтверждена

📦 Заказ: {order_id}
🚚 Водитель: {driver_name or 'Не указан'}
💰 Получено: {received_amount or 'Не указано'}
📅 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}

📷 Фото акта доставки загружено."""
    
    note_added = await add_note_to_amocrm(amocrm_id, note_text, domain, token)
    
    # Try to upload photo to amoCRM files
    photo_uploaded = False
    try:
        photo_url = photo_record.get("photoUrl", "")
        if photo_url.startswith("data:"):
            # Extract base64 data
            import base64
            header, data = photo_url.split(",", 1)
            content_type = header.split(":")[1].split(";")[0]
            file_bytes = base64.b64decode(data)
            
            # Upload file to amoCRM
            # amoCRM API v4 uses /api/v4/leads/{id}/files endpoint
            upload_url = f"https://{domain}/api/v4/leads/{amocrm_id}/files"
            
            # Determine file extension
            ext = "jpg"
            if "png" in content_type:
                ext = "png"
            elif "gif" in content_type:
                ext = "gif"
            
            filename = f"delivery_{order_id}.{ext}"
            
            # amoCRM expects multipart form data
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                files = {
                    "file": (filename, file_bytes, content_type)
                }
                headers = {"Authorization": f"Bearer {token}"}
                
                response = await client.post(upload_url, files=files, headers=headers)
                
                if response.status_code in [200, 201]:
                    photo_uploaded = True
                    logger.info(f"✅ Photo uploaded to amoCRM for lead {amocrm_id}")
                else:
                    logger.warning(f"Failed to upload photo to amoCRM: {response.status_code} - {response.text[:200]}")
    except Exception as e:
        logger.error(f"Error uploading photo to amoCRM: {e}")
    
    if note_added:
        # Log sync
        webhook_logs.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "delivery_photo_sync",
            "amocrm_id": amocrm_id,
            "order_id": order_id,
            "driver_name": driver_name,
            "photo_uploaded": photo_uploaded,
            "result": "success"
        })
        return {"status": "ok", "message": "Delivery note added to amoCRM", "photo_uploaded": photo_uploaded}
    else:
        return {"status": "error", "message": "Failed to add note to amoCRM"}


@router.post("/upload-calculator-pdf")
async def upload_calculator_pdf_to_amocrm(
    request: Request,
    amocrm_id: str,
    order_id: str,
    calculator_type: str = "sauna",
    client_name: str = ""
):
    """Upload calculator PDF to amoCRM lead - V5-drive version.
    
    Uses Kommo Drive file service for uploads.
    """
    # Log version for debugging
    logger.info(f"=== upload_calculator_pdf V7-chunked called ===")
    logger.info(f"amocrm_id={amocrm_id}, order_id={order_id}, calculator_type={calculator_type}")
    
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        return {"status": "skipped", "message": "amoCRM credentials not configured", "code_version": "V7-chunked"}
    
    # Get PDF content from request body
    pdf_bytes = await request.body()
    
    if not pdf_bytes or len(pdf_bytes) < 100:
        return {"status": "error", "message": "No PDF data received", "code_version": "V7-chunked"}
    
    # Save PDF to database for download link (since direct amoCRM upload has issues)
    pdf_saved = False
    pdf_download_url = None
    
    try:
        # Save PDF to database
        pdf_collection = db["calculator_pdfs"]
        pdf_doc = {
            "order_id": order_id,
            "amocrm_id": amocrm_id,
            "calculator_type": calculator_type,
            "client_name": client_name,
            "pdf_data": pdf_bytes,
            "filename": f"KP_{calculator_type.upper()}_{order_id}.pdf",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        pdf_collection.update_one(
            {"order_id": order_id},
            {"$set": pdf_doc},
            upsert=True
        )
        pdf_saved = True
        
        # Build download URL
        app_domain = os.environ.get("APP_DOMAIN", "")
        if app_domain:
            base_url = f"https://{app_domain}"
        else:
            try:
                with open("/app/frontend/.env", "r") as f:
                    for line in f:
                        if line.startswith("REACT_APP_BACKEND_URL="):
                            base_url = line.strip().split("=", 1)[1]
                            break
            except:
                base_url = "https://wm-kalkulator.pl"
        
        pdf_download_url = f"{base_url}/api/integrations/amocrm/calculator-pdf/{order_id}"
        
    except Exception as e:
        logger.error(f"Error saving PDF: {e}")
    
    # Add note with download link
    calc_name = "Сауна" if calculator_type == "sauna" else "Купель"
    
    # Try to upload PDF to amoCRM via File API
    # Kommo uses separate file service (drive-X.amocrm.ru)
    # Step 1: Get drive_url from account info  
    # Step 2: Create upload session on drive
    # Step 3: Upload file to session URL
    # Step 4: Attach file UUID to lead as note
    pdf_uploaded = False
    upload_error = None
    
    try:
        # Clean filename
        safe_name = (client_name or 'Client').replace(' ', '_')
        safe_name = ''.join(c for c in safe_name if c.isalnum() or c in '_-')
        if not safe_name:
            safe_name = 'Client'
        filename = f"KP_{calc_name}_{safe_name}_{order_id}.pdf"
        file_size = len(pdf_bytes)
        
        logger.info(f"=== PDF Upload V7 (Kommo Drive Chunked) ===")
        logger.info(f"domain: {domain}, amocrm_id: {amocrm_id}")
        logger.info(f"filename: {filename}, size: {file_size}")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as http_client:
            # Step 1: Get drive_url from account
            # Response: { "_embedded": { "account": { "drive_url": "https://drive-b.amocrm.ru" } } }
            account_url = f"https://{domain}/api/v4/account?with=drive_url"
            logger.info(f"Step 1: Getting drive_url from {account_url}")
            
            account_resp = await http_client.get(account_url, headers=headers)
            logger.info(f"Account response: {account_resp.status_code} - {account_resp.text[:500]}")
            
            if account_resp.status_code != 200:
                upload_error = f"[V5] Failed to get account: {account_resp.status_code} - {account_resp.text[:200]}"
                logger.error(upload_error)
            else:
                account_data = account_resp.json()
                # drive_url is in _embedded.account.drive_url OR directly in drive_url
                drive_url = account_data.get("drive_url")
                if not drive_url:
                    drive_url = account_data.get("_embedded", {}).get("account", {}).get("drive_url")
                if not drive_url:
                    # Try root level
                    drive_url = account_data.get("drive_url")
                    
                logger.info(f"Got drive_url: {drive_url}")
                
                if not drive_url:
                    upload_error = f"[V5] No drive_url in account response: {account_data}"
                    logger.error(upload_error)
                else:
                    # Step 2: Create upload session on drive
                    # POST {drive_url}/v1.0/sessions with: file_name, file_size, content_type
                    # NOTE: Kommo uses file_name and file_size (with underscores!)
                    session_url = f"{drive_url}/v1.0/sessions"
                    session_data = {
                        "file_name": filename,  # Kommo requires file_name (with underscore)
                        "file_size": file_size,  # Kommo requires file_size (with underscore)
                        "content_type": "application/pdf"
                    }
                    
                    logger.info(f"Step 2: Creating session at {session_url}")
                    logger.info(f"Session data: {session_data}")
                    
                    session_resp = await http_client.post(
                        session_url,
                        json=session_data,
                        headers={**headers, "Content-Type": "application/json"}
                    )
                    
                    logger.info(f"Session response: {session_resp.status_code} - {session_resp.text[:500]}")
                    
                    if session_resp.status_code not in [200, 201]:
                        upload_error = f"[V6] Session failed: {session_resp.status_code} - {session_resp.text[:300]}"
                        logger.error(upload_error)
                    else:
                        session_result = session_resp.json()
                        upload_url = session_result.get("upload_url")
                        session_id = session_result.get("session_id")
                        max_part_size = session_result.get("max_part_size", 524288)  # Default 512KB
                        
                        logger.info(f"Got upload_url: {upload_url}")
                        logger.info(f"Got session_id: {session_id}")
                        logger.info(f"Got max_part_size: {max_part_size}")
                        
                        if not upload_url:
                            upload_error = f"[V7] No upload_url: {session_result}"
                            logger.error(upload_error)
                        else:
                            # Step 3: Upload file in chunks if needed
                            # Kommo has max_part_size limit (usually 512KB)
                            # If file > max_part_size, upload in parts
                            # Each part upload returns next_url for next chunk
                            # Final part upload returns uuid
                            
                            file_uuid = None
                            current_url = upload_url
                            offset = 0
                            part_num = 1
                            
                            logger.info(f"Step 3: Uploading file in chunks (size={file_size}, max_part={max_part_size})")
                            
                            while offset < file_size:
                                # Get chunk
                                chunk_end = min(offset + max_part_size, file_size)
                                chunk = pdf_bytes[offset:chunk_end]
                                is_final = (chunk_end >= file_size)
                                
                                logger.info(f"Uploading part {part_num}: bytes {offset}-{chunk_end} ({len(chunk)} bytes), final={is_final}")
                                
                                upload_resp = await http_client.post(
                                    current_url,
                                    content=chunk,
                                    headers={
                                        **headers,
                                        "Content-Type": "application/octet-stream"
                                    }
                                )
                                
                                logger.info(f"Part {part_num} response: {upload_resp.status_code} - {upload_resp.text[:300]}")
                                
                                if upload_resp.status_code not in [200, 201]:
                                    upload_error = f"[V7] Upload part {part_num} failed: {upload_resp.status_code} - {upload_resp.text[:200]}"
                                    logger.error(upload_error)
                                    break
                                
                                upload_result = upload_resp.json()
                                
                                if is_final:
                                    # Final part - should return uuid
                                    file_uuid = upload_result.get("uuid")
                                    logger.info(f"Final part uploaded, got uuid: {file_uuid}")
                                else:
                                    # Not final - get next_url for next chunk
                                    next_url = upload_result.get("next_url")
                                    if not next_url:
                                        upload_error = f"[V7] No next_url in response: {upload_result}"
                                        logger.error(upload_error)
                                        break
                                    current_url = next_url
                                    logger.info(f"Got next_url for part {part_num + 1}")
                                
                                offset = chunk_end
                                part_num += 1
                            
                            if file_uuid:
                                # Step 4: Attach file to lead via notes
                                # POST /api/v4/leads/{id}/notes with attachments array
                                notes_url = f"https://{domain}/api/v4/leads/{amocrm_id}/notes"
                                note_data = [{
                                    "note_type": "attachment",
                                    "params": {
                                        "attachments": [{
                                            "file_uuid": file_uuid,
                                            "version_uuid": file_uuid,
                                            "file_name": filename
                                        }]
                                    }
                                }]
                                
                                logger.info(f"Step 4: Attaching to lead at {notes_url}")
                                logger.info(f"Note data: {note_data}")
                                
                                attach_resp = await http_client.post(
                                    notes_url,
                                    json=note_data,
                                    headers={**headers, "Content-Type": "application/json"}
                                )
                                
                                logger.info(f"Attach response: {attach_resp.status_code} - {attach_resp.text[:300]}")
                                
                                if attach_resp.status_code in [200, 201]:
                                    pdf_uploaded = True
                                    logger.info(f"✅ PDF uploaded via Kommo Drive V7 (chunked)!")
                                else:
                                    upload_error = f"[V7] Attach failed: {attach_resp.status_code} - {attach_resp.text[:200]}"
                                    logger.error(upload_error)
                            elif not upload_error:
                                upload_error = f"[V7] No uuid after upload"
                                logger.error(upload_error)
                
    except Exception as e:
        upload_error = f"[V7] Exception: {str(e)}"
        logger.error(f"Error uploading PDF to amoCRM: {e}")
    
    # Add text note with info (and download link as backup)
    note_text = f"""📄 Коммерческое предложение создано

🧮 Калькулятор: {calc_name}
📦 Номер заказа: {order_id}
👤 Клиент: {client_name or 'Не указан'}
📅 Дата: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}

📎 {'PDF файл прикреплён выше' if pdf_uploaded else f'Скачать PDF: {pdf_download_url}'}"""

    note_added = await add_note_to_amocrm(amocrm_id, note_text, domain, token)
    
    # Log
    webhook_logs.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "calculator_pdf_upload",
        "amocrm_id": amocrm_id,
        "order_id": order_id,
        "calculator_type": calculator_type,
        "pdf_saved": pdf_saved,
        "pdf_uploaded": pdf_uploaded,
        "note_added": note_added,
        "upload_error": upload_error,
        "result": "success" if pdf_uploaded else "partial"
    })
    
    return {
        "status": "ok" if pdf_uploaded else "partial",
        "message": "PDF uploaded to amoCRM" if pdf_uploaded else f"PDF saved with download link",
        "code_version": "V7-chunked",  # Version marker to confirm deployment
        "pdf_saved": pdf_saved,
        "pdf_uploaded": pdf_uploaded,
        "pdf_url": pdf_download_url,
        "note_added": note_added,
        "upload_error": upload_error
    }


@router.get("/calculator-pdf/{order_id}")
async def download_calculator_pdf(order_id: str):
    """Download saved calculator PDF by order ID."""
    from fastapi.responses import Response
    
    pdf_collection = db["calculator_pdfs"]
    pdf_doc = pdf_collection.find_one({"order_id": order_id}, {"_id": 0})
    
    if not pdf_doc or not pdf_doc.get("pdf_data"):
        return {"status": "error", "message": "PDF not found"}
    
    pdf_bytes = pdf_doc["pdf_data"]
    filename = pdf_doc.get("filename", f"KP_{order_id}.pdf")
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.post("/sync-order")
async def sync_order_to_amocrm(
    amocrm_id: str,
    # Delivery status fields
    delivery_status: Optional[str] = None,
    delivery_comment: Optional[str] = None,
    # Trip fields (from order)
    trip_name: Optional[str] = None,
    trip_driver_name: Optional[str] = None,
    trip_departure_date: Optional[str] = None,
    trip_order_status: Optional[str] = None
):
    """Sync order data (including trip info) to amoCRM.
    
    This endpoint sends all order-related fields to amoCRM:
    - Delivery status and comment
    - Trip name, driver, departure date, order status in trip
    
    Fields are read from the order document which contains trip data
    synced from the trip when order was added to trip.
    """
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    # Field IDs from settings
    status_field_id = settings.get("status_field_id", "")
    comment_field_id = settings.get("comment_field_id", "")
    trip_number_field_id = settings.get("trip_number_field_id", "")
    trip_driver_field_id = settings.get("trip_driver_field_id", "")
    trip_departure_field_id = settings.get("trip_departure_field_id", "")
    trip_order_status_field_id = settings.get("trip_order_status_field_id", "")
    
    # If credentials are not configured, skip silently
    if not domain or not token:
        logger.info(f"Skipping amoCRM sync for {amocrm_id}: credentials not configured")
        return {"status": "skipped", "message": "amoCRM credentials not configured"}
    
    # Status labels for trip order status
    STATUS_LABELS = {
        "pending": "Ожидает",
        "delivering": "В пути",
        "delivered": "Доставлен",
        "cancelled": "Отменён"
    }
    
    # Build update payload
    custom_fields_values = []
    
    # Delivery status
    if status_field_id and delivery_status:
        try:
            custom_fields_values.append({
                "field_id": int(status_field_id),
                "values": [{"value": delivery_status}]
            })
        except ValueError:
            pass
    
    # Delivery comment
    if comment_field_id and delivery_comment:
        try:
            custom_fields_values.append({
                "field_id": int(comment_field_id),
                "values": [{"value": delivery_comment}]
            })
        except ValueError:
            pass
    
    # Trip name
    if trip_number_field_id and trip_name:
        try:
            custom_fields_values.append({
                "field_id": int(trip_number_field_id),
                "values": [{"value": trip_name}]
            })
        except ValueError:
            pass
    
    # Trip driver
    if trip_driver_field_id and trip_driver_name:
        try:
            custom_fields_values.append({
                "field_id": int(trip_driver_field_id),
                "values": [{"value": trip_driver_name}]
            })
        except ValueError:
            pass
    
    # Trip departure date
    if trip_departure_field_id and trip_departure_date:
        try:
            custom_fields_values.append({
                "field_id": int(trip_departure_field_id),
                "values": [{"value": trip_departure_date}]
            })
        except ValueError:
            pass
    
    # Trip order status
    if trip_order_status_field_id and trip_order_status:
        try:
            status_label = STATUS_LABELS.get(trip_order_status, trip_order_status)
            custom_fields_values.append({
                "field_id": int(trip_order_status_field_id),
                "values": [{"value": status_label}]
            })
        except ValueError:
            pass
    
    # If no fields to update, skip
    if not custom_fields_values:
        logger.info(f"Skipping amoCRM sync for {amocrm_id}: no fields to update")
        return {"status": "skipped", "message": "No fields configured for sync"}
    
    # Log sync attempt
    sync_log = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "order_sync",
        "amocrm_id": amocrm_id,
        "delivery_status": delivery_status,
        "trip_name": trip_name,
        "trip_driver_name": trip_driver_name,
        "trip_departure_date": trip_departure_date,
        "trip_order_status": trip_order_status
    }
    
    # Make API request to amoCRM
    url = f"https://{domain}/api/v4/leads/{amocrm_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {"custom_fields_values": custom_fields_values}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                sync_log["result"] = "success"
                sync_log["fields_sent"] = len(custom_fields_values)
                webhook_logs.insert_one(sync_log)
                logger.info(f"Successfully synced order data to amoCRM lead {amocrm_id}, {len(custom_fields_values)} fields")
                return {
                    "status": "ok", 
                    "message": "Order data synced to amoCRM",
                    "fields_synced": len(custom_fields_values)
                }
            else:
                sync_log["result"] = "error"
                sync_log["error"] = response.text
                webhook_logs.insert_one(sync_log)
                logger.error(f"amoCRM API error: {response.status_code} - {response.text}")
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
        "transferredAt": now,  # Date/time of creation
        "source": "amocrm_test",
        "status": "new",
        "deliveryStatus": "pending",
        "deliveryComment": "",
        "changeHistory": []  # Initialize empty change history
    }
    
    collection.insert_one(order_data)
    order_data.pop("_id", None)
    
    return {"status": "ok", "message": f"Test order created in {section}", "order": order_data}


@router.get("/lead/{lead_id}")
async def get_lead_data(lead_id: str, section: str = "balia"):
    """Get lead data from amoCRM by ID for pre-filling calculator.
    
    Used when opening calculator from amoCRM card.
    Returns: fullName, phoneNumber, fullAddress, amocrm_id, amocrm_link
    """
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        raise HTTPException(
            status_code=400, 
            detail="amoCRM API credentials not configured. Please set domain and token in integration settings."
        )
    
    # Fetch lead from amoCRM
    api_data = await fetch_lead_from_amocrm(lead_id, domain, token)
    
    if not api_data:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} not found in amoCRM")
    
    # Get field mapping - try calculator-specific first, then section-specific, then root
    all_mappings = settings.get("field_mapping", {})
    
    # Priority: calculatorBalia/calculatorSauna -> calculator -> section -> root
    if section == "balia" and "calculatorBalia" in all_mappings and all_mappings["calculatorBalia"]:
        field_mapping = all_mappings["calculatorBalia"]
    elif section == "sauna" and "calculatorSauna" in all_mappings and all_mappings["calculatorSauna"]:
        field_mapping = all_mappings["calculatorSauna"]
    elif "calculator" in all_mappings and all_mappings["calculator"]:
        field_mapping = all_mappings["calculator"]
    elif section in all_mappings:
        field_mapping = all_mappings[section]
    else:
        field_mapping = all_mappings
    
    # Extract data using mapping
    lead_data = extract_lead_data_from_api(api_data, field_mapping)
    
    # Build full amoCRM link
    if domain:
        lead_data["amocrm_link"] = f"https://{domain}/leads/detail/{lead_id}"
    
    return {
        "status": "ok",
        "lead": {
            "amocrm_id": lead_data.get("amocrm_id", lead_id),
            "fullName": lead_data.get("fullName", ""),
            "phoneNumber": lead_data.get("phoneNumber", ""),
            "fullAddress": lead_data.get("fullAddress", ""),
            "email": lead_data.get("email", ""),
            "amocrm_link": lead_data.get("amocrm_link", ""),
            "amocrm_name": lead_data.get("amocrm_name", ""),
            "dealSum": lead_data.get("dealSum", ""),
            "orderContents": lead_data.get("orderContents", ""),
            "orderComment": lead_data.get("orderComment", ""),
        }
    }


@router.post("/mark-quote-created")
async def mark_quote_created(amocrm_id: str, order_id: str, calculator_type: str = "balia"):
    """Mark in amoCRM that commercial quote (КП) was created.
    
    Updates a note or custom field in amoCRM lead.
    """
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    
    if not domain or not token:
        return {"status": "error", "message": "amoCRM credentials not configured"}
    
    # Add a note to the lead
    note_text = f"✅ Коммерческое предложение создано\n📋 Заказ: {order_id}\n🧮 Калькулятор: {calculator_type.upper()}\n📅 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
    
    url = f"https://{domain}/api/v4/leads/{amocrm_id}/notes"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    note_data = [{
        "note_type": "common",
        "params": {
            "text": note_text
        }
    }]
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json=note_data)
            
            if response.status_code in [200, 201]:
                logger.info(f"Successfully added quote note to lead {amocrm_id}")
                return {"status": "ok", "message": "Note added to amoCRM lead"}
            else:
                logger.error(f"Failed to add note: {response.status_code} - {response.text}")
                return {
                    "status": "error", 
                    "message": f"Failed to add note: {response.status_code}"
                }
    except Exception as e:
        logger.error(f"Error adding note to amoCRM: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/sync-trip")
async def sync_trip_to_amocrm(
    amocrm_id: str,
    trip_name: str = "",
    driver_name: str = "",
    departure_date: str = "",
    order_status: str = ""
):
    """Sync trip data back to amoCRM lead.
    
    Updates custom fields in amoCRM:
    - Trip number/name
    - Driver name
    - Departure date
    - Order status within trip
    """
    settings = get_amocrm_settings()
    
    domain = settings.get("amocrm_domain", "")
    token = settings.get("amocrm_token", "")
    trip_number_field_id = settings.get("trip_number_field_id", "")
    trip_driver_field_id = settings.get("trip_driver_field_id", "")
    trip_departure_field_id = settings.get("trip_departure_field_id", "")
    trip_order_status_field_id = settings.get("trip_order_status_field_id", "")
    
    # If credentials are not configured, skip silently
    if not domain or not token:
        logger.info(f"Skipping amoCRM trip sync for {amocrm_id}: credentials not configured")
        return {"status": "skipped", "message": "amoCRM credentials not configured"}
    
    # Build update payload
    custom_fields_values = []
    
    if trip_number_field_id and trip_name:
        try:
            custom_fields_values.append({
                "field_id": int(trip_number_field_id),
                "values": [{"value": trip_name}]
            })
        except ValueError:
            pass
    
    if trip_driver_field_id and driver_name:
        try:
            custom_fields_values.append({
                "field_id": int(trip_driver_field_id),
                "values": [{"value": driver_name}]
            })
        except ValueError:
            pass
    
    if trip_departure_field_id and departure_date:
        try:
            custom_fields_values.append({
                "field_id": int(trip_departure_field_id),
                "values": [{"value": departure_date}]
            })
        except ValueError:
            pass
    
    if trip_order_status_field_id and order_status:
        try:
            # Map internal status to display label
            STATUS_LABELS = {
                "pending": "Ожидает",
                "delivering": "В пути",
                "delivered": "Доставлен",
                "cancelled": "Отменён"
            }
            status_label = STATUS_LABELS.get(order_status, order_status)
            
            custom_fields_values.append({
                "field_id": int(trip_order_status_field_id),
                "values": [{"value": status_label}]
            })
        except ValueError:
            pass
    
    # If no fields configured, skip silently
    if not custom_fields_values:
        logger.info(f"Skipping amoCRM trip sync for {amocrm_id}: no trip field IDs configured")
        return {"status": "skipped", "message": "No trip field IDs configured for sync"}
    
    # Log sync attempt
    sync_log = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "trip_sync",
        "amocrm_id": amocrm_id,
        "trip_name": trip_name,
        "driver_name": driver_name,
        "departure_date": departure_date,
        "order_status": order_status
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
                logger.info(f"Successfully synced trip data to amoCRM lead {amocrm_id}")
                return {"status": "ok", "message": "Trip data synced to amoCRM"}
            else:
                sync_log["result"] = "error"
                sync_log["error"] = response.text
                webhook_logs.insert_one(sync_log)
                logger.error(f"amoCRM API error: {response.status_code} - {response.text}")
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
