from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import io

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
    "categories": {
        "shellModels": {
            "name": "Модель купели",
            "displayType": "dropdown",
            "required": True,
            "order": 1,
        },
        "woodTypes": {
            "name": "Тип дерева",
            "displayType": "dropdown",
            "required": True,
            "order": 2,
        },
        "shellColors": {
            "name": "Цвет оболочки",
            "displayType": "dropdown",
            "required": True,
            "order": 3,
        },
        "lidTypes": {
            "name": "Тип крышки",
            "displayType": "dropdown",
            "required": True,
            "order": 4,
        },
        "woodColors": {
            "name": "Цвет дерева",
            "displayType": "dropdown",
            "required": True,
            "order": 5,
        },
        "features": {
            "name": "Особенности и дополнения",
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
        title = Paragraph("Hot Tub Order Form", title_style)
    else:
        title = Paragraph("Technical Production Order", title_style)
    elements.append(title)
    elements.append(Spacer(1, 20))
    
    # Customer Information
    elements.append(Paragraph("Customer Information", heading_style))
    customer_data = [
        ['Full Name:', request.fullName],
        ['Phone:', request.phoneNumber],
        ['Address:', request.fullAddress],
        ['Order Date:', request.orderDate],
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
    elements.append(Paragraph("Configuration", heading_style))
    config_data = [
        ['Shell Model:', request.shellModel],
        ['Wood Type:', request.woodType],
        ['Shell Color:', request.shellColor],
        ['Lid Type:', request.lidType],
        ['Wood Color:', request.woodColor],
    ]
    
    if request.sandFilter and request.sandFilter != 'none':
        config_data.append(['Sand Filter:', request.sandFilter])
    
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
        elements.append(Paragraph("Selected Features", heading_style))
        features_text = '<br/>'.join([f'• {feat.replace("_", " ").title()}' for feat in selected_features])
        features_para = Paragraph(features_text, normal_style)
        elements.append(features_para)
        elements.append(Spacer(1, 20))
    
    # Notes
    if request.notes:
        elements.append(Paragraph("Additional Notes", heading_style))
        notes_para = Paragraph(request.notes, normal_style)
        elements.append(notes_para)
        elements.append(Spacer(1, 20))
    
    # Total
    elements.append(Spacer(1, 10))
    total_data = [['TOTAL:', f'{request.total:.2f} €']]
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
