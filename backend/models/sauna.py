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


class SaunaPriceData(BaseModel):
    models: List[SaunaModel] = []
    categories: List[SaunaCategory] = []
    modelsDisplayType: str = "grid"


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
