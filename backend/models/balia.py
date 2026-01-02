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
    depth: Optional[int] = 0
    totalHeight: Optional[int] = 0
    heaterPower: Optional[int] = 0
    waterCapacity: Optional[int] = 0


class HeaterVariant(BaseModel):
    """Heater variant with its own price and image."""
    type: str  # "integrated" or "external"
    price: float = 0
    imageUrl: Optional[str] = ""
    hint: Optional[str] = ""
    hintPl: Optional[str] = ""


class BaliaModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: Optional[str] = ""
    nameRu: Optional[str] = ""
    namePl: Optional[str] = ""
    type: Optional[str] = "fiberglass"
    shape: Optional[str] = "round"
    size: Optional[str] = ""
    heaterType: Optional[str] = "external"  # Legacy field
    imageUrl: Optional[str] = ""
    specs: Optional[ModelSpec] = None
    includes: Optional[List[str]] = []
    basePrice: Optional[float] = 0  # Legacy field, now from heaterVariants
    currency: Optional[str] = "EUR"
    sortOrder: Optional[int] = 0
    active: Optional[bool] = True
    hint: Optional[str] = ""  # General model hint
    # New: heater variants with individual prices and images
    heaterVariants: Optional[List[HeaterVariant]] = []


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
    
    id: str = Field(default_factory=lambda: f"WMB-{datetime.now(timezone.utc).strftime('%d-%m-%Y-%H%M%S')}")
    fullName: str
    phoneNumber: str
    fullAddress: str = ""
    orderDate: str
    modelId: Optional[str] = None
    modelName: Optional[str] = None
    modelPrice: Optional[float] = 0.0
    modelImageUrl: Optional[str] = None  # Store model image URL
    selections: Optional[Dict[str, Any]] = {}
    selectedOptions: Optional[List[Dict[str, Any]]] = []
    notes: str = ""
    discountPercent: Optional[float] = 0.0
    subtotal: Optional[float] = 0.0
    total: float = 0.0
    currency: str = "EUR"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    createdBy: Optional[str] = None
    # Admin discount fields
    adminDiscountApproved: Optional[bool] = False
    adminDiscountApprovedBy: Optional[str] = None
    adminDiscountApprovedAt: Optional[str] = None
    # Admin gifts - list of option IDs that are gifts
    adminGifts: Optional[List[str]] = []
    # Requested discount from manager
    requestedDiscount: Optional[float] = 0.0
    requestedDiscountNote: Optional[str] = ""
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
    
    orderId: Optional[str] = None  # Order ID for PDF filename
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
    discountPercent: Optional[float] = 0.0
    subtotal: Optional[float] = 0.0
    # Admin gifts - list of option IDs that are gifts
    adminGifts: Optional[List[str]] = []
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
