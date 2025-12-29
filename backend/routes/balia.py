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
    
    offer_number = f"WMB-{datetime.now().strftime('%d-%m-%Y-%H%M%S')}"
    currency = request.currency or 'EUR'
    
    # Load logo
    logo_path = '/app/assets/logo7.png'
    logo_img = None
    if os.path.exists(logo_path):
        try:
            logo_img = RLImage(logo_path, width=180, height=36)
        except Exception as e:
            logger.warning(f"Could not load logo: {e}")
    
    # Load model image if provided
    model_img = None
    model_image_url = getattr(request, 'modelImageUrl', None)
    if model_image_url:
        try:
            # Download image from URL
            if model_image_url.startswith('http'):
                img_data = urllib.request.urlopen(model_image_url, timeout=5).read()
            else:
                # Local file
                img_path = model_image_url.replace('/api/uploads/', '/app/backend/uploads/')
                if os.path.exists(img_path):
                    with open(img_path, 'rb') as f:
                        img_data = f.read()
                else:
                    img_data = None
            
            if img_data:
                img_buffer = io.BytesIO(img_data)
                model_img = RLImage(img_buffer, width=150, height=100)
        except Exception as e:
            logger.warning(f"Could not load model image: {e}")
    
    # ========== HEADER ==========
    logo_cell = logo_img if logo_img else Paragraph('<b>WM-BALIA</b>', ParagraphStyle('Logo', fontName='DejaVuSans-Bold', fontSize=24, textColor=BLUE))
    
    header_data = [[
        logo_cell,
        '',
        Paragraph('''<b>OFERTA HANDLOWA</b><br/>
        <font size="9" color="#6B7280">Tel: +48 732 099 201</font><br/>
        <font size="9" color="#6B7280">Email: wmsauna@gmail.com</font><br/>
        <font size="9" color="#6B7280">www.wm-sauna.pl</font>''',
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
    
    # ========== MODEL SECTION WITH IMAGE ==========
    if request.modelName:
        model_name = request.modelName
        model_price = request.modelPrice or 0
        
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
    
    # ========== SELECTED OPTIONS ==========
    if request.selectedOptions and len(request.selectedOptions) > 0:
        elements.append(Paragraph('<b>WYBRANE OPCJE</b>', section_title_style))
        elements.append(Spacer(1, 6))
        
        options_data = [['Kategoria', 'Wybrana opcja', 'Cena']]
        total_options_price = 0
        
        for opt in request.selectedOptions:
            cat_name = opt.get('categoryName', '')
            opt_name = opt.get('optionName', '')
            price = opt.get('price', 0)
            total_options_price += price
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
    
    # ========== TOTAL ==========
    elements.append(Spacer(1, 10))
    total_data = [[
        Paragraph(f'''<font size="14"><b>SUMA DO ZAPŁATY:</b></font>''', 
                 ParagraphStyle('TotalLabel', fontName='DejaVuSans-Bold', fontSize=14, textColor=WHITE)),
        Paragraph(f'''<font size="16"><b>{request.total:,.0f} {currency}</b></font>'''.replace(',', ' '),
                 ParagraphStyle('TotalValue', fontName='DejaVuSans-Bold', fontSize=16, textColor=WHITE, alignment=TA_RIGHT))
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
    
    try:
        safe_filename = ''.join(c for c in request.fullName if c.isascii() and (c.isalnum() or c in '-_.'))
        if not safe_filename:
            safe_filename = "balia"
    except:
        safe_filename = "balia"
    
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=oferta_{safe_filename}.pdf"}
    )
