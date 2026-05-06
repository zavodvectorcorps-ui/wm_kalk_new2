"""Sauna calculator models."""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


class SaunaModelVariant(BaseModel):
    """Variant of a sauna model with its own price, image and description."""
    model_config = ConfigDict(extra="allow")
    
    id: str  # e.g., "standard", "premium"
    name: str  # Default name (Polish)
    nameRu: Optional[str] = ""  # Russian name
    namePl: Optional[str] = ""  # Polish name
    price: int = 0  # Price for this variant
    costPrice: int = 0  # Cost price (Себестоимость) — admin only
    imageUrl: Optional[str] = ""  # Image for this variant
    hint: Optional[str] = ""  # Description (RU)
    hintPl: Optional[str] = ""  # Description (PL)
    # Category/group for this variant (e.g., "Прямой вход", "Боковой вход", "Правая печка")
    category: Optional[str] = ""  # Variant category for grouping
    categoryPl: Optional[str] = ""  # Category in Polish
    # Room dimensions for this variant (used in PDF WYMIARY POMIESZCZEŃ)
    capacity: Optional[str] = ""  # Orientacyjna liczba osób
    terraceSize: Optional[str] = ""  # Taras
    relaxRoomSize: Optional[str] = ""  # Pokój wypoczynkowy
    steamRoomSize: Optional[str] = ""  # Pokój parowy
    entranceSide: Optional[str] = ""  # Strona wejścia


class SaunaModel(BaseModel):
    id: str
    name: str
    basePrice: int
    costPrice: int = 0  # Cost price (Себестоимость) — admin only, used for margin calc
    foundationPrice: int = 0
    discount: int = 0
    imageUrl: str = ""
    sortOrder: int = 1
    active: bool = True
    # Model group for calculator grouping (e.g., "Квадро", "Бочка", "Викинг", "Парус")
    modelGroup: Optional[str] = None
    modelGroupImageUrl: Optional[str] = None
    hint: Optional[str] = None
    hintImageUrl: Optional[str] = None
    hintVideoUrl: Optional[str] = None
    # Capacity - number of people
    capacity: Optional[str] = None  # e.g., "4-6" or "8"
    # Room sizes (standard configuration)
    relaxRoomSize: Optional[str] = None  # e.g., "2.5 x 3.0 m"
    steamRoomSize: Optional[str] = None  # e.g., "2.0 x 2.0 m"
    # Room sizes when "additional terrace" option is selected
    relaxRoomSizeWithTerrace: Optional[str] = None
    steamRoomSizeWithTerrace: Optional[str] = None
    # Layout size for filtering layouts in catalog (e.g., "2m", "2.5m", "3m")
    layoutSize: Optional[str] = None
    # Model variants (sub-models) with different prices and images
    variants: Optional[List[SaunaModelVariant]] = []
    # Gallery images - multiple photos for this model
    galleryImages: Optional[List[str]] = []
    # Linked model ID to take variants from (e.g., Beczka can use variants from Kwadro)
    linkedVariantsModelId: Optional[str] = None
    # Website description (for public API / external website)
    websiteDescription: Optional[str] = None
    websiteDescriptionPl: Optional[str] = None


class OptionVariant(BaseModel):
    """Variant of an option - mutually exclusive choice (e.g., 'Bench without cladding' vs 'Bench with cladding')."""
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: str  # Default name (Polish)
    nameRu: Optional[str] = ""  # Russian name
    namePl: Optional[str] = ""  # Polish name (same as name)
    price: int = 0  # Full price for this variant (replaces option base price)
    costPrice: int = 0  # Cost price (Себестоимость) — admin only
    imageUrl: Optional[str] = None  # Image for this variant
    techSpecCategoryId: Optional[str] = None  # Link to tech spec category
    techSpecId: Optional[str] = None  # Link to tech spec option


# Keep SubOption as alias for backward compatibility during migration
SubOption = OptionVariant


