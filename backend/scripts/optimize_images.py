#!/usr/bin/env python3
"""Script to optimize existing images in the uploads folder."""
import os
from pathlib import Path
from PIL import Image
import io

UPLOAD_DIR = Path("/app/backend/uploads")
MAX_IMAGE_DIMENSION = 1200
JPEG_QUALITY = 85

def optimize_image(file_path: Path) -> bool:
    """Optimize a single image file."""
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        
        original_size = len(content)
        
        img = Image.open(io.BytesIO(content))
        
        # Convert to RGB if needed
        if img.mode in ('RGBA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if len(img.split()) > 3:
                background.paste(img, mask=img.split()[3])
            else:
                background.paste(img)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize if too large
        width, height = img.size
        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            ratio = min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"  Resized: {width}x{height} -> {new_width}x{new_height}")
        
        # Save as optimized JPEG
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=JPEG_QUALITY, optimize=True)
        optimized_content = output.getvalue()
        
        new_size = len(optimized_content)
        
        if new_size < original_size:
            # Save with .jpg extension
            new_path = file_path.with_suffix('.jpg')
            with open(new_path, 'wb') as f:
                f.write(optimized_content)
            
            # Remove original if different path
            if new_path != file_path:
                os.remove(file_path)
            
            reduction = (1 - new_size / original_size) * 100
            print(f"  Optimized: {original_size/1024:.1f}KB -> {new_size/1024:.1f}KB ({reduction:.0f}% reduction)")
            return True
        else:
            print(f"  Skipped: Already optimized")
            return False
            
    except Exception as e:
        print(f"  Error: {e}")
        return False


def main():
    if not UPLOAD_DIR.exists():
        print(f"Upload directory not found: {UPLOAD_DIR}")
        return
    
    images = list(UPLOAD_DIR.glob("*.png")) + list(UPLOAD_DIR.glob("*.PNG"))
    images += list(UPLOAD_DIR.glob("*.jpg")) + list(UPLOAD_DIR.glob("*.jpeg"))
    
    print(f"Found {len(images)} images to optimize\n")
    
    optimized = 0
    for img_path in images:
        print(f"Processing: {img_path.name}")
        if optimize_image(img_path):
            optimized += 1
    
    print(f"\nDone! Optimized {optimized}/{len(images)} images")


if __name__ == "__main__":
    main()
