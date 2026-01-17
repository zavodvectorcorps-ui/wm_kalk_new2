"""Sauna calculator models."""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


class SaunaModel(BaseModel):
    id: str
    name: str
    basePrice: int
    foundationPrice: int = 0
    discount: int = 0
    imageUrl: str = ""
    sortOrder: int = 1
    active: bool = True
    hint: Optional[str] = None
    hintImageUrl: Optional[str] = None
    hintVideoUrl: Optional[str] = None


class SaunaOption(BaseModel):
    id: str
    name: str
    price: int = 0
    inputType: str = "radio"
    sortOrder: int = 1
    imageUrl: Optional[str] = None
    hasQuantity: bool = False
    isDefaultSelected: bool = False  # If true, option is selected by default in calculator
    techSpecId: Optional[str] = None  # Link to tech spec option ID
    techSpecCategoryId: Optional[str] = None  # Override category mapping for specific options
    hint: Optional[str] = None
    hintImageUrl: Optional[str] = None
    hintVideoUrl: Optional[str] = None


class SaunaCategory(BaseModel):
    id: str
    name: str
    inputType: str = "radio"
    displayType: str = "grid"
    options: List[SaunaOption] = []
    techSpecCategoryId: Optional[str] = None  # Link to tech spec category ID
    hint: Optional[str] = None  # General hint for category (shown under category name)
    hintImageUrl: Optional[str] = None
    hintVideoUrl: Optional[str] = None


class SaunaPriceData(BaseModel):
    models: List[SaunaModel] = []
    categories: List[SaunaCategory] = []
    modelsDisplayType: str = "grid"
    modelsHint: Optional[str] = None  # General hint for models section
    modelsHintImageUrl: Optional[str] = None
    modelsHintVideoUrl: Optional[str] = None


class SaunaOrder(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: Optional[str] = Field(default_factory=lambda: f"WMS-{datetime.now().strftime('%d-%m-%Y-%H%M%S')}")
    fullName: str
    phoneNumber: str
    fullAddress: str = ""  # Made optional with default
    email: str = ""
    orderDate: str = Field(default_factory=lambda: datetime.now().strftime('%Y-%m-%d'))
    selectedModel: str
    modelName: str = ""
    modelImageUrl: str = ""  # Store model image URL
    basePrice: int = 0
    foundationPrice: int = 0
    discount: int = 0
    discountPercent: float = 0.0
    selections: Dict[str, Any] = {}
    quantities: Dict[str, int] = {}  # Added for quantity tracking
    selectedOptions: List[Dict[str, Any]] = []  # Added for consistency
    notes: str = ""
    optionsTotal: int = 0
    subtotal: float = 0.0
    total: float = 0.0
    createdBy: str = ""
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # Admin discount fields
    adminDiscountApproved: bool = False
    adminDiscountApprovedBy: str = ""
    adminDiscountApprovedAt: str = ""
    # Admin gifts - list of option IDs that are gifts
    adminGifts: List[str] = []
    # Requested discount from manager
    requestedDiscount: float = 0.0
    requestedDiscountNote: str = ""
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


class SaunaPDFRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    orderId: str = ""
    fullName: str
    phoneNumber: str
    fullAddress: str = ""
    email: str = ""
    orderDate: Optional[str] = Field(default_factory=lambda: datetime.now().strftime('%Y-%m-%d'))
    selectedModel: str
    modelName: str = ""
    modelImageUrl: str = ""  # Model image URL for PDF
    basePrice: int = 0
    foundationPrice: int = 0
    discount: int = 0
    discountPercent: float = 0.0
    selections: Dict[str, Any] = {}
    quantities: Dict[str, int] = {}
    notes: str = ""
    optionsTotal: int = 0
    subtotal: float = 0.0
    total: float = 0.0
    language: str = "pl"
    categories: List[Dict[str, Any]] = []
    # Admin gifts - list of option IDs that are gifts
    adminGifts: List[str] = []
    selectedOptions: List[Dict[str, Any]] = []