class SaunaOption(BaseModel):
    id: str
    name: str
    price: int = 0
    costPrice: int = 0  # Cost price (Себестоимость) — admin only
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
    showInPdf: bool = True  # If true, option will be shown in PDF catalog (page 2)
    showInPdfForModels: Optional[List[str]] = []  # If set, option shown in PDF only for these models (whitelist)
    # Model-specific pricing: {modelId: price} - overrides base price for specific models
    priceByModel: Optional[Dict[str, int]] = {}
    # Plus variant card details (displayed on option card in calculator)
    terraceSize: Optional[str] = None  # Rozmiar Tarasu
    relaxRoomSize: Optional[str] = None  # Rozmiar Pokoju wypoczynkowego  
    steamRoomSize: Optional[str] = None  # Rozmiar Sauny parowej
    entranceSide: Optional[str] = None  # Strona Wejścia
    # Variants - mutually exclusive choices within this option (e.g., "with cladding" vs "without cladding")
    # When variants exist, user must select exactly one variant
    # The variant's price REPLACES the option's base price
    variants: Optional[List[OptionVariant]] = []
    # Legacy field name - kept for backward compatibility, maps to variants
    subOptions: Optional[List[OptionVariant]] = []
    # Incompatibility settings (inverted logic - specify when to HIDE)
    incompatibleModels: Optional[List[str]] = []  # List of model IDs - hide option when these models selected
    incompatibleWithOptions: Optional[Dict[str, List[str]]] = {}  # Hide when: {categoryId: [optionId1, optionId2]}
    # Legacy compatibility settings (kept for backward compatibility)
    compatibleModels: Optional[List[str]] = []
    compatibleWithOptions: Optional[Dict[str, List[str]]] = {}


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
    # Category visibility based on model variant
    visibleForModelVariants: Optional[List[str]] = []  # e.g., ["plus"] - show only when Plus variant is selected


class SaunaVariantComparisonRow(BaseModel):
    """Row in variant comparison table."""
    option: str  # Option name in Polish
    optionRu: Optional[str] = ""  # Option name in Russian
    standard: str  # Value for Standard variant
    plus: str  # Value for Plus variant


class SaunaLayoutVariant(BaseModel):
    """Layout variant for a specific sauna size - used in FAQ section."""
    model_config = ConfigDict(extra="allow")
    
    id: Optional[str] = None
    modelSize: str  # "2m", "2.5m", "3m", "3.5m", "4m", "5m", "6m"
    variantNumber: int = 1  # 1, 2, 3
    variantName: str = ""  # "Стандарт", "Увеличенная парная", "Экстра терраса"
    variantNamePl: str = ""  # Polish name
    description: str = ""  # Description in Russian
    descriptionPl: str = ""  # Description in Polish
    imageUrl: str = ""  # Photo of layout
    terraceSize: Optional[str] = None  # e.g., "95 cm"
    relaxRoomSize: Optional[str] = None  # e.g., "175 cm"
    steamRoomSize: Optional[str] = None  # e.g., "парная"
    entranceType: Optional[str] = None  # "Прямой", "Боковой", "П или Б"
    sortOrder: int = 0
    isActive: bool = True


class WizardStep(BaseModel):
    """Configuration for a wizard step in the new calculator."""
    model_config = ConfigDict(extra="allow")
    
    id: str  # Unique identifier (e.g., "model", "variant", "stove")
    name: str  # Display name (Polish)
    nameRu: Optional[str] = ""  # Russian name
    icon: str = "Package"  # Icon name from lucide-react
    description: Optional[str] = ""  # Description (Polish)
    descriptionRu: Optional[str] = ""  # Description (Russian)
    categoryNames: List[str] = []  # Category names to show in this step (for option steps)
    sortOrder: int = 0  # Order in the wizard
    isActive: bool = True  # Whether this step is active
    isRequired: bool = True  # Whether user must complete this step


class SaunaPriceData(BaseModel):
    models: List[SaunaModel] = []
    categories: List[SaunaCategory] = []
    modelsDisplayType: str = "grid"
    modelsHint: Optional[str] = None  # General hint for models section
    modelsHintImageUrl: Optional[str] = None
    modelsHintVideoUrl: Optional[str] = None
    maxManagerDiscount: int = 10  # Maximum discount % for managers (non-admin users)
    # Variant comparison table
    variantComparisonTitle: Optional[str] = "Różnice modeli"  # Title for comparison table
    variantComparisonRows: Optional[List[SaunaVariantComparisonRow]] = []  # Comparison rows
    # PDF Page 2 settings
    pdfPage2Enabled: bool = True  # Enable/disable page 2 in PDF
    pdfPage2VariantsTitle: Optional[str] = "Możliwe warianty wykonania w wybranym rozmiarze"
    pdfPage2OptionsTitle: Optional[str] = "Opcje, które można dodać do sauny"
    pdfPage2ShowVariants: bool = True  # Show variants section
    pdfPage2ShowComparisonTable: bool = True  # Show comparison table
    pdfPage2ShowPlusCategories: bool = True  # Show Plus-only categories
    pdfPage2ShowAllOptions: bool = True  # Show all available options catalog


