from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import io
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'balia-calculator-secret-key-159357')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '159357')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Auth Models
class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    access: str  # 'balia', 'sauna', or 'all'

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    access: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    username: str
    role: str  # 'admin' or 'employee'
    access: str  # 'balia', 'sauna', or 'all'
    createdAt: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

# Helper functions for auth
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_token(user_data: dict) -> str:
    payload = {
        "sub": user_data["id"],
        "username": user_data["username"],
        "role": user_data["role"],
        "access": user_data["access"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return decode_token(credentials.credentials)

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def init_admin_user():
    """Initialize admin user if not exists"""
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "access": "all",
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)

# Define Models
class PriceData(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    shellModels: Dict[str, float] = {}
    woodTypes: Dict[str, float] = {}
    shellColors: Dict[str, float] = {}
    lidTypes: Dict[str, float] = {}
    woodColors: Dict[str, float] = {}
    features: Dict[str, float] = {}
    displayTypes: Dict[str, str] = {}  # display type for each option
    categories: Dict[str, Dict[str, Any]] = {}  # custom categories: {categoryId: {name, displayType, required, order}}
    optionCategories: Dict[str, str] = {}  # which category each option belongs to: {optionKey: categoryId}
    optionLabels: Dict[str, str] = {}  # custom labels for options: {optionKey: label}

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
    shellModel: str
    woodType: str
    shellColor: str
    lidType: str
    woodColor: str
    sandFilter: str = "none"
    features: Dict[str, bool] = {}
    notes: str = ""
    total: float = 0.0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PDFRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: str
    shellModel: str
    woodType: str
    shellColor: str
    lidType: str
    woodColor: str
    sandFilter: str = "none"
    features: Dict[str, bool] = {}
    notes: str = ""
    total: float = 0.0
    type: str = "customer"  # customer or technical
    language: str = "ru"  # ru or pl

# Initialize default prices
default_prices = {
    "shellModels": {
        "round200": 1500.0,
        "round225": 1800.0,
        "square170x200": 1600.0,
        "square220x220": 2000.0,
        "square230x230": 2200.0,
        "square245x245": 2500.0,
    },
    "woodTypes": {
        "spruce": 0.0,
        "thermo": 300.0,
        "wpc": 400.0,
        "redCedric": 500.0,
    },
    "shellColors": {
        "white": 0.0,
        "ivory": 50.0,
        "blue": 50.0,
        "gray": 50.0,
        "pearlRed": 100.0,
        "pearlBlue": 100.0,
        "pearlBrown": 100.0,
        "pearlGray": 100.0,
        "pearlWhite": 100.0,
        "galaxy": 150.0,
        "snowflake": 150.0,
        "emerald": 150.0,
        "blackGoldGlitter": 200.0,
        "blackPinkGlitter": 200.0,
        "blackSilverGlitter": 200.0,
    },
    "lidTypes": {
        "glassFiberLid": 200.0,
        "spaLid": 300.0,
    },
    "woodColors": {
        "akrilasWhite": 0.0,
        "akrilasGreenMarble": 100.0,
        "akrilasBrownMarble": 100.0,
        "akrilasBlueMarble": 100.0,
        "akrilasWhiteMarble": 100.0,
        "akrilasCoffeeMarble": 100.0,
        "akrilasBlackMarble": 100.0,
        "natural": 0.0,
        "painted": 150.0,
        "oiled": 200.0,
    },
    "features": {
        "jacuzzi": 800.0,
        "airBubble": 600.0,
        "outsideLed12": 150.0,
        "insideLed": 150.0,
        "outsideLedStripe": 200.0,
        "insideLedMini": 180.0,
        "insulation": 250.0,
        "headPillow": 80.0,
        "sandFilterConnections": 300.0,
        "sandFilterUnderStairs": 350.0,
        "sandFilterBox": 400.0,
        "v4aHeater": 500.0,
        "electricityBox": 200.0,
        "chimneyExtension": 150.0,
        "extraChimneyProtection": 100.0,
        "bluetoothRadio": 250.0,
        "electricHeater3kw": 600.0,
        "electricThermometer": 120.0,
    },
    # Display types: 'dropdown' or 'checkbox'
    # By default: shellModels, woodTypes, shellColors, lidTypes, woodColors = dropdown
    # features = checkbox
    "displayTypes": {
        # Categories default to dropdown
        "shellModels": "dropdown",
        "woodTypes": "dropdown",
        "shellColors": "dropdown",
        "lidTypes": "dropdown",
        "woodColors": "dropdown",
        # Individual features default to checkbox
        "jacuzzi": "checkbox",
        "airBubble": "checkbox",
        "outsideLed12": "checkbox",
        "insideLed": "checkbox",
        "outsideLedStripe": "checkbox",
        "insideLedMini": "checkbox",
        "insulation": "checkbox",
        "headPillow": "checkbox",
        "sandFilterConnections": "checkbox",
        "sandFilterUnderStairs": "checkbox",
        "sandFilterBox": "checkbox",
        "v4aHeater": "checkbox",
        "electricityBox": "checkbox",
        "chimneyExtension": "checkbox",
        "extraChimneyProtection": "checkbox",
        "bluetoothRadio": "checkbox",
        "electricHeater3kw": "checkbox",
        "electricThermometer": "checkbox",
    },
    # Custom categories - allows grouping options into logical sections
    # name is a translation key that maps to frontend i18n
    "categories": {
        "shellModels": {
            "name": "shellModels",
            "nameRu": "Модель купели",
            "namePl": "Model bali",
            "displayType": "dropdown",
            "required": True,
            "order": 1,
        },
        "woodTypes": {
            "name": "woodTypes",
            "nameRu": "Тип дерева",
            "namePl": "Rodzaj drewna",
            "displayType": "dropdown",
            "required": True,
            "order": 2,
        },
        "shellColors": {
            "name": "shellColors",
            "nameRu": "Цвет оболочки",
            "namePl": "Kolor wkładu",
            "displayType": "dropdown",
            "required": True,
            "order": 3,
        },
        "lidTypes": {
            "name": "lidTypes",
            "nameRu": "Тип крышки",
            "namePl": "Rodzaj pokrywy",
            "displayType": "dropdown",
            "required": True,
            "order": 4,
        },
        "woodColors": {
            "name": "woodColors",
            "nameRu": "Цвет дерева",
            "namePl": "Kolor drewna",
            "displayType": "dropdown",
            "required": True,
            "order": 5,
        },
        "features": {
            "name": "features",
            "nameRu": "Особенности и дополнения",
            "namePl": "Funkcje i dodatki",
            "displayType": "checkbox",
            "required": False,
            "order": 6,
        },
    },
    # Map each option to its category
    "optionCategories": {
        # Shell models
        "round200": "shellModels",
        "round225": "shellModels",
        "square170x200": "shellModels",
        "square220x220": "shellModels",
        "square230x230": "shellModels",
        "square245x245": "shellModels",
        # Wood types
        "spruce": "woodTypes",
        "thermo": "woodTypes",
        "wpc": "woodTypes",
        "redCedric": "woodTypes",
        # Shell colors
        "white": "shellColors",
        "ivory": "shellColors",
        "blue": "shellColors",
        "gray": "shellColors",
        "pearlRed": "shellColors",
        "pearlBlue": "shellColors",
        "pearlBrown": "shellColors",
        "pearlGray": "shellColors",
        "pearlWhite": "shellColors",
        "galaxy": "shellColors",
        "snowflake": "shellColors",
        "emerald": "shellColors",
        "blackGoldGlitter": "shellColors",
        "blackPinkGlitter": "shellColors",
        "blackSilverGlitter": "shellColors",
        # Lid types
        "glassFiberLid": "lidTypes",
        "spaLid": "lidTypes",
        # Wood colors
        "akrilasWhite": "woodColors",
        "akrilasGreenMarble": "woodColors",
        "akrilasBrownMarble": "woodColors",
        "akrilasBlueMarble": "woodColors",
        "akrilasWhiteMarble": "woodColors",
        "akrilasCoffeeMarble": "woodColors",
        "akrilasBlackMarble": "woodColors",
        "natural": "woodColors",
        "painted": "woodColors",
        "oiled": "woodColors",
        # Features
        "jacuzzi": "features",
        "airBubble": "features",
        "outsideLed12": "features",
        "insideLed": "features",
        "outsideLedStripe": "features",
        "insideLedMini": "features",
        "insulation": "features",
        "headPillow": "features",
        "sandFilterConnections": "features",
        "sandFilterUnderStairs": "features",
        "sandFilterBox": "features",
        "v4aHeater": "features",
        "electricityBox": "features",
        "chimneyExtension": "features",
        "extraChimneyProtection": "features",
        "bluetoothRadio": "features",
        "electricHeater3kw": "features",
        "electricThermometer": "features",
    },
    # Custom labels for options (empty by default, used for custom options)
    "optionLabels": {},
}

# Auth Routes
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login user (admin or employee)"""
    # Initialize admin if not exists
    await init_admin_user()
    
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user)
    user_response = UserResponse(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        access=user["access"],
        createdAt=user["createdAt"]
    )
    return TokenResponse(token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current logged in user info"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@api_router.post("/auth/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """Verify if token is valid"""
    return {"valid": True, "user": current_user}

# User Management Routes (Admin only)
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(admin: dict = Depends(get_admin_user)):
    """Get all users (admin only)"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**user) for user in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, admin: dict = Depends(get_admin_user)):
    """Create a new employee (admin only)"""
    # Check if username already exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Validate access
    if user_data.access not in ["balia", "sauna", "all"]:
        raise HTTPException(status_code=400, detail="Access must be 'balia', 'sauna', or 'all'")
    
    new_user = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "role": "employee",
        "access": user_data.access,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    
    return UserResponse(
        id=new_user["id"],
        username=new_user["username"],
        role=new_user["role"],
        access=new_user["access"],
        createdAt=new_user["createdAt"]
    )

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, admin: dict = Depends(get_admin_user)):
    """Update an employee (admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow editing admin user
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot edit admin user")
    
    update_data = {}
    if user_data.username:
        # Check if username is taken by another user
        existing = await db.users.find_one({"username": user_data.username, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        update_data["username"] = user_data.username
    
    if user_data.password:
        update_data["password"] = hash_password(user_data.password)
    
    if user_data.access:
        if user_data.access not in ["balia", "sauna", "all"]:
            raise HTTPException(status_code=400, detail="Access must be 'balia', 'sauna', or 'all'")
        update_data["access"] = user_data.access
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Get updated user
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return UserResponse(**updated_user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """Delete an employee (admin only)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting admin user
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin user")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}

# Routes
@api_router.get("/")
async def root():
    return {"message": "Hot Tub Calculator API"}

@api_router.get("/prices")
async def get_prices():
    """Get current pricing"""
    prices = await db.prices.find_one({"_id": "default"})
    if not prices:
        # Initialize with default prices
        await db.prices.insert_one({"_id": "default", **default_prices})
        return default_prices
    
    # Remove MongoDB _id field
    prices.pop('_id', None)
    return prices

@api_router.post("/prices")
async def update_prices(prices: PriceData):
    """Update pricing"""
    price_dict = prices.model_dump()
    await db.prices.update_one(
        {"_id": "default"},
        {"$set": price_dict},
        upsert=True
    )
    return {"message": "Prices updated successfully"}

@api_router.post("/orders", response_model=Order)
async def create_order(order: Order):
    """Create a new order"""
    order_dict = order.model_dump()
    await db.orders.insert_one(order_dict)
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_orders():
    """Get all orders"""
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    return orders


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    """Delete an order"""
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted successfully"}

@api_router.post("/generate-pdf")
async def generate_pdf(request: PDFRequest):
    """Generate PDF order form"""
    buffer = io.BytesIO()
    
    # Language-specific translations
    translations = {
        'ru': {
            'title_customer': 'Заказ купели',
            'title_technical': 'Технический заказ на производство',
            'customer_info': 'Информация о клиенте',
            'full_name': 'Полное имя:',
            'phone': 'Телефон:',
            'address': 'Адрес:',
            'order_date': 'Дата заказа:',
            'configuration': 'Конфигурация',
            'shell_model': 'Модель купели:',
            'wood_type': 'Тип дерева:',
            'shell_color': 'Цвет оболочки:',
            'lid_type': 'Тип крышки:',
            'wood_color': 'Цвет дерева:',
            'sand_filter': 'Песочный фильтр:',
            'selected_features': 'Выбранные функции',
            'additional_notes': 'Дополнительные примечания',
            'total': 'ИТОГО:',
        },
        'pl': {
            'title_customer': 'Zamówienie bali WM-BALIA',
            'title_technical': 'Zamówienie techniczne do produkcji',
            'customer_info': 'Dane klienta',
            'full_name': 'Imię i nazwisko:',
            'phone': 'Telefon:',
            'address': 'Adres:',
            'order_date': 'Data zamówienia:',
            'configuration': 'Konfiguracja',
            'shell_model': 'Model bali:',
            'wood_type': 'Rodzaj drewna:',
            'shell_color': 'Kolor wkładu:',
            'lid_type': 'Rodzaj pokrywy:',
            'wood_color': 'Kolor drewna:',
            'sand_filter': 'Filtr piaskowy:',
            'selected_features': 'Wybrane funkcje',
            'additional_notes': 'Dodatkowe uwagi',
            'total': 'SUMA:',
        }
    }
    
    # Feature translations
    feature_translations = {
        'ru': {
            'jacuzzi': 'Джакузи',
            'airBubble': 'Воздушные пузыри',
            'outsideLed12': 'Наружное LED (12 светодиодов)',
            'insideLed': 'Внутреннее LED',
            'outsideLedStripe': 'Наружное LED (полоса)',
            'insideLedMini': 'Внутреннее LED (12 мини)',
            'insulation': 'Изоляция',
            'headPillow': 'Подушка для головы',
            'sandFilterConnections': 'Соединения песочного фильтра с краном',
            'sandFilterUnderStairs': 'Песочный фильтр под лестницей',
            'sandFilterBox': 'Коробка песочного фильтра',
            'v4aHeater': 'Нагреватель V4A',
            'electricityBox': 'Электрический щит',
            'chimneyExtension': 'Удлинитель дымохода',
            'extraChimneyProtection': 'Дополнительная защита дымохода',
            'bluetoothRadio': 'Bluetooth радио',
            'electricHeater3kw': 'Электрический нагреватель 3кВт',
            'electricThermometer': 'Электрический термометр',
        },
        'pl': {
            'jacuzzi': 'Jacuzzi',
            'airBubble': 'Bąbelki powietrzne',
            'outsideLed12': 'LED zewnętrzne (12 diod)',
            'insideLed': 'LED wewnętrzne',
            'outsideLedStripe': 'LED zewnętrzne (pasek)',
            'insideLedMini': 'LED wewnętrzne (12 mini)',
            'insulation': 'Izolacja',
            'headPillow': 'Poduszka pod głowę',
            'sandFilterConnections': 'Przyłącza filtra piaskowego z kranem',
            'sandFilterUnderStairs': 'Filtr piaskowy pod schodami',
            'sandFilterBox': 'Skrzynka filtra piaskowego',
            'v4aHeater': 'Grzałka V4A',
            'electricityBox': 'Skrzynka elektryczna',
            'chimneyExtension': 'Przedłużenie komina',
            'extraChimneyProtection': 'Dodatkowa ochrona komina',
            'bluetoothRadio': 'Radio Bluetooth',
            'electricHeater3kw': 'Grzałka elektryczna 3kW',
            'electricThermometer': 'Termometr elektryczny',
        }
    }
    
    # Get current language translations
    lang = request.language if request.language in translations else 'ru'
    t = translations[lang]
    ft = feature_translations[lang]
    
    # Register Unicode fonts (DejaVu for Cyrillic support)
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except Exception as e:
        logger.warning(f"Could not register fonts: {e}")
    
    # Create PDF
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                          rightMargin=20*mm, leftMargin=20*mm,
                          topMargin=20*mm, bottomMargin=20*mm)
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Define styles with Unicode font
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName='DejaVuSans-Bold',
        fontSize=24,
        textColor=colors.HexColor('#3B82F6'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontName='DejaVuSans-Bold',
        fontSize=14,
        textColor=colors.HexColor('#1E40AF'),
        spaceAfter=12,
        spaceBefore=20,
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName='DejaVuSans',
        fontSize=10,
    )
    
    # Title
    if request.type == 'customer':
        title = Paragraph(t['title_customer'], title_style)
    else:
        title = Paragraph(t['title_technical'], title_style)
    elements.append(title)
    elements.append(Spacer(1, 20))
    
    # Customer Information
    elements.append(Paragraph(t['customer_info'], heading_style))
    customer_data = [
        [t['full_name'], request.fullName],
        [t['phone'], request.phoneNumber],
        [t['address'], request.fullAddress],
        [t['order_date'], request.orderDate],
    ]
    customer_table = Table(customer_data, colWidths=[60*mm, 110*mm])
    customer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0F4F8')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1E293B')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
    ]))
    elements.append(customer_table)
    elements.append(Spacer(1, 20))
    
    # Configuration
    elements.append(Paragraph(t['configuration'], heading_style))
    config_data = [
        [t['shell_model'], request.shellModel],
        [t['wood_type'], request.woodType],
        [t['shell_color'], request.shellColor],
        [t['lid_type'], request.lidType],
        [t['wood_color'], request.woodColor],
    ]
    
    if request.sandFilter and request.sandFilter != 'none':
        config_data.append([t['sand_filter'], request.sandFilter])
    
    config_table = Table(config_data, colWidths=[60*mm, 110*mm])
    config_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0F4F8')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1E293B')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
    ]))
    elements.append(config_table)
    elements.append(Spacer(1, 20))
    
    # Features
    selected_features = [k for k, v in request.features.items() if v]
    if selected_features:
        elements.append(Paragraph(t['selected_features'], heading_style))
        # Translate feature names
        features_text = '<br/>'.join([f'• {ft.get(feat, feat.replace("_", " ").title())}' for feat in selected_features])
        features_para = Paragraph(features_text, normal_style)
        elements.append(features_para)
        elements.append(Spacer(1, 20))
    
    # Notes
    if request.notes:
        elements.append(Paragraph(t['additional_notes'], heading_style))
        notes_para = Paragraph(request.notes, normal_style)
        elements.append(notes_para)
        elements.append(Spacer(1, 20))
    
    # Total
    elements.append(Spacer(1, 10))
    total_data = [[t['total'], f'{request.total:.2f} €']]
    total_table = Table(total_data, colWidths=[120*mm, 50*mm])
    total_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#3B82F6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (0, 0), 'RIGHT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(total_table)
    
    # Build PDF
    doc.build(elements)
    
    # Get PDF data
    pdf_data = buffer.getvalue()
    buffer.close()
    
    # Return as streaming response
    # Create safe filename by URL encoding or using ASCII-safe name
    import urllib.parse
    try:
        # Try to create a safe ASCII filename
        safe_filename = ''.join(c for c in request.fullName if c.isascii() and (c.isalnum() or c in '-_.'))
        if not safe_filename:
            safe_filename = "customer"
    except:
        safe_filename = "customer"
    
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=order_{safe_filename}.pdf"}
    )

