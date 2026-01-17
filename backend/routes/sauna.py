"""Sauna calculator routes."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta
from urllib.parse import quote
import io
import os
import logging

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

from database import db
from models.sauna import SaunaModel, SaunaOption, SaunaCategory, SaunaPriceData, SaunaOrder, SaunaPDFRequest
from data.sauna_defaults import default_sauna_prices
from services.telegram_service import notify_new_order

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sauna", tags=["Sauna Calculator"])


@router.get("/prices")
async def get_sauna_prices():
    """Get sauna pricing data"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        return default_sauna_prices
    
    prices.pop('_id', None)
    return prices


@router.post("/prices")
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
@router.post("/models")
async def add_sauna_model(model: SaunaModel):
    """Add a new sauna model"""
    prices = await db.sauna_prices.find_one({"_id": "default"})
    if not prices:
        await db.sauna_prices.insert_one({"_id": "default", **default_sauna_prices})
        prices = default_sauna_prices.copy()
    
    models = prices.get("models", [])
    if any(m["id"] == model.id for m in models):
        raise HTTPException(status_code=400, detail="Model with this ID already exists")
    
    models.append(model.model_dump())
    await db.sauna_prices.update_one(
        {"_id": "default"},
        {"$set": {"models": models}}
    )
    return {"message": "Model added successfully", "model": model}


@router.put("/models/{model_id}")
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


@router.delete("/models/{model_id}")
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
@router.post("/categories")
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


@router.put("/categories/{category_id}")
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


@router.delete("/categories/{category_id}")
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
@router.post("/categories/{category_id}/options")
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


@router.put("/categories/{category_id}/options/{option_id}")
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


@router.delete("/categories/{category_id}/options/{option_id}")
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


@router.post("/orders", response_model=SaunaOrder)
async def create_sauna_order(order: SaunaOrder):
    """Create a new sauna order"""
    order_dict = order.model_dump()
    await db.sauna_orders.insert_one(order_dict)
    
    # Send Telegram notification with PDF for new sauna order
    try:
        pdf_request = SaunaPDFRequest(
            orderId=order_dict.get('id', ''),
            fullName=order_dict.get('fullName', ''),
            phoneNumber=order_dict.get('phoneNumber', ''),
            fullAddress=order_dict.get('fullAddress', ''),
            email=order_dict.get('email', ''),
            orderDate=order_dict.get('orderDate', order_dict.get('createdAt', datetime.now().isoformat())),
            selectedModel=order_dict.get('selectedModel', ''),
            modelName=order_dict.get('modelName', ''),
            basePrice=order_dict.get('basePrice', 0),
            selections=order_dict.get('selections', {}),
            quantities=order_dict.get('quantities', {}),
            notes=order_dict.get('notes', ''),
            total=order_dict.get('total', 0)
        )
        pdf_data = await generate_sauna_pdf_bytes(pdf_request)
        await notify_new_order(order_dict, order_type='sauna', is_web_order=False, pdf_data=pdf_data)
    except Exception as e:
        logger.warning(f"Failed to send Telegram notification with PDF for sauna order: {e}")
        # Fallback: try to send without PDF
        try:
            await notify_new_order(order_dict, order_type='sauna', is_web_order=False)
        except:
            pass
    
    return order


@router.get("/orders")
async def get_sauna_orders():
    """Get all sauna orders"""
    orders = await db.sauna_orders.find({}, {"_id": 0}).to_list(1000)
    return orders


@router.get("/orders/{order_id}")
async def get_sauna_order(order_id: str):
    """Get a single sauna order by ID"""
    order = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/orders/{order_id}")
