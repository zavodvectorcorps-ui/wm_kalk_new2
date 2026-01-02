"""Balia calculator routes."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from datetime import datetime, timedelta
from urllib.parse import quote
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
    
    # === MERGE MISSING CATEGORIES FROM DEFAULTS ===
    # Get existing category IDs
    existing_cat_ids = {cat.get('id') for cat in prices.get('categories', [])}
    
    # Add missing categories from defaults (e.g., bowl_material, fiberglass_color, acrylic_color)
    categories_added = False
    for default_cat in default_balia_prices.get('categories', []):
        if default_cat.get('id') not in existing_cat_ids:
            prices['categories'].append(default_cat)
            categories_added = True
            logger.info(f"Added missing category from defaults: {default_cat.get('id')}")
    
    # Sort categories by sortOrder after adding new ones
    if categories_added:
        prices['categories'].sort(key=lambda c: c.get('sortOrder', 999))
        # Save the updated categories to DB
        await db.prices.update_one(
            {"_id": "default"},
            {"$set": {"categories": prices['categories']}}
        )
    
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


@router.get("/prices/export")
async def export_prices():
    """Export prices to Excel file"""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    
    prices = await db.prices.find_one({"_id": "default"})
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    
    wb = Workbook()
    
    # Styles
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    section_fill = PatternFill(start_color="D6DCE5", end_color="D6DCE5", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # === Sheet 1: Models ===
    ws_models = wb.active
    ws_models.title = "Modele"
    
    # Header
    model_headers = ["ID", "Nazwa (RU)", "Nazwa (PL)", "Typ печi", "Zakup EUR", "Marża %", "Cena PLN", "Kolor HEX"]
    for col, header in enumerate(model_headers, 1):
        cell = ws_models.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center')
        cell.border = thin_border
    
    row = 2
    for model in prices.get('models', []):
        model_name_ru = model.get('nameRu', model.get('name', ''))
        model_name_pl = model.get('namePl', model.get('name', ''))
        
        for variant in model.get('heaterVariants', []):
            ws_models.cell(row=row, column=1, value=model.get('id', '')).border = thin_border
            ws_models.cell(row=row, column=2, value=model_name_ru).border = thin_border
            ws_models.cell(row=row, column=3, value=model_name_pl).border = thin_border
            ws_models.cell(row=row, column=4, value=variant.get('type', '')).border = thin_border
            ws_models.cell(row=row, column=5, value=variant.get('purchasePriceEur', 0)).border = thin_border
            ws_models.cell(row=row, column=6, value=variant.get('markupPercent', 30)).border = thin_border
            ws_models.cell(row=row, column=7, value=variant.get('price', 0)).border = thin_border
            ws_models.cell(row=row, column=8, value=variant.get('colorPreview', '')).border = thin_border
            row += 1
    
    # Auto-width columns
    for col in range(1, len(model_headers) + 1):
        ws_models.column_dimensions[chr(64 + col)].width = 15
    
    # === Sheet 2: Options ===
    ws_options = wb.create_sheet("Opcje")
    
    option_headers = ["Kategoria ID", "Kategoria (RU)", "Opcja ID", "Opcja (RU)", "Opcja (PL)", "Zakup EUR", "Marża %", "Cena PLN", "Kolor HEX"]
    for col, header in enumerate(option_headers, 1):
        cell = ws_options.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center')
        cell.border = thin_border
    
    row = 2
    for category in prices.get('categories', []):
        cat_id = category.get('id', '')
        cat_name_ru = category.get('nameRu', category.get('name', ''))
        
        for option in category.get('options', []):
            ws_options.cell(row=row, column=1, value=cat_id).border = thin_border
            ws_options.cell(row=row, column=2, value=cat_name_ru).border = thin_border
            ws_options.cell(row=row, column=3, value=option.get('id', '')).border = thin_border
            ws_options.cell(row=row, column=4, value=option.get('nameRu', option.get('name', ''))).border = thin_border
            ws_options.cell(row=row, column=5, value=option.get('namePl', '')).border = thin_border
            ws_options.cell(row=row, column=6, value=option.get('purchasePriceEur', 0)).border = thin_border
            ws_options.cell(row=row, column=7, value=option.get('markupPercent', 30)).border = thin_border
            ws_options.cell(row=row, column=8, value=option.get('price', 0)).border = thin_border
            ws_options.cell(row=row, column=9, value=option.get('colorPreview', '')).border = thin_border
            row += 1
    
    # Auto-width columns
    for col in range(1, len(option_headers) + 1):
        ws_options.column_dimensions[chr(64 + col)].width = 18
    
    # === Sheet 3: Settings ===
    ws_settings = wb.create_sheet("Ustawienia")
    
    ws_settings.cell(row=1, column=1, value="Parametr").font = header_font
    ws_settings.cell(row=1, column=1).fill = header_fill
    ws_settings.cell(row=1, column=2, value="Wartość").font = header_font
    ws_settings.cell(row=1, column=2).fill = header_fill
    
    settings = [
        ("Waluta", prices.get('currency', 'PLN')),
        ("Symbol waluty", prices.get('currencySymbol', 'zł')),
        ("Kurs EUR", prices.get('eurRate', 4.30)),
        ("Domyślna marża %", prices.get('defaultMarkupPercent', 30)),
    ]
    
    for row, (param, value) in enumerate(settings, 2):
        ws_settings.cell(row=row, column=1, value=param).border = thin_border
        ws_settings.cell(row=row, column=2, value=value).border = thin_border
    
    ws_settings.column_dimensions['A'].width = 20
    ws_settings.column_dimensions['B'].width = 15
    
    # Save to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    filename = f"cennik_balia_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


from fastapi import UploadFile, File

@router.post("/prices/import")
async def import_prices(file: UploadFile = File(...)):
    """Import prices from Excel file"""
    from openpyxl import load_workbook
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        contents = await file.read()
        buffer = io.BytesIO(contents)
        wb = load_workbook(buffer, read_only=True)
        
        # Get current prices
        prices = await db.prices.find_one({"_id": "default"})
        if not prices:
            prices = {}
        
        updated_models = 0
        updated_options = 0
        updated_settings = 0
        
        # === Import Models ===
        if "Modele" in wb.sheetnames:
            ws = wb["Modele"]
            models = prices.get('models', [])
            
            for row in ws.iter_rows(min_row=2, values_only=True):
                if not row[0]:  # Skip empty rows
                    continue
                    
                model_id, name_ru, name_pl, heater_type, purchase_eur, markup, price, color = row[:8]
                
                # Find and update model
                for model in models:
                    if model.get('id') == model_id:
                        # Update variant
                        for variant in model.get('heaterVariants', []):
                            if variant.get('type') == heater_type:
                                if purchase_eur is not None:
                                    variant['purchasePriceEur'] = float(purchase_eur or 0)
                                if markup is not None:
                                    variant['markupPercent'] = float(markup or 30)
                                if price is not None:
                                    variant['price'] = float(price or 0)
                                if color:
                                    variant['colorPreview'] = str(color)
                                updated_models += 1
                        break
            
            prices['models'] = models
        
        # === Import Options ===
        if "Opcje" in wb.sheetnames:
            ws = wb["Opcje"]
            categories = prices.get('categories', [])
            
            for row in ws.iter_rows(min_row=2, values_only=True):
                if not row[0]:  # Skip empty rows
                    continue
                
                cat_id, cat_name, opt_id, opt_name_ru, opt_name_pl, purchase_eur, markup, price, color = row[:9]
                
                # Find and update option
                for category in categories:
                    if category.get('id') == cat_id:
                        for option in category.get('options', []):
                            if option.get('id') == opt_id:
                                if purchase_eur is not None:
                                    option['purchasePriceEur'] = float(purchase_eur or 0)
                                if markup is not None:
                                    option['markupPercent'] = float(markup or 30)
                                if price is not None:
                                    option['price'] = float(price or 0)
                                if color:
                                    option['colorPreview'] = str(color)
                                updated_options += 1
                                break
                        break
            
            prices['categories'] = categories
        
        # === Import Settings ===
        if "Ustawienia" in wb.sheetnames:
            ws = wb["Ustawienia"]
            
            for row in ws.iter_rows(min_row=2, values_only=True):
                if not row[0]:
                    continue
                    
                param, value = row[:2]
                
                if param == "Waluta":
                    prices['currency'] = str(value)
                    updated_settings += 1
                elif param == "Symbol waluty":
                    prices['currencySymbol'] = str(value)
                    updated_settings += 1
                elif param == "Kurs EUR":
                    prices['eurRate'] = float(value or 4.30)
                    updated_settings += 1
                elif param == "Domyślna marża %":
                    prices['defaultMarkupPercent'] = float(value or 30)
                    updated_settings += 1
        
        # Save to database
        await db.prices.update_one(
            {"_id": "default"},
            {"$set": prices},
            upsert=True
        )
        
        return {
            "message": "Import successful",
            "updated_models": updated_models,
            "updated_options": updated_options,
            "updated_settings": updated_settings
        }
        
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=400, detail=f"Error importing file: {str(e)}")


@router.post("/generate-production-excel")
async def generate_production_excel(request: dict):
    """Generate production Excel with selected options marked with X"""
    from openpyxl import load_workbook
    from openpyxl.styles import Font, Alignment
    
    # Load template
    template_path = os.path.join(os.path.dirname(__file__), '..', 'templates', 'production_template.xlsx')
    if not os.path.exists(template_path):
        raise HTTPException(status_code=500, detail="Production template not found")
    
    wb = load_workbook(template_path)
    ws = wb.active
    
    # Style for X marks
    x_font = Font(bold=True, size=14)
    x_align = Alignment(horizontal='center', vertical='center')
    
    # Customer data
    ws['B2'] = request.get('fullName', '')
    ws['B4'] = request.get('fullAddress', '')
    
    # Mapping of calculator option IDs to Excel cells
    # Row 10 - Heater type, colors, lid, wood finish
    heater_mapping = {
        'external': 'B10',
        'integrated': 'C10',
    }
    
    fiberglass_color_mapping = {
        'fg_white': 'D10',
        'fg_ivory': 'E10',
        'fg_blue': 'F10',
        'fg_gray': 'G10',
        'fg_pearl_red': 'H10',
        'fg_pearl_blue': 'I10',
        'fg_pearl_brown': 'J10',
        'fg_pearl_gray': 'K10',
        'fg_pearl_white': 'L10',
        'fg_galaxy': 'M10',
        'fg_snowflake': 'N10',
        'fg_emerald': 'O10',
        'fg_black_gold': 'P10',
        'fg_black_pink': 'Q10',
        'fg_black_silver': 'R10',
    }
    
    acrylic_color_mapping = {
        'ac_white': 'V10',
        'ac_green_marble': 'W10',
        'ac_brown_marble': 'X10',
        'ac_blue_marble': 'Y10',
        'ac_white_marble': 'Z10',
        'ac_coffee_marble': 'AA10',
        'ac_black_marble': 'AB10',
    }
    
    lid_mapping = {
        'glass_fiber_lid': 'AD10',
        'spa_lid': 'AE10',
    }
    
    wood_finish_mapping = {
        'natural': 'AF10',
        'painted': 'AG10',
        'oiled': 'AH10',
    }
    
    # Row 16 - Accessories, model, wood type
    accessories_mapping = {
        # Hydromassage options
        'hydromassage_basic': 'B16',
        'hydromassage_premium': 'B16',
        # Air bubble
        'air_bubble_yes': 'C16',
        # LED options
        'outside_led_12': 'D16',
        'inside_led_1': 'E16',
        'inside_led_2': 'F16',
        'inside_led_3': 'G16',
        'outside_led_stripe': 'H16',
        'inside_led_mini': 'I16',
        # Other accessories
        'insulation_yes': 'J16',
        'head_pillow': 'K16',
        'sand_filter': 'L16',
        'sand_filter_crane': 'M16',
        'sand_filter_stairs': 'N16',
        'sand_filter_box': 'O16',
        'v4a_heater': 'P16',
        'electricity_box': 'Q16',
        'chimney_extension': 'R16',
        'extra_chimney': 'S16',
        'bluetooth_radio': 'T16',
        'electric_heater': 'U16',
        'electric_thermometer': 'V16',
    }
    
    model_mapping = {
        'round_200': 'Y16',
        'round_225': 'Z16',
        'square_170x200': 'AA16',
        'square_220x220': 'AB16',
        'square_230x230': 'AC16',
        'square_245x245': 'AD16',
    }
    
    wood_type_mapping = {
        'spruce': 'AE16',
        'thermo': 'AF16',
        'wpc': 'AG16',
        'red_cedric': 'AH16',
    }
    
    def mark_cell(cell_ref):
        """Put X in specified cell"""
        ws[cell_ref] = 'X'
        ws[cell_ref].font = x_font
        ws[cell_ref].alignment = x_align
    
    # Process heater type
    heater_type = request.get('selectedHeaterType', '')
    if heater_type in heater_mapping:
        mark_cell(heater_mapping[heater_type])
    
    # Process model
    model_id = request.get('modelId', '')
    if model_id in model_mapping:
        mark_cell(model_mapping[model_id])
    
    # Process selected options
    selected_options = request.get('selectedOptions', [])
    selections = request.get('selections', {})
    
    # Process selections dict (category_id -> option_id or {option_id: true})
    for cat_id, selection in selections.items():
        if cat_id == 'bowl_material':
            # Material type (fiberglass or acrylic) - just note which type
            continue
        elif cat_id == 'fiberglass_color':
            if selection in fiberglass_color_mapping:
                mark_cell(fiberglass_color_mapping[selection])
        elif cat_id == 'acrylic_color':
            if selection in acrylic_color_mapping:
                mark_cell(acrylic_color_mapping[selection])
        elif cat_id == 'lid':
            if selection in lid_mapping:
                mark_cell(lid_mapping[selection])
        elif cat_id == 'wood_finish':
            if selection in wood_finish_mapping:
                mark_cell(wood_finish_mapping[selection])
        elif cat_id == 'wood_type':
            if selection in wood_type_mapping:
                mark_cell(wood_type_mapping[selection])
        elif isinstance(selection, dict):
            # Checkbox type - multiple selections
            for opt_id, is_selected in selection.items():
                if is_selected:
                    if opt_id in accessories_mapping:
                        mark_cell(accessories_mapping[opt_id])
        else:
            # Radio type - single selection
            if selection in accessories_mapping:
                mark_cell(accessories_mapping[selection])
    
    # Also check selectedOptions array for backward compatibility
    for opt in selected_options:
        opt_id = opt.get('id', '') if isinstance(opt, dict) else str(opt)
        
        # Check all mappings
        all_mappings = {
            **fiberglass_color_mapping,
            **acrylic_color_mapping,
            **lid_mapping,
            **wood_finish_mapping,
            **accessories_mapping,
            **model_mapping,
            **wood_type_mapping,
        }
        
        if opt_id in all_mappings:
            mark_cell(all_mappings[opt_id])
    
    # Add notes if present
    notes = request.get('notes', '')
    if notes:
        ws['B18'] = notes
    
    # Save to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    # Generate filename
    safe_name = (request.get('fullName', 'Zamowienie') or 'Zamowienie').replace(' ', '_')
    safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '_')
    order_id = request.get('orderId', request.get('id', 'new'))
    filename = f"TechSpec_{safe_name}_{order_id}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={quote(filename)}"}
    )


@router.post("/clear-images")
async def clear_all_images():
    """Clear all image URLs from models and options"""
    prices = await db.prices.find_one({"_id": "default"})
    if not prices:
        return {"message": "No prices found"}
    
    # Clear model images
    models = prices.get('models', [])
    for model in models:
        model['imageUrl'] = ''
    
    # Clear category and option images
    categories = prices.get('categories', [])
    for category in categories:
        category['imageUrl'] = ''
        for option in category.get('options', []):
            option['imageUrl'] = ''
    
    # Update database
    await db.prices.update_one(
        {"_id": "default"},
        {"$set": {"models": models, "categories": categories}}
    )
    
    return {"message": "All Balia images cleared successfully", "models_cleared": len(models), "categories_cleared": len(categories)}


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


@router.get("/orders/{order_id}")
async def get_order(order_id: str):
    """Get a single order by ID"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/orders/{order_id}")