# ==================== SAUNA CALCULATOR API ====================

# Sauna Models
class SaunaModel(BaseModel):
    id: str
    name: str
    basePrice: int
    foundationPrice: int = 0
    discount: int = 0
    imageUrl: str = ""
    sortOrder: int = 1
    active: bool = True

class SaunaOption(BaseModel):
    id: str
    name: str
    price: int = 0
    inputType: str = "radio"
    sortOrder: int = 1
    imageUrl: Optional[str] = None
    hasQuantity: bool = False  # If true, show quantity input field

class SaunaCategory(BaseModel):
    id: str
    name: str
    inputType: str = "radio"
    displayType: str = "grid"  # "grid" (плитка) or "dropdown" (выпадающий список)
    options: List[SaunaOption] = []

class SaunaPriceData(BaseModel):
    models: List[SaunaModel] = []
    categories: List[SaunaCategory] = []
    modelsDisplayType: str = "grid"  # "grid" or "dropdown" для базовых моделей

class SaunaOrder(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str = Field(default_factory=lambda: f"WMS-{datetime.now().strftime('%d-%m-%Y-%H%M%S')}")
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: str
    selectedModel: str
    modelName: str = ""
    basePrice: int = 0
    foundationPrice: int = 0
    discount: int = 0
    discountPercent: float = 0.0
    selections: Dict[str, Any] = {}
    notes: str = ""
    optionsTotal: int = 0
    subtotal: float = 0.0
    total: float = 0.0
    createdBy: str = ""  # Username of employee who created the order
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SaunaPDFRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    orderId: str = ""
    fullName: str
    phoneNumber: str
    fullAddress: str = ""
    email: str = ""
    orderDate: str
    selectedModel: str
    modelName: str = ""
    basePrice: int = 0
    foundationPrice: int = 0
    discount: int = 0
    discountPercent: float = 0.0
    selections: Dict[str, Any] = {}
    quantities: Dict[str, int] = {}  # Store quantity for options
    notes: str = ""
    optionsTotal: int = 0
    subtotal: float = 0.0
    total: float = 0.0
    language: str = "pl"
    categories: List[Dict[str, Any]] = []

# Default sauna data
default_sauna_prices = {
    "models": [
        {"id": "sauna_kwadro_beczka_235x200_cm", "name": "Sauna Kwadro-Beczka 235x200 cm", "basePrice": 14200, "foundationPrice": 150, "discount": 10, "imageUrl": "https://i.imgur.com/hzOjw2G.jpeg", "sortOrder": 1, "active": True},
        {"id": "sauna_kwadro_beczka_235x250_cm", "name": "Sauna Kwadro-Beczka 235x250 cm", "basePrice": 17980, "foundationPrice": 200, "discount": 10, "imageUrl": "https://i.imgur.com/LbbjL2d.jpeg", "sortOrder": 2, "active": True},
        {"id": "sauna_kwadro_beczka_235x300_cm", "name": "Sauna Kwadro-Beczka 235x300 cm", "basePrice": 24100, "foundationPrice": 250, "discount": 8, "imageUrl": "https://i.imgur.com/2Hk8SaX.jpeg", "sortOrder": 3, "active": True},
        {"id": "sauna_kwadro_beczka_235x350_cm", "name": "Sauna Kwadro-Beczka 235x350 cm", "basePrice": 26770, "foundationPrice": 300, "discount": 8, "imageUrl": "https://i.imgur.com/JacJT18.jpeg", "sortOrder": 4, "active": True},
        {"id": "sauna_kwadro_beczka_235x400_cm", "name": "Sauna Kwadro-Beczka 235x400 cm", "basePrice": 29780, "foundationPrice": 350, "discount": 7, "imageUrl": "https://i.imgur.com/pJhd5hG.jpeg", "sortOrder": 5, "active": True},
        {"id": "sauna_kwadro_beczka_235x500_cm", "name": "Sauna Kwadro-Beczka 235x500 cm", "basePrice": 33180, "foundationPrice": 400, "discount": 5, "imageUrl": "https://i.imgur.com/rzD46tD.jpeg", "sortOrder": 6, "active": True},
        {"id": "sauna_kwadro_beczka_235x600_cm", "name": "Sauna Kwadro-Beczka 235x600 cm", "basePrice": 38280, "foundationPrice": 450, "discount": 5, "imageUrl": "https://i.imgur.com/LhEbZnJ.jpeg", "sortOrder": 7, "active": True},
        {"id": "sauna_beczka_235x200_cm", "name": "Sauna Beczka 235x200 cm", "basePrice": 12800, "foundationPrice": 150, "discount": 0, "imageUrl": "https://i.imgur.com/4UCP9c1.jpeg", "sortOrder": 8, "active": True},
        {"id": "sauna_beczka_235x250_cm", "name": "Sauna Beczka 235x250 cm", "basePrice": 15800, "foundationPrice": 200, "discount": 0, "imageUrl": "https://i.imgur.com/4japDW5.jpeg", "sortOrder": 9, "active": True},
        {"id": "sauna_beczka_235x300_cm", "name": "Sauna Beczka 235x300 cm", "basePrice": 21800, "foundationPrice": 250, "discount": 0, "imageUrl": "https://i.imgur.com/MxafYj4.jpeg", "sortOrder": 10, "active": True},
        {"id": "sauna_beczka_235x350_cm", "name": "Sauna Beczka 235x350 cm", "basePrice": 24300, "foundationPrice": 300, "discount": 0, "imageUrl": "https://i.imgur.com/IVx6NJr.jpeg", "sortOrder": 11, "active": True},
        {"id": "sauna_beczka_235x400_cm", "name": "Sauna Beczka 235x400 cm", "basePrice": 26800, "foundationPrice": 350, "discount": 0, "imageUrl": "https://i.imgur.com/Ierf7jw.jpeg", "sortOrder": 12, "active": True},
        {"id": "sauna_beczka_235x450_cm", "name": "Sauna Beczka 235x450 cm", "basePrice": 28300, "foundationPrice": 400, "discount": 0, "imageUrl": "https://i.imgur.com/QSWLalW.jpeg", "sortOrder": 13, "active": True},
    ],
    "modelsDisplayType": "grid",
    "categories": [
        {
            "id": "kolor",
            "name": "Kolor",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "impregnacja_gratis", "name": "Impregnacja zewnętrzna w dowolnym wybranym kolorze Gratis", "price": 0, "inputType": "radio", "sortOrder": 1}
            ]
        },
        {
            "id": "piece",
            "name": "Piece",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "bez_pieca", "name": "Bez pieca", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "piec_elektryczny_9kw", "name": "Piec Elektryczne 9 kW", "price": 2600, "inputType": "radio", "sortOrder": 2},
                {"id": "piec_drewno_wew_12kw", "name": "Piec na Drewno / załadunek wewnętrzna / 12kW", "price": 4000, "inputType": "radio", "sortOrder": 3},
                {"id": "piec_drewno_zew_12kw", "name": "Piec na Drewno / z załadunkiem zewnętrznym / 12kW", "price": 4650, "inputType": "radio", "sortOrder": 4},
                {"id": "piec_drewno_wew_18kw", "name": "Piec na Drewno / załadunek wewnętrzna / 18kW", "price": 5600, "inputType": "radio", "sortOrder": 5},
                {"id": "piec_drewno_zew_18kw", "name": "Piec na Drewno / z załadunkiem zewnętrznym / 18kW", "price": 6250, "inputType": "radio", "sortOrder": 6}
            ]
        },
        {
            "id": "strona_pieca",
            "name": "Strona Pieca:",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "piec_wprost", "name": "Piec wprost", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "piec_lewo", "name": "Piec lewo", "price": 350, "inputType": "radio", "sortOrder": 2},
                {"id": "piec_prawo", "name": "Piec prawo", "price": 350, "inputType": "radio", "sortOrder": 3}
            ]
        },
        {
            "id": "zbiornik_wody",
            "name": "Zbiornik na wodę na piec",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "zbiornik_nie", "name": "Zbiornik na wodę na piec - Nie", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "zbiornik_30l", "name": "Zbiornik na wodę na piec 30L", "price": 890, "inputType": "radio", "sortOrder": 2},
                {"id": "zbiornik_50l", "name": "Zbiornik na wodę na piec 50L", "price": 990, "inputType": "radio", "sortOrder": 3}
            ]
        },
        {
            "id": "ogrodzenie_pieca",
            "name": "Ogrodzenie do pieca (drewniane)",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": [
                {"id": "ogrodzenie_drewniane", "name": "Ogrodzenie do pieca (drewniane)", "price": 490, "inputType": "checkbox", "sortOrder": 1}
            ]
        },
        {
            "id": "drzwi",
            "name": "Drzwi",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "drzwi_szklane_gratis", "name": "Drzwi szklane hartowane 8mm gratis", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "drzwi_szklane_hartowane", "name": "Drzwi wejściowe do łaźni wykonane są ze szkła hartowanego", "price": 530, "inputType": "radio", "sortOrder": 2},
                {"id": "drzwi_drewniane", "name": "Drzwi drewniane z dużym przeszkleniem (zamykane)", "price": 990, "inputType": "radio", "sortOrder": 3}
            ]
        },
        {
            "id": "lokalizacja_drzwi",
            "name": "Lokalizacja drzwi",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "drzwi_wprost", "name": "Lokalizacja drzwi wprost", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "drzwi_boczne", "name": "Lokalizacja drzwi bocznych", "price": 1170, "inputType": "radio", "sortOrder": 2}
            ]
        },
        {
            "id": "okna",
            "name": "Okna",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": [
                {"id": "okno_42x42", "name": "Okno otwierane 42x42 cm", "price": 420, "inputType": "checkbox", "sortOrder": 1},
                {"id": "extra_okno_42x42", "name": "Extra Okno otwierane 42x42 cm", "price": 420, "inputType": "checkbox", "sortOrder": 2},
                {"id": "okno_50x60", "name": "Okno otwierane 50x60 cm", "price": 650, "inputType": "checkbox", "sortOrder": 3},
                {"id": "extra_okno_50x60", "name": "Extra Okno otwierane 50x60 cm", "price": 650, "inputType": "checkbox", "sortOrder": 4},
                {"id": "okno_120x50", "name": "Okno otwierane 120x50 cm", "price": 1190, "inputType": "checkbox", "sortOrder": 5},
                {"id": "extra_okno_120x50", "name": "Extra Okno otwierane 120x50 cm", "price": 1190, "inputType": "checkbox", "sortOrder": 6}
            ]
        },
        {
            "id": "szyba_panoramiczna",
            "name": "Szyba połpanoramiczna",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "szyba_nie", "name": "Szyba połpanoramiczna- Nie", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "szyba_80x160", "name": "Szyba połpanoramiczna 80x160 cm", "price": 980, "inputType": "radio", "sortOrder": 2},
                {"id": "szyba_160x160", "name": "Szyba panoramiczna 160x160 cm", "price": 1980, "inputType": "radio", "sortOrder": 3}
            ]
        },
        {
            "id": "lawki",
            "name": "Ławki",
            "inputType": "radio",
            "displayType": "grid",
            "options": [
                {"id": "lawki_standard_1", "name": "Standart (1 poziom)", "price": 0, "inputType": "radio", "sortOrder": 1, "imageUrl": "https://i.imgur.com/ff4dvj5.jpeg"},
                {"id": "lawki_standard_katowy", "name": "Standart kątowy (1 poziom)", "price": 0, "inputType": "radio", "sortOrder": 2, "imageUrl": "https://i.imgur.com/EH6e0Oe.jpeg"},
                {"id": "lawki_2_poziomy_otwarte", "name": "Ławki 2-poziomowe nie są zamknięte 55 cm", "price": 480, "inputType": "radio", "sortOrder": 3, "imageUrl": "https://i.imgur.com/lNi4r5Q.jpeg"},
                {"id": "lawki_2_poziomy_zamkniete", "name": "Premium Ławki 2 poziomy zamknięte 55 cm", "price": 980, "inputType": "radio", "sortOrder": 4, "imageUrl": "https://i.imgur.com/F8HtCTo.jpeg"},
                {"id": "lawki_2_poziomy_przesuwane", "name": "Premium Ławki 2 poziomy nie są zamknięte dolne przesuwane 55 cm", "price": 1580, "inputType": "radio", "sortOrder": 5, "imageUrl": "https://i.imgur.com/udSAwBt.jpeg"}
            ]
        },
        {
            "id": "oswietlenie",
            "name": "Oswietlenie",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": [
                {"id": "led_gratis", "name": "LED oświetlenie przebieralni i łaźni gratis", "price": 0, "inputType": "checkbox", "sortOrder": 1},
                {"id": "lampa_standard", "name": "Lampa STANDARD (w każdym pomieszczeniu)", "price": 0, "inputType": "checkbox", "sortOrder": 2},
                {"id": "led_rgb", "name": "Oświetlenie LED RGB (dedykowane pod ławkami)", "price": 580, "inputType": "checkbox", "sortOrder": 3},
                {"id": "led_neon", "name": "Oświetlenie LED NEON (zewnętrzny pasek led zwykle wokół drzwi i okien albo krawędź sauny) do wyboru", "price": 970, "inputType": "checkbox", "sortOrder": 4},
                {"id": "led_przebieralnia", "name": "Oświetlenie LED przebieralnia", "price": 580, "inputType": "checkbox", "sortOrder": 5},
                {"id": "lampa_zewnetrzna", "name": "Dodatkowa lampa zewnętrzna", "price": 390, "inputType": "checkbox", "sortOrder": 6},
                {"id": "premium_oswietlenie", "name": "Premium Oświetlenie pomieszczeń", "price": 1500, "inputType": "checkbox", "sortOrder": 7}
            ]
        },
        {
            "id": "opcje_dodatkowe",
            "name": "Opcje Dodatkowe",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": [
                {"id": "grzejnik_30l", "name": "Grzejnik elektryczny na wodę 30L + Brodzik + Prysznic", "price": 2800, "inputType": "checkbox", "sortOrder": 1},
                {"id": "grzejnik_50l", "name": "Grzejnik elektryczny na wodę 50L + Brodzik + Prysznic", "price": 2950, "inputType": "checkbox", "sortOrder": 2},
                {"id": "stol_relaksacyjny", "name": "Duży stół do pokoju relaksacyjnego", "price": 360, "inputType": "checkbox", "sortOrder": 3},
                {"id": "lezak_ergonomiczny", "name": "Ergonomiczny profilowany leżak", "price": 1850, "inputType": "checkbox", "sortOrder": 4},
                {"id": "lawka_skrzynia", "name": "Ławka ze skrzynią do przechowywania", "price": 340, "inputType": "checkbox", "sortOrder": 5},
                {"id": "schody", "name": "Schody przed wejściem", "price": 540, "inputType": "checkbox", "sortOrder": 6},
                {"id": "dach_wejscie", "name": "Dach nad wejściem przy opcji wejścia ftontowego", "price": 610, "inputType": "checkbox", "sortOrder": 7},
                {"id": "taras_zewnetrzny", "name": "Extra Taras Zewnętrzny (50cm 2 Lawki)", "price": 950, "inputType": "checkbox", "sortOrder": 8}
            ]
        },
        {
            "id": "fundament",
            "name": "Belki podłużne do podstawy ramy sauny",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "belki_nie", "name": "Belki podłużne - Nie", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "belki_dodaj", "name": "Dodaj do sauny Belki podłużne", "price": 0, "inputType": "radio", "sortOrder": 2}
            ]
        },
        {
            "id": "dostawa",
            "name": "Dostawa",
            "inputType": "radio",
            "displayType": "dropdown",
            "options": [
                {"id": "odbior_osobisty", "name": "Odbiór osobisty", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "dostawa_1_100km", "name": "Dostawa 1 (1-100km)", "price": 950, "inputType": "radio", "sortOrder": 2},
                {"id": "dostawa_101_250km", "name": "Dostawa 2 (101-250km)", "price": 1200, "inputType": "radio", "sortOrder": 3},
                {"id": "dostawa_251_400km", "name": "Dostawa 3 (251-400km)", "price": 1800, "inputType": "radio", "sortOrder": 4},
                {"id": "dostawa_401_650km", "name": "Dostawa 4 (401-650km)", "price": 2300, "inputType": "radio", "sortOrder": 5}
            ]
        }
    ]
}

