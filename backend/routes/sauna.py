"""Sauna calculator routes."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
import io
import os
import logging
import requests
import re

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

from database import db
from models.sauna import SaunaModel, SaunaOption, SaunaCategory, SaunaPriceData, SaunaOrder, SaunaPDFRequest, WizardStep
from data.sauna_defaults import default_sauna_prices
from services.telegram_service import notify_new_order

# Import amoCRM functions for notes
from routes.amocrm import add_note_to_amocrm, get_amocrm_settings

# Import modular routers
from routes.sauna_crud import router as crud_router
from routes.sauna_orders import router as orders_router
from routes.sauna_wizard import router as wizard_router

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sauna", tags=["Sauna Calculator"])

# Include modular routers
router.include_router(crud_router)
router.include_router(orders_router)
router.include_router(wizard_router)


# Default PDF template settings
DEFAULT_PDF_TEMPLATE = {
    "blocks": [
        {"id": "header", "enabled": True},
        {"id": "client_info", "enabled": True},
        {"id": "model_photo", "enabled": True},
        {"id": "options", "enabled": True},
        {"id": "promo", "enabled": True},
        {"id": "benches", "enabled": True},
        {"id": "total", "enabled": True},
        {"id": "gallery", "enabled": True},
        {"id": "footer", "enabled": True},
    ],
    "colors": {
        "primary": "#8B4513",
        "secondary": "#D2B48C",
        "accent": "#CD853F",
        "text": "#333333",
        "muted": "#666666"
    },
    "texts": {
        "headerTitle": "OFERTA HANDLOWA",
        "companyPhone": "+48 732 099 201",
        "companyEmail": "wmsauna@gmail.com",
        "companyWebsite": "www.wm-sauna.pl",
        "promoTitle": "PROMOCJA",
        "promoText": "Darmowa balia do schłodzenia<br/>lub beczka z sauną!",
        "warrantyText": "GWARANCJA: 12 miesiące od daty montażu",
        "footerText": "Oferta ważna 30 dni od daty wystawienia.",
        "galleryTitle": "GALERIA REALIZACJI",
        "companySlogan": "WM-Group — Producent saun i bali na wymiar"
    }
}


async def get_pdf_template(calculator_type: str = "sauna") -> dict:
    """Load PDF template from database or return default"""
    try:
        template = await db.pdf_templates.find_one(
            {"calculator_type": calculator_type, "isDefault": True},
            {"_id": 0}
        )
        if template:
            return template
    except Exception as e:
        logger.warning(f"Could not load PDF template: {e}")
    return DEFAULT_PDF_TEMPLATE


def is_block_enabled(template: dict, block_id: str) -> bool:
    """Check if a block is enabled in the template"""
    blocks = template.get("blocks", [])
    for block in blocks:
        if block.get("id") == block_id:
            return block.get("enabled", True)
    return True  # Default to enabled if not found



# =============================================
# CRUD operations moved to modular files:
# - sauna_crud.py: prices, models, categories, options
# - sauna_orders.py: orders CRUD
# - sauna_wizard.py: wizard steps API
# These are included via router.include_router() above
# =============================================

async def generate_sauna_pdf_bytes(request: SaunaPDFRequest) -> bytes:
    """Generate PDF for sauna order and return as bytes (for Telegram)"""
    from reportlab.lib.units import mm
    
    buffer = io.BytesIO()

    from services.pdf_fonts import ensure_pdf_fonts
    ensure_pdf_fonts()
    
    # Colors - Orange theme for Sauna
    ORANGE = colors.HexColor('#EA580C')
    ORANGE_LIGHT = colors.HexColor('#FFF7ED')
    ORANGE_DARK = colors.HexColor('#C2410C')
    ORANGE_BORDER = colors.HexColor('#FDBA74')
    GREEN = colors.HexColor('#059669')
    GREEN_LIGHT = colors.HexColor('#ECFDF5')
    TEXT_COLOR = colors.HexColor('#1F2937')
    MUTED = colors.HexColor('#6B7280')
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15*mm,
        leftMargin=15*mm,
        topMargin=10*mm,
        bottomMargin=15*mm
    )
    
    elements = []
    
    # Generate offer number
    offer_number = request.orderId if request.orderId else f"SAUNA-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Custom styles
    title_style = ParagraphStyle('Title', fontName='DejaVuSans-Bold', fontSize=22, textColor=ORANGE_DARK, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', fontName='DejaVuSans', fontSize=10, textColor=MUTED, alignment=TA_CENTER)
    section_style = ParagraphStyle('Section', fontName='DejaVuSans-Bold', fontSize=13, textColor=ORANGE_DARK, spaceBefore=12)
    
    # Header
    elements.append(Paragraph("OFERTA CENOWA - SAUNA", title_style))
    elements.append(Spacer(1, 2*mm))
    elements.append(Paragraph(f"Nr oferty: {offer_number} | Data: {datetime.now().strftime('%d.%m.%Y')}", subtitle_style))
    elements.append(Spacer(1, 6*mm))
    
    # Customer info section
    elements.append(Paragraph("📋 DANE KLIENTA", section_style))
    customer_data = [
        ["Imię i nazwisko:", request.fullName or "-"],
        ["Telefon:", request.phoneNumber or "-"],
        ["Email:", request.email or "-"],
    ]
    if request.fullAddress:
        customer_data.append(["Adres:", request.fullAddress])
    if request.notes:
        customer_data.append(["Uwagi:", request.notes])
    
    customer_table = Table(customer_data, colWidths=[50*mm, 125*mm])
    customer_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), MUTED),
        ('TEXTCOLOR', (1, 0), (1, -1), TEXT_COLOR),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(customer_table)
    elements.append(Spacer(1, 6*mm))
    
    # Model section
    elements.append(Paragraph("🧖 WYBRANY MODEL", section_style))
    model_info = [
        ["Model:", request.modelName or request.selectedModel or "-"],
        ["Cena bazowa:", f"{request.basePrice:,} zł".replace(",", " ")],
    ]
    
    model_table = Table(model_info, colWidths=[50*mm, 125*mm])
    model_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), MUTED),
        ('TEXTCOLOR', (1, 0), (1, -1), TEXT_COLOR),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(model_table)
    elements.append(Spacer(1, 6*mm))
    
    # Options section - from selectedOptions with images
    # Track delivery price for separate display
    delivery_price_simple = 0
    
    if request.selectedOptions:
        elements.append(Paragraph("📦 WYBRANE OPCJE", section_style))
        
        # Get admin gifts list
        admin_gifts = getattr(request, 'adminGifts', []) or []
        
        for opt in request.selectedOptions:
            category_id = opt.get('categoryId', '')
            opt_id = opt.get('optionId', '') or opt.get('id', '')
            
            # Skip dostawa - it will be shown separately below total
            if category_id == 'dostawa':
                delivery_price_simple = opt.get('price', 0) * opt.get('quantity', 1)
                continue
            
            # Check if this option is a gift (including fundament)
            is_gift = opt_id in admin_gifts or (category_id == 'fundament' and 'fundament_gift' in admin_gifts)
                
            opt_name = opt.get('optionName', '')
            
            # Rename fundament option for PDF display
            if category_id == 'fundament':
                opt_name = 'Koszt fundamentu'
            base_price = opt.get('price', 0)
            quantity = opt.get('quantity', 1)
            image_url = opt.get('imageUrl')
            hint_image_url = opt.get('hintImageUrl')
            sub_options = opt.get('selectedSubOptions', [])
            sub_options_total = opt.get('subOptionsTotal', 0)
            
            # Try to load option image (either from imageUrl or hintImageUrl)
            display_image = image_url or hint_image_url
            img_element = None
            if display_image:
                try:
                    if display_image.startswith('http'):
                        img_response = requests.get(display_image, timeout=5)
                        if img_response.status_code == 200:
                            img_data = io.BytesIO(img_response.content)
                            img_element = RLImage(img_data, width=40*mm, height=30*mm)
                    elif display_image.startswith('/api/uploads/'):
                        # Local file
                        file_path = display_image.replace('/api/uploads/', '/app/backend/uploads/')
                        if os.path.exists(file_path):
                            img_element = RLImage(file_path, width=40*mm, height=30*mm)
                except Exception as e:
                    logger.warning(f"Could not load option image: {e}")
            
            # Format base price (with gift styling if needed)
            base_total = base_price * quantity
            if is_gift:
                # Gift: show crossed out price + gift label
                price_formatted = Paragraph(
                    f"<strike>{base_total:,.0f} zł</strike><br/><font color='#059669'><b>🎁 Prezent</b></font>".replace(",", " "),
                    ParagraphStyle('GiftPrice', fontName='DejaVuSans', fontSize=9, alignment=TA_RIGHT, textColor=colors.HexColor('#888888'))
                )
            else:
                price_formatted = f"{base_total:,.0f}".replace(",", " ") + " zł"
                if quantity > 1:
                    price_formatted = f"{quantity} × {base_price:,.0f}".replace(",", " ") + f" = {base_total:,.0f}".replace(",", " ") + " zł"
            
            # Main option row
            if img_element:
                opt_data = [[img_element, Paragraph(opt_name, ParagraphStyle('OptName', fontName='DejaVuSans-Bold', fontSize=10)), price_formatted]]
                opt_table = Table(opt_data, colWidths=[45*mm, 95*mm, 35*mm])
            else:
                opt_data = [[Paragraph(opt_name, ParagraphStyle('OptName', fontName='DejaVuSans-Bold', fontSize=10)), price_formatted]]
                opt_table = Table(opt_data, colWidths=[140*mm, 35*mm])
            
            # Use green color for gift items
            price_color = colors.HexColor('#059669') if is_gift else ORANGE_DARK
            
            opt_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('TEXTCOLOR', (0, 0), (-1, -1), TEXT_COLOR),
                ('TEXTCOLOR', (-1, 0), (-1, -1), price_color),
                ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('LINEBELOW', (0, 0), (-1, -1), 0.5, ORANGE_BORDER),
            ]))
            elements.append(opt_table)
            
            # Sub-options as separate rows with smaller font
            if sub_options:
                for sub_opt in sub_options:
                    sub_name = sub_opt.get('name', '')
                    sub_price = sub_opt.get('price', 0) * quantity
                    sub_price_formatted = f"+{sub_price:,.0f}".replace(",", " ") + " zł"
                    
                    sub_style = ParagraphStyle('SubOptName', fontName='DejaVuSans', fontSize=9, textColor=colors.HexColor('#6b7280'))
                    sub_data = [[Paragraph(f"    ↳ {sub_name}", sub_style), sub_price_formatted]]
                    sub_table = Table(sub_data, colWidths=[140*mm, 35*mm])
                    sub_table.setStyle(TableStyle([
                        ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6b7280')),
                        ('TEXTCOLOR', (-1, 0), (-1, -1), colors.HexColor('#7c3aed')),
                        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                        ('TOPPADDING', (0, 0), (-1, -1), 2),
                    ]))
                    elements.append(sub_table)
        
        elements.append(Spacer(1, 6*mm))
    
    # Fallback to old selections format if no selectedOptions
    elif request.selections:
        elements.append(Paragraph("📦 WYBRANE OPCJE", section_style))
        options_data = [["Opcja", "Wartość"]]
        
        for key, value in request.selections.items():
            if value and value != "none":
                display_key = key.replace("_", " ").title()
                display_value = str(value).replace("_", " ").title() if isinstance(value, str) else str(value)
                options_data.append([display_key, display_value])
        
        if len(options_data) > 1:
            options_table = Table(options_data, colWidths=[90*mm, 85*mm])
            options_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
                ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BACKGROUND', (0, 0), (-1, 0), ORANGE_LIGHT),
                ('TEXTCOLOR', (0, 0), (-1, 0), ORANGE_DARK),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, ORANGE_BORDER),
            ]))
            elements.append(options_table)
            elements.append(Spacer(1, 6*mm))
    
    # Total section
    elements.append(Paragraph("💰 PODSUMOWANIE", section_style))
    
    total = request.total or 0
    total_formatted = f"{total:,.0f}".replace(",", " ")
    
    total_data = [["RAZEM DO ZAPŁATY (brutto z VAT):", f"{total_formatted} zł"]]
    
    total_table = Table(total_data, colWidths=[125*mm, 50*mm])
    total_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('BACKGROUND', (0, 0), (-1, -1), GREEN_LIGHT),
        ('TEXTCOLOR', (0, 0), (0, -1), TEXT_COLOR),
        ('TEXTCOLOR', (1, 0), (1, -1), GREEN),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (-1, -1), 1, GREEN),
    ]))
    elements.append(total_table)
    
    # Delivery section (if delivery price > 0)
    if delivery_price_simple > 0:
        delivery_formatted = f"{int(delivery_price_simple):,.0f}".replace(",", " ")
        total_with_delivery = int(total) + int(delivery_price_simple)
        total_with_delivery_formatted = f"{total_with_delivery:,.0f}".replace(",", " ")
        
        delivery_data = [
            ["Koszt dostawy:", f"+{delivery_formatted} zł"],
            ["Razem z dostawą:", f"{total_with_delivery_formatted} zł"]
        ]
        
        delivery_table = Table(delivery_data, colWidths=[125*mm, 50*mm])
        delivery_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, 1), 12),
            ('FONTNAME', (0, 1), (-1, 1), 'DejaVuSans-Bold'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF8F0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), TEXT_COLOR),
            ('TEXTCOLOR', (1, 1), (1, 1), ORANGE_DARK),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(Spacer(1, 2*mm))
        elements.append(delivery_table)
    
    elements.append(Spacer(1, 8*mm))
    
    # Footer
    footer_style = ParagraphStyle('Footer', fontName='DejaVuSans', fontSize=8, textColor=MUTED, alignment=TA_CENTER)
    elements.append(Paragraph("Oferta ważna 14 dni od daty wystawienia.", footer_style))
    elements.append(Paragraph("Oferta nie stanowi oferty handlowej w rozumieniu Kodeksu Cywilnego.", footer_style))
    
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return pdf_data


# ============== WIZARD STEPS API ==============

# Default wizard steps configuration
@router.post("/generate-pdf")
async def generate_sauna_pdf(request: SaunaPDFRequest):
    """Generate PDF for sauna order - Professional offer format"""
    import urllib.request
    import base64
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from PIL import Image as PILImage
    
    # Image cache to avoid loading the same image multiple times
    image_cache = {}
    
    def optimize_image_for_pdf(img_data: bytes, max_size: int = 400, quality: int = 60) -> bytes:
        """Optimize image for PDF: resize and compress to reduce file size"""
        if not img_data:
            return img_data
        try:
            img = PILImage.open(io.BytesIO(img_data))
            
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'P'):
                background = PILImage.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                if img.mode == 'RGBA':
                    background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize if too large (more aggressive resize for faster PDF)
            width, height = img.size
            if width > max_size or height > max_size:
                ratio = min(max_size / width, max_size / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                img = img.resize((new_width, new_height), PILImage.Resampling.BILINEAR)  # BILINEAR is faster than LANCZOS
            
            # Compress as JPEG with lower quality for faster loading
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=quality, optimize=True)
            return output.getvalue()
        except Exception as e:
            logger.warning(f"Could not optimize image: {e}")
            return img_data
    
    async def load_image_from_mongodb(image_url: str) -> bytes:
        """Load image from MongoDB by extracting ID from URL with caching"""
        if not image_url or '/api/uploads/' not in image_url:
            return None
        
        # Check cache first
        if image_url in image_cache:
            return image_cache[image_url]
        
        try:
            filename = image_url.split('/api/uploads/')[-1]
            file_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
            image_doc = await db.images.find_one({"id": file_id}, {"content": 1})
            if image_doc:
                content = image_doc.get("content", "")
                if content:
                    decoded = base64.b64decode(content)
                    image_cache[image_url] = decoded
                    return decoded
        except Exception as e:
            logger.warning(f"Could not load image from MongoDB: {e}")
        return None
    
    def load_image_from_url_sync(image_url: str, timeout: int = 3) -> bytes:
        """Synchronous image loading from URL with short timeout"""
        if not image_url or not image_url.startswith('http'):
            return None
        
        # Check cache first
        if image_url in image_cache:
            return image_cache[image_url]
        
        try:
            req = urllib.request.Request(image_url, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'image/*',
            })
            with urllib.request.urlopen(req, timeout=timeout) as response:
                data = response.read()
                image_cache[image_url] = data
                return data
        except Exception as e:
            logger.warning(f"Could not download image (timeout={timeout}s): {e}")
        return None
    
    async def load_image_from_url(image_url: str, timeout: int = 3) -> bytes:
        """Async wrapper for URL image loading"""
        if not image_url or '/api/uploads/' in image_url:
            return None
        
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            return await loop.run_in_executor(executor, load_image_from_url_sync, image_url, timeout)
    
    async def load_image(image_url: str, timeout: int = 3) -> bytes:
        """Universal image loader - handles both MongoDB and external URLs"""
        if not image_url:
            return None
        
        # Check cache first
        if image_url in image_cache:
            return image_cache[image_url]
        
        if '/api/uploads/' in image_url:
            return await load_image_from_mongodb(image_url)
        elif image_url.startswith('http'):
            return await load_image_from_url(image_url, timeout)
        return None
    
    async def load_template_image(image_id: str) -> bytes:
        """Load image from pdf_images collection by ID"""
        if not image_id:
            return None
        try:
            image_doc = await db.pdf_images.find_one({"id": image_id}, {"data": 1})
            if image_doc and image_doc.get("data"):
                return base64.b64decode(image_doc["data"])
        except Exception as e:
            logger.warning(f"Could not load template image {image_id}: {e}")
        return None
    
    # Load PDF template from database
    pdf_template = await get_pdf_template("sauna")
    template_colors = pdf_template.get("colors", {})
    template_texts = pdf_template.get("texts", {})
    
    buffer = io.BytesIO()
    
    from services.pdf_fonts import ensure_pdf_fonts
    ensure_pdf_fonts()
    
    # Colors - use template colors or defaults
    BROWN = colors.HexColor(template_colors.get('primary', '#97724E'))
    BROWN_LIGHT = colors.HexColor('#FAF6F0')
    BROWN_BORDER = colors.HexColor(template_colors.get('secondary', '#D4C4B0'))
    BROWN_DARK = colors.HexColor(template_colors.get('accent', '#6B5038'))
    GREEN = colors.HexColor('#2D7A3E')
    GREEN_LIGHT = colors.HexColor('#F0F9F5')
    RED = colors.HexColor('#C53030')
    RED_LIGHT = colors.HexColor('#FFF5F5')
    TEXT_COLOR = colors.HexColor(template_colors.get('text', '#323232'))
    MUTED = colors.HexColor(template_colors.get('muted', '#888888'))
    
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                          rightMargin=20, leftMargin=20,
                          topMargin=20, bottomMargin=20)
    
    elements = []
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
    
    # Use orderId if provided
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
    
    # Load model image if provided
    model_img = None
    model_image_url = getattr(request, 'modelImageUrl', None) or ''
    if model_image_url:
        try:
            img_data = await load_image(model_image_url, timeout=3)
            
            if img_data:
                # Optimize image for PDF (smaller size, lower quality for speed)
                img_data = optimize_image_for_pdf(img_data, max_size=300, quality=55)
                
                # Get image dimensions to preserve aspect ratio
                img_buffer = io.BytesIO(img_data)
                pil_img = PILImage.open(img_buffer)
                orig_width, orig_height = pil_img.size
                
                # Calculate scaled dimensions (max width 130, preserve ratio)
                max_width = 130
                max_height = 95
                ratio = min(max_width / orig_width, max_height / orig_height)
                new_width = orig_width * ratio
                new_height = orig_height * ratio
                
                img_buffer.seek(0)
                model_img = RLImage(img_buffer, width=new_width, height=new_height)
        except Exception as e:
            logger.warning(f"Could not load model image: {e}")
    
    # ========== HEADER ==========
    # Get header title from template
    header_title = template_texts.get('headerTitle', 'OFERTA HANDLOWA')
    
    # Try to load custom logo from template
    custom_logo_img = None
    if pdf_template.get('logoImageId'):
        logo_data = await load_template_image(pdf_template.get('logoImageId'))
        if logo_data:
            try:
                logo_buffer = io.BytesIO(logo_data)
                custom_logo_img = RLImage(logo_buffer, width=180, height=36)
            except Exception as e:
                logger.warning(f"Could not load custom logo: {e}")
    
    logo_cell = custom_logo_img or logo_img if logo_img else Paragraph('<b>WM-SAUNA</b>', ParagraphStyle('Logo', fontName='DejaVuSans-Bold', fontSize=24, textColor=BROWN))
    
    header_data = [[
        logo_cell,
        '',
        Paragraph(f'''<b>{header_title}</b><br/>
        <font size="9" color="#95856e">Tel: {template_texts.get('companyPhone', '+48 732 099 201')}</font><br/>
        <font size="9" color="#95856e">Email: {template_texts.get('companyEmail', 'wmsauna@gmail.com')}</font><br/>
        <font size="9" color="#95856e">{template_texts.get('companyWebsite', 'www.wm-sauna.pl')}</font>''',
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
    
    # Only add header if enabled in template
    if is_block_enabled(pdf_template, 'header'):
        elements.append(header_table)
        # Divider line
        elements.append(Spacer(1, 4))
        elements.append(Table([['']], colWidths=[530], rowHeights=[2], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
        elements.append(Spacer(1, 8))
    
    # ========== CLIENT + OFFER INFO ==========
    if is_block_enabled(pdf_template, 'client_info'):
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
    if is_block_enabled(pdf_template, 'promo'):
        # Get promo texts from template
        promo_title = template_texts.get('promoTitle', 'PROMOCJA')
        promo_text_content = template_texts.get('promoText', 'Darmowa balia do schłodzenia<br/>lub beczka z sauną!')
        
        # Try to load custom promo image from template
        custom_promo_img = None
        if pdf_template.get('promoImageId'):
            promo_data_bytes = await load_template_image(pdf_template.get('promoImageId'))
            if promo_data_bytes:
                try:
                    promo_buffer = io.BytesIO(promo_data_bytes)
                    custom_promo_img = RLImage(promo_buffer, width=100, height=100)
                except Exception as e:
                    logger.warning(f"Could not load custom promo image: {e}")
        
        active_promo_img = custom_promo_img or promo_img
        
        if discount_percent > 0:
            savings = subtotal - total_after_discount
            discount_content = Paragraph(f'''<b><font color="#2D7A3E" size="14">ZASTOSOWANA ZNIŻKA</font></b><br/><br/>
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
            promo_text = Paragraph(f'''<b><font color="#C53030" size="13">{promo_title}</font></b><br/><br/>
            <font size="9">Zamów do {promo_until} i wybierz swój super gratis świąteczny:<br/>
            {promo_text_content.replace('<br/>', '<br/>')}</font><br/><br/>
            <font size="8" color="#888888">Oferta ważna tylko przy zakupie w tym terminie</font>''',
            ParagraphStyle('PromoText', fontName='DejaVuSans', fontSize=11))
            
            if active_promo_img:
                promo_data = [[active_promo_img, promo_text]]
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
    # Large section title for MODEL I ŁAWKI
    model_section_title = ParagraphStyle(
        'ModelSectionTitle',
        fontName='DejaVuSans-Bold',
        fontSize=16,
        textColor=BROWN_DARK,
        spaceAfter=6
    )
    elements.append(Paragraph('MODEL I ŁAWKI', model_section_title))
    elements.append(Spacer(1, 4))
    elements.append(Table([['']], colWidths=[530], rowHeights=[2], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
    elements.append(Spacer(1, 6))
    
    # Model info with image if available
    model_name = request.modelName or "-"
    model_price_val = request.basePrice or 0
    model_text = Paragraph(f'<b>{model_name}</b>', ParagraphStyle('Model', fontName='DejaVuSans-Bold', fontSize=12))
    model_price = Paragraph(f'<b><font color="#97724E">{model_price_val:,} PLN</font></b>'.replace(',', ' '), 
                 ParagraphStyle('Price', fontName='DejaVuSans-Bold', fontSize=12, alignment=TA_RIGHT))
    
    # ========== BENCH IMAGE SECTION - Get bench data first ==========
    bench_image_url = None
    bench_name = None
    bench_price = 0
    bench_opt_id = None
    
    selected_options = getattr(request, 'selectedOptions', None) or []
    admin_gifts = getattr(request, 'adminGifts', []) or []
    
    for opt in selected_options:
        cat_id = opt.get('categoryId', '')
        if cat_id == 'lawki' and opt.get('imageUrl'):
            bench_image_url = opt.get('imageUrl')
            bench_name = opt.get('optionName') or opt.get('name')
            bench_price = opt.get('price', 0)
            bench_opt_id = opt.get('optionId') or opt.get('id')
            break
    
    if not bench_image_url:
        for category in request.categories:
            if category.get('id') == 'lawki':
                selection = request.selections.get('lawki')
                if selection:
                    for opt in category.get('options', []):
                        if opt.get('id') == selection:
                            if opt.get('imageUrl'):
                                bench_image_url = opt.get('imageUrl')
                                bench_name = opt.get('name')
                                bench_price = opt.get('price', 0)
                                bench_opt_id = opt.get('id')
                            break
                break
    
    # Check if bench is a gift
    bench_is_gift = bench_opt_id and bench_opt_id in admin_gifts
    
    # Load bench image if available
    bench_img = None
    if bench_image_url and bench_name:
        bench_data = await load_image(bench_image_url, timeout=3)
        
        # Create image object if we have data
        if bench_data:
            try:
                import tempfile
                # Optimize bench image for PDF (smaller for speed)
                bench_data = optimize_image_for_pdf(bench_data, max_size=250, quality=55)
                
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                    tmp.write(bench_data)
                    bench_img = RLImage(tmp.name, width=130, height=95)
            except Exception as e:
                logger.warning(f"Could not create bench image for PDF: {e}")
    
    # ========== MODEL + BENCH IN ONE ROW ==========
    # Left side: Model, Right side: Bench
    
    # Build bench info paragraph
    if bench_name:
        if bench_is_gift:
            bench_info = Paragraph(f'''<b>ŁAWKI</b><br/><br/>
            {bench_name}<br/>
            <font color="#888888"><strike>{bench_price:,} PLN</strike></font><br/>
            <font color="#059669"><b>🎁 Prezent od WM-Group</b></font>'''.replace(',', ' '),
            ParagraphStyle('BenchInfo', fontName='DejaVuSans', fontSize=10, leading=13))
        else:
            bench_info = Paragraph(f'''<b>ŁAWKI</b><br/><br/>
            {bench_name}<br/>
            <font color="#97724E"><b>{bench_price:,} PLN</b></font>'''.replace(',', ' '),
            ParagraphStyle('BenchInfo', fontName='DejaVuSans', fontSize=10, leading=13))
    else:
        bench_info = Paragraph('<font color="#888888"><i>Brak ławek</i></font>',
            ParagraphStyle('BenchInfo', fontName='DejaVuSans', fontSize=10))
    
    # Create combined row: MODEL | BENCH
    if model_img and bench_img:
        # Both have images
        combined_data = [[
            model_img,
            Paragraph(f'<b>MODEL</b><br/><br/>{model_name}<br/><font color="#97724E"><b>{model_price_val:,} PLN</b></font>'.replace(',', ' '),
                ParagraphStyle('ModelInfo', fontName='DejaVuSans', fontSize=10, leading=13)),
            bench_img,
            bench_info
        ]]
        combined_table = Table(combined_data, colWidths=[130, 135, 130, 135])
    elif model_img:
        # Only model has image
        combined_data = [[
            model_img,
            Paragraph(f'<b>MODEL</b><br/><br/>{model_name}<br/><font color="#97724E"><b>{model_price_val:,} PLN</b></font>'.replace(',', ' '),
                ParagraphStyle('ModelInfo', fontName='DejaVuSans', fontSize=10, leading=13)),
            bench_info
        ]]
        combined_table = Table(combined_data, colWidths=[130, 200, 200])
    elif bench_img:
        # Only bench has image
        combined_data = [[
            Paragraph(f'<b>MODEL</b><br/><br/>{model_name}<br/><font color="#97724E"><b>{model_price_val:,} PLN</b></font>'.replace(',', ' '),
                ParagraphStyle('ModelInfo', fontName='DejaVuSans', fontSize=10, leading=13)),
            bench_img,
            bench_info
        ]]
        combined_table = Table(combined_data, colWidths=[200, 130, 200])
    else:
        # No images
        combined_data = [[
            Paragraph(f'<b>MODEL</b><br/><br/>{model_name}<br/><font color="#97724E"><b>{model_price_val:,} PLN</b></font>'.replace(',', ' '),
                ParagraphStyle('ModelInfo', fontName='DejaVuSans', fontSize=10, leading=13)),
            bench_info
        ]]
        combined_table = Table(combined_data, colWidths=[265, 265])
    
    combined_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBEFORE', (2, 0), (2, 0), 1, BROWN_BORDER) if len(combined_data[0]) > 2 else ('TOPPADDING', (0,0), (0,0), 10),
    ]))
    elements.append(combined_table)
    # Disclaimer text under model and bench block
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        'Zdjęcia mają charakter poglądowy. Twoja sauna zostanie wykonana zgodnie z wybranymi opcjami i wyposażeniem.',
        ParagraphStyle('ModelDisclaimer', fontName='DejaVuSans', fontSize=8, textColor=MUTED, alignment=TA_CENTER)
    ))
    elements.append(Spacer(1, 8))
    
    # ========== ROOM SIZES SECTION ==========
    relax_room_size = getattr(request, 'relaxRoomSize', None)
    steam_room_size = getattr(request, 'steamRoomSize', None)
    has_terrace = getattr(request, 'hasTerrace', False)
    capacity = getattr(request, 'capacity', None)
    
    # Get selected model variant data (from sub-model / layout variant)
    selected_variant = getattr(request, 'selectedModelVariantData', None) or {}
    variant_capacity = selected_variant.get('capacity')
    variant_terrace_size = selected_variant.get('terraceSize')
    variant_relax_room_size = selected_variant.get('relaxRoomSize')
    variant_steam_room_size = selected_variant.get('steamRoomSize')
    variant_entrance_side = selected_variant.get('entranceSide')
    variant_name = selected_variant.get('name')
    variant_image_url = selected_variant.get('imageUrl')
    variant_hint = selected_variant.get('hint')  # Description / what's included
    
    # Determine if we should use variant data or standard room sizes
    has_variant_data = variant_terrace_size or variant_relax_room_size or variant_steam_room_size or variant_entrance_side or variant_capacity or variant_hint
    has_variant_image = bool(variant_image_url)
    has_standard_data = relax_room_size or steam_room_size or capacity
    
    if has_variant_data or has_variant_image or has_standard_data:
        room_sizes_title = ParagraphStyle(
            'RoomSizesTitle',
            fontName='DejaVuSans-Bold',
            fontSize=12,
            textColor=BROWN_DARK,
            spaceAfter=6
        )
        elements.append(Paragraph('WYMIARY POMIESZCZEŃ', room_sizes_title))
        elements.append(Spacer(1, 4))
        elements.append(Table([['']], colWidths=[530], rowHeights=[2], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
        elements.append(Spacer(1, 6))
        
        room_data = []
        
        # If model variant is selected, use its data
        if has_variant_data or has_variant_image:
            # Use Paragraph for long text to enable word wrap
            label_style = ParagraphStyle('RoomLabel', fontName='DejaVuSans', fontSize=9, textColor=TEXT_COLOR, leading=11)
            value_style = ParagraphStyle('RoomValue', fontName='DejaVuSans-Bold', fontSize=9, textColor=BROWN_DARK, leading=11)
            
            if variant_name:
                room_data.append([Paragraph('Wariant układu:', label_style), Paragraph(variant_name, value_style)])
            if variant_capacity or capacity:
                room_data.append([Paragraph('Orientacyjna liczba osób:', label_style), Paragraph(variant_capacity or capacity, value_style)])
            if variant_terrace_size:
                room_data.append([Paragraph('Taras:', label_style), Paragraph(variant_terrace_size, value_style)])
            if variant_relax_room_size:
                room_data.append([Paragraph('Pokój wypoczynkowy:', label_style), Paragraph(variant_relax_room_size, value_style)])
            if variant_steam_room_size:
                room_data.append([Paragraph('Pokój parowy:', label_style), Paragraph(variant_steam_room_size, value_style)])
            if variant_entrance_side:
                room_data.append([Paragraph('Strona wejścia:', label_style), Paragraph(variant_entrance_side, value_style)])
        else:
            # Use standard room sizes
            if capacity:
                room_data.append(['Orientacyjna liczba osób:', capacity])
            if relax_room_size:
                room_data.append(['Przebieralnia:', relax_room_size])
            if steam_room_size:
                room_data.append(['Pokój parowy:', steam_room_size])
            if has_terrace:
                room_data.append(['', 'Z dodatkowym tarasem ✓'])
        
        # Try to load variant image first (before checking room_data)
        variant_img = None
        if variant_image_url and (has_variant_data or has_variant_image):
            try:
                img_data = await load_image(variant_image_url, timeout=3)
                
                if img_data:
                    img_data = optimize_image_for_pdf(img_data, max_size=300, quality=55)
                    pil_img = PILImage.open(io.BytesIO(img_data))
                    orig_w, orig_h = pil_img.size
                    # Scale to fit in right column (max 200x140)
                    max_w, max_h = 200, 140
                    ratio = min(max_w / orig_w, max_h / orig_h)
                    new_w, new_h = int(orig_w * ratio), int(orig_h * ratio)
                    variant_img = RLImage(io.BytesIO(img_data), width=new_w, height=new_h)
            except Exception as e:
                logger.warning(f"Could not load variant image: {e}")
        
        if room_data or variant_img:
            room_table = None
            if room_data:
                # Create room sizes table (left side)
                room_table = Table(room_data, colWidths=[140, 170])
                room_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
            
            # Create layout: left = room sizes (if any), right = image (if any)
            if variant_img and room_table:
                # Two column layout with both
                layout_table = Table(
                    [[room_table, variant_img]],
                    colWidths=[320, 210]
                )
                layout_table.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ALIGN', (1, 0), (1, 0), 'CENTER'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                    ('TOPPADDING', (0, 0), (-1, -1), 0),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ]))
                elements.append(layout_table)
                
                # Add variant description (hint) below both columns
                if variant_hint:
                    elements.append(Spacer(1, 6))
                    hint_style = ParagraphStyle(
                        'VariantHint',
                        fontName='DejaVuSans',
                        fontSize=9,
                        textColor=TEXT_COLOR,
                        leading=12,
                        spaceAfter=4
                    )
                    hint_html = variant_hint.replace('\n', '<br/>')
                    elements.append(Paragraph(f'<b>Co zawiera wariant:</b><br/>{hint_html}', hint_style))
            elif variant_img:
                # Only image, no room data - show image with name
                img_with_name = Table(
                    [[Paragraph(f'<b>Wariant układu:</b> {variant_name}' if variant_name else '', 
                               ParagraphStyle('VariantName', fontName='DejaVuSans', fontSize=10, textColor=BROWN_DARK))],
                     [variant_img]],
                    colWidths=[530]
                )
                img_with_name.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                elements.append(img_with_name)
                
                # Add variant description (hint) below image
                if variant_hint:
                    elements.append(Spacer(1, 6))
                    hint_style = ParagraphStyle(
                        'VariantHint',
                        fontName='DejaVuSans',
                        fontSize=9,
                        textColor=TEXT_COLOR,
                        leading=12,
                        spaceAfter=4
                    )
                    hint_html = variant_hint.replace('\n', '<br/>')
                    elements.append(Paragraph(f'<b>Co zawiera wariant:</b><br/>{hint_html}', hint_style))
            elif room_table:
                # Only room data, no image - full width table
                room_table_full = Table(room_data, colWidths=[200, 330])
                room_table_full.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
                    ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans'),
                    ('FONTNAME', (1, 0), (1, -1), 'DejaVuSans-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('TEXTCOLOR', (0, 0), (0, -1), TEXT_COLOR),
                    ('TEXTCOLOR', (1, 0), (1, -1), BROWN_DARK),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                elements.append(room_table_full)
                
                # Add variant description (hint) below room sizes table (no image case)
                if variant_hint:
                    elements.append(Spacer(1, 6))
                    hint_style = ParagraphStyle(
                        'VariantHint',
                        fontName='DejaVuSans',
                        fontSize=9,
                        textColor=TEXT_COLOR,
                        leading=12,
                        spaceAfter=4
                    )
                    hint_html = variant_hint.replace('\n', '<br/>')
                    elements.append(Paragraph(f'<b>Co zawiera wariant:</b><br/>{hint_html}', hint_style))
            
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
    
    # ========== LAYOUT VARIANTS ON PAGE 1 (moved from Page 2) ==========
    other_layouts_for_size_p1 = getattr(request, 'otherLayoutsForSize', []) or []
    selected_layout_size_p1 = getattr(request, 'selectedLayoutSize', None)
    
    if other_layouts_for_size_p1:
        elements.append(Spacer(1, 8))
        layout_title_p1 = f'MOŻLIWE WARIANTY WYKONANIA W ROZMIARZE {selected_layout_size_p1}' if selected_layout_size_p1 else 'MOŻLIWE WARIANTY WYKONANIA'
        elements.append(Paragraph(layout_title_p1, 
            ParagraphStyle('LayoutTitleP1', fontName='DejaVuSans-Bold', fontSize=12, 
                          textColor=BROWN_DARK, alignment=TA_CENTER, spaceAfter=8)))
        elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN_BORDER)]))
        elements.append(Spacer(1, 8))
        
        # Determine optimal grid layout
        def get_p1_columns(item_count: int) -> tuple:
            if item_count <= 2:
                return (2, 255)
            elif item_count <= 3:
                return (3, 168)
            else:
                return (4, 125)
        
        num_cols_p1, col_width_p1 = get_p1_columns(len(other_layouts_for_size_p1))
        layout_rows_p1 = []
        current_row_p1 = []
        
        for layout in other_layouts_for_size_p1:
            card_content = []
            
            layout_img = None
            layout_image_url = layout.get('imageUrl', '')
            if layout_image_url:
                try:
                    img_data = await load_image(layout_image_url, timeout=2)
                    if img_data:
                        img_data = optimize_image_for_pdf(img_data, max_size=200, quality=50)
                        pil_img = PILImage.open(io.BytesIO(img_data))
                        orig_w, orig_h = pil_img.size
                        ratio = min((col_width_p1-20) / orig_w, 80 / orig_h)
                        new_w, new_h = int(orig_w * ratio), int(orig_h * ratio)
                        layout_img = RLImage(io.BytesIO(img_data), width=new_w, height=new_h)
                except Exception as e:
                    logger.warning(f"Could not load layout image: {e}")
            
            if layout_img:
                card_content.append(layout_img)
            
            layout_name = layout.get('name', 'Wariant')
            card_content.append(Paragraph(f'<b>{layout_name}</b>', 
                ParagraphStyle('LP1Name', fontName='DejaVuSans-Bold', fontSize=9, textColor=BROWN_DARK, alignment=TA_CENTER, spaceBefore=4)))
            
            dims = []
            if layout.get('peopleCount'):
                dims.append(f"{layout['peopleCount']} os.")
            if layout.get('steamRoomSize') and layout['steamRoomSize'] != '0':
                dims.append(f"{layout['steamRoomSize']}")
            if layout.get('entranceSide'):
                dims.append(f"{layout['entranceSide']}")
            if dims:
                card_content.append(Paragraph(' | '.join(dims), 
                    ParagraphStyle('LP1Dims', fontName='DejaVuSans', fontSize=7, textColor=MUTED, alignment=TA_CENTER)))
            
            if layout.get('description'):
                desc = layout['description'][:80] + '...' if len(layout.get('description', '')) > 80 else layout.get('description', '')
                card_content.append(Paragraph(desc, 
                    ParagraphStyle('LP1Desc', fontName='DejaVuSans', fontSize=7, textColor=TEXT_COLOR, alignment=TA_CENTER, leading=9)))
            
            card = Table([[c] for c in card_content], colWidths=[col_width_p1-10])
            card.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
                ('BOX', (0, 0), (-1, -1), 1, BROWN_BORDER),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            
            current_row_p1.append(card)
            if len(current_row_p1) == num_cols_p1:
                layout_rows_p1.append(current_row_p1)
                current_row_p1 = []
        
        if current_row_p1:
            while len(current_row_p1) < num_cols_p1:
                current_row_p1.append('')
            layout_rows_p1.append(current_row_p1)
        
        if layout_rows_p1:
            grid = Table(layout_rows_p1, colWidths=[col_width_p1] * num_cols_p1)
            grid.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(grid)
        elements.append(Spacer(1, 8))
    
    # ========== OPTIONS SECTION (Two columns) ==========
    options_items = []
    quantities = getattr(request, 'quantities', {}) or {}
    
    # PRIMARY: Use selectedOptions if available (from saved orders)
    # Track delivery price separately
    delivery_price = 0
    
    if selected_options:
        for opt in selected_options:
            # Skip lawki as it's shown separately with image
            if opt.get('categoryId') == 'lawki':
                continue
            
            opt_id = opt.get('optionId', '') or opt.get('id', '')
            category_id = opt.get('categoryId', '')
            
            # Skip dostawa - it will be shown separately below total
            if category_id == 'dostawa':
                delivery_price = opt.get('price', 0) * opt.get('quantity', 1)
                continue
            
            # Skip options whose chosen variant is "Nie" / "Brak" / "Bez" — the
            # customer explicitly opted OUT, so listing them under "WYBRANE OPCJE"
            # confuses the reader. The frontend appends the variant name to the
            # option name like "Szyba połpanoramiczna - Nie".
            _opt_name_raw = (opt.get('optionName', '') or opt.get('name', '') or '').strip()
            if re.search(r'[\-–—:]\s*(nie|brak|bez)\s*$', _opt_name_raw, flags=re.IGNORECASE):
                continue
            
            # Check if this option is a gift (including fundament)
            is_gift = opt_id in admin_gifts or (category_id == 'fundament' and 'fundament_gift' in admin_gifts)
            
            name = _opt_name_raw
            
            # Rename fundament option for PDF display
            if category_id == 'fundament':
                name = 'Koszt fundamentu'
            
            price = opt.get('price', 0)
            quantity = opt.get('quantity', 1)
            total_price = price * quantity
            
            if quantity > 1:
                name = f"{name} (×{quantity})"
            
            if is_gift:
                # Show original price crossed out + gift label
                price_str = f"<strike>{total_price:,}</strike> Prezent od WM-Group".replace(',', ' ')
            else:
                # Don't show price for options with 0 price
                price_str = f"{total_price:,} PLN".replace(',', ' ') if total_price > 0 else ''
            
            options_items.append({'name': name, 'price': price_str, 'is_gift': is_gift, 'original_price': total_price})
    else:
        # FALLBACK: Use categories + selections (from calculator direct generation)
        for category in request.categories:
            cat_id = category.get('id', '')
            
            # Skip lawki as it's shown separately with image
            if cat_id == 'lawki':
                continue
            
            # Skip dostawa - it will be shown separately below total
            if cat_id == 'dostawa':
                selection = request.selections.get(cat_id)
                if selection:
                    opt = next((o for o in category.get('options', []) if o.get('id') == selection), None)
                    if opt:
                        delivery_price = opt.get('price', 0)
                continue
            
            selection = request.selections.get(cat_id)
            
            if not selection:
                continue
            
            if category.get('inputType') == 'checkbox':
                for opt_id, is_selected in selection.items():
                    if is_selected:
                        opt = next((o for o in category.get('options', []) if o.get('id') == opt_id), None)
                        if opt:
                            _opt_name_raw = (opt.get('name', '') or '').strip()
                            if re.search(r'[\-–—:]\s*(nie|brak|bez)\s*$', _opt_name_raw, flags=re.IGNORECASE):
                                continue
                            price = opt.get('price', 0)
                            has_quantity = opt.get('hasQuantity', False)
                            quantity = quantities.get(opt_id, 1) if has_quantity else 1
                            total_price = price * quantity
                            
                            name = _opt_name_raw
                            # Rename fundament option for PDF display
                            if cat_id == 'fundament':
                                name = 'Koszt fundamentu'
                            if has_quantity and quantity > 1:
                                name = f"{name} (×{quantity})"
                            
                            # Check if this option is a gift (including fundament)
                            is_gift = opt_id in admin_gifts or (cat_id == 'fundament' and 'fundament_gift' in admin_gifts)
                            
                            if is_gift:
                                price_str = f"<strike>{total_price:,}</strike> Prezent od WM-Group".replace(',', ' ')
                            else:
                                # Don't show price for options with 0 price
                                price_str = f"{total_price:,} PLN".replace(',', ' ') if total_price > 0 else ''
                            
                            options_items.append({'name': name, 'price': price_str, 'is_gift': is_gift, 'original_price': total_price})
            else:
                opt = next((o for o in category.get('options', []) if o.get('id') == selection), None)
                if opt:
                    _opt_name_raw = (opt.get('name', '') or '').strip()
                    if re.search(r'[\-–—:]\s*(nie|brak|bez)\s*$', _opt_name_raw, flags=re.IGNORECASE):
                        continue
                    price = opt.get('price', 0)
                    has_quantity = opt.get('hasQuantity', False)
                    quantity = quantities.get(selection, 1) if has_quantity else 1
                    total_price = price * quantity
                    
                    name = _opt_name_raw
                    # Rename fundament option for PDF display
                    if cat_id == 'fundament':
                        name = 'Koszt fundamentu'
                    if has_quantity and quantity > 1:
                        name = f"{name} (×{quantity})"
                    
                    # Check if this option is a gift (including fundament)
                    is_gift = selection in admin_gifts or (cat_id == 'fundament' and 'fundament_gift' in admin_gifts)
                    
                    if is_gift:
                        price_str = f"<strike>{total_price:,}</strike> Prezent od WM-Group".replace(',', ' ')
                    else:
                        price_str = f"{total_price:,} PLN".replace(',', ' ') if total_price > 0 else '0 PLN'
                    
                    options_items.append({'name': name, 'price': price_str, 'is_gift': is_gift, 'original_price': total_price})
    
    if options_items:
        # Start WYBRANE OPCJE on a new page
        elements.append(PageBreak())
        elements.append(Paragraph('WYBRANE OPCJE', section_title_style))
        elements.append(Spacer(1, 4))
        elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN_BORDER)]))
        elements.append(Spacer(1, 4))
        
        opt_count = len(options_items)
        if opt_count > 40:
            fs = 7
        elif opt_count > 28:
            fs = 8
        elif opt_count > 18:
            fs = 9
        else:
            fs = 10
        
        # Define styles for gifts
        GIFT_GREEN = colors.HexColor('#059669')
        GIFT_BG = colors.HexColor('#ECFDF5')
        
        options_body = [[
            Paragraph('<b>OPCJA</b>', ParagraphStyle('OptHeader', fontName='DejaVuSans-Bold', fontSize=fs, textColor=colors.white)),
            '',
            Paragraph('<b>OPCJA</b>', ParagraphStyle('OptHeader', fontName='DejaVuSans-Bold', fontSize=fs, textColor=colors.white)),
            ''
        ]]
        
        gift_row_indices = []  # Track which rows contain gifts
        
        for i in range(0, len(options_items), 2):
            left = options_items[i]
            right = options_items[i + 1] if i + 1 < len(options_items) else None
            
            # Create paragraph styles based on gift status
            left_name_style = ParagraphStyle('OptName', fontName='DejaVuSans', fontSize=fs, 
                                             textColor=GIFT_GREEN if left.get('is_gift') else TEXT_COLOR)
            left_price_style = ParagraphStyle('OptPrice', fontName='DejaVuSans', fontSize=fs, 
                                              alignment=TA_RIGHT, textColor=GIFT_GREEN if left.get('is_gift') else TEXT_COLOR)
            
            right_name_style = ParagraphStyle('OptName', fontName='DejaVuSans', fontSize=fs,
                                              textColor=GIFT_GREEN if right and right.get('is_gift') else TEXT_COLOR) if right else None
            right_price_style = ParagraphStyle('OptPrice', fontName='DejaVuSans', fontSize=fs, 
                                               alignment=TA_RIGHT, textColor=GIFT_GREEN if right and right.get('is_gift') else TEXT_COLOR) if right else None
            
            row = [
                Paragraph(left['name'], left_name_style),
                Paragraph(left['price'], left_price_style),
                Paragraph(right['name'] if right else '', right_name_style or ParagraphStyle('OptName', fontName='DejaVuSans', fontSize=fs)),
                Paragraph(right['price'] if right else '', right_price_style or ParagraphStyle('OptPrice', fontName='DejaVuSans', fontSize=fs, alignment=TA_RIGHT)),
            ]
            options_body.append(row)
            
            # Track if this row has any gifts
            if left.get('is_gift') or (right and right.get('is_gift')):
                gift_row_indices.append(len(options_body) - 1)
        
        options_table = Table(options_body, colWidths=[180, 80, 180, 80])
        table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), BROWN),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('LINEBELOW', (0, 0), (-1, -1), 0.8, BROWN_BORDER),
            ('LINEABOVE', (0, 0), (-1, 0), 1, BROWN),
            ('LINEBEFORE', (2, 0), (2, -1), 0.8, BROWN_BORDER),
            ('BOX', (0, 0), (-1, -1), 1, BROWN_BORDER),
        ]
        for i in range(1, len(options_body)):
            if i in gift_row_indices:
                table_style.append(('BACKGROUND', (0, i), (-1, i), GIFT_BG))
            elif (i - 1) % 2 == 0:
                table_style.append(('BACKGROUND', (0, i), (-1, i), BROWN_LIGHT))
        
        options_table.setStyle(TableStyle(table_style))
        elements.append(options_table)
        elements.append(Spacer(1, 10))
    
    # ========== TOTAL SECTION ==========
    total_price_int = int(round(total_after_discount))
    total_price_str = f"{total_price_int:,}".replace(',', ' ')
    
    discount_note = ''
    if discount_percent > 0:
        subtotal_int = int(round(subtotal))
        savings_int = int(round(subtotal - total_after_discount))
        discount_note = f"<br/><font size='8' color='#F0F9F5'>Cena bez rabatu: {subtotal_int:,} PLN | Oszczędzasz: {savings_int:,} PLN</font>".replace(',', ' ')
    
    # Build left content as a single Paragraph with HTML-like formatting
    left_html = f'''<font color="white"><b>WARTOŚĆ CAŁKOWITA OFERTY (brutto z VAT)</b></font><br/><br/>
    <font color="white" size="20"><b>{total_price_str} PLN</b></font>{discount_note}'''
    
    total_left = Paragraph(left_html, 
                           ParagraphStyle('TotalLeft', fontName='DejaVuSans-Bold', fontSize=11, 
                                         textColor=colors.white, leading=14))
    
    # Build right content as a single Paragraph
    right_html = '''TERMIN REALIZACJI: 1–3 tygodni + montaż 1–2 dni<br/>
    ZALICZKA: 50% przed produkcją, 50% przed wysyłką<br/>
    GWARANCJA: 12 miesiące od daty montażu'''
    
    total_right = Paragraph(right_html, 
                            ParagraphStyle('TotalRight', fontName='DejaVuSans', fontSize=8, 
                                          textColor=TEXT_COLOR, leading=12))
    
    total_table = Table([[total_left, total_right]], colWidths=[280, 250])
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
    
    # ========== DELIVERY SECTION (if delivery price > 0) ==========
    if delivery_price > 0:
        delivery_price_str = f"{int(delivery_price):,}".replace(',', ' ')
        total_with_delivery = total_price_int + int(delivery_price)
        total_with_delivery_str = f"{total_with_delivery:,}".replace(',', ' ')
        
        delivery_html = f'''<font size="10">Koszt dostawy: <b>{delivery_price_str} PLN</b></font><br/>
        <font size="12" color="#8B4513"><b>Razem z dostawą: {total_with_delivery_str} PLN</b></font>'''
        
        delivery_para = Paragraph(delivery_html, 
                                  ParagraphStyle('DeliveryInfo', fontName='DejaVuSans', fontSize=10, 
                                                textColor=TEXT_COLOR, leading=14, alignment=TA_RIGHT))
        
        delivery_table = Table([[delivery_para]], colWidths=[530])
        delivery_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ]))
        elements.append(Spacer(1, 4))
        elements.append(delivery_table)
    
    # ========== FOOTER ==========
    elements.append(Spacer(1, 10))
    elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(template_texts.get('footerText', 'Oferta ważna 30 dni od daty wystawienia.'), 
                             ParagraphStyle('Footer', fontName='DejaVuSans', fontSize=8, textColor=MUTED, alignment=TA_CENTER)))
    
    # ========== PAGE 2: VARIANTS AND OPTIONS ==========
    model_variants = getattr(request, 'modelVariants', []) or []
    variant_comparison_rows = getattr(request, 'variantComparisonRows', []) or []
    plus_only_categories = getattr(request, 'plusOnlyCategories', []) or []
    all_available_options = getattr(request, 'allAvailableOptions', []) or []
    
    # Other layouts for the same size from Layout Catalog (now rendered on Page 1)
    # Variables are still loaded here for potential future page2 use, but rendering moved to Page 1
    
    # PDF Page 2 settings from request
    page2_enabled = getattr(request, 'pdfPage2Enabled', True)
    page2_variants_title = getattr(request, 'pdfPage2VariantsTitle', 'Możliwe warianty wykonania w wybranym rozmiarze') or 'Możliwe warianty wykonania w wybranym rozmiarze'
    page2_options_title = getattr(request, 'pdfPage2OptionsTitle', 'Opcje, które można dodać do sauny') or 'Opcje, które można dodać do sauny'
    page2_show_variants = getattr(request, 'pdfPage2ShowVariants', True)
    page2_show_comparison = getattr(request, 'pdfPage2ShowComparisonTable', True)
    page2_show_plus_cats = getattr(request, 'pdfPage2ShowPlusCategories', True)
    page2_show_all_opts = getattr(request, 'pdfPage2ShowAllOptions', True)
    
    # Helper function to determine optimal column count
    def get_optimal_columns(item_count: int) -> tuple:
        """Return (num_columns, column_width) based on item count"""
        if item_count <= 2:
            return (2, 255)
        elif item_count <= 3:
            return (3, 168)
        else:
            return (4, 125)
    
    # Only add Page 2 if enabled and we have content to show (layouts moved to page 1)
    has_page2_content = (model_variants and page2_show_variants) or all_available_options
    if page2_enabled and has_page2_content:
        elements.append(PageBreak())
        
        # Helper function to load image for PDF card (uses cached load_image)
        async def load_card_image(image_url: str, max_width: int = 120, max_height: int = 90) -> RLImage:
            """Load and scale image for variant/option card"""
            if not image_url:
                return None
            try:
                img_data = await load_image(image_url, timeout=2)  # Short timeout for cards
                
                if img_data:
                    img_data = optimize_image_for_pdf(img_data, max_size=200, quality=50)  # Smaller for speed
                    pil_img = PILImage.open(io.BytesIO(img_data))
                    orig_w, orig_h = pil_img.size
                    ratio = min(max_width / orig_w, max_height / orig_h)
                    new_w, new_h = int(orig_w * ratio), int(orig_h * ratio)
                    return RLImage(io.BytesIO(img_data), width=new_w, height=new_h)
            except Exception as e:
                logger.warning(f"Could not load card image: {e}")
            return None
        
        # ===== SECTION 0: Layout Variants - MOVED TO PAGE 1 =====
        # (Layout variants are now rendered on page 1, before options section)
        
        # ===== SECTION 1: Model Variants =====
        logger.info(f"PDF Page 2 - model_variants count: {len(model_variants) if model_variants else 0}")
        logger.info(f"PDF Page 2 - page2_show_variants: {page2_show_variants}, page2_show_comparison: {page2_show_comparison}")
        if model_variants:
            for i, v in enumerate(model_variants):
                logger.info(f"Variant {i}: name={v.get('namePl')}, relax={v.get('relaxRoomSize')}, steam={v.get('steamRoomSize')}, terrace={v.get('terraceSize')}, entrance={v.get('entranceSide')}")
        
        if model_variants and page2_show_variants:
            elements.append(Paragraph(page2_variants_title.upper(), 
                ParagraphStyle('Page2Title', fontName='DejaVuSans-Bold', fontSize=14, 
                              textColor=BROWN_DARK, alignment=TA_CENTER, spaceAfter=12)))
            elements.append(Table([['']], colWidths=[530], rowHeights=[2], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
            elements.append(Spacer(1, 12))
            
            # Generate comparison table from model variants data
            # New structure: Variant name | Relax room | Steam room | Terrace | Entrance side
            has_comparison_data = any(
                v.get('relaxRoomSize') or v.get('steamRoomSize') or v.get('terraceSize') or v.get('entranceSide')
                for v in model_variants
            )
            logger.info(f"PDF Page 2 - has_comparison_data: {has_comparison_data}")
            
            if has_comparison_data and page2_show_comparison:
                comparison_data = [[
                    Paragraph('<b>Wariant</b>', ParagraphStyle('CompHeader', fontName='DejaVuSans-Bold', fontSize=9, textColor=colors.white)),
                    Paragraph('<b>Pokój wyp.</b>', ParagraphStyle('CompHeader', fontName='DejaVuSans-Bold', fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
                    Paragraph('<b>Sauna</b>', ParagraphStyle('CompHeader', fontName='DejaVuSans-Bold', fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
                    Paragraph('<b>Taras</b>', ParagraphStyle('CompHeader', fontName='DejaVuSans-Bold', fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
                    Paragraph('<b>Wejście</b>', ParagraphStyle('CompHeader', fontName='DejaVuSans-Bold', fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
                ]]
                for variant in model_variants:
                    v_name = variant.get('namePl') or variant.get('name', '')
                    relax = variant.get('relaxRoomSize', '')
                    steam = variant.get('steamRoomSize', '')
                    terrace = variant.get('terraceSize', '')
                    entrance = variant.get('entranceSide', '')
                    comparison_data.append([
                        Paragraph(v_name, ParagraphStyle('CompCell', fontName='DejaVuSans-Bold', fontSize=8, textColor=BROWN_DARK)),
                        Paragraph(relax if relax and relax != '0' else '-', ParagraphStyle('CompCell', fontName='DejaVuSans', fontSize=8, textColor=TEXT_COLOR, alignment=TA_CENTER)),
                        Paragraph(steam if steam and steam != '0' else '-', ParagraphStyle('CompCell', fontName='DejaVuSans', fontSize=8, textColor=TEXT_COLOR, alignment=TA_CENTER)),
                        Paragraph(terrace if terrace and terrace != '0' else '-', ParagraphStyle('CompCell', fontName='DejaVuSans', fontSize=8, textColor=TEXT_COLOR, alignment=TA_CENTER)),
                        Paragraph(entrance if entrance else '-', ParagraphStyle('CompCell', fontName='DejaVuSans', fontSize=8, textColor=TEXT_COLOR, alignment=TA_CENTER)),
                    ])
                
                comp_table = Table(comparison_data, colWidths=[130, 100, 100, 100, 100])
                comp_style = [
                    ('BACKGROUND', (0, 0), (-1, 0), BROWN),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('GRID', (0, 0), (-1, -1), 0.5, BROWN_BORDER),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ]
                for i in range(1, len(comparison_data)):
                    if i % 2 == 0:
                        comp_style.append(('BACKGROUND', (0, i), (-1, i), BROWN_LIGHT))
                comp_table.setStyle(TableStyle(comp_style))
                elements.append(comp_table)
                elements.append(Spacer(1, 15))
            
            # Variant cards - show all variants in a grid
            variant_cards = []
            for variant in model_variants:
                v_name = variant.get('namePl') or variant.get('name', '')
                v_price = variant.get('price', 0)
                v_hint = variant.get('hintPl') or variant.get('hint', '')
                v_image_url = variant.get('imageUrl', '')
                
                # Build card content
                card_elements = []
                
                # Try to load variant image
                v_img = await load_card_image(v_image_url, 110, 80)
                if v_img:
                    card_elements.append(v_img)
                    card_elements.append(Spacer(1, 5))
                
                card_elements.append(Paragraph(f'<b>{v_name}</b>', 
                    ParagraphStyle('VarName', fontName='DejaVuSans-Bold', fontSize=11, textColor=BROWN_DARK, alignment=TA_CENTER)))
                card_elements.append(Paragraph(f'{v_price:,} PLN'.replace(',', ' '), 
                    ParagraphStyle('VarPrice', fontName='DejaVuSans-Bold', fontSize=12, textColor=BROWN, alignment=TA_CENTER)))
                
                if v_hint:
                    # Truncate long descriptions
                    hint_short = v_hint[:150] + '...' if len(v_hint) > 150 else v_hint
                    card_elements.append(Spacer(1, 3))
                    card_elements.append(Paragraph(hint_short, 
                        ParagraphStyle('VarHint', fontName='DejaVuSans', fontSize=7, textColor=MUTED, alignment=TA_CENTER, leading=9)))
                
                variant_cards.append(card_elements)
            
            # Create grid layout for variant cards (2 or 3 per row)
            if variant_cards:
                num_variants = len(variant_cards)
                if num_variants <= 2:
                    cols = 2
                    col_width = 260
                else:
                    cols = 3
                    col_width = 170
                
                # Build rows of cards
                card_rows = []
                for i in range(0, num_variants, cols):
                    row = []
                    for j in range(cols):
                        if i + j < num_variants:
                            row.append(Table([[el] for el in variant_cards[i + j]], colWidths=[col_width - 20]))
                        else:
                            row.append('')
                    card_rows.append(row)
                
                if card_rows:
                    cards_table = Table(card_rows, colWidths=[col_width] * cols)
                    card_style = [
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (-1, -1), 5),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                    ]
                    # Add borders and backgrounds for each card
                    for row_idx in range(len(card_rows)):
                        for col_idx in range(cols):
                            if row_idx * cols + col_idx < num_variants:
                                card_style.append(('BOX', (col_idx, row_idx), (col_idx, row_idx), 1, BROWN_BORDER))
                                card_style.append(('BACKGROUND', (col_idx, row_idx), (col_idx, row_idx), BROWN_LIGHT))
                    cards_table.setStyle(TableStyle(card_style))
                    elements.append(cards_table)
                    elements.append(Spacer(1, 20))
        
        # ===== SECTION 2: Plus-only categories (List format) =====
        if plus_only_categories and page2_show_plus_cats:
            for category in plus_only_categories:
                cat_name = category.get('name', '')
                cat_options = category.get('options', [])
                
                if not cat_options:
                    continue
                
                elements.append(Paragraph(f'<b>{cat_name}</b> <font size="8" color="#888888">(dostępne w wersji Plus)</font>', 
                    ParagraphStyle('PlusCatTitle', fontName='DejaVuSans-Bold', fontSize=11, textColor=BROWN_DARK, spaceAfter=6)))
                elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN_BORDER)]))
                elements.append(Spacer(1, 6))
                
                # Build two-column list: [img + name | img + name]
                list_rows = []
                for i in range(0, len(cat_options), 2):
                    row_cells = []
                    
                    for j in range(2):
                        if i + j < len(cat_options):
                            opt = cat_options[i + j]
                            opt_name = opt.get('name', '')
                            opt_image = opt.get('imageUrl', '')
                            
                            # Load image (70x55 for all option cards)
                            opt_img = await load_card_image(opt_image, 70, 55)
                            
                            # Create cell with image on left, text on right
                            if opt_img:
                                cell_table = Table(
                                    [[opt_img, Paragraph(opt_name, ParagraphStyle('ListOptName', fontName='DejaVuSans', fontSize=11, textColor=TEXT_COLOR, leading=13))]],
                                    colWidths=[75, 175]
                                )
                                cell_table.setStyle(TableStyle([
                                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                                    ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                                ]))
                                row_cells.append(cell_table)
                            else:
                                # No image - just text with bullet (BIGGER font)
                                row_cells.append(Paragraph(f'• {opt_name}', ParagraphStyle('ListOptNameNoBullet', fontName='DejaVuSans', fontSize=11, textColor=TEXT_COLOR, leading=13)))
                        else:
                            row_cells.append('')
                    
                    list_rows.append(row_cells)
                
                if list_rows:
                    list_table = Table(list_rows, colWidths=[260, 260])
                    list_table.setStyle(TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                        ('LEFTPADDING', (0, 0), (-1, -1), 5),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                    ]))
                    elements.append(list_table)
                    elements.append(Spacer(1, 12))
        
        # ===== SECTION 3: "Dodatkowe wyposażenie do wyboru" =====
        # Show only options the client did NOT select, with prices, as an upsell catalog.
        # Marked clearly as "opcjonalnie" so the customer can't think they ordered them.
        selected_ids = set()
        for opt in (selected_options or []):
            oid = opt.get('optionId') or opt.get('id')
            if oid:
                selected_ids.add(oid)
        # Also derive from request.selections (calculator direct-generation fallback)
        try:
            for cat_id, sel in (request.selections or {}).items():
                if isinstance(sel, dict):
                    for opt_id, is_sel in sel.items():
                        if is_sel:
                            selected_ids.add(opt_id)
                elif sel:
                    selected_ids.add(sel)
        except Exception:
            pass

        # NON-selected options only (upsell catalog at the end).
        # Also skip options without a flat price (variant-based pricing) — they would
        # show without a price tag and reintroduce the same confusion.
        filtered_options = [
            opt for opt in all_available_options
            if (opt.get('id') or opt.get('optionId')) not in selected_ids
            and int(opt.get('price') or 0) > 0
        ]

        # Override section title for the upsell version
        page2_options_title = "Dodatkowe wyposażenie do wyboru"

        # Start on a new page
        if filtered_options and page2_show_all_opts:
            elements.append(PageBreak())
            elements.append(Paragraph(page2_options_title.upper(),
                ParagraphStyle('AllOptTitle', fontName='DejaVuSans-Bold', fontSize=12,
                              textColor=BROWN_DARK, alignment=TA_CENTER, spaceAfter=4)))
            # Small grey disclaimer right under the title
            elements.append(Paragraph(
                "Opcjonalnie · do dokupienia · ceny nie wliczone w aktualną ofertę",
                ParagraphStyle('UpsellDisclaimer', fontName='DejaVuSans', fontSize=8,
                               textColor=colors.HexColor('#888888'), alignment=TA_CENTER, spaceAfter=8)
            ))
            elements.append(Table([['']], colWidths=[530], rowHeights=[2], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
            elements.append(Spacer(1, 8))
            
            # Build simple two-column layout for ALL options (no category grouping)
            async def build_option_cell(opt, col_width=255):
                """Build a single option cell with image and text."""
                opt_name = opt.get('name', '')
                opt_image = opt.get('imageUrl', '')
                opt_price = opt.get('price', 0)
                
                # Load small image
                opt_img = await load_card_image(opt_image, 50, 40)
                
                # Build text content
                name_style = ParagraphStyle('ListOptName2', fontName='DejaVuSans-Bold', fontSize=9, textColor=TEXT_COLOR, leading=11)
                price_style = ParagraphStyle('ListOptPrice', fontName='DejaVuSans', fontSize=8, textColor=BROWN, leading=10)
                
                if opt_img:
                    # With image: [img | name + price]
                    text_content = opt_name
                    if opt_price:
                        text_content += f' - {opt_price:,} PLN'.replace(',', ' ')
                    
                    cell_table = Table(
                        [[opt_img, Paragraph(text_content, name_style)]],
                        colWidths=[55, col_width - 60]
                    )
                    cell_table.setStyle(TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('LEFTPADDING', (0, 0), (-1, -1), 2),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
                    ]))
                    return cell_table
                else:
                    # No image: bullet point style
                    text_content = f'• {opt_name}'
                    if opt_price:
                        text_content += f' - {opt_price:,} PLN'.replace(',', ' ')
                    return Paragraph(text_content, name_style)
            
            # Build rows of 2 options each
            option_rows = []
            for i in range(0, len(filtered_options), 2):
                row_cells = []
                
                # First option
                cell1 = await build_option_cell(filtered_options[i], 255)
                row_cells.append(cell1)
                
                # Second option (if exists)
                if i + 1 < len(filtered_options):
                    cell2 = await build_option_cell(filtered_options[i + 1], 255)
                    row_cells.append(cell2)
                else:
                    row_cells.append('')  # Empty cell for odd number of options
                
                option_rows.append(row_cells)
            
            # Create the two-column table
            if option_rows:
                options_table = Table(option_rows, colWidths=[265, 265])
                options_table.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 3),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 3),
                    ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.Color(0.9, 0.9, 0.9)),
                ]))
                elements.append(options_table)
                elements.append(Spacer(1, 8))
    
    # ========== GALLERY PROMO PAGE ==========
    if is_block_enabled(pdf_template, 'gallery_promo'):
        gallery_promo_title = pdf_template.get('galleryPromoTitle')
        gallery_promo_text = pdf_template.get('galleryPromoText')
        gallery_promo_image_id = pdf_template.get('galleryPromoImageId')
        
        # Only show if at least title or image is set
        if gallery_promo_title or gallery_promo_image_id:
            elements.append(PageBreak())
            
            # Title
            if gallery_promo_title:
                elements.append(Paragraph(gallery_promo_title, 
                    ParagraphStyle('GalleryPromoTitle', fontName='DejaVuSans-Bold', fontSize=18, 
                                  textColor=BROWN, alignment=TA_CENTER, spaceAfter=12)))
            
            # Text
            if gallery_promo_text:
                # Support line breaks in text
                text_lines = gallery_promo_text.replace('\n', '<br/>')
                elements.append(Paragraph(text_lines, 
                    ParagraphStyle('GalleryPromoText', fontName='DejaVuSans', fontSize=11, 
                                  textColor=TEXT_COLOR, alignment=TA_CENTER, spaceAfter=15, leading=14)))
            
            # Full-width image
            if gallery_promo_image_id:
                promo_img_data = await load_template_image(gallery_promo_image_id)
                if promo_img_data:
                    try:
                        from PIL import Image as PILImage
                        pil_img = PILImage.open(io.BytesIO(promo_img_data))
                        orig_width, orig_height = pil_img.size
                        
                        # Scale to full page width (530px) preserving aspect ratio
                        max_width = 530
                        max_height = 600  # Leave some space for text
                        
                        width_ratio = max_width / orig_width
                        height_ratio = max_height / orig_height
                        scale = min(width_ratio, height_ratio)
                        
                        new_width = int(orig_width * scale)
                        new_height = int(orig_height * scale)
                        
                        promo_full_img = RLImage(io.BytesIO(promo_img_data), width=new_width, height=new_height)
                        
                        # Center the image in a table
                        img_table = Table([[promo_full_img]], colWidths=[530])
                        img_table.setStyle(TableStyle([
                            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ]))
                        elements.append(img_table)
                        elements.append(Spacer(1, 15))
                    except Exception as e:
                        logger.warning(f"Could not load gallery promo image: {e}")
    
    # ========== GALLERY COLLAGE ==========
    if is_block_enabled(pdf_template, 'gallery'):
        # Check if we need page break (only if gallery_promo was NOT shown)
        gallery_promo_shown = is_block_enabled(pdf_template, 'gallery_promo') and (
            pdf_template.get('galleryPromoTitle') or pdf_template.get('galleryPromoImageId')
        )
        
        if not gallery_promo_shown:
            # Add page break only if promo page wasn't added
            elements.append(PageBreak())
            
            # Gallery title from template (show only if no promo page)
            gallery_title = template_texts.get('galleryTitle', 'GALERIA REALIZACJI')
            elements.append(Paragraph(gallery_title, 
                                     ParagraphStyle('GalleryTitle', fontName='DejaVuSans-Bold', fontSize=16, 
                                                   textColor=BROWN, alignment=TA_CENTER, spaceAfter=15)))
        
        # Helper function to scale image preserving aspect ratio
        def scale_image_proportionally(img_data_or_path, max_width=250, max_height=180):
            """Scale image to fit within max dimensions while preserving aspect ratio"""
            from PIL import Image as PILImage
            try:
                if isinstance(img_data_or_path, bytes):
                    pil_img = PILImage.open(io.BytesIO(img_data_or_path))
                else:
                    pil_img = PILImage.open(img_data_or_path)
                
                orig_width, orig_height = pil_img.size
                
                # Calculate scale to fit within max dimensions
                width_ratio = max_width / orig_width
                height_ratio = max_height / orig_height
                scale = min(width_ratio, height_ratio)
                
                new_width = int(orig_width * scale)
                new_height = int(orig_height * scale)
                
                # Create ReportLab image with calculated dimensions
                if isinstance(img_data_or_path, bytes):
                    return RLImage(io.BytesIO(img_data_or_path), width=new_width, height=new_height)
                else:
                    return RLImage(img_data_or_path, width=new_width, height=new_height)
            except Exception as e:
                logger.warning(f"Could not scale image: {e}")
                # Fallback to fixed size
                if isinstance(img_data_or_path, bytes):
                    return RLImage(io.BytesIO(img_data_or_path), width=max_width, height=max_height)
                else:
                    return RLImage(img_data_or_path, width=max_width, height=max_height)
        
        # Load gallery images - first try from template, then fall back to default
        gallery_images = []
        template_gallery_ids = pdf_template.get('galleryImageIds', [])
        
        if template_gallery_ids:
            # Load images from template
            for img_id in template_gallery_ids[:6]:  # Max 6 images
                img_data = await load_template_image(img_id)
                if img_data:
                    try:
                        gallery_images.append(scale_image_proportionally(img_data, 165, 120))
                    except Exception as e:
                        logger.warning(f"Could not load template gallery image {img_id}: {e}")
        
        # Fall back to default gallery if no template images
        if not gallery_images:
            gallery_dir = '/app/assets/gallery'
            gallery_files = ['grat-3.jpg', 'f-bg-3.jpg', 'grat-2.jpg', 'photo-4.jpg']
            
            for img_file in gallery_files:
                img_path = os.path.join(gallery_dir, img_file)
                if os.path.exists(img_path):
                    try:
                        gallery_images.append(scale_image_proportionally(img_path, 165, 120))
                    except Exception as e:
                        logger.warning(f"Could not load gallery image {img_file}: {e}")
        
        # Create 3x2 grid of images (3 per row)
        if gallery_images:
            row_style = TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 3),
                ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ])
            
            # First row (images 0, 1, 2)
            row1_images = gallery_images[:3]
            if row1_images:
                # Pad with empty cells if less than 3 images
                while len(row1_images) < 3:
                    row1_images.append('')
                row1 = Table([row1_images], colWidths=[176, 176, 176], rowHeights=[125])
                row1.setStyle(row_style)
                elements.append(row1)
                elements.append(Spacer(1, 8))
            
            # Second row (images 3, 4, 5)
            if len(gallery_images) > 3:
                row2_images = gallery_images[3:6]
                # Pad with empty cells if less than 3 images
                while len(row2_images) < 3:
                    row2_images.append('')
                row2 = Table([row2_images], colWidths=[176, 176, 176], rowHeights=[125])
                row2.setStyle(row_style)
                elements.append(row2)
        
        # Gallery footer / company slogan from template
        company_slogan = template_texts.get('companySlogan', 'WM-Group — Producent saun i bali na wymiar')
        elements.append(Spacer(1, 15))
        elements.append(Paragraph(company_slogan, 
                                 ParagraphStyle('GalleryFooter', fontName='DejaVuSans', fontSize=10, 
                                               textColor=MUTED, alignment=TA_CENTER)))
    
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    # Generate filename: SAUNA_ClientName_OrderId
    try:
        # Keep name with cyrillic/polish chars, just replace spaces and remove unsafe filename chars
        safe_name = request.fullName.replace(' ', '_') if request.fullName else 'Klient'
        # Remove characters that are unsafe in filenames
        safe_name = ''.join(c for c in safe_name if c not in '<>:"/\\|?*')
        if not safe_name:
            safe_name = "Klient"
    except:
        safe_name = "Klient"
    
    # Use orderId if provided, otherwise generate timestamp-based ID
    order_id = request.orderId if request.orderId else offer_number
    filename = f"SAUNA_{safe_name}_{order_id}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )



# =============================================
# TECH SPEC PDF GENERATION (not in modular file)
# CRUD endpoints for tech-spec are in sauna_orders.py
# =============================================

@router.post("/generate-tech-spec-pdf")
async def generate_tech_spec_pdf(request: dict):
    """Generate PDF for technical specification based on the new 21-point structure.
    
    Sections: Общее, Парная, Комната отдыха, Электрика.
    Optionally uploads to Cloudinary and links to CRM lead.
    """
    order = request.get("order", {})
    tech_spec = request.get("techSpec", {})
    categories = request.get("categories", [])
    sections = request.get("sections", [])
    lead_id = request.get("leadId")
    bench_data = request.get("benchData", [])
    layout_image_url = request.get("layoutImageUrl")

    selections = tech_spec.get("selections", {})
    text_inputs = tech_spec.get("textInputs", {})
    conditional_data = tech_spec.get("conditionalData", {})
    comment = tech_spec.get("comment", "")

    # Build lookup
    cats_by_id = {c["id"]: c for c in categories}

    buffer = io.BytesIO()

    from services.pdf_fonts import ensure_pdf_fonts
    ensure_pdf_fonts()

    BROWN = colors.HexColor('#97724E')
    BROWN_LIGHT = colors.HexColor('#FAF6F0')
    BROWN_DARK = colors.HexColor('#6B5038')
    TEXT_COLOR = colors.HexColor('#323232')
    WHITE = colors.white

    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=30, leftMargin=30,
                            topMargin=20, bottomMargin=20)
    elements = []

    title_style = ParagraphStyle('Title', fontName='DejaVuSans-Bold', fontSize=16, textColor=BROWN, alignment=TA_CENTER)
    section_style = ParagraphStyle('Section', fontName='DejaVuSans-Bold', fontSize=11, textColor=BROWN_DARK)
    normal_style = ParagraphStyle('Normal', fontName='DejaVuSans', fontSize=9, textColor=TEXT_COLOR)

    # ========== TITLE ==========
    elements.append(Paragraph("Zgłoszenie techniczne - sauna", title_style))
    elements.append(Spacer(1, 15))

    # ========== CLIENT INFO ==========
    elements.append(Paragraph("Dane klienta", section_style))
    elements.append(Spacer(1, 6))
    client_data = [
        ["Imię i nazwisko", "Telefon", "Nr zamówienia"],
        [order.get("fullName", order.get("clientName", "-")), order.get("phoneNumber", order.get("phone", "-")), order.get("id", "-")]
    ]
    client_table = Table(client_data, colWidths=[180, 180, 170])
    client_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BROWN), ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'), ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9), ('BACKGROUND', (0, 1), (-1, -1), BROWN_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, BROWN), ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6), ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(client_table)
    elements.append(Spacer(1, 12))

    # ========== MODEL INFO ==========
    elements.append(Paragraph("Model bazowy", section_style))
    elements.append(Spacer(1, 6))
    model_info_parts = [order.get("modelName", "-")]
    if order.get("selectedModelVariantName"):
        model_info_parts.append(f"({order['selectedModelVariantName']})")
    model_name = " ".join(model_info_parts)
    model_table = Table([[model_name]], colWidths=[530])
    model_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), BROWN_LIGHT), ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11), ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(model_table)
    elements.append(Spacer(1, 12))

    # ========== LAYOUT IMAGE ==========
    if layout_image_url:
        try:
            import urllib.request
            import tempfile
            req = urllib.request.Request(layout_image_url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                img_bytes = resp.read()
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                tmp.write(img_bytes)
                tmp_path = tmp.name
            elements.append(Paragraph("Planowka", section_style))
            elements.append(Spacer(1, 6))
            layout_img = RLImage(tmp_path, width=400, height=280)
            layout_img.hAlign = 'CENTER'
            elements.append(layout_img)
            elements.append(Spacer(1, 12))
        except Exception as e:
            logger.warning(f"Could not load layout image for tech spec PDF: {e}")

    # ========== BENCH DATA FROM CALCULATOR (with images) ==========
    if bench_data:
        elements.append(Paragraph("Ławki (z kalkulatora)", section_style))
        elements.append(Spacer(1, 6))
        for bench in bench_data:
            bench_name = bench.get("optionName", "-")
            variant_name = ""
            if bench.get("selectedVariant"):
                variant_name = bench["selectedVariant"].get("name", "")
            bench_text = bench_name
            if variant_name:
                bench_text += f" — {variant_name}"
            qty = bench.get("quantity", 1)
            if qty and int(qty) > 1:
                bench_text += f" (x{qty})"

            bench_img = None
            img_url = bench.get("imageUrl") or (bench.get("selectedVariant") or {}).get("imageUrl")
            if img_url:
                try:
                    import urllib.request
                    import tempfile
                    req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*'})
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        img_data = resp.read()
                    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                        tmp.write(img_data)
                        bench_img = RLImage(tmp.name, width=100, height=70)
                except Exception as e:
                    logger.warning(f"Could not load bench image: {e}")

            if bench_img:
                row = [[bench_img, Paragraph(f"<b>{bench_text}</b>", ParagraphStyle('BN', fontName='DejaVuSans-Bold', fontSize=9))]]
                bt = Table(row, colWidths=[110, 420])
                bt.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT), ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4), ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ]))
                elements.append(bt)
            else:
                bt = Table([[bench_text]], colWidths=[530])
                bt.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, 0), BROWN_LIGHT), ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9), ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
                    ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ]))
                elements.append(bt)
            elements.append(Spacer(1, 4))
        elements.append(Spacer(1, 8))

    # ========== SECTIONS: Общее / Парная / Комната отдыха / Электрика ==========
    def get_opt_name(cat_id, opt_id):
        cat = cats_by_id.get(cat_id, {})
        for o in cat.get("options", []):
            if o.get("id") == opt_id:
                return o.get("name", opt_id)
        return str(opt_id)

    for section in sections:
        sec_id = section.get("id")
        sec_name = section.get("name")
        sec_cats = [c for c in categories if c.get("section") == sec_id]
        if not sec_cats:
            continue

        section_data = []
        for cat in sec_cats:
            cat_id = cat.get("id")
            cat_name = cat.get("name")

            # Skip calc_transfer (benches) — already rendered above
            if cat.get("inputType") == "calc_transfer":
                continue

            # Collect value (use defaultValue if no explicit selection)
            value = selections.get(cat_id)
            if not value and cat.get("defaultValue"):
                value = cat["defaultValue"]
            text_vals = []
            for opt in cat.get("options", []):
                tv = text_inputs.get(f"{cat_id}_{opt['id']}")
                if tv:
                    if len(cat.get("options", [])) > 1:
                        text_vals.append(f"{opt['name']}: {tv}")
                    else:
                        text_vals.append(tv)
                # Custom field for checkbox "other size"
                cv = text_inputs.get(f"{cat_id}_{opt['id']}_custom")
                if cv:
                    text_vals.append(f"{opt['name']}: {cv}")

            # Build display value
            display = ""
            if cat.get("inputType") == "text":
                display = "; ".join(text_vals) if text_vals else ""
            elif cat.get("inputType") in ("radio",):
                if value:
                    display = get_opt_name(cat_id, value)
            elif cat.get("inputType") == "checkbox":
                if isinstance(value, list) and value:
                    names = [get_opt_name(cat_id, v) for v in value]
                    display = ", ".join(names)
                    # Append any custom fields
                    if text_vals:
                        display += " (" + "; ".join(text_vals) + ")"

            # Conditional fields (stove type etc.)
            cond_parts = []
            if cat.get("conditionalFields") and value and value in cat["conditionalFields"]:
                for cf in cat["conditionalFields"][value]:
                    cf_val = conditional_data.get(f"{cat_id}_{cf['id']}")
                    if cf_val:
                        if cf.get("inputType") == "radio":
                            for co in cf.get("options", []):
                                if co["id"] == cf_val:
                                    cond_parts.append(f"{cf['name']}: {co['name']}")
                                    break
                        else:
                            cond_parts.append(f"{cf['name']}: {cf_val}")

            if cond_parts:
                display = (display + " | " if display else "") + "; ".join(cond_parts)

            # Always include category in PDF
            section_data.append([cat_name, display if display else ""])

        if section_data:
            # Section header
            sec_header = Table([[sec_name]], colWidths=[530])
            sec_header.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, 0), BROWN), ('TEXTCOLOR', (0, 0), (0, 0), WHITE),
                ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 11),
                ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(sec_header)
            elements.append(Spacer(1, 4))

            dt = Table(section_data, colWidths=[180, 350])
            dt.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
                ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9), ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
                ('GRID', (0, 0), (-1, -1), 0.5, BROWN), ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5), ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(dt)
            elements.append(Spacer(1, 10))

    # ========== COMMENT ==========
    if comment:
        elements.append(Paragraph("Komentarz (wewnętrzny)", section_style))
        elements.append(Spacer(1, 6))
        comment_table = Table([[comment]], colWidths=[530])
        comment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), BROWN_LIGHT), ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
            ('FONTSIZE', (0, 0), (-1, -1), 9), ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
            ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(comment_table)
        elements.append(Spacer(1, 12))

    # ========== FOOTER ==========
    elements.append(Spacer(1, 20))
    current_date = datetime.now().strftime('%d.%m.%Y')
    elements.append(Paragraph(f"Data zgłoszenia: {current_date}",
                              ParagraphStyle('Footer', fontName='DejaVuSans', fontSize=9, textColor=TEXT_COLOR)))

    doc.build(elements)
    pdf_data = buffer.getvalue()
    buffer.close()

    order_id = order.get("id", "unknown")
    try:
        safe_name = ''.join(c for c in order.get("fullName", order.get("clientName", "Klient")) if c.isascii() and (c.isalnum() or c in '-_. '))
        safe_name = safe_name.replace(' ', '_') or "Klient"
    except Exception:
        safe_name = "Klient"
    filename = f"TechSpec_{order_id}_{safe_name}.pdf"

    # ========== UPLOAD TO CLOUDINARY & LINK TO CRM LEAD ==========
    cloudinary_url = None
    if lead_id:
        try:
            from services.cloudinary_service import upload_pdf
            cloud_result = await upload_pdf(pdf_data, filename, folder="wm-calculator/tech-specs")
            if cloud_result and cloud_result.get("url"):
                cloudinary_url = cloud_result["url"]
                logger.info(f"Tech spec PDF uploaded to Cloudinary: {cloudinary_url}")

                # Remove old tech_spec documents, then add new one
                await db.sauna_crm_leads.update_one(
                    {"id": lead_id},
                    {"$pull": {"documents": {"type": "tech_spec"}}}
                )
                doc_entry = {
                    "id": str(os.urandom(4).hex()),
                    "type": "tech_spec",
                    "name": f"Тех. задание — {order.get('modelName', '')}",
                    "url": cloudinary_url,
                    "filename": filename,
                    "uploadedAt": datetime.now(timezone.utc).isoformat(),
                    "orderId": order_id,
                }
                await db.sauna_crm_leads.update_one(
                    {"id": lead_id},
                    {"$push": {"documents": doc_entry}}
                )
                logger.info(f"Tech spec PDF linked to CRM lead {lead_id}")

                # Push tech spec link to amoCRM as a note
                crm_lead = await db.sauna_crm_leads.find_one({"id": lead_id}, {"_id": 0, "amocrm_id": 1, "clientName": 1})
                amocrm_id = crm_lead.get("amocrm_id") if crm_lead else None
                if amocrm_id:
                    try:
                        settings_amo = get_amocrm_settings()
                        amo_domain = settings_amo.get("amocrm_domain", "")
                        amo_token = settings_amo.get("amocrm_token", "")
                        if amo_domain and amo_token:
                            note_text = (
                                f"Техническое задание создано\n"
                                f"Клиент: {crm_lead.get('clientName', '')}\n"
                                f"Модель: {order.get('modelName', '')}\n"
                                f"Скачать: {cloudinary_url}\n"
                                f"{datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}"
                            )
                            await add_note_to_amocrm(amocrm_id, note_text, amo_domain, amo_token)
                            logger.info(f"Tech spec link sent to amoCRM lead {amocrm_id}")
                    except Exception as e:
                        logger.error(f"Failed to send tech spec link to amoCRM: {e}")
        except Exception as e:
            logger.error(f"Failed to upload tech spec PDF to Cloudinary: {e}")

    if cloudinary_url:
        return {"status": "ok", "url": cloudinary_url, "filename": filename}

    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
