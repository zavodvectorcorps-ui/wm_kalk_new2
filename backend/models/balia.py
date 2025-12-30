"""Balia calculator models."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid


class ModelSpec(BaseModel):
    outerDiameter: Optional[int] = None
    innerDiameter: Optional[int] = None
    outerWidth: Optional[int] = None
    outerLength: Optional[int] = None
    innerWidth: Optional[int] = None
    innerLength: Optional[int] = None
    depth: int
    totalHeight: int
    heaterPower: int
    waterCapacity: int


class BaliaModel(BaseModel):
    id: str
    name: str
    nameRu: Optional[str] = ""
    namePl: Optional[str] = ""
    type: str
    shape: str
    size: str
    heaterType: str
    imageUrl: str = ""
    specs: ModelSpec
    includes: Optional[List[str]] = []
    basePrice: float
    currency: str
    sortOrder: int
    active: bool = True


class CategoryOption(BaseModel):
    id: str
    name: str
    nameRu: Optional[str] = ""
    namePl: Optional[str] = ""
    price: float
    imageUrl: Optional[str] = ""
    hint: Optional[str] = ""
    applicableTo: Optional[str] = None
    sortOrder: int


class BaliaCategory(BaseModel):
    id: str
    name: str
    nameRu: Optional[str] = ""
    namePl: Optional[str] = ""
    imageUrl: str = ""
    inputType: str
    displayType: str = "list"  # "list" | "tiles"
    sortOrder: int
    options: List[CategoryOption]


class CustomerField(BaseModel):
    """Configuration for a customer data field."""
    id: str
    name: str  # Field label in English
    nameRu: Optional[str] = ""  # Russian label
    namePl: Optional[str] = ""  # Polish label
    fieldType: str = "text"  # "text" | "phone" | "email" | "textarea" | "date"
    placeholder: Optional[str] = ""
    placeholderRu: Optional[str] = ""
    placeholderPl: Optional[str] = ""
    required: bool = False
    sortOrder: int = 0
    active: bool = True


class CustomerFieldsConfig(BaseModel):
    """Configuration for customer fields in calculator."""
    calculatorType: str  # "sauna" | "balia"
    fields: List[CustomerField] = []


class PriceData(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    # New structure
    models: Optional[List[BaliaModel]] = []
    categories: Optional[List[BaliaCategory]] = []
    modelsDisplayType: Optional[str] = "grid"
    currency: Optional[str] = "EUR"
    currencySymbol: Optional[str] = "€"
    
    # Legacy structure (for backward compatibility)
    shellModels: Optional[Dict[str, float]] = {}
    woodTypes: Optional[Dict[str, float]] = {}
    shellColors: Optional[Dict[str, float]] = {}
    lidTypes: Optional[Dict[str, float]] = {}
    woodColors: Optional[Dict[str, float]] = {}
    features: Optional[Dict[str, float]] = {}
    displayTypes: Optional[Dict[str, str]] = {}
    optionCategories: Optional[Dict[str, str]] = {}
    optionLabels: Optional[Dict[str, str]] = {}


class OrderFeatures(BaseModel):
    jacuzzi: bool = False
    airBubble: bool = False
    outsideLed12: bool = False
    insideLed: bool = False
    outsideLedStripe: bool = False
    insideLedMini: bool = False
    insulation: bool = False
    headPillow: bool = False
    v4aHeater: bool = False
    electricityBox: bool = False
    chimneyExtension: bool = False
    extraChimneyProtection: bool = False
    bluetoothRadio: bool = False
    electricHeater3kw: bool = False
    electricThermometer: bool = False


class Order(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: str
    modelId: Optional[str] = None
    modelName: Optional[str] = None
    modelPrice: Optional[float] = 0.0
    selections: Optional[Dict[str, Any]] = {}
    selectedOptions: Optional[List[Dict[str, Any]]] = []
    notes: str = ""
    total: float = 0.0
    currency: str = "EUR"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # Legacy fields for backward compatibility
    shellModel: Optional[str] = None
    woodType: Optional[str] = None
    shellColor: Optional[str] = None
    lidType: Optional[str] = None
    woodColor: Optional[str] = None
    sandFilter: Optional[str] = "none"
    features: Optional[Dict[str, bool]] = {}


class PDFRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: str
    # New structure fields
    modelId: Optional[str] = None
    modelName: Optional[str] = None
    modelPrice: Optional[float] = 0.0
    modelImageUrl: Optional[str] = None
    selections: Optional[Dict[str, Any]] = {}
    selectedOptions: Optional[List[Dict[str, Any]]] = []
    currency: Optional[str] = "EUR"
    # Legacy fields
    shellModel: Optional[str] = None
    woodType: Optional[str] = None
    shellColor: Optional[str] = None
    lidType: Optional[str] = None
    woodColor: Optional[str] = None
    sandFilter: Optional[str] = "none"
    features: Optional[Dict[str, bool]] = {}
    notes: str = ""
    total: float = 0.0
    type: str = "customer"
    language: str = "pl"