# Sauna API Routes
@api_router.get("/sauna/prices")
async def get_sauna_prices():
    """Get sauna pricing data"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        # Initialize with default prices
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        return default_sauna_prices
    
    prices.pop('_id', None)
    return prices

@api_router.post("/sauna/prices")
async def update_sauna_prices(prices: SaunaPriceData):
    """Update sauna pricing data"""
    price_dict = prices.model_dump()
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": price_dict},
        upsert=True
    )
    return {"message": "Sauna prices updated successfully"}


# =============================================
# SAUNA MODELS CRUD
# =============================================
@api_router.post("/sauna/models")
async def add_sauna_model(model: SaunaModel):
    """Add a new sauna model"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        prices = default_sauna_prices.copy()
    
    models = prices.get("models", [])
    # Check if model with same id exists
    if any(m["id"] == model.id for m in models):
        raise HTTPException(status_code=400, detail="Model with this ID already exists")
    
    models.append(model.model_dump())
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"models": models}}
    )
    return {"message": "Model added successfully", "model": model}


@api_router.put("/sauna/models/{model_id}")
async def update_sauna_model(model_id: str, model: SaunaModel):
    """Update an existing sauna model"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    models = prices.get("models", [])
    model_index = next((i for i, m in enumerate(models) if m["id"] == model_id), None)
    
    if model_index is None:
        raise HTTPException(status_code=404, detail="Model not found")
    
    models[model_index] = model.model_dump()
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"models": models}}
    )
    return {"message": "Model updated successfully", "model": model}


@api_router.delete("/sauna/models/{model_id}")
async def delete_sauna_model(model_id: str):
    """Delete a sauna model"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    models = prices.get("models", [])
    new_models = [m for m in models if m["id"] != model_id]
    
    if len(new_models) == len(models):
        raise HTTPException(status_code=404, detail="Model not found")
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"models": new_models}}
    )
    return {"message": "Model deleted successfully"}


