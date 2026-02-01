"""PDF section builders for sauna calculator."""
import io
import os
import logging
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle, Paragraph, Spacer, Image as RLImage, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

from services.pdf_helpers import (
    get_pdf_colors, 
    optimize_image_for_pdf, 
    load_image_from_mongodb,
    load_template_image,
    scale_image_proportionally,
    download_external_image
)

logger = logging.getLogger(__name__)


async def build_header_section(elements, pdf_template, template_texts, colors_dict, db, logo_img=None):
    """Build PDF header section with logo and company info."""
    header_title = template_texts.get('headerTitle', 'OFERTA HANDLOWA')
    
    # Try to load custom logo from template
    custom_logo_img = None
    if pdf_template.get('logoImageId'):
        logo_data = await load_template_image(db, pdf_template.get('logoImageId'))
        if logo_data:
            try:
                logo_buffer = io.BytesIO(logo_data)
                custom_logo_img = RLImage(logo_buffer, width=180, height=36)
            except Exception as e:
                logger.warning(f"Could not load custom logo: {e}")
    
    logo_cell = custom_logo_img or logo_img if logo_img else Paragraph(
        '<b>WM-SAUNA</b>', 
        ParagraphStyle('Logo', fontName='DejaVuSans-Bold', fontSize=24, textColor=colors_dict['BROWN'])
    )
    
    header_data = [[
        logo_cell,
        '',
        Paragraph(f'''<b>{header_title}</b><br/>
        <font size="9" color="#95856e">Tel: +48 732 099 201</font><br/>
        <font size="9" color="#95856e">Email: wmsauna@gmail.com</font><br/>
        <font size="9" color="#95856e">www.wm-sauna.pl</font>''',
        ParagraphStyle('HeaderRight', fontName='DejaVuSans', fontSize=16, alignment=TA_RIGHT, textColor=colors_dict['BROWN']))
    ]]
    
    header_table = Table(header_data, colWidths=[200, 130, 200])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors_dict['BROWN_LIGHT']),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (0, 0), 10),
    ]))
    
    elements.append(header_table)
    # Divider line
    elements.append(Spacer(1, 4))
    elements.append(Table([['']], colWidths=[530], rowHeights=[2], style=[('BACKGROUND', (0,0), (0,0), colors_dict['BROWN'])]))
    elements.append(Spacer(1, 8))


def build_client_info_section(elements, request, colors_dict, current_date, valid_until, offer_number):
    """Build client and offer info section."""
    email_line = f"Email: {request.email}<br/>" if hasattr(request, 'email') and request.email else ""
    
    client_info = Paragraph(f'''<b>DANE KLIENTA:</b><br/>
    Imię i nazwisko: {request.fullName}<br/>
    {email_line}Telefon: {request.phoneNumber}''', 
    ParagraphStyle('ClientInfo', fontName='DejaVuSans', fontSize=9, textColor=colors_dict['TEXT_COLOR']))
    
    offer_info = Paragraph(f'''<b>INFORMACJE O OFERCIE:</b><br/>
    Data wystawienia: {current_date}<br/>
    Ważność oferty: {valid_until}<br/>
    <b>Nr oferty: {offer_number}</b>''',
    ParagraphStyle('OfferInfo', fontName='DejaVuSans', fontSize=9, textColor=colors_dict['TEXT_COLOR'], alignment=TA_RIGHT))
    
    info_table = Table([[client_info, offer_info]], colWidths=[265, 265])
    info_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors_dict['BROWN']),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 8))


