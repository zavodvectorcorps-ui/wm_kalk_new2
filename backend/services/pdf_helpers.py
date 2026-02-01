"""PDF generation helpers for sauna calculator."""
import io
import os
import logging
import base64
from PIL import Image as PILImage

logger = logging.getLogger(__name__)


def optimize_image_for_pdf(img_data: bytes, max_size: int = 800, quality: int = 75) -> bytes:
    """Optimize image for PDF: resize and compress to reduce file size."""
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


async def load_image_from_mongodb(db, image_url: str) -> bytes:
    """Load image from MongoDB by extracting ID from URL."""
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


async def load_template_image(db, image_id: str) -> bytes:
    """Load image from pdf_images collection by ID."""
    if not image_id:
        return None
    try:
        image_doc = await db.pdf_images.find_one({"id": image_id})
        if image_doc and image_doc.get("data"):
            return base64.b64decode(image_doc["data"])
    except Exception as e:
        logger.warning(f"Could not load template image {image_id}: {e}")
    return None


def scale_image_proportionally(img_data_or_path, max_width=250, max_height=180):
    """Scale image to fit within max dimensions while preserving aspect ratio."""
    from reportlab.platypus import Image as RLImage
    
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


def get_pdf_colors(template_colors: dict = None) -> dict:
    """Get PDF color palette from template or defaults."""
    from reportlab.lib import colors
    
    template_colors = template_colors or {}
    
    return {
        'BROWN': colors.HexColor(template_colors.get('primary', '#97724E')),
        'BROWN_LIGHT': colors.HexColor('#FAF6F0'),
        'BROWN_BORDER': colors.HexColor(template_colors.get('secondary', '#D4C4B0')),
        'BROWN_DARK': colors.HexColor(template_colors.get('accent', '#6B5038')),
        'GREEN': colors.HexColor('#2D7A3E'),
        'GREEN_LIGHT': colors.HexColor('#F0F9F5'),
        'RED': colors.HexColor('#C53030'),
        'RED_LIGHT': colors.HexColor('#FFF5F5'),
        'TEXT_COLOR': colors.HexColor(template_colors.get('text', '#323232')),
        'MUTED': colors.HexColor(template_colors.get('muted', '#888888')),
        'WHITE': colors.white,
        'GIFT_GREEN': colors.HexColor('#059669'),
        'GIFT_BG': colors.HexColor('#ECFDF5'),
    }


def get_pdf_styles(colors_dict: dict) -> dict:
    """Get PDF paragraph styles."""
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    
    return {
        'section_title': ParagraphStyle(
            'SectionTitle',
            fontName='DejaVuSans-Bold',
            fontSize=13,
            textColor=colors_dict['BROWN_DARK'],
        ),
        'normal': ParagraphStyle(
            'Normal',
            fontName='DejaVuSans',
            fontSize=9,
            textColor=colors_dict['TEXT_COLOR'],
        ),
        'header_right': ParagraphStyle(
            'HeaderRight',
            fontName='DejaVuSans',
            fontSize=16,
            alignment=TA_RIGHT,
            textColor=colors_dict['BROWN']
        ),
        'gallery_title': ParagraphStyle(
            'GalleryTitle',
            fontName='DejaVuSans-Bold',
            fontSize=16,
            textColor=colors_dict['BROWN'],
            alignment=TA_CENTER,
            spaceAfter=15
        ),
        'gallery_footer': ParagraphStyle(
            'GalleryFooter',
            fontName='DejaVuSans',
            fontSize=10,
            textColor=colors_dict['MUTED'],
            alignment=TA_CENTER
        ),
    }


def register_fonts():
    """Register DejaVu fonts for PDF generation."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
        return True
    except Exception as e:
        logger.warning(f"Could not register fonts: {e}")
        return False


async def download_external_image(url: str, timeout: int = 10) -> bytes:
    """Download image from external URL."""
    import urllib.request
    
    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://wm-sauna.pl/',
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except Exception as e:
        logger.warning(f"Could not download image from URL {url}: {e}")
        return None