# =============================================
# SAUNA CATEGORIES CRUD
# =============================================
@api_router.post("/sauna/categories")
async def add_sauna_category(category: SaunaCategory):
    """Add a new sauna category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        prices = default_sauna_prices.copy()
    
    categories = prices.get("categories", [])
    if any(c["id"] == category.id for c in categories):
        raise HTTPException(status_code=400, detail="Category with this ID already exists")
    
    categories.append(category.model_dump())
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category added successfully", "category": category}


@api_router.put("/sauna/categories/{category_id}")
async def update_sauna_category(category_id: str, category: SaunaCategory):
    """Update an existing sauna category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    categories[cat_index] = category.model_dump()
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Category updated successfully", "category": category}


@api_router.delete("/sauna/categories/{category_id}")
async def delete_sauna_category(category_id: str):
    """Delete a sauna category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    new_categories = [c for c in categories if c["id"] != category_id]
    
    if len(new_categories) == len(categories):
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": new_categories}}
    )
    return {"message": "Category deleted successfully"}


# =============================================
# SAUNA OPTIONS CRUD
# =============================================
@api_router.post("/sauna/categories/{category_id}/options")
async def add_sauna_option(category_id: str, option: SaunaOption):
    """Add an option to a category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    if any(o["id"] == option.id for o in options):
        raise HTTPException(status_code=400, detail="Option with this ID already exists")
    
    options.append(option.model_dump())
    categories[cat_index]["options"] = options
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option added successfully", "option": option}


