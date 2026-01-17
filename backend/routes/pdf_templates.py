"""PDF Template management routes."""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import os
import base64
from pymongo import MongoClient

router = APIRouter(prefix="/pdf-templates", tags=["pdf-templates"])

# MongoDB connection
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "wm_calculator")
client = MongoClient(mongo_url)
db = client[db_name]
templates_collection = db["pdf_templates"]
pdf_images_collection = db["pdf_images"]


class PDFBlock(BaseModel):
    id: str
    name: str
    enabled: bool = True
    order: int = 0


class PDFColors(BaseModel):
    primary: str = "#8B4513"  # Brown
    secondary: str = "#D2B48C"  # Light brown
    accent: str = "#CD853F"  # Peru
    text: str = "#333333"
    muted: str = "#666666"


class PDFTexts(BaseModel):
    headerTitle: str = "OFERTA HANDLOWA"
    promoTitle: str = "PROMOCJA"
    promoText: str = "Darmowa balia do schłodzenia<br/>lub beczka z sauną!"
    warrantyText: str = "GWARANCJA: 12 miesiące od daty montażu"
    footerText: str = "Oferta ważna 30 dni od daty wystawienia."
    galleryTitle: str = "GALERIA REALIZACJI"
    companySlogan: str = "WM-Group — Producent saun i bali na wymiar"


class PDFTemplate(BaseModel):
    id: Optional[str] = None
    name: str
    calculator_type: str  # 'sauna' or 'balia'
    isDefault: bool = False
    blocks: List[PDFBlock] = []
    colors: PDFColors = PDFColors()
    texts: PDFTexts = PDFTexts()
    logoImageId: Optional[str] = None
    promoImageId: Optional[str] = None
    galleryImageIds: List[str] = []
    # Gallery promo block (before gallery collage)
    galleryPromoTitle: Optional[str] = None
    galleryPromoText: Optional[str] = None
    galleryPromoImageId: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class PDFTemplateCreate(BaseModel):
    name: str
    calculator_type: str
    isDefault: bool = False
    blocks: List[Dict[str, Any]] = []
    colors: Dict[str, str] = {}
    texts: Dict[str, str] = {}
    logoImageId: Optional[str] = None
    promoImageId: Optional[str] = None
    galleryImageIds: List[str] = []
    galleryPromoTitle: Optional[str] = None
    galleryPromoText: Optional[str] = None
    galleryPromoImageId: Optional[str] = None


class PDFTemplateUpdate(BaseModel):
    name: Optional[str] = None
    isDefault: Optional[bool] = None
    blocks: Optional[List[Dict[str, Any]]] = None
    colors: Optional[Dict[str, str]] = None
    texts: Optional[Dict[str, str]] = None
    logoImageId: Optional[str] = None
    promoImageId: Optional[str] = None
    galleryImageIds: Optional[List[str]] = None
    galleryPromoTitle: Optional[str] = None
    galleryPromoText: Optional[str] = None
    galleryPromoImageId: Optional[str] = None


# Default blocks configuration
DEFAULT_BLOCKS = [
    {"id": "header", "name": "Шапка с логотипом", "enabled": True, "order": 1},
    {"id": "client_info", "name": "Информация о клиенте", "enabled": True, "order": 2},
    {"id": "model_photo", "name": "Модель и фото", "enabled": True, "order": 3},
    {"id": "options", "name": "Опции", "enabled": True, "order": 4},
    {"id": "promo", "name": "Промо-блок с подарком", "enabled": True, "order": 5},
    {"id": "benches", "name": "Информация о лавках", "enabled": True, "order": 6},
    {"id": "total", "name": "Итого", "enabled": True, "order": 7},
    {"id": "gallery_promo", "name": "Промо-страница галереи", "enabled": True, "order": 8},
    {"id": "gallery", "name": "Коллаж галереи", "enabled": True, "order": 9},
    {"id": "footer", "name": "Футер", "enabled": True, "order": 10},
]


@router.get("")
async def get_templates(calculator_type: str = None):
    """Get all PDF templates, optionally filtered by calculator type."""
    query = {}
    if calculator_type:
        query["calculator_type"] = calculator_type
    
    templates = list(templates_collection.find(query, {"_id": 0}).sort("name", 1))
    return templates


