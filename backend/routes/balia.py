"""Balia calculator routes."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from datetime import datetime, timedelta
import io
import os
import logging

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

from database import db
from models.balia import PriceData, Order, PDFRequest
from data.balia_defaults import default_balia_prices

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Balia Calculator"])


@router.get("/")
async def root():
    return {"message": "Hot Tub Calculator API"}


@router.get("/prices")
async def get_prices():
    """Get current pricing"""
    prices = await db.prices.find_one({"_id": "default"})
    if not prices:
        await db.prices.insert_one({"_id": "default", **default_balia_prices})
        return default_balia_prices
    
    prices.pop('_id', None)
    
    # Ensure critical fields are arrays
    if not isinstance(prices.get('models'), list):
        prices['models'] = default_balia_prices.get('models', [])
    if not isinstance(prices.get('categories'), list):
        prices['categories'] = default_balia_prices.get('categories', [])
    
    # Merge hints from defaults if missing in DB data
    default_model_hints = {m['id']: m.get('hint', '') for m in default_balia_prices.get('models', [])}
    default_option_hints = {}
    for cat in default_balia_prices.get('categories', []):
        for opt in cat.get('options', []):
            default_option_hints[opt['id']] = opt.get('hint', '')
    
    # Add hints to models if missing
    for model in prices.get('models', []):
        if not model.get('hint') and model.get('id') in default_model_hints:
            model['hint'] = default_model_hints[model['id']]
    
    # Add hints to options if missing
    for category in prices.get('categories', []):
        for option in category.get('options', []):
            if not option.get('hint') and option.get('id') in default_option_hints:
                option['hint'] = default_option_hints[option['id']]
    
    # Ensure currency fields exist
    prices.setdefault('currency', 'EUR')
    prices.setdefault('currencySymbol', '€')
    
    return prices


@router.post("/prices")
async def update_prices(prices: PriceData):
    """Update pricing"""
    price_dict = prices.model_dump()
    await db.prices.update_one(
        {"_id": "default"},
        {"$set": price_dict},
        upsert=True
    )
    return {"message": "Prices updated successfully"}


@router.post("/orders", response_model=Order)
async def create_order(order: Order):
    """Create a new order"""
    order_dict = order.model_dump()
    await db.orders.insert_one(order_dict)
    return order


@router.get("/orders", response_model=List[Order])
async def get_orders():
    """Get all orders"""
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    return orders


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    """Delete an order"""
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted successfully"}


@router.post("/generate-pdf")
async def generate_pdf(request: PDFRequest):
    """Generate professional PDF order form for Balia - Polish only"""
    import urllib.request
    from PIL import Image as PILImage
    
    buffer = io.BytesIO()
    
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except Exception as e:
        logger.warning(f"Could not register fonts: {e}")
    
    # Colors - Blue theme for Balia (water theme)
    BLUE = colors.HexColor('#2563EB')
    BLUE_LIGHT = colors.HexColor('#EFF6FF')
    BLUE_DARK = colors.HexColor('#1E40AF')
    BLUE_BORDER = colors.HexColor('#93C5FD')
    GREEN = colors.HexColor('#059669')
    GREEN_LIGHT = colors.HexColor('#ECFDF5')
    TEXT_COLOR = colors.HexColor('#1F2937')
    MUTED = colors.HexColor('#6B7280')
    WHITE = colors.white
    
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                          rightMargin=20, leftMargin=20,
                          topMargin=20, bottomMargin=20)
    
    elements = []
    styles = getSampleStyleSheet()
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        fontName='DejaVuSans-Bold',
        fontSize=13,
        textColor=BLUE_DARK,
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
    
    # Use orderId if provided, otherwise generate new number
    if request.orderId and request.orderId.startswith('WMB-'):
        offer_number = request.orderId
    else:
        offer_number = f"WMB-{datetime.now().strftime('%d-%m-%Y-%H%M%S')}"
    currency = request.currency or 'EUR'
    
    # Load model image if provided - preserve aspect ratio
    model_img = None
    model_image_url = getattr(request, 'modelImageUrl', None)
    if model_image_url:
        try:
            img_data = None
            
            # Extract filename from URL (works for both external and relative URLs)
            if '/api/uploads/' in model_image_url:
                filename = model_image_url.split('/api/uploads/')[-1]
                local_path = f'/app/backend/uploads/{filename}'
                if os.path.exists(local_path):
                    with open(local_path, 'rb') as f:
                        img_data = f.read()
                    logger.info(f"Loaded model image from local file: {local_path}")
            
            # Fallback to HTTP download if local file not found
            if not img_data and model_image_url.startswith('http'):
                try:
                    img_data = urllib.request.urlopen(model_image_url, timeout=5).read()
                    logger.info(f"Downloaded model image from URL: {model_image_url}")
                except Exception as e:
                    logger.warning(f"Could not download image from URL: {e}")
            
            if img_data:
                # Get original image dimensions to preserve aspect ratio
                from PIL import Image as PILImage
                img_buffer = io.BytesIO(img_data)
                pil_img = PILImage.open(img_buffer)
                orig_width, orig_height = pil_img.size
                
                # Calculate scaled dimensions (max width 160, preserve ratio)
                max_width = 160
                max_height = 120
                ratio = min(max_width / orig_width, max_height / orig_height)
                new_width = orig_width * ratio
                new_height = orig_height * ratio
                
                img_buffer.seek(0)
                model_img = RLImage(img_buffer, width=new_width, height=new_height)
        except Exception as e:
            logger.warning(f"Could not load model image: {e}")
    
    # ========== HEADER - styled WM-BALIA text ==========
    logo_style = ParagraphStyle(
        'LogoStyle',
        fontName='DejaVuSans-Bold',
        fontSize=28,
        textColor=BLUE_DARK,
        leading=32,
    )
    logo_cell = Paragraph('<font color="#2563EB">WM</font><font color="#1E40AF">-BALIA</font>', logo_style)
    
    header_data = [[
        logo_cell,
        '',
        Paragraph('''<b>OFERTA HANDLOWA</b><br/>
        <font size="9" color="#6B7280">Tel: +48 732 111 111</font><br/>
        <font size="9" color="#6B7280">Email: wmbalia@gmail.com</font><br/>
        <font size="9" color="#6B7280">www.wm-balia.pl</font>''',
        ParagraphStyle('HeaderRight', fontName='DejaVuSans', fontSize=16, alignment=TA_RIGHT, textColor=BLUE))
    ]]
    header_table = Table(header_data, colWidths=[200, 130, 200])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BLUE_LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (0, 0), 10),
    ]))
    elements.append(header_table)
    
    # Divider line
    elements.append(Spacer(1, 4))
    elements.append(Table([['']], colWidths=[530], rowHeights=[3], style=[('BACKGROUND', (0,0), (0,0), BLUE)]))
    elements.append(Spacer(1, 10))
    
    # ========== CLIENT + OFFER INFO ==========
    client_info = Paragraph(f'''<b>DANE KLIENTA:</b><br/>
    Imię i nazwisko: {request.fullName}<br/>
    Telefon: {request.phoneNumber}<br/>
    Adres: {request.fullAddress}''', 
    ParagraphStyle('ClientInfo', fontName='DejaVuSans', fontSize=9, textColor=TEXT_COLOR))
    
    offer_info = Paragraph(f'''<b>INFORMACJE O OFERCIE:</b><br/>
    Data wystawienia: {current_date}<br/>
    Ważność oferty: {valid_until}<br/>
    <b>Nr oferty: {offer_number}</b>''',
    ParagraphStyle('OfferInfo', fontName='DejaVuSans', fontSize=9, textColor=TEXT_COLOR, alignment=TA_RIGHT))
    
    info_table = Table([[client_info, offer_info]], colWidths=[265, 265])
    info_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BLUE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 12))
    
    # ========== MODEL SECTION WITH IMAGE - Polish name ==========
    if request.modelName or request.modelId:
        # Get Polish model name from DB
        model_name = request.modelName
        model_price = request.modelPrice or 0
        
        # Try to get Polish name from database
        if request.modelId:
            prices_data_for_model = await db.prices.find_one({"_id": "default"})
            if prices_data_for_model:
                for m in prices_data_for_model.get('models', []):
                    if m.get('id') == request.modelId:
                        model_name = m.get('namePl') or m.get('name', model_name)
                        break
        
        # Create model info content
        model_text = Paragraph(f'''<b><font size="14" color="#1E40AF">WYBRANY MODEL</font></b><br/><br/>
        <font size="12"><b>{model_name}</b></font><br/><br/>
        <font size="11">Cena bazowa: <b>{model_price:,.0f} {currency}</b></font>'''.replace(',', ' '),
        ParagraphStyle('ModelText', fontName='DejaVuSans', fontSize=11, textColor=TEXT_COLOR))
        
        if model_img:
            model_data = [[model_img, model_text]]
            model_table = Table(model_data, colWidths=[170, 350])
        else:
            model_data = [[model_text]]
            model_table = Table(model_data, colWidths=[520])
        
        model_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BLUE_LIGHT),
            ('BOX', (0, 0), (-1, -1), 2, BLUE),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(model_table)
        elements.append(Spacer(1, 12))
    
    # ========== SELECTED OPTIONS - Always in Polish ==========
    if request.selectedOptions and len(request.selectedOptions) > 0:
        elements.append(Paragraph('<b>WYBRANE OPCJE</b>', section_title_style))
        elements.append(Spacer(1, 6))
        
        # Load prices from DB to get Polish names
        prices_data = await db.prices.find_one({"_id": "default"})
        categories_map = {}
        if prices_data:
            for cat in prices_data.get('categories', []):
                cat_id = cat.get('id')
                cat_name_pl = cat.get('namePl') or cat.get('name', '')
                options_map = {}
                for opt in cat.get('options', []):
                    opt_id = opt.get('id')
                    opt_name_pl = opt.get('namePl') or opt.get('name', '')
                    options_map[opt_id] = opt_name_pl
                categories_map[cat_id] = {'name': cat_name_pl, 'options': options_map}
        
        options_data = [['Kategoria', 'Wybrana opcja', 'Cena']]
        total_options_price = 0
        
        for opt in request.selectedOptions:
            cat_id = opt.get('categoryId', '')
            opt_id = opt.get('optionId', '')
            price = opt.get('price', 0)
            total_options_price += price
            
            # Get Polish names from DB, fallback to provided names
            cat_info = categories_map.get(cat_id, {})
            cat_name = cat_info.get('name', opt.get('categoryName', ''))
            opt_name = cat_info.get('options', {}).get(opt_id, opt.get('optionName', ''))
            
            price_str = f"+{price:,.0f} {currency}".replace(',', ' ') if price > 0 else 'W cenie'
            options_data.append([cat_name, opt_name, price_str])
        
        # Add subtotal row for options
        if total_options_price > 0:
            options_data.append(['', 'Opcje razem:', f"+{total_options_price:,.0f} {currency}".replace(',', ' ')])
        
        options_table = Table(options_data, colWidths=[160, 260, 100])
        options_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            # Body
            ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_COLOR),
            ('ALIGN', (2, 1), (2, -1), 'RIGHT'),
            # Subtotal row
            ('FONTNAME', (1, -1), (-1, -1), 'DejaVuSans-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), BLUE_LIGHT),
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, BLUE_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            # Alternate row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [WHITE, colors.HexColor('#F9FAFB')]),
        ]))
        elements.append(options_table)
        elements.append(Spacer(1, 12))
    
    # ========== NOTES ==========
    if request.notes:
        elements.append(Paragraph('<b>UWAGI DODATKOWE</b>', section_title_style))
        elements.append(Spacer(1, 4))
        notes_para = Paragraph(request.notes, normal_style)
        notes_table = Table([[notes_para]], colWidths=[520])
        notes_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F9FAFB')),
            ('BOX', (0, 0), (-1, -1), 1, MUTED),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(notes_table)
        elements.append(Spacer(1, 12))
    
    # ========== DISCOUNT SECTION (if applicable) ==========
    discount_percent = getattr(request, 'discountPercent', 0) or 0
    subtotal = getattr(request, 'subtotal', request.total / (1 - discount_percent/100) if discount_percent else request.total) or request.total
    total_after_discount = request.total
    
    if discount_percent > 0:
        savings = subtotal - total_after_discount
        discount_section = Paragraph(f'''<b><font color="#059669" size="13">ZASTOSOWANY RABAT</font></b><br/><br/>
        <font size="11">Cena przed rabatem: <b>{subtotal:,.2f} {currency}</b></font><br/>
        <font size="12" color="#059669"><b>Rabat: {discount_percent:.0f}%</b></font><br/>
        <font size="11">Kwota rabatu: <b>-{savings:,.2f} {currency}</b></font><br/><br/>
        <font size="10" color="#059669"><i>Oszczędzasz: {savings:,.2f} {currency}</i></font>'''.replace(',', ' '),
        ParagraphStyle('DiscountSection', fontName='DejaVuSans', fontSize=11))
        
        discount_table = Table([[discount_section]], colWidths=[520])
        discount_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), GREEN_LIGHT),
            ('BOX', (0, 0), (-1, -1), 2, GREEN),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ]))
        elements.append(discount_table)
        elements.append(Spacer(1, 12))
    
    # ========== TOTAL ==========
    elements.append(Spacer(1, 10))
    
    # Build total section with discount info if applicable
    if discount_percent > 0:
        total_html = f'''<font size="14"><b>SUMA DO ZAPŁATY:</b></font><br/>
        <font size="9" color="#EFF6FF">Rabat: {discount_percent:.0f}% (cena przed rabatem: {subtotal:,.2f} {currency})</font>'''.replace(',', ' ')
    else:
        total_html = f'''<font size="14"><b>SUMA DO ZAPŁATY:</b></font>'''
    
    total_data = [[
        Paragraph(total_html, 
                 ParagraphStyle('TotalLabel', fontName='DejaVuSans-Bold', fontSize=14, textColor=WHITE)),
        Paragraph(f'''<font size="18"><b>{total_after_discount:,.2f} {currency}</b></font>'''.replace(',', ' '),
                 ParagraphStyle('TotalValue', fontName='DejaVuSans-Bold', fontSize=18, textColor=WHITE, alignment=TA_RIGHT))
    ]]
    total_table = Table(total_data, colWidths=[300, 220])
    total_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BLUE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(total_table)
    
    # ========== FOOTER ==========
    elements.append(Spacer(1, 20))
    footer_text = Paragraph('''<font size="8" color="#6B7280">
    Dziękujemy za zainteresowanie naszą ofertą. W razie pytań prosimy o kontakt.<br/>
    Oferta nie stanowi oferty handlowej w rozumieniu Kodeksu Cywilnego.
    </font>''', ParagraphStyle('Footer', fontName='DejaVuSans', fontSize=8, textColor=MUTED, alignment=TA_CENTER))
    elements.append(footer_text)
    
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    # Use offer_number as filename
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={offer_number}.pdf"}
    )