@api_router.put("/sauna/categories/{category_id}/options/{option_id}")
async def update_sauna_option(category_id: str, option_id: str, option: SaunaOption):
    """Update an option in a category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    opt_index = next((i for i, o in enumerate(options) if o["id"] == option_id), None)
    
    if opt_index is None:
        raise HTTPException(status_code=404, detail="Option not found")
    
    options[opt_index] = option.model_dump()
    categories[cat_index]["options"] = options
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option updated successfully", "option": option}


@api_router.delete("/sauna/categories/{category_id}/options/{option_id}")
async def delete_sauna_option(category_id: str, option_id: str):
    """Delete an option from a category"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    categories = prices.get("categories", [])
    cat_index = next((i for i, c in enumerate(categories) if c["id"] == category_id), None)
    
    if cat_index is None:
        raise HTTPException(status_code=404, detail="Category not found")
    
    options = categories[cat_index].get("options", [])
    new_options = [o for o in options if o["id"] != option_id]
    
    if len(new_options) == len(options):
        raise HTTPException(status_code=404, detail="Option not found")
    
    categories[cat_index]["options"] = new_options
    
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"categories": categories}}
    )
    return {"message": "Option deleted successfully"}

@api_router.post("/sauna/orders", response_model=SaunaOrder)
async def create_sauna_order(order: SaunaOrder):
    """Create a new sauna order"""
    order_dict = order.model_dump()
    await db.sauna_orders.insert_one(order_dict)
    return order