class SaunaOrder(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: Optional[str] = Field(default_factory=lambda: f"WMS-{datetime.now().strftime('%d-%m-%Y-%H%M%S')}")
    fullName: str
    phoneNumber: str
    fullAddress: str = ""  # Made optional with default
    email: str = ""
    orderDate: str = Field(default_factory=lambda: datetime.now().strftime('%Y-%m-%d'))
    selectedModel: str
    selectedModelVariant: Optional[str] = None  # Selected sub-model variant ID
    modelName: str = ""
    modelImageUrl: str = ""  # Store model image URL
    basePrice: int = 0
    foundationPrice: int = 0
    discount: int = 0
    discountPercent: float = 0.0
    certificateDiscount: bool = False
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
    # Room sizes (based on terrace selection)
    relaxRoomSize: Optional[str] = None  # e.g., "2.5 x 3.0 m"
    steamRoomSize: Optional[str] = None  # e.g., "2.0 x 2.0 m"
    hasTerrace: Optional[bool] = False  # Whether terrace option is selected
    # === LAYOUT CONFIGURATOR FIELDS ===
    layoutConfigImage: Optional[str] = None  # Exported PNG image URL of configured layout
    layoutConfigJson: Optional[str] = None  # JSON string of canvas state for editing
    layoutConfigVariants: Optional[Dict[str, str]] = {}  # Applied variants: {optionId: variantId}
    layoutConfiguredAt: Optional[str] = None  # When layout was configured
    layoutConfiguredBy: Optional[str] = None  # Who configured it
    # === COST/MARGIN (admin-only) ===
    totalCost: Optional[int] = 0  # Sum of cost prices of all selected items (model + variant + options)
    margin: Optional[float] = 0  # total - totalCost (after discounts)


class SaunaPDFRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    orderId: str = ""
    fullName: str
    phoneNumber: str
    fullAddress: str = ""
    email: str = ""
    orderDate: Optional[str] = Field(default_factory=lambda: datetime.now().strftime('%Y-%m-%d'))
    selectedModel: str
    selectedModelVariant: Optional[str] = None  # Selected sub-model variant ID
    modelVariantName: Optional[str] = None  # Name of selected variant
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
    # Room sizes
    relaxRoomSize: Optional[str] = None  # e.g., "2.5 x 3.0 m"
    steamRoomSize: Optional[str] = None  # e.g., "2.0 x 2.0 m"
    hasTerrace: Optional[bool] = False  # Whether terrace option is selected
    # Capacity - number of people
    capacity: Optional[str] = None  # e.g., "4-6"
    # Model variants data for Page 2
    modelVariants: Optional[List[Dict[str, Any]]] = []  # All variants of selected model
    variantComparisonRows: Optional[List[Dict[str, Any]]] = []  # Comparison table rows
    plusOnlyCategories: Optional[List[Dict[str, Any]]] = []  # Categories visible only for Plus variant
    allAvailableOptions: Optional[List[Dict[str, Any]]] = []  # All available additional options with images
    # Selected Plus variant option data (for WYMIARY POMIESZCZEŃ section)
    selectedPlusOption: Optional[Dict[str, Any]] = None  # Contains terraceSize, relaxRoomSize, steamRoomSize, entranceSide
    # PDF Page 2 settings
    pdfPage2Enabled: bool = True
    pdfPage2VariantsTitle: Optional[str] = "Możliwe warianty wykonania w wybranym rozmiarze"
    pdfPage2OptionsTitle: Optional[str] = "Opcje, które można dodać do sauny"
    pdfPage2ShowVariants: bool = True
    pdfPage2ShowComparisonTable: bool = True
    pdfPage2ShowPlusCategories: bool = True
    pdfPage2ShowAllOptions: bool = True
