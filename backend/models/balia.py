"""Balia calculator models."""
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timezone
import uuid


class ModelSpec(BaseModel):
    """Model specifications - accepts both int and string values like '200cm'."""
    model_config = ConfigDict(extra="allow")
    
    outerDiameter: Optional[Any] = None
    innerDiameter: Optional[Any] = None
    outerWidth: Optional[Any] = None
    outerLength: Optional[Any] = None
    innerWidth: Optional[Any] = None
    innerLength: Optional[Any] = None
    depth: Optional[Any] = 0
    totalHeight: Optional[Any] = 0
    heaterPower: Optional[Any] = 0
    waterCapacity: Optional[Any] = 0


class HeaterVariant(BaseModel):
    """Heater variant with its own price and image."""
    model_config = ConfigDict(extra="allow")
    
    type: str  # "integrated" or "external"
    price: float = 0
    imageUrl: Optional[str] = ""
    hint: Optional[str] = ""
    hintPl: Optional[str] = ""
    # Pricing calculation fields
    purchasePriceEur: Optional[float] = 0  # Purchase price in EUR
    markupPercent: Optional[float] = 30  # Markup percentage


class BaliaModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: Optional[str] = ""
    nameRu: Optional[str] = ""
    namePl: Optional[str] = ""
    type: Optional[str] = "fiberglass"  # Default bowl type
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
    hint: Optional[str] = ""  # General model hint (RU)
    hintPl: Optional[str] = ""  # Polish hint
    hintImageUrl: Optional[str] = ""  # Image for hint
    hintVideoUrl: Optional[str] = ""  # Video for hint
    # Heater variants with individual prices and images
    heaterVariants: Optional[List[HeaterVariant]] = []
    # Available heater types for this model (e.g., ["integrated", "external"] or just ["external"])
    availableHeaterTypes: Optional[List[str]] = ["integrated", "external"]
    # Available bowl types for this model (e.g., ["fiberglass", "acrylic"] or just ["fiberglass"])
    availableBowlTypes: Optional[List[str]] = ["fiberglass", "acrylic"]
    # Available color options by heater type - nested map of heaterType -> categoryId -> list of optionIds
    # If empty or not set, all colors are available
    # New format: {"integrated": {"shellColors": ["white", "blue"]}, "external": {"shellColors": ["gray"]}}
    # Old format (auto-converted): {"shellColors": ["white", "blue"]} -> applies to all heater types
    availableColorOptions: Optional[Dict[str, Any]] = {}
    
    @field_validator('availableColorOptions', mode='before')
    @classmethod
    def convert_old_color_format(cls, v):
        """Convert old flat format to new heater-type-based format."""
        if not v or not isinstance(v, dict):
            return {}
        
        # Check if it's already in new format (keys are heater types)
        if 'integrated' in v or 'external' in v:
            return v
        
        # Check if it's old format (keys are category IDs with list values)
        # Old format: {"shellColors": ["white", "blue"]}
        # Convert to: {"integrated": {"shellColors": ["white", "blue"]}, "external": {"shellColors": ["white", "blue"]}}
        is_old_format = False
        for key, value in v.items():
            if isinstance(value, list):
                is_old_format = True
                break
        
        if is_old_format:
            # Apply same restrictions to both heater types
            return {
                "integrated": v,
                "external": v
            }
        
        return v


