"""Balia calculator routes."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
import io
import logging

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER

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
    """Generate PDF order form"""
    buffer = io.BytesIO()
    
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
    
    lang = request.language if request.language in translations else 'ru'
    t = translations[lang]
    ft = feature_translations[lang]
    
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except Exception as e:
        logger.warning(f"Could not register fonts: {e}")
    
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                          rightMargin=20*mm, leftMargin=20*mm,
                          topMargin=20*mm, bottomMargin=20*mm)
    
    elements = []
    
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
    
    if request.type == 'customer':
        title = Paragraph(t['title_customer'], title_style)
    else:
        title = Paragraph(t['title_technical'], title_style)
    elements.append(title)
    elements.append(Spacer(1, 20))
    
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
    
    selected_features = [k for k, v in request.features.items() if v]
    if selected_features:
        elements.append(Paragraph(t['selected_features'], heading_style))
        features_text = '<br/>'.join([f'• {ft.get(feat, feat.replace("_", " ").title())}' for feat in selected_features])
        features_para = Paragraph(features_text, normal_style)
        elements.append(features_para)
        elements.append(Spacer(1, 20))
    
    if request.notes:
        elements.append(Paragraph(t['additional_notes'], heading_style))
        notes_para = Paragraph(request.notes, normal_style)
        elements.append(notes_para)
        elements.append(Spacer(1, 20))
    
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
    
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    try:
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