@router.get("/default/{calculator_type}")
async def get_default_template(calculator_type: str):
    """Get the default template for a calculator type."""
    template = templates_collection.find_one(
        {"calculator_type": calculator_type, "isDefault": True},
        {"_id": 0}
    )
    
    if not template:
        # Return a default template structure
        return {
            "id": None,
            "name": "Domyślny szablon",
            "calculator_type": calculator_type,
            "isDefault": True,
            "blocks": DEFAULT_BLOCKS,
            "colors": PDFColors().model_dump(),
            "texts": PDFTexts().model_dump(),
            "logoImageId": None,
            "promoImageId": None,
            "galleryImageIds": []
        }
    
    return template


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get a specific template by ID."""
    template = templates_collection.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("")
async def create_template(template: PDFTemplateCreate):
    """Create a new PDF template."""
    now = datetime.now(timezone.utc).isoformat()
    template_id = f"tpl-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(ObjectId())[:8]}"
    
    # Use default blocks if not provided
    blocks = template.blocks if template.blocks else DEFAULT_BLOCKS
    
    # Merge with default colors and texts
    default_colors = PDFColors().model_dump()
    default_texts = PDFTexts().model_dump()
    
    colors = {**default_colors, **template.colors}
    texts = {**default_texts, **template.texts}
    
    template_dict = {
        "id": template_id,
        "name": template.name,
        "calculator_type": template.calculator_type,
        "isDefault": template.isDefault,
        "blocks": blocks,
        "colors": colors,
        "texts": texts,
        "logoImageId": template.logoImageId,
        "promoImageId": template.promoImageId,
        "galleryImageIds": template.galleryImageIds,
        "createdAt": now,
        "updatedAt": now
    }
    
    # If this is set as default, unset other defaults for this calculator type
    if template.isDefault:
        templates_collection.update_many(
            {"calculator_type": template.calculator_type, "isDefault": True},
            {"$set": {"isDefault": False}}
        )
    
    templates_collection.insert_one(template_dict)
    
    result = templates_collection.find_one({"id": template_id}, {"_id": 0})
    return result


@router.put("/{template_id}")
async def update_template(template_id: str, template: PDFTemplateUpdate):
    """Update a PDF template."""
    existing = templates_collection.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = {k: v for k, v in template.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    # If setting as default, unset other defaults
    if template.isDefault:
        templates_collection.update_many(
            {"calculator_type": existing["calculator_type"], "isDefault": True, "id": {"$ne": template_id}},
            {"$set": {"isDefault": False}}
        )
    
    templates_collection.update_one({"id": template_id}, {"$set": update_data})
    
    result = templates_collection.find_one({"id": template_id}, {"_id": 0})
    return result


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    """Delete a PDF template."""
    result = templates_collection.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deleted", "id": template_id}


@router.post("/{template_id}/duplicate")
async def duplicate_template(template_id: str, new_name: str = None):
    """Duplicate an existing PDF template."""
    # Find the original template
    original = templates_collection.find_one({"id": template_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Create a new template based on the original
    now = datetime.now(timezone.utc).isoformat()
    new_id = f"tpl-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(ObjectId())[:8]}"
    
    new_template = {
        "id": new_id,
        "name": new_name or f"{original.get('name', 'Szablon')} (kopia)",
        "calculator_type": original.get("calculator_type", "sauna"),
        "isDefault": False,  # Duplicates are never default
        "blocks": original.get("blocks", []),
        "colors": original.get("colors", {}),
        "texts": original.get("texts", {}),
        "logoImageId": original.get("logoImageId"),
        "promoImageId": original.get("promoImageId"),
        "galleryImageIds": original.get("galleryImageIds", []),
        "createdAt": now,
        "updatedAt": now
    }
    
    templates_collection.insert_one(new_template)
    
    # Return without _id
    if "_id" in new_template:
        del new_template["_id"]
    return new_template


@router.get("/{template_id}/export")
async def export_template(template_id: str):
    """Export a template with all its images as a JSON package."""
    # Find template
    template = templates_collection.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Collect all image IDs
    image_ids = []
    if template.get("logoImageId"):
        image_ids.append(template["logoImageId"])
    if template.get("promoImageId"):
        image_ids.append(template["promoImageId"])
    if template.get("galleryImageIds"):
        image_ids.extend(template["galleryImageIds"])
    
    # Fetch all images
    images = []
    for img_id in image_ids:
        img_doc = pdf_images_collection.find_one({"id": img_id}, {"_id": 0})
        if img_doc:
            images.append(img_doc)
    
    # Create export package
    export_data = {
        "version": "1.0",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "template": template,
        "images": images
    }
    
    return export_data


@router.post("/import")
async def import_template(import_data: dict):
    """Import a template with its images from a JSON package."""
    if "template" not in import_data:
        raise HTTPException(status_code=400, detail="Invalid import data: missing template")
    
    template_data = import_data["template"]
    images_data = import_data.get("images", [])
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create ID mapping for images (old ID -> new ID)
    image_id_map = {}
    
    # Import images first
    for img in images_data:
        old_id = img.get("id")
        new_id = f"img-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(ObjectId())[:8]}"
        
        new_img = {
            "id": new_id,
            "filename": img.get("filename", "imported.jpg"),
            "content_type": img.get("content_type", "image/jpeg"),
            "image_type": img.get("image_type", "gallery"),
            "calculator_type": template_data.get("calculator_type", "sauna"),
            "data": img.get("data", ""),
            "size": img.get("size", 0),
            "createdAt": now
        }
        
        pdf_images_collection.insert_one(new_img)
        image_id_map[old_id] = new_id
    
    # Create new template with updated image IDs
    new_template_id = f"tpl-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(ObjectId())[:8]}"
    
    new_template = {
        "id": new_template_id,
        "name": f"{template_data.get('name', 'Imported')} (import)",
        "calculator_type": template_data.get("calculator_type", "sauna"),
        "isDefault": False,  # Imported templates are never default
        "blocks": template_data.get("blocks", []),
        "colors": template_data.get("colors", {}),
        "texts": template_data.get("texts", {}),
        "logoImageId": image_id_map.get(template_data.get("logoImageId")),
        "promoImageId": image_id_map.get(template_data.get("promoImageId")),
        "galleryImageIds": [image_id_map.get(gid) for gid in template_data.get("galleryImageIds", []) if image_id_map.get(gid)],
        "createdAt": now,
        "updatedAt": now
    }
    
    templates_collection.insert_one(new_template)
    
    # Return without _id
    if "_id" in new_template:
        del new_template["_id"]
    
    return {
        "status": "imported",
        "template": new_template,
        "imagesImported": len(image_id_map)
    }


# ========== IMAGE MANAGEMENT ==========

@router.post("/images/upload")
async def upload_image(
    file: UploadFile = File(...),
    image_type: str = "gallery",  # 'logo', 'promo', 'gallery'
    calculator_type: str = "sauna"
):
    """Upload an image for PDF templates."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file content
    content = await file.read()
    
    # Convert to base64 for storage
    base64_content = base64.b64encode(content).decode('utf-8')
    
    now = datetime.now(timezone.utc).isoformat()
    image_id = f"img-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(ObjectId())[:8]}"
    
    image_doc = {
        "id": image_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "image_type": image_type,
        "calculator_type": calculator_type,
        "data": base64_content,
        "size": len(content),
        "createdAt": now
    }
    
    pdf_images_collection.insert_one(image_doc)
    
    return {
        "id": image_id,
        "filename": file.filename,
        "image_type": image_type,
        "size": len(content)
    }


