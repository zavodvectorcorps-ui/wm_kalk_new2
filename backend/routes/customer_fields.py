"""Customer fields configuration routes."""
from fastapi import APIRouter, HTTPException
from typing import List
import logging
import uuid

from database import db
from models.balia import CustomerField, CustomerFieldsConfig

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Customer Fields"])

# Default customer fields
DEFAULT_FIELDS = {
    "sauna": [
        {
            "id": "fullName",
            "name": "Full Name",
            "nameRu": "ФИО",
            "namePl": "Imię i nazwisko",
            "fieldType": "text",
            "placeholder": "Full name",
            "placeholderRu": "Введите имя",
            "placeholderPl": "Imię i nazwisko",
            "required": True,
            "sortOrder": 1,
            "active": True
        },
        {
            "id": "phone",
            "name": "Phone Number",
            "nameRu": "Телефон",
            "namePl": "Numer telefonu",
            "fieldType": "phone",
            "placeholder": "+48 123 456 789",
            "placeholderRu": "+48 123 456 789",
            "placeholderPl": "+48 123 456 789",
            "required": True,
            "sortOrder": 2,
            "active": True
        },
        {
            "id": "address",
            "name": "Address",
            "nameRu": "Адрес",
            "namePl": "Pełny adres",
            "fieldType": "textarea",
            "placeholder": "Full address",
            "placeholderRu": "Полный адрес",
            "placeholderPl": "Pełny adres",
            "required": False,
            "sortOrder": 3,
            "active": True
        }
    ],
    "balia": [
        {
            "id": "fullName",
            "name": "Full Name",
            "nameRu": "ФИО",
            "namePl": "Imię i nazwisko",
            "fieldType": "text",
            "placeholder": "Full name",
            "placeholderRu": "Введите имя",
            "placeholderPl": "Imię i nazwisko",
            "required": True,
            "sortOrder": 1,
            "active": True
        },
        {
            "id": "phone",
            "name": "Phone Number",
            "nameRu": "Телефон",
            "namePl": "Numer telefonu",
            "fieldType": "phone",
            "placeholder": "+48 123 456 789",
            "placeholderRu": "+48 123 456 789",
            "placeholderPl": "+48 123 456 789",
            "required": True,
            "sortOrder": 2,
            "active": True
        },
        {
            "id": "address",
            "name": "Address",
            "nameRu": "Адрес",
            "namePl": "Pełny adres",
            "fieldType": "textarea",
            "placeholder": "Full address",
            "placeholderRu": "Полный адрес",
            "placeholderPl": "Pełny adres",
            "required": False,
            "sortOrder": 3,
            "active": True
        }
    ]
}


@router.get("/customer-fields/{calculator_type}")
async def get_customer_fields(calculator_type: str):
    """Get customer fields configuration for a calculator type."""
    if calculator_type not in ["sauna", "balia"]:
        raise HTTPException(status_code=400, detail="Invalid calculator type")
    
    config = await db.customer_fields.find_one({"calculatorType": calculator_type})
    
    if not config:
        # Return defaults
        return {
            "calculatorType": calculator_type,
            "fields": DEFAULT_FIELDS.get(calculator_type, [])
        }
    
    config.pop('_id', None)
    return config


@router.post("/customer-fields/{calculator_type}")
async def save_customer_fields(calculator_type: str, config: CustomerFieldsConfig):
    """Save customer fields configuration."""
    if calculator_type not in ["sauna", "balia"]:
        raise HTTPException(status_code=400, detail="Invalid calculator type")
    
    config_dict = config.model_dump()
    config_dict["calculatorType"] = calculator_type
    
    await db.customer_fields.update_one(
        {"calculatorType": calculator_type},
        {"$set": config_dict},
        upsert=True
    )
    
    logger.info(f"Saved customer fields for {calculator_type}: {len(config.fields)} fields")
    return {"message": "Customer fields saved successfully"}


@router.post("/customer-fields/{calculator_type}/field")
async def add_customer_field(calculator_type: str, field: CustomerField):
    """Add a new customer field."""
    if calculator_type not in ["sauna", "balia"]:
        raise HTTPException(status_code=400, detail="Invalid calculator type")
    
    # Get current config
    config = await db.customer_fields.find_one({"calculatorType": calculator_type})
    
    if not config:
        config = {
            "calculatorType": calculator_type,
            "fields": DEFAULT_FIELDS.get(calculator_type, [])
        }
    
    # Generate ID if not provided
    if not field.id:
        field.id = str(uuid.uuid4())[:8]
    
    # Check for duplicate ID
    existing_ids = [f.get("id") for f in config.get("fields", [])]
    if field.id in existing_ids:
        raise HTTPException(status_code=400, detail="Field ID already exists")
    
    # Add new field
    field_dict = field.model_dump()
    config["fields"].append(field_dict)
    
    await db.customer_fields.update_one(
        {"calculatorType": calculator_type},
        {"$set": config},
        upsert=True
    )
    
    logger.info(f"Added customer field '{field.id}' for {calculator_type}")
    return {"message": "Field added successfully", "field": field_dict}


@router.put("/customer-fields/{calculator_type}/field/{field_id}")
async def update_customer_field(calculator_type: str, field_id: str, field: CustomerField):
    """Update an existing customer field."""
    if calculator_type not in ["sauna", "balia"]:
        raise HTTPException(status_code=400, detail="Invalid calculator type")
    
    config = await db.customer_fields.find_one({"calculatorType": calculator_type})
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Find and update field
    fields = config.get("fields", [])
    found = False
    for i, f in enumerate(fields):
        if f.get("id") == field_id:
            fields[i] = field.model_dump()
            fields[i]["id"] = field_id  # Preserve original ID
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Field not found")
    
    await db.customer_fields.update_one(
        {"calculatorType": calculator_type},
        {"$set": {"fields": fields}}
    )
    
    logger.info(f"Updated customer field '{field_id}' for {calculator_type}")
    return {"message": "Field updated successfully"}


@router.delete("/customer-fields/{calculator_type}/field/{field_id}")
async def delete_customer_field(calculator_type: str, field_id: str):
    """Delete a customer field."""
    if calculator_type not in ["sauna", "balia"]:
        raise HTTPException(status_code=400, detail="Invalid calculator type")
    
    config = await db.customer_fields.find_one({"calculatorType": calculator_type})
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Remove field
    fields = [f for f in config.get("fields", []) if f.get("id") != field_id]
    
    if len(fields) == len(config.get("fields", [])):
        raise HTTPException(status_code=404, detail="Field not found")
    
    await db.customer_fields.update_one(
        {"calculatorType": calculator_type},
        {"$set": {"fields": fields}}
    )
    
    logger.info(f"Deleted customer field '{field_id}' for {calculator_type}")
    return {"message": "Field deleted successfully"}