async def build_promo_section(elements, pdf_template, template_texts, colors_dict, db, 
                              discount_percent, subtotal, total_after_discount, promo_until, promo_img=None):
    """Build discount or promo section."""
    promo_title = template_texts.get('promoTitle', 'PROMOCJA')
    promo_text_content = template_texts.get('promoText', 'Darmowa balia do schłodzenia<br/>lub beczka z sauną!')
    
    # Try to load custom promo image from template
    custom_promo_img = None
    if pdf_template.get('promoImageId'):
        promo_data_bytes = await load_template_image(db, pdf_template.get('promoImageId'))
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
        <font size="12" color="#2D7A3E"><b>Rabat: {discount_percent:.0f}%</b></font><br/>
        <font size="11">Cena przed rabatem: {subtotal:,.0f} PLN</font><br/>
        <font size="11" color="#2D7A3E"><b>Cena po rabacie: {total_after_discount:,.0f} PLN</b></font><br/>
        <font size="10" color="#666666"><i>Oszczędzasz: {savings:,.0f} PLN</i></font>'''.replace(',', ' '),
        ParagraphStyle('Discount', fontName='DejaVuSans', fontSize=11))
        
        promo_table = Table([[discount_content]], colWidths=[530])
        promo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors_dict['GREEN_LIGHT']),
            ('BOX', (0, 0), (-1, -1), 2, colors_dict['GREEN']),
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
                ('BACKGROUND', (0, 0), (-1, -1), colors_dict['RED_LIGHT']),
                ('BOX', (0, 0), (-1, -1), 1.5, colors_dict['RED']),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
        else:
            promo_table = Table([[promo_text]], colWidths=[530])
            promo_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors_dict['RED_LIGHT']),
                ('BOX', (0, 0), (-1, -1), 1.5, colors_dict['RED']),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ]))
        elements.append(promo_table)
    elements.append(Spacer(1, 10))


def build_comment_section(elements, notes, colors_dict, section_title_style, normal_style):
    """Build comment section if notes are present."""
    if not notes:
        return
    
    elements.append(Paragraph('KOMENTARZ DO ZAMÓWIENIA', section_title_style))
    elements.append(Spacer(1, 4))
    comment_table = Table([[Paragraph(notes, normal_style)]], colWidths=[530])
    comment_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.8, colors_dict['BROWN']),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(comment_table)
    elements.append(Spacer(1, 8))


def build_total_section(elements, subtotal, discount_percent, total_after_discount, colors_dict, template_texts):
    """Build total price section."""
    warranty_text = template_texts.get('warrantyText', 'GWARANCJA: 12 miesiące od daty montażu')
    footer_text = template_texts.get('footerText', 'Oferta ważna 30 dni od daty wystawienia.')
    
    if discount_percent > 0:
        savings = subtotal - total_after_discount
        total_content = Paragraph(f'''<b><font size="16" color="#6B5038">RAZEM DO ZAPŁATY</font></b><br/><br/>
        <font size="10">Wartość przed rabatem: <strike>{subtotal:,.0f} PLN</strike></font><br/>
        <font size="10" color="#2D7A3E">Zastosowany rabat: -{discount_percent:.0f}% (-{savings:,.0f} PLN)</font><br/><br/>
        <font size="18" color="#2D7A3E"><b>{total_after_discount:,.0f} PLN</b></font><br/><br/>
        <font size="9" color="#888888">{warranty_text}<br/>{footer_text}</font>'''.replace(',', ' '),
        ParagraphStyle('TotalWithDiscount', fontName='DejaVuSans', fontSize=10, alignment=TA_CENTER))
    else:
        total_content = Paragraph(f'''<b><font size="16" color="#6B5038">RAZEM DO ZAPŁATY</font></b><br/><br/>
        <font size="18" color="#6B5038"><b>{total_after_discount:,.0f} PLN</b></font><br/><br/>
        <font size="9" color="#888888">{warranty_text}<br/>{footer_text}</font>'''.replace(',', ' '),
        ParagraphStyle('Total', fontName='DejaVuSans', fontSize=10, alignment=TA_CENTER))
    
    total_table = Table([[total_content]], colWidths=[530])
    total_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors_dict['BROWN_LIGHT']),
        ('BOX', (0, 0), (-1, -1), 2, colors_dict['BROWN']),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(total_table)


async def build_gallery_section(elements, pdf_template, template_texts, colors_dict, db, is_block_enabled_fn):
    """Build gallery section with images."""
    # Check if we need page break (only if gallery_promo was NOT shown)
    gallery_promo_shown = is_block_enabled_fn(pdf_template, 'gallery_promo') and (
        pdf_template.get('galleryPromoTitle') or pdf_template.get('galleryPromoImageId')
    )
    
    if not gallery_promo_shown:
        elements.append(PageBreak())
        gallery_title = template_texts.get('galleryTitle', 'GALERIA REALIZACJI')
        elements.append(Paragraph(gallery_title, 
                                 ParagraphStyle('GalleryTitle', fontName='DejaVuSans-Bold', fontSize=16, 
                                               textColor=colors_dict['BROWN'], alignment=TA_CENTER, spaceAfter=15)))
    
    # Load gallery images - first try from template, then fall back to default
    gallery_images = []
    template_gallery_ids = pdf_template.get('galleryImageIds', [])
    
    if template_gallery_ids:
        for img_id in template_gallery_ids[:6]:
            img_data = await load_template_image(db, img_id)
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
    
    # Create 3x2 grid of images
    if gallery_images:
        row_style = TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ])
        
        # First row
        row1_images = gallery_images[:3]
        if row1_images:
            while len(row1_images) < 3:
                row1_images.append('')
            row1 = Table([row1_images], colWidths=[176, 176, 176], rowHeights=[125])
            row1.setStyle(row_style)
            elements.append(row1)
            elements.append(Spacer(1, 8))
        
        # Second row
        if len(gallery_images) > 3:
            row2_images = gallery_images[3:6]
            while len(row2_images) < 3:
                row2_images.append('')
            row2 = Table([row2_images], colWidths=[176, 176, 176], rowHeights=[125])
            row2.setStyle(row_style)
            elements.append(row2)
    
    # Gallery footer
    company_slogan = template_texts.get('companySlogan', 'WM-Group — Producent saun i bali na wymiar')
    elements.append(Spacer(1, 15))
    elements.append(Paragraph(company_slogan, 
                             ParagraphStyle('GalleryFooter', fontName='DejaVuSans', fontSize=10, 
                                           textColor=colors_dict['MUTED'], alignment=TA_CENTER)))