@router.get("/images")
async def get_images(image_type: str = None, calculator_type: str = None):
    """Get list of uploaded images (without data)."""
    query = {}
    if image_type:
        query["image_type"] = image_type
    if calculator_type:
        query["calculator_type"] = calculator_type
    
    images = list(pdf_images_collection.find(query, {"_id": 0, "data": 0}).sort("createdAt", -1))
    return images


@router.get("/images/{image_id}")
async def get_image(image_id: str):
    """Get image data by ID."""
    image = pdf_images_collection.find_one({"id": image_id}, {"_id": 0})
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.get("/images/{image_id}/data")
async def get_image_data(image_id: str):
    """Get raw image data for display."""
    from fastapi.responses import Response
    
    image = pdf_images_collection.find_one({"id": image_id})
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Decode base64
    image_data = base64.b64decode(image["data"])
    
    return Response(content=image_data, media_type=image["content_type"])


@router.delete("/images/{image_id}")
async def delete_image(image_id: str):
    """Delete an uploaded image."""
    result = pdf_images_collection.delete_one({"id": image_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"status": "deleted", "id": image_id}


# ========== SEED DEFAULT TEMPLATE ==========

@router.post("/seed-defaults")
async def seed_default_templates():
    """Create default templates for both calculator types."""
    created = []
    
    for calc_type in ["sauna", "balia"]:
        existing = templates_collection.find_one({
            "calculator_type": calc_type,
            "isDefault": True
        })
        
        if not existing:
            now = datetime.now(timezone.utc).isoformat()
            template_id = f"tpl-default-{calc_type}"
            
            template = {
                "id": template_id,
                "name": f"Szablon domyślny - {calc_type.upper()}",
                "calculator_type": calc_type,
                "isDefault": True,
                "blocks": DEFAULT_BLOCKS,
                "colors": PDFColors().model_dump(),
                "texts": PDFTexts().model_dump(),
                "logoImageId": None,
                "promoImageId": None,
                "galleryImageIds": [],
                "createdAt": now,
                "updatedAt": now
            }
            
            templates_collection.insert_one(template)
            created.append(calc_type)
    
    return {"status": "ok", "created": created}



@router.post("/preview/{calculator_type}")
async def generate_preview_pdf(calculator_type: str):
    """Generate a preview PDF with sample data using current template settings."""
    from fastapi.responses import Response
    import io
    import base64
    from datetime import datetime, timedelta
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    from reportlab.platypus import Image as RLImage
    
    # Load template
    template = templates_collection.find_one(
        {"calculator_type": calculator_type, "isDefault": True},
        {"_id": 0}
    )
    
    if not template:
        template = {
            "blocks": DEFAULT_BLOCKS,
            "colors": PDFColors().model_dump(),
            "texts": PDFTexts().model_dump(),
            "logoImageId": None,
            "promoImageId": None,
            "galleryImageIds": []
        }
    
    def is_block_enabled(block_id: str) -> bool:
        blocks = template.get("blocks", [])
        for block in blocks:
            if block.get("id") == block_id:
                return block.get("enabled", True)
        return True
    
    def load_template_image(image_id: str) -> bytes:
        if not image_id:
            return None
        try:
            image_doc = pdf_images_collection.find_one({"id": image_id})
            if image_doc and image_doc.get("data"):
                return base64.b64decode(image_doc["data"])
        except Exception:
            pass
        return None
    
    template_colors = template.get("colors", {})
    template_texts = template.get("texts", {})
    
    buffer = io.BytesIO()
    
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except Exception:
        pass
    
    # Colors from template
    BROWN = colors.HexColor(template_colors.get('primary', '#97724E'))
    BROWN_LIGHT = colors.HexColor('#FAF6F0')
    BROWN_BORDER = colors.HexColor(template_colors.get('secondary', '#D4C4B0'))
    BROWN_DARK = colors.HexColor(template_colors.get('accent', '#6B5038'))
    RED = colors.HexColor('#C53030')
    RED_LIGHT = colors.HexColor('#FFF5F5')
    TEXT_COLOR = colors.HexColor(template_colors.get('text', '#323232'))
    MUTED = colors.HexColor(template_colors.get('muted', '#888888'))
    
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                          rightMargin=20, leftMargin=20,
                          topMargin=20, bottomMargin=20)
    
    elements = []
    
    # Sample data
    current_date = datetime.now().strftime('%d.%m.%Y')
    valid_until = (datetime.now() + timedelta(days=30)).strftime('%d.%m.%Y')
    promo_until = (datetime.now() + timedelta(days=7)).strftime('%d.%m.%Y')
    offer_number = f"PREVIEW-{datetime.now().strftime('%Y%m%d')}"
    
    # ========== HEADER ==========
    if is_block_enabled('header'):
        header_title = template_texts.get('headerTitle', 'OFERTA HANDLOWA')
        
        # Try to load custom logo
        logo_cell = None
        if template.get('logoImageId'):
            logo_data = load_template_image(template.get('logoImageId'))
            if logo_data:
                try:
                    logo_buffer = io.BytesIO(logo_data)
                    logo_cell = RLImage(logo_buffer, width=180, height=36)
                except Exception:
                    pass
        
        if not logo_cell:
            logo_cell = Paragraph('<b>WM-SAUNA</b>', ParagraphStyle('Logo', fontName='DejaVuSans-Bold', fontSize=24, textColor=BROWN))
        
        header_data = [[
            logo_cell,
            '',
            Paragraph(f'''<b>{header_title}</b><br/>
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
        elements.append(Spacer(1, 4))
        elements.append(Table([['']], colWidths=[530], rowHeights=[2], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
        elements.append(Spacer(1, 8))
    
    # ========== CLIENT INFO ==========
    if is_block_enabled('client_info'):
        client_info = Paragraph('''<b>DANE KLIENTA:</b><br/>
        Imię i nazwisko: Jan Kowalski<br/>
        Email: jan.kowalski@example.com<br/>
        Telefon: +48 123 456 789''', 
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
    
    # ========== PROMO SECTION ==========
    if is_block_enabled('promo'):
        promo_title = template_texts.get('promoTitle', 'PROMOCJA')
        promo_text_content = template_texts.get('promoText', 'Darmowa balia do schłodzenia<br/>lub beczka z sauną!')
        
        # Try to load custom promo image
        promo_img = None
        if template.get('promoImageId'):
            promo_data = load_template_image(template.get('promoImageId'))
            if promo_data:
                try:
                    promo_buffer = io.BytesIO(promo_data)
                    promo_img = RLImage(promo_buffer, width=100, height=100)
                except Exception:
                    pass
        
        promo_text = Paragraph(f'''<b><font color="#C53030" size="13">{promo_title}</font></b><br/><br/>
        <font size="9">Zamów do {promo_until} i wybierz swój super gratis świąteczny:<br/>
        {promo_text_content}</font><br/><br/>
        <font size="8" color="#888888">Oferta ważna tylko przy zakupie w tym terminie</font>''',
        ParagraphStyle('PromoText', fontName='DejaVuSans', fontSize=11))
        
        if promo_img:
            promo_data_table = [[promo_img, promo_text]]
            promo_table = Table(promo_data_table, colWidths=[120, 400])
        else:
            promo_table = Table([[promo_text]], colWidths=[530])
        
        promo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), RED_LIGHT),
            ('BOX', (0, 0), (-1, -1), 1.5, RED),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(promo_table)
        elements.append(Spacer(1, 10))
    
    # ========== MODEL SECTION ==========
    if is_block_enabled('model_photo'):
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
        
        model_info = Paragraph(f'''<b>MODEL</b><br/><br/>
        Sauna Kwadro-Beczka 235×200 cm<br/>
        <font color="{template_colors.get('primary', '#97724E')}"><b>12 500 PLN</b></font>''',
        ParagraphStyle('ModelInfo', fontName='DejaVuSans', fontSize=10, leading=13))
        
        bench_info = Paragraph(f'''<b>ŁAWKI</b><br/><br/>
        Ławki standardowe<br/>
        <font color="{template_colors.get('primary', '#97724E')}"><b>2 500 PLN</b></font>''',
        ParagraphStyle('BenchInfo', fontName='DejaVuSans', fontSize=10, leading=13))
        
        combined_table = Table([[model_info, bench_info]], colWidths=[265, 265])
        combined_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BROWN_LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(combined_table)
        elements.append(Spacer(1, 8))
    
    # ========== OPTIONS SECTION ==========
    if is_block_enabled('options'):
        section_title_style = ParagraphStyle(
            'SectionTitle',
            fontName='DejaVuSans-Bold',
            fontSize=13,
            textColor=BROWN_DARK,
        )
        elements.append(Paragraph('DODATKOWE OPCJE', section_title_style))
        elements.append(Spacer(1, 4))
        elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN_BORDER)]))
        elements.append(Spacer(1, 4))
        
        sample_options = [
            ['Piec elektryczny 9kW', '3 500 PLN', 'Oświetlenie LED', '800 PLN'],
            ['Termometr', '150 PLN', 'Klepsydra', '100 PLN'],
            ['Podłoga drewniana', '1 200 PLN', 'Wentylacja', '400 PLN'],
        ]
        
        options_body = [[
            Paragraph('<b>OPCJA</b>', ParagraphStyle('OptHeader', fontName='DejaVuSans-Bold', fontSize=9, textColor=colors.white)),
            '',
            Paragraph('<b>OPCJA</b>', ParagraphStyle('OptHeader', fontName='DejaVuSans-Bold', fontSize=9, textColor=colors.white)),
            ''
        ]]
        
        for row in sample_options:
            options_body.append([
                Paragraph(row[0], ParagraphStyle('OptName', fontName='DejaVuSans', fontSize=9)),
                Paragraph(row[1], ParagraphStyle('OptPrice', fontName='DejaVuSans', fontSize=9, alignment=TA_RIGHT)),
                Paragraph(row[2], ParagraphStyle('OptName', fontName='DejaVuSans', fontSize=9)),
                Paragraph(row[3], ParagraphStyle('OptPrice', fontName='DejaVuSans', fontSize=9, alignment=TA_RIGHT)),
            ])
        
        options_table = Table(options_body, colWidths=[180, 80, 180, 80])
        options_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BROWN),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('LINEBELOW', (0, 0), (-1, -1), 0.8, BROWN_BORDER),
            ('BOX', (0, 0), (-1, -1), 1, BROWN_BORDER),
            ('BACKGROUND', (0, 1), (-1, 1), BROWN_LIGHT),
            ('BACKGROUND', (0, 3), (-1, 3), BROWN_LIGHT),
        ]))
        elements.append(options_table)
        elements.append(Spacer(1, 10))
    
    # ========== TOTAL SECTION ==========
    if is_block_enabled('total'):
        total_price_str = "21 150"
        warranty_text = template_texts.get('warrantyText', 'GWARANCJA: 12 miesiące od daty montażu')
        
        total_left = Paragraph(f'''<font color="white"><b>WARTOŚĆ CAŁKOWITA OFERTY</b></font><br/><br/>
        <font color="white" size="20"><b>{total_price_str} PLN</b></font>''', 
        ParagraphStyle('TotalLeft', fontName='DejaVuSans-Bold', fontSize=11, textColor=colors.white, leading=14))
        
        total_right = Paragraph(f'''TERMIN REALIZACJI: 1–3 tygodni + montaż 1–2 dni<br/>
        ZALICZKA: 50% przed produkcją, 50% przed wysyłką<br/>
        {warranty_text}''', 
        ParagraphStyle('TotalRight', fontName='DejaVuSans', fontSize=8, textColor=TEXT_COLOR, leading=12))
        
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
    if is_block_enabled('footer'):
        footer_text = template_texts.get('footerText', 'Oferta ważna 30 dni od daty wystawienia.')
        elements.append(Spacer(1, 10))
        elements.append(Table([['']], colWidths=[530], rowHeights=[1], style=[('BACKGROUND', (0,0), (0,0), BROWN)]))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(footer_text, 
                                 ParagraphStyle('Footer', fontName='DejaVuSans', fontSize=8, textColor=MUTED, alignment=TA_CENTER)))
    
    # ========== GALLERY PAGE ==========
    if is_block_enabled('gallery'):
        elements.append(PageBreak())
        
        gallery_title = template_texts.get('galleryTitle', 'GALERIA REALIZACJI')
        elements.append(Paragraph(gallery_title, 
                                 ParagraphStyle('GalleryTitle', fontName='DejaVuSans-Bold', fontSize=16, 
                                               textColor=BROWN, alignment=TA_CENTER, spaceAfter=15)))
        
        # Try to load gallery images from template
        gallery_images = []
        template_gallery_ids = template.get('galleryImageIds', [])
        
        if template_gallery_ids:
            for img_id in template_gallery_ids[:6]:
                img_data = load_template_image(img_id)
                if img_data:
                    try:
                        img_buffer = io.BytesIO(img_data)
                        gallery_images.append(RLImage(img_buffer, width=250, height=180))
                    except Exception:
                        pass
        
        if gallery_images:
            # Create grid
            if len(gallery_images) >= 2:
                row1 = Table([[gallery_images[0], gallery_images[1]]], colWidths=[265, 265], rowHeights=[185])
                row1.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                elements.append(row1)
                elements.append(Spacer(1, 10))
            
            if len(gallery_images) >= 4:
                row2 = Table([[gallery_images[2], gallery_images[3]]], colWidths=[265, 265], rowHeights=[185])
                row2.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                elements.append(row2)
        else:
            # Placeholder for gallery
            elements.append(Spacer(1, 50))
            elements.append(Paragraph('<font color="#888888"><i>Galeria zdjęć — dodaj zdjęcia w zakładce "Изображения"</i></font>', 
                                     ParagraphStyle('GalleryPlaceholder', fontName='DejaVuSans', fontSize=12, 
                                                   textColor=MUTED, alignment=TA_CENTER)))
            elements.append(Spacer(1, 50))
        
        company_slogan = template_texts.get('companySlogan', 'WM-Group — Producent saun i bali na wymiar')
        elements.append(Spacer(1, 15))
        elements.append(Paragraph(company_slogan, 
                                 ParagraphStyle('GalleryFooter', fontName='DejaVuSans', fontSize=10, 
                                               textColor=MUTED, alignment=TA_CENTER)))
    
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=preview.pdf"}
    )