class CategoryOption(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: str
    nameRu: Optional[str] = ""
    namePl: Optional[str] = ""
    price: float
    imageUrl: Optional[str] = ""
    hint: Optional[str] = ""
    hintPl: Optional[str] = ""
    hintImageUrl: Optional[str] = ""  # Image for hint
    hintVideoUrl: Optional[str] = ""  # Video for hint
    applicableTo: Optional[str] = None
    sortOrder: int
    # Pricing calculation fields
    purchasePriceEur: Optional[float] = 0  # Purchase price in EUR
    markupPercent: Optional[float] = 30  # Markup percentage
    # Color preview for color options
    colorPreview: Optional[str] = ""  # HEX color code for preview (e.g., #FFFFFF)


class BaliaCategory(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: str
    nameRu: Optional[str] = ""
    namePl: Optional[str] = ""
    imageUrl: str = ""
    inputType: str
    displayType: str = "list"  # "list" | "tiles"
    sortOrder: int
    options: List[CategoryOption]
    # Conditional display - show only when parent category has specific value
    dependsOn: Optional[str] = None  # Parent category ID
    dependsOnValue: Optional[str] = None  # Required value in parent category
    # Category-level hint (shown under category name for all options)
    hint: Optional[str] = ""  # Russian hint
    hintPl: Optional[str] = ""  # Polish hint
    hintImageUrl: Optional[str] = ""  # Image for category hint
    hintVideoUrl: Optional[str] = ""  # Video for category hint


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
    currency: Optional[str] = "PLN"
    currencySymbol: Optional[str] = "zł"
    # EUR exchange rate and markup settings
    eurRate: Optional[float] = 4.30  # EUR to PLN exchange rate
    defaultMarkupPercent: Optional[float] = 30  # Default markup percentage
    # Models section hint (shown above all models)
    modelsHint: Optional[str] = ""  # Russian hint for models section
    modelsHintPl: Optional[str] = ""  # Polish hint for models section
    modelsHintImageUrl: Optional[str] = ""  # Image for models section hint
    modelsHintVideoUrl: Optional[str] = ""  # Video for models section hint
    
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
    orderDate: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    modelId: Optional[str] = None
    modelName: Optional[str] = None
    modelPrice: Optional[float] = 0.0
    modelImageUrl: Optional[str] = None  # Store model image URL
    heaterType: Optional[str] = None  # "integrated" or "external"
    heaterTypeName: Optional[str] = None  # Display name for heater type
    selectedHeaterVariantId: Optional[str] = None  # ID for Excel mapping
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
    # === LOGISTICS FIELDS ===
    # Client info (editable in logistics)
    clientName: Optional[str] = None
    phone: Optional[str] = None
    # Order contents
    orderContents: Optional[str] = None  # Состав заказа
    # Financial fields
    dealSum: Optional[str] = None  # Сумма заказа
    debtSum: Optional[str] = None  # Задолженность
    totalPrice: Optional[str] = None
    amountDue: Optional[str] = None
    # Trip assignment
    tripId: Optional[str] = None
    tripName: Optional[str] = None
    tripDriverName: Optional[str] = None
    tripDepartureDate: Optional[str] = None
    tripOrderStatus: Optional[str] = None
    # Delivery status
    deliveryStatus: Optional[str] = "pending"
    deliveryComment: Optional[str] = ""
    # Order flags
    isImportant: Optional[bool] = False
    # amoCRM fields
    amocrm_id: Optional[str] = None
    amocrm_link: Optional[str] = None
    amocrm_name: Optional[str] = None  # amoCRM deal name
    amocrm_data: Optional[Dict[str, Any]] = None
    order_number: Optional[str] = None
    budget: Optional[float] = None
    # Geo coordinates
    lat: Optional[float] = None
    lng: Optional[float] = None
    # === TRANSFER / HISTORY FIELDS ===
    transferredAt: Optional[str] = None  # Дата/время переноса из amoCRM
    transferredBy: Optional[str] = None  # Кто перенёс
    source: Optional[str] = None  # Источник: "amocrm", "manual", "web"
    updatedAt: Optional[str] = None  # Дата последнего обновления
    updatedBy: Optional[str] = None  # Кто обновил
    # History of changes
    changeHistory: Optional[List[Dict[str, Any]]] = []  # История изменений


class PDFRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    orderId: Optional[str] = None  # Order ID for PDF filename
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    # New structure fields
    modelId: Optional[str] = None
    modelName: Optional[str] = None
    modelPrice: Optional[float] = 0.0
    modelImageUrl: Optional[str] = None
    modelSpecs: Optional[Dict[str, Any]] = {}  # Model specifications (seats, dimensions, etc.)
    heaterType: Optional[str] = None  # "integrated" or "external"
    heaterTypeName: Optional[str] = None  # Display name for heater type
    selectedHeaterVariantId: Optional[str] = None  # ID for Excel mapping
    selections: Optional[Dict[str, Any]] = {}
    selectedOptions: Optional[List[Dict[str, Any]]] = []
    currency: Optional[str] = "PLN"
    currencySymbol: Optional[str] = "zł"  # Currency symbol for display
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


class WebOrder(BaseModel):
    """Order from public website calculator"""
    model_config = ConfigDict(extra="allow")
    
    id: str = Field(default_factory=lambda: f"WEB-{datetime.now(timezone.utc).strftime('%d%m%Y-%H%M%S')}")
    # Customer data
    customerName: str
    customerPhone: str
    customerComment: Optional[str] = ""
    # Order data
    modelId: Optional[str] = None
    modelName: Optional[str] = None
    modelPrice: Optional[float] = 0.0
    modelImageUrl: Optional[str] = None
    heaterVariantType: Optional[str] = None  # "integrated" or "external"
    selections: Optional[Dict[str, Any]] = {}
    selectedOptions: Optional[List[Dict[str, Any]]] = []
    subtotal: Optional[float] = 0.0
    total: float = 0.0
    currency: str = "PLN"
    # Status
    status: str = "new"  # new, processing, completed, cancelled
    # Metadata
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    processedBy: Optional[str] = None
    processedAt: Optional[str] = None
    notes: Optional[str] = ""  # Manager notes