async def update_sauna_order(order_id: str, order: SaunaOrder):
    """Update an existing sauna order with change history tracking"""
    from datetime import datetime, timezone
    
    # Get existing order to track changes
    existing = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_dict = order.model_dump()
    now = datetime.now(timezone.utc).isoformat()
    
    # Track what fields changed
    changes = []
    tracked_fields = [
        'fullName', 'clientName', 'phoneNumber', 'phone', 'fullAddress',
        'orderContents', 'notes', 'dealSum', 'debtSum', 'totalPrice', 'amountDue',
        'deliveryStatus', 'deliveryComment', 'isImportant',
        'tripId', 'tripName', 'tripDriverName', 'tripDepartureDate', 'tripOrderStatus',
        'modelName', 'total', 'discountPercent'
    ]
    
    for field in tracked_fields:
        old_val = existing.get(field)
        new_val = order_dict.get(field)
        if old_val != new_val:
            changes.append({
                'field': field,
                'oldValue': old_val,
                'newValue': new_val
            })
    
    # If there are changes, add to history
    if changes:
        history_entry = {
            'timestamp': now,
            'changes': changes,
            'changedBy': order_dict.get('updatedBy', 'system')
        }
        
        # Get existing history or create new
        change_history = existing.get('changeHistory', []) or []
        change_history.append(history_entry)
        order_dict['changeHistory'] = change_history
        order_dict['updatedAt'] = now
    
    result = await db.sauna_orders.update_one(
        {"id": order_id},
        {"$set": order_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Return updated order
    updated = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    return updated


@router.delete("/orders/{order_id}")
async def delete_sauna_order(order_id: str):
    """Delete a sauna order"""
    result = await db.sauna_orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted successfully"}


async def generate_sauna_pdf_bytes(request: SaunaPDFRequest) -> bytes:
    """Generate PDF for sauna order and return as bytes (for Telegram)"""
    from reportlab.lib.units import mm
    
    buffer = io.BytesIO()
    
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except:
        pass
    
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
    
    # Options section - from selections
    if request.selections:
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
    
    total_data = [["RAZEM DO ZAPŁATY:", f"{total_formatted} zł"]]
    
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
    elements.append(Spacer(1, 8*mm))
    
    # Footer
    footer_style = ParagraphStyle('Footer', fontName='DejaVuSans', fontSize=8, textColor=MUTED, alignment=TA_CENTER)
    elements.append(Paragraph("Oferta ważna 14 dni od daty wystawienia.", footer_style))
    elements.append(Paragraph("Oferta nie stanowi oferty handlowej w rozumieniu Kodeksu Cywilnego.", footer_style))
    
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return pdf_data


@router.post("/generate-pdf")
async def generate_sauna_pdf(request: SaunaPDFRequest):
    """Generate PDF for sauna order - Professional offer format"""
    import urllib.request
    import base64
    from PIL import Image as PILImage
    
    def optimize_image_for_pdf(img_data: bytes, max_size: int = 800, quality: int = 75) -> bytes:
        """Optimize image for PDF: resize and compress to reduce file size"""
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
            
            # Resize if too large
            width, height = img.size
            if width > max_size or height > max_size:
                ratio = min(max_size / width, max_size / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                img = img.resize((new_width, new_height), PILImage.Resampling.LANCZOS)
            
            # Compress as JPEG
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=quality, optimize=True)
            optimized = output.getvalue()
            
            original_size = len(img_data)
            new_size = len(optimized)
            if new_size < original_size:
                logger.info(f"Optimized image: {original_size/1024:.1f}KB -> {new_size/1024:.1f}KB")
                return optimized
            return img_data
        except Exception as e:
            logger.warning(f"Could not optimize image: {e}")
            return img_data
    
    async def load_image_from_mongodb(image_url: str) -> bytes:
        """Load image from MongoDB by extracting ID from URL"""
        if not image_url or '/api/uploads/' not in image_url:
            logger.warning(f"Invalid image URL for MongoDB: {image_url}")
            return None
        try:
            filename = image_url.split('/api/uploads/')[-1]
            file_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
            logger.info(f"Looking for MongoDB image with ID: {file_id}")
            image_doc = await db.images.find_one({"id": file_id})
            if image_doc:
                content = image_doc.get("content", "")
                if content:
                    decoded = base64.b64decode(content)
                    logger.info(f"Found MongoDB image, decoded size: {len(decoded)} bytes")
                    return decoded
                else:
                    logger.warning(f"MongoDB image found but content is empty for ID: {file_id}")
            else:
                logger.warning(f"MongoDB image not found for ID: {file_id}")
        except Exception as e:
            logger.warning(f"Could not load image from MongoDB: {e}")
        return None
    
    buffer = io.BytesIO()
    
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
            img_data = None
            logger.info(f"Processing model image URL: {model_image_url}")
            
            # Try loading from MongoDB first - check for /api/uploads/ pattern
            if '/api/uploads/' in model_image_url:
                img_data = await load_image_from_mongodb(model_image_url)
                if img_data:
                    logger.info(f"Loaded model image from MongoDB for Sauna PDF (size: {len(img_data)} bytes)")
                else:
                    logger.warning(f"MongoDB image not found for URL: {model_image_url}")
            
            # Fallback to HTTP download for external URLs (only if not MongoDB URL or MongoDB failed)
            if not img_data and model_image_url.startswith('http') and '/api/uploads/' not in model_image_url:
                try:
                    req = urllib.request.Request(
                        model_image_url,
                        headers={
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Referer': 'https://wm-sauna.pl/',
                        }
                    )
                    with urllib.request.urlopen(req, timeout=10) as response:
                        img_data = response.read()
                    logger.info(f"Downloaded model image from external URL: {model_image_url}")
                except Exception as e:
                    logger.warning(f"Could not download image from URL: {e}")
            
            if img_data:
                # Optimize image for PDF (resize and compress)
                img_data = optimize_image_for_pdf(img_data, max_size=600, quality=70)
                
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
        try:
            import urllib.request
            import tempfile
            
            req = urllib.request.Request(
                bench_image_url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                }
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                bench_data = response.read()
            
            # Optimize bench image for PDF
            bench_data = optimize_image_for_pdf(bench_data, max_size=500, quality=70)
            
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                tmp.write(bench_data)
                bench_img = RLImage(tmp.name, width=130, height=95)
        except Exception as e:
            logger.warning(f"Could not load bench image: {e}")
    
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
    
    # ========== OPTIONS SECTION (Two columns) ==========
    options_items = []
    quantities = getattr(request, 'quantities', {}) or {}
    
    # PRIMARY: Use selectedOptions if available (from saved orders)
    if selected_options:
        for opt in selected_options:
            # Skip lawki as it's shown separately with image
            if opt.get('categoryId') == 'lawki':
                continue
            
            opt_id = opt.get('optionId', '') or opt.get('id', '')
            name = opt.get('optionName', '') or opt.get('name', '')
            price = opt.get('price', 0)
            quantity = opt.get('quantity', 1)
            total_price = price * quantity
            
            # Check if this option is a gift
            is_gift = opt_id in admin_gifts
            
            if quantity > 1:
                name = f"{name} (×{quantity})"
            
            if is_gift:
                # Show original price crossed out + gift label
                price_str = f"<strike>{total_price:,}</strike> Prezent od WM-Group".replace(',', ' ')
            else:
                price_str = f"{total_price:,} PLN".replace(',', ' ') if total_price > 0 else '0 PLN'
            
            options_items.append({'name': name, 'price': price_str, 'is_gift': is_gift, 'original_price': total_price})
    else:
        # FALLBACK: Use categories + selections (from calculator direct generation)
        for category in request.categories:
            cat_id = category.get('id', '')
            
            # Skip lawki as it's shown separately with image
            if cat_id == 'lawki':
                continue
                
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
                            
                            name = opt.get('name', '')
                            if has_quantity and quantity > 1:
                                name = f"{name} (×{quantity})"
                            
                            # Check if this option is a gift
                            is_gift = opt_id in admin_gifts
                            if is_gift:
                                price_str = f"<strike>{total_price:,}</strike> Prezent od WM-Group".replace(',', ' ')
                            else:
                                price_str = f"{total_price:,} PLN".replace(',', ' ') if total_price > 0 else '0 PLN'
                            
                            options_items.append({'name': name, 'price': price_str, 'is_gift': is_gift, 'original_price': total_price})
            else:
                opt = next((o for o in category.get('options', []) if o.get('id') == selection), None)
                if opt:
                    price = opt.get('price', 0)
                    has_quantity = opt.get('hasQuantity', False)
                    quantity = quantities.get(selection, 1) if has_quantity else 1
                    total_price = price * quantity
                    
                    name = opt.get('name', '')
                    if has_quantity and quantity > 1:
                        name = f"{name} (×{quantity})"
                    
                    # Check if this option is a gift
                    is_gift = selection in admin_gifts
                    if is_gift:
                        price_str = f"<strike>{total_price:,}</strike> Prezent od WM-Group".replace(',', ' ')
                    else:
                        price_str = f"{total_price:,} PLN".replace(',', ' ') if total_price > 0 else '0 PLN'
                    
                    options_items.append({'name': name, 'price': price_str, 'is_gift': is_gift, 'original_price': total_price})
    
    if options_items:
        elements.append(Paragraph('DODATKOWE OPCJE', section_title_style))
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
        discount_note = f"<br/><font size='8' color='#F0F9F5'>Rabat: {discount_percent:.0f}% (cena bez rabatu: {subtotal_int:,} PLN)</font>".replace(',', ' ')
    
    # Build left content as a single Paragraph with HTML-like formatting
    left_html = f'''<font color="white"><b>WARTOŚĆ CAŁKOWITA OFERTY</b></font><br/><br/>
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
    
    # ========== FOOTER ==========
    elements.append(Spacer(1, 10))
    elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph('Oferta ważna 30 dni od daty wystawienia.', 
                             ParagraphStyle('Footer', fontName='DejaVuSans', fontSize=8, textColor=MUTED, alignment=TA_CENTER)))
    
    # ========== GALLERY PAGE ==========
    # Add a new page with photo collage
    elements.append(PageBreak())
    
    # Gallery title
    elements.append(Paragraph('GALERIA REALIZACJI', 
                             ParagraphStyle('GalleryTitle', fontName='DejaVuSans-Bold', fontSize=16, 
                                           textColor=BROWN, alignment=TA_CENTER, spaceAfter=15)))
    
    # Load gallery images
    gallery_dir = '/app/assets/gallery'
    gallery_images = []
    gallery_files = ['grat-3.jpg', 'f-bg-3.jpg', 'grat-2.jpg', 'photo-4.jpg']
    
    for img_file in gallery_files:
        img_path = os.path.join(gallery_dir, img_file)
        if os.path.exists(img_path):
            try:
                gallery_images.append(RLImage(img_path, width=250, height=180))
            except Exception as e:
                logger.warning(f"Could not load gallery image {img_file}: {e}")
    
    # Create 2x2 grid of images
    if gallery_images:
        # First row
        if len(gallery_images) >= 2:
            row1 = Table([[gallery_images[0], gallery_images[1]]], 
                        colWidths=[265, 265],
                        rowHeights=[185])
            row1.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            elements.append(row1)
            elements.append(Spacer(1, 10))
        
        # Second row
        if len(gallery_images) >= 4:
            row2 = Table([[gallery_images[2], gallery_images[3]]], 
                        colWidths=[265, 265],
                        rowHeights=[185])
            row2.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            elements.append(row2)
        elif len(gallery_images) == 3:
            # If only 3 images, center the third one
            row2 = Table([[gallery_images[2]]], 
                        colWidths=[265],
                        rowHeights=[185])
            row2.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            elements.append(row2)
    
    # Gallery footer
    elements.append(Spacer(1, 15))
    elements.append(Paragraph('WM-Group — Producent saun i bali na wymiar', 
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
# TECH SPEC (Technical Specification) ENDPOINTS
# =============================================

@router.put("/orders/{order_id}/tech-spec")
async def update_order_tech_spec(order_id: str, tech_spec: dict):
    """Update technical specification for an order"""
    result = await db.sauna_orders.update_one(
        {"id": order_id},
        {"$set": {"techSpec": tech_spec}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Tech spec updated successfully"}


@router.get("/orders/{order_id}/tech-spec")
async def get_order_tech_spec(order_id: str):
    """Get technical specification for an order"""
    order = await db.sauna_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order.get("techSpec", {})


@router.post("/generate-tech-spec-pdf")
async def generate_tech_spec_pdf(request: dict):
    """Generate PDF for technical specification - Production format"""
    order = request.get("order", {})
    tech_spec = request.get("techSpec", {})
    
    # Load tech spec config to get category and option names
    tech_config = await db.tech_spec_config.find_one({"_id": "default"})
    if not tech_config:
        from data.tech_spec_defaults import default_tech_spec_data
        tech_config = default_tech_spec_data
    
    master_categories = tech_config.get("masterCategories", [])
    categories_config = tech_config.get("categories", [])
    
    # Build lookup dictionaries
    categories_by_id = {c["id"]: c for c in categories_config}
    masters_by_id = {m["id"]: m for m in master_categories}
    
    buffer = io.BytesIO()
    
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except Exception as e:
        logger.warning(f"Could not register fonts: {e}")
    
    # Colors
    BROWN = colors.HexColor('#97724E')
    BROWN_LIGHT = colors.HexColor('#FAF6F0')
    BROWN_DARK = colors.HexColor('#6B5038')
    TEXT_COLOR = colors.HexColor('#323232')
    WHITE = colors.white
    
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                          rightMargin=30, leftMargin=30,
                          topMargin=20, bottomMargin=20)
    
    elements = []
    
    title_style = ParagraphStyle(
        'Title',
        fontName='DejaVuSans-Bold',
        fontSize=16,
        textColor=BROWN,
        alignment=TA_CENTER,
    )
    
    section_style = ParagraphStyle(
        'Section',
        fontName='DejaVuSans-Bold',
        fontSize=11,
        textColor=BROWN_DARK,
    )
    
    master_section_style = ParagraphStyle(
        'MasterSection',
        fontName='DejaVuSans-Bold',
        fontSize=12,
        textColor=WHITE,
    )
    
    normal_style = ParagraphStyle(
        'Normal',
        fontName='DejaVuSans',
        fontSize=9,
        textColor=TEXT_COLOR,
    )
    
    # ========== TITLE ==========
    elements.append(Paragraph("Zgłoszenie techniczne - sauna", title_style))
    elements.append(Spacer(1, 15))
    
    # ========== CLIENT INFO ==========
    elements.append(Paragraph("Dane klienta", section_style))
    elements.append(Spacer(1, 6))
    
    client_data = [
        ["Imię i nazwisko", "Telefon", "Nr zamówienia"],
        [order.get("fullName", "-"), order.get("phoneNumber", "-"), order.get("id", "-")]
    ]
    
    client_table = Table(client_data, colWidths=[180, 180, 170])
    client_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BROWN),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 1), (-1, -1), BROWN_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(client_table)
    elements.append(Spacer(1, 12))
    
    # ========== MODEL INFO ==========
    elements.append(Paragraph("Model bazowy", section_style))
    elements.append(Spacer(1, 6))
    
    model_name = order.get("modelName", "-")
    model_table = Table([[model_name]], colWidths=[530])
    model_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), BROWN_LIGHT),
        ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(model_table)
    elements.append(Spacer(1, 12))
    
    # ========== BENCH IMAGE ==========
    selections = tech_spec.get("selections", {})
    bench_selection = selections.get("benches", "")
    bench_image_url = None
    bench_name = None
    
    if bench_selection:
        benches_cat = categories_by_id.get("benches", {})
        for opt in benches_cat.get("options", []):
            if opt.get("id") == bench_selection:
                bench_image_url = opt.get("imageUrl")
                bench_name = opt.get("name")
                break
    
    if bench_image_url and bench_name:
        elements.append(Paragraph("Ławki", section_style))
        elements.append(Spacer(1, 6))
        
        bench_img = None
        try:
            import urllib.request
            import tempfile
            
            req = urllib.request.Request(
                bench_image_url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                }
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                img_data = response.read()
                
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                tmp.write(img_data)
                tmp_path = tmp.name
            
            bench_img = RLImage(tmp_path, width=120, height=80)
        except Exception as e:
            logger.warning(f"Could not load bench image: {e}")
        
        if bench_img:
            bench_info = [[
                bench_img,
                Paragraph(f"<b>{bench_name}</b>", ParagraphStyle('BenchName', fontName='DejaVuSans-Bold', fontSize=10))
            ]]
            bench_table = Table(bench_info, colWidths=[130, 400])
            bench_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
                ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (1, 0), (1, 0), 15),
            ]))
            elements.append(bench_table)
        else:
            bench_table = Table([[bench_name]], colWidths=[530])
            bench_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, 0), BROWN_LIGHT),
                ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(bench_table)
        elements.append(Spacer(1, 12))
    
    # ========== TECHNICAL SPEC OPTIONS - GROUPED BY MASTER CATEGORIES ==========
    text_inputs = tech_spec.get("textInputs", {})
    
    # Helper function to get option name from category config
    def get_option_name(cat_id, option_id):
        cat_config = categories_by_id.get(cat_id, {})
        for opt in cat_config.get("options", []):
            if opt.get("id") == option_id:
                return opt.get("name", option_id)
        return option_id
    
    def get_category_name(cat_id):
        cat_config = categories_by_id.get(cat_id, {})
        return cat_config.get("name", cat_id)
    
    # Group categories by master category
    for master in master_categories:
        master_id = master.get("id")
        master_name = master.get("name")
        
        # Get categories for this master
        master_cats = [c for c in categories_config if c.get("masterCategoryId") == master_id]
        
        # Collect data for this master category
        master_data = []
        for cat in master_cats:
            cat_id = cat.get("id")
            cat_name = cat.get("name")
            
            # Skip benches as we show them separately with image
            if cat_id == "benches":
                continue
            
            value = selections.get(cat_id)
            if not value:
                continue
            
            # Handle list (checkbox) vs single value (radio)
            if isinstance(value, list):
                option_names = [get_option_name(cat_id, v) for v in value]
                value_str = ", ".join(option_names)
            else:
                value_str = get_option_name(cat_id, value)
            
            master_data.append([cat_name, value_str])
        
        # Check text inputs for this master's categories
        for cat in master_cats:
            cat_id = cat.get("id")
            for key, val in text_inputs.items():
                if key.startswith(cat_id) and val:
                    cat_name = get_category_name(cat_id)
                    master_data.append([cat_name, str(val)])
        
        # Add master category section if there's data
        if master_data:
            # Master category header
            master_header = Table([[master_name]], colWidths=[530])
            master_header.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, 0), BROWN),
                ('TEXTCOLOR', (0, 0), (0, 0), WHITE),
                ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 11),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(master_header)
            elements.append(Spacer(1, 4))
            
            # Data table
            data_table = Table(master_data, colWidths=[180, 350])
            data_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
                ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
                ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(data_table)
            elements.append(Spacer(1, 10))
    
    # ========== UNASSIGNED CATEGORIES ==========
    unassigned_cats = [c for c in categories_config if not c.get("masterCategoryId")]
    unassigned_data = []
    
    for cat in unassigned_cats:
        cat_id = cat.get("id")
        cat_name = cat.get("name")
        
        if cat_id == "benches":
            continue
        
        value = selections.get(cat_id)
        if not value:
            continue
        
        if isinstance(value, list):
            option_names = [get_option_name(cat_id, v) for v in value]
            value_str = ", ".join(option_names)
        else:
            value_str = get_option_name(cat_id, value)
        
        unassigned_data.append([cat_name, value_str])
    
    if unassigned_data:
        other_header = Table([["Прочее"]], colWidths=[530])
        other_header.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#666666')),
            ('TEXTCOLOR', (0, 0), (0, 0), WHITE),
            ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(other_header)
        elements.append(Spacer(1, 4))
        
        data_table = Table(unassigned_data, colWidths=[180, 350])
        data_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
            ('FONTNAME', (0, 0), (0, -1), 'DejaVuSans-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
            ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(data_table)
        elements.append(Spacer(1, 10))
    
    # ========== COMMENT ==========
    comment = tech_spec.get("comment", "")
    if comment:
        elements.append(Paragraph("Komentarz (wewnętrzny)", section_style))
        elements.append(Spacer(1, 6))
        
        comment_table = Table([[comment]], colWidths=[530])
        comment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), BROWN_LIGHT),
            ('FONTNAME', (0, 0), (-1, -1), 'DejaVuSans'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, BROWN),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
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
        safe_name = ''.join(c for c in order.get("fullName", "Klient") if c.isascii() and (c.isalnum() or c in '-_. '))
        safe_name = safe_name.replace(' ', '_')
        if not safe_name:
            safe_name = "Klient"
    except:
        safe_name = "Klient"
    
    filename = f"TechSpec_{order_id}_{safe_name}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
