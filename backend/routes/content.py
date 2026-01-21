"""
Content management for sales materials.
Allows uploading photos, videos, and YouTube links organized in folders.
Generates public pages for sharing with clients.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import Response, HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import logging
import os
import io

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/content", tags=["content"])

# Database connection
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

mongo_client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
db = mongo_client[os.environ.get("DB_NAME", "wm_kalkulator")]

# GridFS for content files
content_fs = AsyncIOMotorGridFSBucket(db, bucket_name="content_files")

# File size limits
MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB


class ContentItem(BaseModel):
    """Single content item (file or link)"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    type: str  # image, video, youtube
    name: str
    url: Optional[str] = None  # For youtube links or file URL
    gridfs_id: Optional[str] = None  # For uploaded files
    mimeType: Optional[str] = None
    size: Optional[int] = None
    thumbnailUrl: Optional[str] = None  # YouTube thumbnail
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ContentFolder(BaseModel):
    """Folder containing content items"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    name: str
    description: Optional[str] = ""
    calculator_type: str  # balia, sauna
    parentId: Optional[str] = None  # Parent folder ID for nested folders
    items: List[ContentItem] = []
    publicId: str = Field(default_factory=lambda: str(ObjectId())[:12])  # Short ID for public links
    isPublic: bool = True
    order: int = 0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: Optional[str] = None


# ==================== Folders ====================

@router.get("/folders")
async def get_folders(calculator_type: Optional[str] = None):
    """Get all content folders, optionally filtered by calculator type"""
    query = {}
    if calculator_type:
        query["calculator_type"] = calculator_type
    
    folders = await db.content_folders.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    return folders


@router.post("/folders")
async def create_folder(
    name: str = Form(...), 
    description: str = Form(""), 
    calculator_type: str = Form(...),
    parentId: Optional[str] = Form(None)
):
    """Create a new content folder (can be nested under parent)"""
    if calculator_type not in ["balia", "sauna"]:
        raise HTTPException(status_code=400, detail="calculator_type must be 'balia' or 'sauna'")
    
    # If parentId is provided, verify parent exists
    if parentId:
        parent = await db.content_folders.find_one({"id": parentId})
        if not parent:
            raise HTTPException(status_code=404, detail="Родительская папка не найдена")
    
    # Get max order for this level (same parent)
    query = {"calculator_type": calculator_type, "parentId": parentId}
    max_order_doc = await db.content_folders.find_one(
        query,
        sort=[("order", -1)]
    )
    max_order = max_order_doc["order"] + 1 if max_order_doc else 0
    
    folder = ContentFolder(
        name=name,
        description=description,
        calculator_type=calculator_type,
        parentId=parentId,
        order=max_order
    )
    
    await db.content_folders.insert_one(folder.dict())
    
    return folder.dict()


@router.put("/folders/{folder_id}")
async def update_folder(folder_id: str, name: str = Form(...), description: str = Form(""), isPublic: bool = Form(True)):
    """Update folder details"""
    result = await db.content_folders.update_one(
        {"id": folder_id},
        {
            "$set": {
                "name": name,
                "description": description,
                "isPublic": isPublic,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    
    folder = await db.content_folders.find_one({"id": folder_id}, {"_id": 0})
    return folder


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str):
    """Delete a folder and all its contents"""
    folder = await db.content_folders.find_one({"id": folder_id})
    if not folder:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    
    # Delete all files from GridFS
    for item in folder.get("items", []):
        if item.get("gridfs_id"):
            try:
                await content_fs.delete(ObjectId(item["gridfs_id"]))
            except Exception as e:
                logger.error(f"Error deleting file from GridFS: {e}")
    
    await db.content_folders.delete_one({"id": folder_id})
    return {"message": "Папка удалена"}


# ==================== Content Items ====================

@router.post("/folders/{folder_id}/upload")
async def upload_content(folder_id: str, file: UploadFile = File(...)):
    """Upload a file (image or video) to a folder"""
    folder = await db.content_folders.find_one({"id": folder_id})
    if not folder:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    
    # Determine file type
    mime_type = file.content_type or "application/octet-stream"
    if mime_type.startswith('image/'):
        file_type = "image"
        max_size = MAX_IMAGE_SIZE
    elif mime_type.startswith('video/'):
        file_type = "video"
        max_size = MAX_VIDEO_SIZE
    else:
        raise HTTPException(status_code=400, detail="Поддерживаются только изображения и видео")
    
    # Read and check size
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(status_code=400, detail=f"Файл слишком большой. Максимум {max_size // (1024*1024)}MB")
    
    # Store in GridFS
    item_id = str(ObjectId())
    metadata = {
        "id": item_id,
        "folder_id": folder_id,
        "name": file.filename or "file",
        "mimeType": mime_type,
        "type": file_type
    }
    
    try:
        gridfs_id = await content_fs.upload_from_stream(
            file.filename or "file",
            io.BytesIO(file_content),
            metadata=metadata
        )
    except Exception as e:
        logger.error(f"Error uploading to GridFS: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {str(e)}")
    
    # Create content item
    item = {
        "id": item_id,
        "type": file_type,
        "name": file.filename or "file",
        "url": f"/api/content/files/{item_id}",
        "gridfs_id": str(gridfs_id),
        "mimeType": mime_type,
        "size": len(file_content),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to folder
    await db.content_folders.update_one(
        {"id": folder_id},
        {
            "$push": {"items": item},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return item


@router.post("/folders/{folder_id}/youtube")
async def add_youtube_link(folder_id: str, url: str = Form(...), name: str = Form("")):
    """Add a YouTube link to a folder"""
    folder = await db.content_folders.find_one({"id": folder_id})
    if not folder:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    
    # Extract video ID from URL
    video_id = None
    if "youtube.com/watch?v=" in url:
        video_id = url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        video_id = url.split("youtu.be/")[1].split("?")[0]
    elif "youtube.com/embed/" in url:
        video_id = url.split("embed/")[1].split("?")[0]
    
    if not video_id:
        raise HTTPException(status_code=400, detail="Неверный формат ссылки YouTube")
    
    # Create content item
    item_id = str(ObjectId())
    item = {
        "id": item_id,
        "type": "youtube",
        "name": name or f"YouTube видео",
        "url": url,
        "videoId": video_id,
        "thumbnailUrl": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to folder
    await db.content_folders.update_one(
        {"id": folder_id},
        {
            "$push": {"items": item},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return item


@router.delete("/folders/{folder_id}/items/{item_id}")
async def delete_content_item(folder_id: str, item_id: str):
    """Delete a content item from a folder"""
    folder = await db.content_folders.find_one({"id": folder_id})
    if not folder:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    
    # Find the item
    item = next((i for i in folder.get("items", []) if i["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Элемент не найден")
    
    # Delete from GridFS if it's a file
    if item.get("gridfs_id"):
        try:
            await content_fs.delete(ObjectId(item["gridfs_id"]))
        except Exception as e:
            logger.error(f"Error deleting from GridFS: {e}")
    
    # Remove from folder
    await db.content_folders.update_one(
        {"id": folder_id},
        {
            "$pull": {"items": {"id": item_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Элемент удалён"}


# ==================== File Serving ====================

@router.get("/files/{file_id}")
async def get_content_file(file_id: str):
    """Get a content file from GridFS"""
    logger.info(f"=== get_content_file called with file_id: {file_id} ===")
    
    # Find file in GridFS
    try:
        cursor = content_fs.find({"metadata.id": file_id})
        file_doc = await cursor.to_list(length=1)
        logger.info(f"GridFS search result: found={len(file_doc)} documents")
    except Exception as e:
        logger.error(f"Error searching GridFS: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка поиска файла: {str(e)}")
    
    if not file_doc:
        logger.error(f"File {file_id} not found in GridFS")
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    file_doc = file_doc[0]
    gridfs_id = file_doc["_id"]
    metadata = file_doc.get("metadata", {})
    mime_type = metadata.get("mimeType", "application/octet-stream")
    filename = metadata.get("name", "file")
    file_size = file_doc.get("length", 0)
    
    logger.info(f"File found: gridfs_id={gridfs_id}, mime={mime_type}, name={filename}, size={file_size}")
    
    # Build headers
    headers = {
        "Content-Disposition": f"inline; filename=\"{filename}\"",
        "Cache-Control": "public, max-age=31536000",
        "Content-Length": str(file_size),
        "Accept-Ranges": "bytes"
    }
    
    # Use streaming for large files (> 1MB)
    if file_size > 1024 * 1024:
        logger.info(f"Using streaming response for large file ({file_size} bytes)")
        
        async def stream_file():
            try:
                stream = await content_fs.open_download_stream(gridfs_id)
                while True:
                    chunk = await stream.read(256 * 1024)  # 256KB chunks
                    if not chunk:
                        break
                    yield chunk
            except Exception as e:
                logger.error(f"Error streaming file: {e}")
                raise
        
        return StreamingResponse(
            stream_file(),
            media_type=mime_type,
            headers=headers
        )
    else:
        # Small files - read entirely
        try:
            stream = await content_fs.open_download_stream(gridfs_id)
            file_content = await stream.read()
            logger.info(f"File read successfully: {len(file_content)} bytes")
        except Exception as e:
            logger.error(f"Error reading from GridFS: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка чтения файла: {str(e)}")
        
        return Response(
            content=file_content,
            media_type=mime_type,
            headers=headers
        )


# ==================== Public Page ====================

async def get_subfolders_recursive(folder_id: str, base_url: str):
    """Recursively get all subfolders and build HTML"""
    subfolders = await db.content_folders.find(
        {"parentId": folder_id, "isPublic": True}, 
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    if not subfolders:
        return ""
    
    html = '<ul class="subfolder-list">'
    for subfolder in subfolders:
        subfolder_items_html = build_items_html(subfolder.get("items", []), base_url)
        nested_subfolders = await get_subfolders_recursive(subfolder["id"], base_url)
        
        html += f'''
        <li class="subfolder-item">
            <div class="subfolder-header" onclick="toggleSubfolder(this)">
                <span class="folder-icon">📁</span>
                <span class="subfolder-name">{subfolder["name"]}</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div class="subfolder-content">
                {f'<p class="subfolder-description">{subfolder.get("description", "")}</p>' if subfolder.get("description") else ''}
                {f'<div class="items-grid">{subfolder_items_html}</div>' if subfolder_items_html else ''}
                {nested_subfolders}
            </div>
        </li>
        '''
    html += '</ul>'
    return html

def build_items_html(items: list, base_url: str) -> str:
    """Build HTML for content items"""
    if not items:
        return ""
    
    items_html = ""
    for item in items:
        item_url = item.get('url', '')
        if item_url.startswith('/'):
            item_url = f"{base_url}{item_url}"
        
        if item["type"] == "image":
            items_html += f'''
            <div class="item image-item">
                <a href="{item_url}" target="_blank" download>
                    <img src="{item_url}" alt="{item['name']}" loading="lazy">
                </a>
                <p class="item-name">{item['name']}</p>
                <a href="{item_url}" download class="download-btn">Скачать</a>
            </div>
            '''
        elif item["type"] == "video":
            items_html += f'''
            <div class="item video-item">
                <video controls preload="metadata" playsinline>
                    <source src="{item_url}" type="{item.get('mimeType', 'video/mp4')}">
                    Ваш браузер не поддерживает видео.
                </video>
                <p class="item-name">{item['name']}</p>
                <a href="{item_url}" download class="download-btn">Скачать</a>
            </div>
            '''
        elif item["type"] == "youtube":
            video_id = item.get("videoId", "")
            items_html += f'''
            <div class="item youtube-item">
                <div class="youtube-container">
                    <iframe src="https://www.youtube.com/embed/{video_id}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                    </iframe>
                </div>
                <p class="item-name">{item['name']}</p>
            </div>
            '''
    return items_html

@router.get("/public/{public_id}", response_class=HTMLResponse)
async def get_public_folder_page(public_id: str, request: Request):
    """Generate a public HTML page for a folder with nested subfolders"""
    folder = await db.content_folders.find_one({"publicId": public_id})
    
    if not folder:
        raise HTTPException(status_code=404, detail="Страница не найдена")
    
    if not folder.get("isPublic", True):
        raise HTTPException(status_code=403, detail="Доступ к странице закрыт")
    
    items = folder.get("items", [])
    folder_name = folder.get("name", "Контент")
    description = folder.get("description", "")
    folder_id = folder.get("id")
    
    # Get base URL from request for absolute URLs
    scheme = request.headers.get('x-forwarded-proto', request.url.scheme)
    host = request.headers.get('x-forwarded-host', request.url.netloc)
    base_url = f"{scheme}://{host}"
    
    # Build HTML for this folder's items
    items_html = build_items_html(items, base_url)
    
    # Get subfolders recursively
    subfolders_html = await get_subfolders_recursive(folder_id, base_url)
    
    html = f'''
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{folder_name}</title>
        <style>
            * {{
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }}
            .container {{
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }}
            h1 {{
                font-size: 2.5rem;
                color: #1a1a2e;
                margin-bottom: 10px;
                text-align: center;
            }}
            .description {{
                text-align: center;
                color: #666;
                margin-bottom: 30px;
                font-size: 1.1rem;
            }}
            .items-grid {{
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 25px;
            }}
            .item {{
                background: #f8f9fa;
                border-radius: 15px;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                transition: transform 0.3s, box-shadow 0.3s;
            }}
            .item:hover {{
                transform: translateY(-5px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            }}
            .image-item img {{
                width: 100%;
                height: 250px;
                object-fit: cover;
                cursor: pointer;
            }}
            .video-item video {{
                width: 100%;
                height: 250px;
                object-fit: cover;
                background: #000;
            }}
            .youtube-container {{
                position: relative;
                width: 100%;
                padding-bottom: 56.25%;
            }}
            .youtube-container iframe {{
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
            }}
            .item-name {{
                padding: 15px;
                font-weight: 500;
                color: #333;
                text-align: center;
            }}
            .download-btn {{
                display: block;
                text-align: center;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                font-weight: 500;
                transition: opacity 0.3s;
            }}
            .download-btn:hover {{
                opacity: 0.9;
            }}
            .empty {{
                text-align: center;
                padding: 60px 20px;
                color: #666;
            }}
            .logo {{
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #999;
                font-size: 0.9rem;
            }}
            @media (max-width: 600px) {{
                .container {{
                    padding: 20px;
                    border-radius: 15px;
                }}
                h1 {{
                    font-size: 1.8rem;
                }}
                .items-grid {{
                    grid-template-columns: 1fr;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>{folder_name}</h1>
            {f'<p class="description">{description}</p>' if description else ''}
            
            {'<div class="items-grid">' + items_html + '</div>' if items else '<div class="empty"><p>В этой папке пока нет материалов</p></div>'}
            
            <div class="logo">
                WM Kalkulator
            </div>
        </div>
    </body>
    </html>
    '''
    
    return HTMLResponse(content=html)


@router.get("/public/{public_id}/link")
async def get_public_link(public_id: str):
    """Get the public link for a folder"""
    folder = await db.content_folders.find_one({"publicId": public_id}, {"_id": 0, "id": 1, "name": 1, "publicId": 1})
    
    if not folder:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    
    return {
        "publicId": folder["publicId"],
        "name": folder.get("name"),
        "path": f"/api/content/public/{folder['publicId']}"
    }