@api_router.get("/sauna/orders")
async def get_sauna_orders():
    """Get all sauna orders"""
    orders = await db.sauna_orders.find({}, {"_id": 0}).to_list(1000)
    return orders


@api_router.delete("/sauna/orders/{order_id}")
async def delete_sauna_order(order_id: str):
    """Delete a sauna order"""
    result = await db.sauna_orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted successfully"}

@api_router.post("/sauna/generate-pdf")
async def generate_sauna_pdf(request: SaunaPDFRequest):
    """Generate PDF for sauna order - Professional offer format"""
    import base64
    import os
    
    buffer = io.BytesIO()
    
    # Register Unicode fonts
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except Exception as e:
        logger.warning(f"Could not register fonts: {e}")
    
    # Colors
    BROWN = colors.HexColor('#97724E')
    BROWN_LIGHT = colors.HexColor('#FAF6F0')
    BROWN_BORDER = colors.HexColor('#D4C4B0')
    BROWN_DARK = colors.HexColor('#6B5038')
    GREEN = colors.HexColor('#2D7A3E')
    GREEN_LIGHT = colors.HexColor('#F0F9F5')
    RED = colors.HexColor('#C53030')
    RED_LIGHT = colors.HexColor('#FFF5F5')
    TEXT_COLOR = colors.HexColor('#323232')
    MUTED = colors.HexColor('#888888')
    
    # Create PDF
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                          rightMargin=20, leftMargin=20,
                          topMargin=20, bottomMargin=20)
    
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        fontName='DejaVuSans-Bold',
        fontSize=13,
        textColor=BROWN_DARK,
    )
    
    normal_style = ParagraphStyle(
        'Normal',
        fontName='DejaVuSans',
        fontSize=9,
        textColor=TEXT_COLOR,
    )
    
    # Calculate dates
    current_date = datetime.now().strftime('%d.%m.%Y')
    valid_until = (datetime.now() + timedelta(days=30)).strftime('%d.%m.%Y')
    promo_until = (datetime.now() + timedelta(days=7)).strftime('%d.%m.%Y')
    
    # Use orderId if provided - it should be in WMS-DD-MM-YYYY-HHMMSS format
    order_id = getattr(request, 'orderId', '') or ''
    if order_id and order_id.startswith('WMS-'):
        offer_number = order_id
    elif order_id:
        offer_number = f"WMS-{order_id[:8].upper()}"
    else:
        offer_number = f"WMS-{datetime.now().strftime('%d-%m-%Y-%H%M%S')}"
    
    # Get discount info
    discount_percent = getattr(request, 'discountPercent', 0) or 0
    subtotal = getattr(request, 'subtotal', request.total / (1 - discount_percent/100) if discount_percent else request.total) or request.total
    total_after_discount = request.total
    
    # Load logo image
    logo_path = '/app/assets/logo7.png'
    logo_img = None
    if os.path.exists(logo_path):
        try:
            logo_img = RLImage(logo_path, width=180, height=36)
        except Exception as e:
            logger.warning(f"Could not load logo: {e}")
    
    # Load promo image
    promo_path = '/app/assets/Prezent2.jpg'
    promo_img = None
    if os.path.exists(promo_path):
        try:
            promo_img = RLImage(promo_path, width=100, height=100)
        except Exception as e:
            logger.warning(f"Could not load promo image: {e}")
    
    # ========== HEADER ==========
    logo_cell = logo_img if logo_img else Paragraph('<b>WM-SAUNA</b>', ParagraphStyle('Logo', fontName='DejaVuSans-Bold', fontSize=24, textColor=BROWN))
    
    header_data = [[
        logo_cell,
        '',
        Paragraph('''<b>OFERTA HANDLOWA</b><br/>
        <font size="9" color="#95856e">Tel: +48 732 099 201</font><br/>
        <font size="9" color="#95856e">Email: wmsauna@gmail.com</font><br/>
        <font size="9" color="#95856e">www.wm-sauna.pl</font>''',
        ParagraphStyle('HeaderRight', fontName='DejaVuSans', fontSize=16, alignment=TA_RIGHT, textColor=BROWN))
    ]]
    header_table = Table(header_data, colWidths=[200, 130, 200])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (0, 0), 10),
    ]))
    elements.append(header_table)
    
    # Divider line
    elements.append(Spacer(1, 4))
    elements.append(Table([['']], colWidths=[530], rowHeights=[2], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
    elements.append(Spacer(1, 8))
    
    # ========== CLIENT + OFFER INFO ==========
    email_line = f"Email: {request.email}<br/>" if hasattr(request, 'email') and request.email else ""
    client_info = Paragraph(f'''<b>DANE KLIENTA:</b><br/>
    Imię i nazwisko: {request.fullName}<br/>
    {email_line}Telefon: {request.phoneNumber}''', 
    ParagraphStyle('ClientInfo', fontName='DejaVuSans', fontSize=9, textColor=TEXT_COLOR))
    
    offer_info = Paragraph(f'''<b>INFORMACJE O OFERCIE:</b><br/>
    Data wystawienia: {current_date}<br/>
    Ważność oferty: {valid_until}<br/>
    <b>Nr oferty: {offer_number}</b>''',
    ParagraphStyle('OfferInfo', fontName='DejaVuSans', fontSize=9, textColor=TEXT_COLOR, alignment=TA_RIGHT))
    
    info_table = Table([[client_info, offer_info]], colWidths=[265, 265])
    info_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BROWN),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 8))
    
    # ========== DISCOUNT OR PROMO SECTION ==========
    if discount_percent > 0:
        savings = subtotal - total_after_discount
        discount_content = Paragraph(f'''<b><font color="#2D7A3E" size="14">ZASTOSOWANA ZNIŻKA</font></b><br/><br/>
        <font size="12" color="#2D7A3E"><b>Rabat: {discount_percent:.0f}%</b></font><br/>
        <font size="11">Cena przed rabatem: {subtotal:,.0f} PLN</font><br/>
        <font size="11" color="#2D7A3E"><b>Cena po rabacie: {total_after_discount:,.0f} PLN</b></font><br/>
        <font size="10" color="#666666"><i>Oszczędzasz: {savings:,.0f} PLN</i></font>'''.replace(',', ' '),
        ParagraphStyle('Discount', fontName='DejaVuSans', fontSize=11))
        
        promo_table = Table([[discount_content]], colWidths=[530])
        promo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), GREEN_LIGHT),
            ('BOX', (0, 0), (-1, -1), 2, GREEN),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(promo_table)
    else:
        # Promo section with gift image
        promo_text = Paragraph(f'''<b><font color="#C53030" size="13">PROMOCJA SPECJALNA</font></b><br/><br/>
        <font size="9">Zamów do {promo_until} i wybierz swój super gratis świąteczny:<br/>
        Darmowa balia do schłodzenia<br/>
        albo rabat do 10% od zamówienia</font><br/><br/>
        <font size="8" color="#888888">Oferta ważna tylko przy zakupie w tym terminie</font>''',
        ParagraphStyle('PromoText', fontName='DejaVuSans', fontSize=11))
        
        if promo_img:
            promo_data = [[promo_img, promo_text]]
            promo_table = Table(promo_data, colWidths=[120, 400])
            promo_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), RED_LIGHT),
                ('BOX', (0, 0), (-1, -1), 1.5, RED),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
        else:
            promo_table = Table([[promo_text]], colWidths=[530])
            promo_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), RED_LIGHT),
                ('BOX', (0, 0), (-1, -1), 1.5, RED),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ]))
        elements.append(promo_table)
    elements.append(Spacer(1, 10))
    
    # ========== MODEL SECTION ==========
    elements.append(Paragraph('MODEL', section_title_style))
    elements.append(Spacer(1, 4))
    elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN_BORDER)]))
    elements.append(Spacer(1, 4))
    
    model_data = [[
        Paragraph(f'<b>{request.modelName or "-"}</b>', ParagraphStyle('Model', fontName='DejaVuSans-Bold', fontSize=12)),
        Paragraph(f'<b><font color="#97724E">{request.basePrice:,} PLN</font></b>'.replace(',', ' '), 
                 ParagraphStyle('Price', fontName='DejaVuSans-Bold', fontSize=12, alignment=TA_RIGHT))
    ]]
    model_table = Table(model_data, colWidths=[380, 150])
    model_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(model_table)
    elements.append(Spacer(1, 8))
    
    # ========== COMMENT SECTION ==========
    if request.notes:
        elements.append(Paragraph('KOMENTARZ DO ZAMÓWIENIA', section_title_style))
        elements.append(Spacer(1, 4))
        comment_table = Table([[Paragraph(request.notes, normal_style)]], colWidths=[530])
        comment_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.8, BROWN),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(comment_table)
        elements.append(Spacer(1, 8))
    
    # ========== BENCH IMAGE SECTION ==========
    # Find bench selection and its image
    bench_image_url = None
    bench_name = None
    bench_price = 0
    
    # First try from selectedOptions
    selected_options = getattr(request, 'selectedOptions', None) or []
    logger.info(f"selectedOptions: {selected_options}")
    
    for opt in selected_options:
        cat_id = opt.get('categoryId', '')
        if cat_id == 'lawki' and opt.get('imageUrl'):
            bench_image_url = opt.get('imageUrl')
            bench_name = opt.get('optionName')
            bench_price = opt.get('price', 0)
            logger.info(f"Found bench from selectedOptions: {bench_name}, URL: {bench_image_url}")
            break
    
    # If not found, try from categories
    if not bench_image_url:
        for category in request.categories:
            if category.get('id') == 'lawki':
                selection = request.selections.get('lawki')
                logger.info(f"Bench selection from categories: {selection}")
                if selection:
                    for opt in category.get('options', []):
                        if opt.get('id') == selection:
                            if opt.get('imageUrl'):
                                bench_image_url = opt.get('imageUrl')
                                bench_name = opt.get('name')
                                bench_price = opt.get('price', 0)
                                logger.info(f"Found bench from categories: {bench_name}, URL: {bench_image_url}")
                            break
                break
    
    logger.info(f"Final bench data: name={bench_name}, url={bench_image_url}")
    
    if bench_image_url and bench_name:
        elements.append(Paragraph('ŁAWKI', section_title_style))
        elements.append(Spacer(1, 4))
        
        # Try to load bench image from URL
        bench_img = None
        try:
            import urllib.request
            import tempfile
            
            # Download image with proper headers to avoid rate limiting
            req = urllib.request.Request(
                bench_image_url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.google.com/',
                }
            )
            
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                with urllib.request.urlopen(req, timeout=10) as response:
                    tmp.write(response.read())
                bench_img = RLImage(tmp.name, width=140, height=100)
                logger.info(f"Successfully loaded bench image: {bench_image_url}")
        except Exception as e:
            logger.warning(f"Could not load bench image: {e}")
        
        bench_info = Paragraph(f'''<b>{bench_name}</b><br/>
        <font color="#97724E">{bench_price:,} PLN</font>'''.replace(',', ' '),
        ParagraphStyle('BenchInfo', fontName='DejaVuSans', fontSize=11))
        
        if bench_img:
            bench_data = [[bench_img, bench_info]]
            bench_table = Table(bench_data, colWidths=[160, 370])
            bench_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (1, 0), (1, 0), 15),
            ]))
            elements.append(bench_table)
        else:
            elements.append(bench_info)
        elements.append(Spacer(1, 8))
    
    # ========== OPTIONS SECTION (Two columns) ==========
    options_items = []
    quantities = getattr(request, 'quantities', {}) or {}
    
    for category in request.categories:
        cat_id = category.get('id', '')
        selection = request.selections.get(cat_id)
        
        if not selection:
            continue
        
        if category.get('inputType') == 'checkbox':
            for opt_id, is_selected in selection.items():
                if is_selected:
                    opt = next((o for o in category.get('options', []) if o.get('id') == opt_id), None)
                    if opt:
                        price = opt.get('price', 0)
                        has_quantity = opt.get('hasQuantity', False)
                        quantity = quantities.get(opt_id, 1) if has_quantity else 1
                        total_price = price * quantity
                        
                        # Format name with quantity
                        name = opt.get('name', '')
                        if has_quantity and quantity > 1:
                            name = f"{name} (×{quantity})"
                        
                        price_str = f"{total_price:,} PLN".replace(',', ' ') if total_price > 0 else '0 PLN'
                        options_items.append({'name': name, 'price': price_str})
        else:
            opt = next((o for o in category.get('options', []) if o.get('id') == selection), None)
            if opt:
                price = opt.get('price', 0)
                has_quantity = opt.get('hasQuantity', False)
                quantity = quantities.get(selection, 1) if has_quantity else 1
                total_price = price * quantity
                
                # Format name with quantity
                name = opt.get('name', '')
                if has_quantity and quantity > 1:
                    name = f"{name} (×{quantity})"
                
                price_str = f"{total_price:,} PLN".replace(',', ' ') if total_price > 0 else '0 PLN'
                options_items.append({'name': name, 'price': price_str})
    
    if options_items:
        elements.append(Paragraph('DODATKOWE OPCJE', section_title_style))
        elements.append(Spacer(1, 4))
        elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN_BORDER)]))
        elements.append(Spacer(1, 4))
        
        # Determine font size based on option count
        opt_count = len(options_items)
        if opt_count > 40:
            fs = 7
        elif opt_count > 28:
            fs = 8
        elif opt_count > 18:
            fs = 9
        else:
            fs = 10
        
        # Create two-column layout
        options_body = [[
            Paragraph('<b>OPCJA</b>', ParagraphStyle('OptHeader', fontName='DejaVuSans-Bold', fontSize=fs, textColor=colors.white)),
            '',
            Paragraph('<b>OPCJA</b>', ParagraphStyle('OptHeader', fontName='DejaVuSans-Bold', fontSize=fs, textColor=colors.white)),
            ''
        ]]
        
        # Split into rows of two
        for i in range(0, len(options_items), 2):
            left = options_items[i]
            right = options_items[i + 1] if i + 1 < len(options_items) else None
            
            row = [
                Paragraph(left['name'], ParagraphStyle('OptName', fontName='DejaVuSans', fontSize=fs)),
                Paragraph(left['price'], ParagraphStyle('OptPrice', fontName='DejaVuSans', fontSize=fs, alignment=TA_RIGHT)),
                Paragraph(right['name'] if right else '', ParagraphStyle('OptName', fontName='DejaVuSans', fontSize=fs)),
                Paragraph(right['price'] if right else '', ParagraphStyle('OptPrice', fontName='DejaVuSans', fontSize=fs, alignment=TA_RIGHT)),
            ]
            options_body.append(row)
        
        options_table = Table(options_body, colWidths=[180, 80, 180, 80])
        table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), BROWN),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            # Horizontal lines between all rows
            ('LINEBELOW', (0, 0), (-1, -1), 0.8, BROWN_BORDER),
            ('LINEABOVE', (0, 0), (-1, 0), 1, BROWN),
            # Vertical line between left and right columns
            ('LINEBEFORE', (2, 0), (2, -1), 0.8, BROWN_BORDER),
            # Box around the whole table
            ('BOX', (0, 0), (-1, -1), 1, BROWN_BORDER),
        ]
        # Add alternating row colors
        for i in range(1, len(options_body)):
            if (i - 1) % 2 == 0:
                table_style.append(('BACKGROUND', (0, i), (-1, i), BROWN_LIGHT))
        
        options_table.setStyle(TableStyle(table_style))
        elements.append(options_table)
        elements.append(Spacer(1, 10))
    
    # ========== TOTAL SECTION (FIXED) ==========
    total_price_str = f"{total_after_discount:,.0f}".replace(',', ' ')
    
    discount_note = ''
    if discount_percent > 0:
        discount_note = f"Rabat: {discount_percent:.0f}% (cena bez rabatu: {subtotal:,.0f} PLN)".replace(',', ' ')
    
    # Left cell with total
    total_left_content = [
        Paragraph('<font color="white"><b>WARTOŚĆ CAŁKOWITA OFERTY</b></font>', 
                  ParagraphStyle('TotalTitle', fontName='DejaVuSans-Bold', fontSize=11, textColor=colors.white)),
        Spacer(1, 4),
        Paragraph(f'<font color="white"><b>{total_price_str} PLN</b></font>', 
                  ParagraphStyle('TotalValue', fontName='DejaVuSans-Bold', fontSize=20, textColor=colors.white)),
    ]
    if discount_note:
        total_left_content.append(Spacer(1, 4))
        total_left_content.append(Paragraph(f'<font color="#F0F9F5" size="8">{discount_note}</font>', 
                                           ParagraphStyle('DiscountNote', fontName='DejaVuSans', fontSize=8)))
    
    # Right cell with terms
    total_right_content = [
        Paragraph('TERMIN REALIZACJI: 1–3 tygodni + montaż 1–2 dni', 
                  ParagraphStyle('Terms', fontName='DejaVuSans', fontSize=8)),
        Paragraph('ZALICZKA: 50% przed produkcją, 50% przed wysyłką', 
                  ParagraphStyle('Terms', fontName='DejaVuSans', fontSize=8)),
        Paragraph('GWARANCJA: 12 miesiące od daty montażu', 
                  ParagraphStyle('Terms', fontName='DejaVuSans', fontSize=8)),
    ]
    
    total_table = Table([[[*total_left_content], [*total_right_content]]], colWidths=[280, 250])
    total_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), BROWN),
        ('BACKGROUND', (1, 0), (1, 0), BROWN_LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(total_table)
    
    # ========== FOOTER ==========
    elements.append(Spacer(1, 10))
    elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph('Oferta ważna 30 dni od daty wystawienia.', 
                             ParagraphStyle('Footer', fontName='DejaVuSans', fontSize=8, textColor=MUTED, alignment=TA_CENTER)))
    
    # Build PDF
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    # Safe filename
    current_date_file = datetime.now().strftime('%d-%m-%Y')
    try:
        safe_name = ''.join(c for c in request.fullName if c.isascii() and (c.isalnum() or c in '-_. '))
        safe_name = safe_name.replace(' ', '_')
        if not safe_name:
            safe_name = "Klient"
    except:
        safe_name = "Klient"
    
    filename = f"Oferta_{safe_name}_{current_date_file}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Health check endpoint for Kubernetes liveness/readiness probes
@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    return {"status": "healthy", "service": "wm-calculator-backend"}

@api_router.get("/health")
async def api_health_check():
    """Health check endpoint accessible via /api/health"""
    return {"status": "healthy", "service": "wm-calculator-backend"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