async def update_order(order_id: str, order: Order):
    """Update an existing order"""
    order_dict = order.model_dump()
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": order_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


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
    import base64
    from PIL import Image as PILImage
    
    async def load_image_from_mongodb(image_url: str) -> bytes:
        """Load image from MongoDB by extracting ID from URL"""
        if not image_url or '/api/uploads/' not in image_url:
            return None
        try:
            filename = image_url.split('/api/uploads/')[-1]
            file_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
            image_doc = await db.images.find_one({"id": file_id})
            if image_doc:
                return base64.b64decode(image_doc["content"])
        except Exception as e:
            logger.warning(f"Could not load image from MongoDB: {e}")
        return None
    
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
    
    # Load model image if provided - from MongoDB or external URL
    model_img = None
    model_image_url = getattr(request, 'modelImageUrl', None)
    if model_image_url:
        try:
            img_data = None
            
            # Try loading from MongoDB first
            if '/api/uploads/' in model_image_url:
                img_data = await load_image_from_mongodb(model_image_url)
                if img_data:
                    logger.info(f"Loaded model image from MongoDB")
            
            # Fallback to HTTP download for external URLs
            if not img_data and model_image_url.startswith('http'):
                try:
                    img_data = urllib.request.urlopen(model_image_url, timeout=5).read()
                    logger.info(f"Downloaded model image from URL: {model_image_url}")
                except Exception as e:
                    logger.warning(f"Could not download image from URL: {e}")
            
            if img_data:
                # Get original image dimensions to preserve aspect ratio
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
        # Get Polish model name and specs from DB
        model_name = request.modelName
        model_price = request.modelPrice or 0
        model_specs = None
        
        # Try to get Polish name and specs from database
        if request.modelId:
            prices_data_for_model = await db.prices.find_one({"_id": "default"})
            if prices_data_for_model:
                for m in prices_data_for_model.get('models', []):
                    if m.get('id') == request.modelId:
                        model_name = m.get('namePl') or m.get('name', model_name)
                        model_specs = m.get('specs')
                        break
        
        # Create model info content with specs
        specs_text = ""
        if model_specs:
            specs_lines = []
            if model_specs.get('outerDiameter'):
                specs_lines.append(f"Średnica zewnętrzna: {model_specs['outerDiameter']}")
            if model_specs.get('innerDiameter'):
                specs_lines.append(f"Średnica wewnętrzna: {model_specs['innerDiameter']}")
            if model_specs.get('dimensions'):
                specs_lines.append(f"Wymiary: {model_specs['dimensions']}")
            if model_specs.get('depth'):
                specs_lines.append(f"Głębokość: {model_specs['depth']}")
            if model_specs.get('volume'):
                specs_lines.append(f"Pojemność: {model_specs['volume']}")
            if model_specs.get('seats') and model_specs.get('seats') > 0:
                specs_lines.append(f"Ilość miejsc: {model_specs['seats']}")
            if model_specs.get('totalHeight') and model_specs.get('totalHeight') not in [0, '0']:
                specs_lines.append(f"Wysokość całkowita: {model_specs['totalHeight']}")
            if model_specs.get('heaterPower') and model_specs.get('heaterPower') not in [0, '0']:
                specs_lines.append(f"Moc pieca: {model_specs['heaterPower']}")
            if model_specs.get('weight'):
                specs_lines.append(f"Waga (pusta): {model_specs['weight']}")
            
            if specs_lines:
                specs_text = "<br/><br/><font size='9' color='#6B7280'>" + " | ".join(specs_lines) + "</font>"
        
        model_text = Paragraph(f'''<b><font size="14" color="#1E40AF">WYBRANY MODEL</font></b><br/><br/>
        <font size="12"><b>{model_name}</b></font><br/><br/>
        <font size="11">Cena bazowa: <b>{model_price:,.0f} {currency}</b></font>{specs_text}'''.replace(',', ' '),
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
    
    # ========== SELECTED OPTIONS WITH IMAGES - Always in Polish ==========
    # Get admin gifts list if available
    admin_gifts = getattr(request, 'adminGifts', []) or []
    
    if request.selectedOptions and len(request.selectedOptions) > 0:
        elements.append(Paragraph('<b>WYBRANE OPCJE</b>', section_title_style))
        elements.append(Spacer(1, 6))
        
        # Load prices from DB to get Polish names and images
        prices_data = await db.prices.find_one({"_id": "default"})
        categories_map = {}
        if prices_data:
            for cat in prices_data.get('categories', []):
                cat_id = cat.get('id')
                cat_name_pl = cat.get('namePl') or cat.get('name', '')
                cat_image_url = cat.get('imageUrl', '')
                options_map = {}
                for opt in cat.get('options', []):
                    opt_id = opt.get('id')
                    opt_name_pl = opt.get('namePl') or opt.get('name', '')
                    opt_image_url = opt.get('imageUrl', '')
                    options_map[opt_id] = {
                        'name': opt_name_pl,
                        'imageUrl': opt_image_url
                    }
                categories_map[cat_id] = {
                    'name': cat_name_pl, 
                    'imageUrl': cat_image_url,
                    'options': options_map
                }
        
        # Helper function to load and resize option image
        async def load_option_image(image_url: str, max_width: int = 60, max_height: int = 45):
            """Load option image from MongoDB or external URL"""
            if not image_url:
                return None
            try:
                img_data = None
                
                # Try loading from MongoDB first
                if '/api/uploads/' in image_url:
                    img_data = await load_image_from_mongodb(image_url)
                    if img_data:
                        logger.info(f"Loaded option image from MongoDB: {len(img_data)} bytes")
                
                # If not in MongoDB and it's a relative URL, try full external URL
                if not img_data and '/api/uploads/' in image_url:
                    try:
                        # Convert relative URL to absolute using API_URL env var or request URL
                        import os
                        base_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://sauna-quote.preview.emergentagent.com')
                        full_url = f"{base_url}{image_url}"
                        img_data = urllib.request.urlopen(full_url, timeout=10).read()
                        # Check if it's actually image data (not JSON error)
                        if img_data and len(img_data) > 100 and not img_data.startswith(b'{'):
                            logger.info(f"Downloaded option image from external URL: {len(img_data)} bytes")
                        else:
                            logger.warning(f"External URL returned non-image data: {image_url}")
                            img_data = None
                    except Exception as e:
                        logger.warning(f"Failed to download from external URL: {e}")
                
                # Try direct HTTP download for external URLs
                if not img_data and image_url.startswith('http'):
                    try:
                        img_data = urllib.request.urlopen(image_url, timeout=10).read()
                        if img_data and len(img_data) > 100:
                            logger.info(f"Downloaded option image from URL: {len(img_data)} bytes")
                    except Exception as e:
                        logger.warning(f"Failed to download option image: {e}")
                
                if img_data:
                    # Compress and resize image
                    img_buffer = io.BytesIO(img_data)
                    pil_img = PILImage.open(img_buffer)
                    
                    # Convert to RGB if necessary
                    if pil_img.mode in ('RGBA', 'P'):
                        pil_img = pil_img.convert('RGB')
                    
                    # Resize preserving aspect ratio
                    orig_width, orig_height = pil_img.size
                    ratio = min(max_width / orig_width, max_height / orig_height)
                    new_width = int(orig_width * ratio)
                    new_height = int(orig_height * ratio)
                    pil_img = pil_img.resize((new_width, new_height), PILImage.Resampling.LANCZOS)
                    
                    # Compress
                    output = io.BytesIO()
                    pil_img.save(output, format='JPEG', quality=70, optimize=True)
                    output.seek(0)
                    
                    logger.info(f"Option image processed: {new_width}x{new_height}")
                    return RLImage(output, width=new_width, height=new_height)
            except Exception as e:
                logger.warning(f"Could not load option image: {e}")
            return None
        
        options_data = [['', 'Kategoria', 'Wybrana opcja', 'Cena']]
        total_options_price = 0
        gifts_total = 0
        gift_rows = []  # Track which rows are gifts for styling
        
        # Style for gift price with strikethrough
        gift_price_style = ParagraphStyle(
            'GiftPrice',
            fontName='DejaVuSans',
            fontSize=9,
            textColor=colors.HexColor('#059669'),
            alignment=TA_RIGHT
        )
        normal_price_style = ParagraphStyle(
            'NormalPrice',
            fontName='DejaVuSans',
            fontSize=9,
            textColor=TEXT_COLOR,
            alignment=TA_RIGHT
        )
        
        for idx, opt in enumerate(request.selectedOptions):
            cat_id = opt.get('categoryId', '')
            opt_id = opt.get('optionId', '') or opt.get('id', '')
            price = opt.get('price', 0)
            
            # Check if this option is a gift
            is_gift = opt_id in admin_gifts
            
            if is_gift:
                gifts_total += price
            else:
                total_options_price += price
            
            # Get Polish names and images from DB, fallback to provided names
            cat_info = categories_map.get(cat_id, {})
            cat_name = cat_info.get('name', opt.get('categoryName', ''))
            opt_info = cat_info.get('options', {}).get(opt_id, {})
            opt_name = opt_info.get('name', opt.get('optionName', '') or opt.get('name', ''))
            
            # Get image URL - option image first, then category image as fallback
            opt_image_url = opt_info.get('imageUrl', '')
            cat_image_url = cat_info.get('imageUrl', '')
            image_url = opt_image_url or cat_image_url
            
            logger.info(f"Option {opt_id}: opt_image_url={opt_image_url}, cat_image_url={cat_image_url}, using={image_url}")
            
            # Load image
            option_img = await load_option_image(image_url)
            img_cell = option_img if option_img else ''
            
            if option_img:
                logger.info(f"Successfully loaded image for option {opt_id}")
            
            if is_gift:
                # Show as gift with strikethrough price and WM-Group label
                price_text = f"<strike>{price:,.0f} {currency}</strike><br/>🎁 Prezent od WM-Group".replace(',', ' ')
                price_cell = Paragraph(price_text, gift_price_style)
                gift_rows.append(idx + 1)  # +1 because of header row
            else:
                price_text = f"+{price:,.0f} {currency}".replace(',', ' ') if price > 0 else 'W cenie'
                price_cell = Paragraph(price_text, normal_price_style)
            
            options_data.append([img_cell, cat_name, opt_name, price_cell])
        
        # Add subtotal row for options
        if total_options_price > 0 or gifts_total > 0:
            options_data.append(['', '', 'Opcje razem:', f"+{total_options_price:,.0f} {currency}".replace(',', ' ')])
        
        options_table = Table(options_data, colWidths=[70, 130, 230, 90])
        
        # Build table style
        table_style = [
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
            ('ALIGN', (3, 1), (3, -1), 'RIGHT'),  # Price column
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # Image column
            ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),  # Vertical align all cells
            # Subtotal row
            ('FONTNAME', (2, -1), (-1, -1), 'DejaVuSans-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), BLUE_LIGHT),
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, BLUE_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            # Alternate row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [WHITE, colors.HexColor('#F9FAFB')]),
        ]
        
        # Highlight gift rows with green background
        for gift_row in gift_rows:
            table_style.append(('BACKGROUND', (0, gift_row), (-1, gift_row), colors.HexColor('#ECFDF5')))
            table_style.append(('TEXTCOLOR', (1, gift_row), (2, gift_row), colors.HexColor('#059669')))
        
        options_table.setStyle(TableStyle(table_style))
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
    
    # Generate filename: BALIA_ClientName_OrderId
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
    filename = f"BALIA_{safe_name}_{order_id}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )
