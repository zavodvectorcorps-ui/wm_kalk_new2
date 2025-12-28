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
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
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
ADMIN_PASSWORD = "159357"

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

class SaunaCategory(BaseModel):
    id: str
    name: str
    inputType: str = "radio"
    options: List[SaunaOption] = []

class SaunaPriceData(BaseModel):
    models: List[SaunaModel] = []
    categories: List[SaunaCategory] = []

class SaunaOrder(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: str
    selectedModel: str
    modelName: str = ""
    basePrice: int = 0
    foundationPrice: int = 0
    discount: int = 0
    selections: Dict[str, Any] = {}
    notes: str = ""
    optionsTotal: int = 0
    total: float = 0.0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SaunaPDFRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: str
    selectedModel: str
    modelName: str = ""
    basePrice: int = 0
    foundationPrice: int = 0
    discount: int = 0
    selections: Dict[str, Any] = {}
    notes: str = ""
    optionsTotal: int = 0
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
    "categories": [
        {
            "id": "kolor",
            "name": "Kolor",
            "inputType": "radio",
            "options": [
                {"id": "impregnacja_gratis", "name": "Impregnacja zewnętrzna w dowolnym wybranym kolorze Gratis", "price": 0, "inputType": "radio", "sortOrder": 1}
            ]
        },
        {
            "id": "piece",
            "name": "Piece",
            "inputType": "radio",
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
            "options": [
                {"id": "ogrodzenie_drewniane", "name": "Ogrodzenie do pieca (drewniane)", "price": 490, "inputType": "checkbox", "sortOrder": 1}
            ]
        },
        {
            "id": "drzwi",
            "name": "Drzwi",
            "inputType": "radio",
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
            "options": [
                {"id": "drzwi_wprost", "name": "Lokalizacja drzwi wprost", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "drzwi_boczne", "name": "Lokalizacja drzwi bocznych", "price": 1170, "inputType": "radio", "sortOrder": 2}
            ]
        },
        {
            "id": "okna",
            "name": "Okna",
            "inputType": "checkbox",
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
            "options": [
                {"id": "belki_nie", "name": "Belki podłużne - Nie", "price": 0, "inputType": "radio", "sortOrder": 1},
                {"id": "belki_dodaj", "name": "Dodaj do sauny Belki podłużne", "price": 0, "inputType": "radio", "sortOrder": 2}
            ]
        },
        {
            "id": "dostawa",
            "name": "Dostawa",
            "inputType": "radio",
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

@api_router.post("/sauna/generate-pdf")
async def generate_sauna_pdf(request: SaunaPDFRequest):
    """Generate PDF for sauna order"""
    buffer = io.BytesIO()
    
    # Register Unicode fonts
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except Exception as e:
        logger.warning(f"Could not register fonts: {e}")
    
    # Create PDF
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                          rightMargin=15*mm, leftMargin=15*mm,
                          topMargin=15*mm, bottomMargin=15*mm)
    
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'SaunaTitle',
        parent=styles['Heading1'],
        fontName='DejaVuSans-Bold',
        fontSize=20,
        textColor=colors.HexColor('#16A34A'),
        spaceAfter=20,
        alignment=TA_CENTER,
    )
    
    heading_style = ParagraphStyle(
        'SaunaHeading',
        parent=styles['Heading2'],
        fontName='DejaVuSans-Bold',
        fontSize=12,
        textColor=colors.HexColor('#166534'),
        spaceAfter=8,
        spaceBefore=12,
    )
    
    normal_style = ParagraphStyle(
        'SaunaNormal',
        parent=styles['Normal'],
        fontName='DejaVuSans',
        fontSize=9,
    )
    
    # Title
    elements.append(Paragraph('Zamówienie Sauny', title_style))
    elements.append(Spacer(1, 10))
    
    # Customer Info
    elements.append(Paragraph('Dane klienta', heading_style))
    customer_data = [
        ['Imię i nazwisko:', request.fullName],
        ['Telefon:', request.phoneNumber],
        ['Adres:', request.fullAddress],
        ['Data zamówienia:', request.orderDate],
    ]
    customer_table = Table(customer_data, colWidths=[50*mm, 120*mm])
    customer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0FDF4')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1E293B')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#BBF7D0')),
    ]))
    elements.append(customer_table)
    elements.append(Spacer(1, 10))
    
    # Model Info
    elements.append(Paragraph('Model sauny', heading_style))
    model_data = [
        ['Model:', request.modelName],
        ['Cena podstawowa:', f'{request.basePrice:,} PLN'.replace(',', ' ')],
    ]
    if request.foundationPrice > 0:
        model_data.append(['Fundament:', f'+{request.foundationPrice:,} PLN'.replace(',', ' ')])
    if request.discount > 0:
        model_data.append(['Rabat:', f'-{request.discount}%'])
    
    model_table = Table(model_data, colWidths=[50*mm, 120*mm])
    model_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0FDF4')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1E293B')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#BBF7D0')),
    ]))
    elements.append(model_table)
    elements.append(Spacer(1, 10))
    
    # Selected Options
    elements.append(Paragraph('Wybrane opcje', heading_style))
    
    options_data = []
    for category in request.categories:
        cat_id = category.get('id', '')
        cat_name = category.get('name', '')
        selection = request.selections.get(cat_id)
        
        if not selection:
            continue
        
        if category.get('inputType') == 'checkbox':
            # Multiple selections
            for opt_id, is_selected in selection.items():
                if is_selected:
                    opt = next((o for o in category.get('options', []) if o.get('id') == opt_id), None)
                    if opt:
                        price_str = f"+{opt.get('price', 0):,} PLN".replace(',', ' ') if opt.get('price', 0) > 0 else 'gratis'
                        options_data.append([cat_name, opt.get('name', ''), price_str])
        else:
            # Single selection
            opt = next((o for o in category.get('options', []) if o.get('id') == selection), None)
            if opt:
                price_str = f"+{opt.get('price', 0):,} PLN".replace(',', ' ') if opt.get('price', 0) > 0 else 'gratis'
                options_data.append([cat_name, opt.get('name', ''), price_str])
    
    if options_data:
        options_table = Table(options_data, colWidths=[40*mm, 95*mm, 35*mm])
        options_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0FDF4')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1E293B')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
            ('FONTNAME', (1, 0), (-1, -1), 'DejaVuSans'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#BBF7D0')),
        ]))
        elements.append(options_table)
    
    elements.append(Spacer(1, 10))
    
    # Notes
    if request.notes:
        elements.append(Paragraph('Uwagi', heading_style))
        elements.append(Paragraph(request.notes, normal_style))
        elements.append(Spacer(1, 10))
    
    # Total
    elements.append(Spacer(1, 5))
    total_data = [['RAZEM:', f'{request.total:,.0f} PLN'.replace(',', ' ')]]
    total_table = Table(total_data, colWidths=[120*mm, 50*mm])
    total_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#16A34A')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (0, 0), 'RIGHT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(total_table)
    
    # Build PDF
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    # Safe filename
    try:
        safe_filename = ''.join(c for c in request.fullName if c.isascii() and (c.isalnum() or c in '-_.'))
        if not safe_filename:
            safe_filename = "sauna"
    except:
        safe_filename = "sauna"
    
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=sauna_{safe_filename}.pdf"}
    )

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
