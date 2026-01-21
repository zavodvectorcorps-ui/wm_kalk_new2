"""
Training module for manager education.
Supports courses with video lessons (Synthesia embed), files and tests.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging
import os
import base64
import uuid
import io

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/training", tags=["training"])

# File upload settings
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB for videos
CHUNK_SIZE = 10 * 1024 * 1024  # 10MB chunks for large files

# Database connection
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

mongo_client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
db = mongo_client[os.environ.get("DB_NAME", "wm_kalkulator")]

# GridFS for large files
fs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="training_files")


# ============= Models =============

class Question(BaseModel):
    """Test question model"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    text: str  # Question text
    options: List[str]  # Answer options
    correctAnswer: int  # Index of correct answer (0-based)
    explanation: Optional[str] = None  # Optional explanation for correct answer


class LessonFile(BaseModel):
    """File attached to a lesson"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    name: str  # Original filename
    url: str  # URL to access the file via API
    size: int  # File size in bytes
    mimeType: str  # MIME type
    fileType: str = "document"  # document, video, image
    uploadedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Lesson(BaseModel):
    """Lesson model"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    title: str
    description: Optional[str] = ""
    thumbnailUrl: Optional[str] = None  # Thumbnail/cover image URL (can be GIF from Synthesia)
    videoEmbed: Optional[str] = None  # Synthesia embed code (iframe)
    videoUrl: Optional[str] = None  # Alternative: direct video URL or uploaded video
    videoFileId: Optional[str] = None  # ID of uploaded video file in training_files collection
    content: Optional[str] = ""  # Additional text content (markdown)
    files: List[LessonFile] = []  # Attached files (PDF, documents, etc.)
    questions: List[Question] = []
    passingScore: int = 100  # Minimum % to pass (0-100)
    order: int = 0
    isActive: bool = True
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: Optional[str] = None


class Course(BaseModel):
    """Course model"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    title: str
    description: Optional[str] = ""
    coverImage: Optional[str] = None  # Cover image URL
    lessons: List[Lesson] = []
    isActive: bool = True
    isRequired: bool = False  # Required course for all managers
    order: int = 0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: Optional[str] = None


class LessonProgress(BaseModel):
    """User progress for a single lesson"""
    lessonId: str
    completed: bool = False
    score: Optional[int] = None  # Percentage score on test
    attempts: int = 0
    lastAttemptAt: Optional[str] = None
    completedAt: Optional[str] = None
    answers: Optional[Dict[str, int]] = None  # questionId -> selected answer index


class UserProgress(BaseModel):
    """User's overall training progress"""
    userId: str
    courseId: str
    lessons: Dict[str, LessonProgress] = {}  # lessonId -> progress
    startedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completedAt: Optional[str] = None
    isCompleted: bool = False


class SubmitTestRequest(BaseModel):
    """Request to submit test answers"""
    answers: Dict[str, int]  # questionId -> selected answer index


class SubmitTestResponse(BaseModel):
    """Response after submitting test"""
    passed: bool
    score: int  # Percentage
    correctAnswers: int
    totalQuestions: int
    requiredScore: int
    results: List[Dict[str, Any]]  # Detailed results per question


# ============= Course CRUD =============

@router.get("/courses")
async def get_courses(include_inactive: bool = False):
    """Get all courses"""
    query = {} if include_inactive else {"isActive": True}
    courses = await db.training_courses.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    return courses


@router.get("/courses/{course_id}")
async def get_course(course_id: str):
    """Get a single course with all lessons"""
    course = await db.training_courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    return course


@router.post("/courses")
async def create_course(course: Course):
    """Create a new course (admin only)"""
    course_dict = course.model_dump()
    
    # Get max order
    max_order = await db.training_courses.find_one(
        {}, {"order": 1, "_id": 0}, sort=[("order", -1)]
    )
    course_dict["order"] = (max_order.get("order", 0) + 1) if max_order else 0
    
    await db.training_courses.insert_one(course_dict)
    
    # Return without _id
    course_dict.pop("_id", None)
    return course_dict


@router.put("/courses/{course_id}")
async def update_course(course_id: str, course: Course):
    """Update a course (admin only)"""
    course_dict = course.model_dump()
    course_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.training_courses.update_one(
        {"id": course_id},
        {"$set": course_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    course_dict.pop("_id", None)
    return course_dict


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    """Delete a course (admin only)"""
    result = await db.training_courses.delete_one({"id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Also delete all progress for this course
    await db.training_progress.delete_many({"courseId": course_id})
    
    return {"message": "Курс удалён"}


# ============= Lesson CRUD =============

@router.post("/courses/{course_id}/lessons")
async def add_lesson(course_id: str, lesson: Lesson):
    """Add a lesson to a course"""
    course = await db.training_courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    lesson_dict = lesson.model_dump()
    
    # Set order to be last
    lessons = course.get("lessons", [])
    lesson_dict["order"] = len(lessons)
    
    await db.training_courses.update_one(
        {"id": course_id},
        {
            "$push": {"lessons": lesson_dict},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return lesson_dict


@router.put("/courses/{course_id}/lessons/{lesson_id}")
async def update_lesson(course_id: str, lesson_id: str, lesson: Lesson):
    """Update a lesson"""
    lesson_dict = lesson.model_dump()
    lesson_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.training_courses.update_one(
        {"id": course_id, "lessons.id": lesson_id},
        {"$set": {"lessons.$": lesson_dict, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    return lesson_dict


@router.delete("/courses/{course_id}/lessons/{lesson_id}")
async def delete_lesson(course_id: str, lesson_id: str):
    """Delete a lesson from a course"""
    result = await db.training_courses.update_one(
        {"id": course_id},
        {
            "$pull": {"lessons": {"id": lesson_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    return {"message": "Урок удалён"}


@router.post("/courses/{course_id}/lessons/{lesson_id}/files")
async def upload_lesson_file(course_id: str, lesson_id: str, file: UploadFile = File(...)):
    """Upload a file to a lesson"""
    # Check course and lesson exist
    course = await db.training_courses.find_one({"id": course_id, "lessons.id": lesson_id})
    if not course:
        raise HTTPException(status_code=404, detail="Курс или урок не найден")
    
    # Check file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"Файл слишком большой. Максимум {MAX_FILE_SIZE // (1024*1024)}MB")
    
    # Determine file type
    mime_type = file.content_type or "application/octet-stream"
    if mime_type.startswith('video/'):
        file_type = "video"
    elif mime_type.startswith('image/'):
        file_type = "image"
    else:
        file_type = "document"
    
    # Store file in GridFS
    file_id = str(ObjectId())
    metadata = {
        "id": file_id,
        "name": file.filename or "file",
        "mimeType": mime_type,
        "fileType": file_type,
        "courseId": course_id,
        "lessonId": lesson_id,
        "uploadedAt": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        gridfs_id = await fs_bucket.upload_from_stream(
            file.filename or "file",
            io.BytesIO(file_content),
            metadata=metadata
        )
        # Store GridFS ObjectId reference
        metadata["gridfs_id"] = str(gridfs_id)
    except Exception as e:
        logger.error(f"Error uploading to GridFS: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {str(e)}")
    
    # Create file record for lesson (without the actual data)
    file_record = {
        "id": file_id,
        "gridfs_id": str(gridfs_id),
        "name": file.filename or "file",
        "url": f"/api/training/files/{file_id}",
        "size": len(file_content),
        "mimeType": mime_type,
        "fileType": file_type,
        "uploadedAt": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to lesson's files array
    result = await db.training_courses.update_one(
        {"id": course_id, "lessons.id": lesson_id},
        {
            "$push": {"lessons.$.files": file_record},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        # Clean up stored file from GridFS
        try:
            await fs_bucket.delete(gridfs_id)
        except:
            pass
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    return file_record


@router.post("/courses/{course_id}/lessons/{lesson_id}/video")
async def upload_lesson_video(course_id: str, lesson_id: str, file: UploadFile = File(...)):
    """Upload a video file to a lesson"""
    # Check course and lesson exist
    course = await db.training_courses.find_one({"id": course_id, "lessons.id": lesson_id})
    if not course:
        raise HTTPException(status_code=404, detail="Курс или урок не найден")
    
    # Check file is video
    if not file.content_type or not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="Файл должен быть видео")
    
    # Check file size
    file_content = await file.read()
    if len(file_content) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail=f"Видео слишком большое. Максимум {MAX_VIDEO_SIZE // (1024*1024)}MB")
    
    # Store video in GridFS
    file_id = str(ObjectId())
    metadata = {
        "id": file_id,
        "name": file.filename or "video",
        "mimeType": file.content_type,
        "fileType": "video",
        "courseId": course_id,
        "lessonId": lesson_id,
        "uploadedAt": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        gridfs_id = await fs_bucket.upload_from_stream(
            file.filename or "video",
            io.BytesIO(file_content),
            metadata=metadata
        )
    except Exception as e:
        logger.error(f"Error uploading video to GridFS: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения видео: {str(e)}")
    
    # Update lesson with video URL
    video_url = f"/api/training/files/{file_id}"
    
    result = await db.training_courses.update_one(
        {"id": course_id, "lessons.id": lesson_id},
        {
            "$set": {
                "lessons.$.videoUrl": video_url,
                "lessons.$.videoFileId": file_id,
                "lessons.$.videoGridfsId": str(gridfs_id),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        try:
            await fs_bucket.delete(gridfs_id)
        except:
            pass
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    return {
        "id": file_id,
        "name": file.filename,
        "url": video_url,
        "size": len(file_content),
        "mimeType": file.content_type
    }


@router.delete("/courses/{course_id}/lessons/{lesson_id}/video")
async def delete_lesson_video(course_id: str, lesson_id: str):
    """Delete video from a lesson"""
    # Find the course and lesson
    course = await db.training_courses.find_one({"id": course_id, "lessons.id": lesson_id})
    if not course:
        raise HTTPException(status_code=404, detail="Курс или урок не найден")
    
    # Find the lesson
    lesson = next((l for l in course.get("lessons", []) if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    video_gridfs_id = lesson.get("videoGridfsId")
    
    # Delete video file from GridFS
    if video_gridfs_id:
        try:
            await fs_bucket.delete(ObjectId(video_gridfs_id))
        except Exception as e:
            logger.error(f"Error deleting video from GridFS: {e}")
    
    # Remove video from lesson
    await db.training_courses.update_one(
        {"id": course_id, "lessons.id": lesson_id},
        {
            "$unset": {"lessons.$.videoUrl": "", "lessons.$.videoFileId": "", "lessons.$.videoGridfsId": ""},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Видео удалено"}


@router.delete("/courses/{course_id}/lessons/{lesson_id}/files/{file_id}")
async def delete_lesson_file(course_id: str, lesson_id: str, file_id: str):
    """Delete a file from a lesson"""
    # Find the course and lesson
    course = await db.training_courses.find_one({"id": course_id, "lessons.id": lesson_id})
    if not course:
        raise HTTPException(status_code=404, detail="Курс или урок не найден")
    
    # Find the lesson and file
    lesson = next((l for l in course.get("lessons", []) if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    file_record = next((f for f in lesson.get("files", []) if f["id"] == file_id), None)
    if not file_record:
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # Delete file from GridFS
    gridfs_id = file_record.get("gridfs_id")
    if gridfs_id:
        try:
            await fs_bucket.delete(ObjectId(gridfs_id))
        except Exception as e:
            logger.error(f"Error deleting file from GridFS: {e}")
    
    # Remove from lesson's files array
    result = await db.training_courses.update_one(
        {"id": course_id, "lessons.id": lesson_id},
        {
            "$pull": {"lessons.$.files": {"id": file_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Файл удалён"}


@router.get("/files/{file_id}")
async def get_lesson_file(file_id: str):
    """Get/download a lesson file from GridFS"""
    # Find file metadata in GridFS
    cursor = fs_bucket.find({"metadata.id": file_id})
    file_doc = await cursor.to_list(length=1)
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    file_doc = file_doc[0]
    gridfs_id = file_doc["_id"]
    metadata = file_doc.get("metadata", {})
    mime_type = metadata.get("mimeType", "application/octet-stream")
    filename = metadata.get("name", "file")
    
    # Download file from GridFS
    try:
        stream = await fs_bucket.open_download_stream(gridfs_id)
        file_content = await stream.read()
    except Exception as e:
        logger.error(f"Error reading file from GridFS: {e}")
        raise HTTPException(status_code=500, detail="Ошибка чтения файла")
    
    # For PDFs, images, and videos - serve inline
    if mime_type.startswith('image/') or mime_type == 'application/pdf' or mime_type.startswith('video/'):
        return Response(
            content=file_content,
            media_type=mime_type,
            headers={
                "Content-Disposition": f"inline; filename=\"{filename}\"",
                "Accept-Ranges": "bytes"
            }
        )
    
    # For other files - serve as download
    return Response(
        content=file_content,
        media_type=mime_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.put("/courses/{course_id}/lessons/reorder")
async def reorder_lessons(course_id: str, lesson_ids: List[str]):
    """Reorder lessons in a course"""
    course = await db.training_courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    lessons = course.get("lessons", [])
    lessons_dict = {l["id"]: l for l in lessons}
    
    # Reorder based on provided IDs
    reordered = []
    for i, lesson_id in enumerate(lesson_ids):
        if lesson_id in lessons_dict:
            lesson = lessons_dict[lesson_id]
            lesson["order"] = i
            reordered.append(lesson)
    
    await db.training_courses.update_one(
        {"id": course_id},
        {"$set": {"lessons": reordered, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Порядок уроков обновлён"}


# ============= User Progress =============

@router.get("/progress/{user_id}")
async def get_user_progress(user_id: str):
    """Get all training progress for a user"""
    progress = await db.training_progress.find(
        {"userId": user_id}, {"_id": 0}
    ).to_list(100)
    return progress


@router.get("/progress/{user_id}/{course_id}")
async def get_course_progress(user_id: str, course_id: str):
    """Get user's progress for a specific course"""
    progress = await db.training_progress.find_one(
        {"userId": user_id, "courseId": course_id},
        {"_id": 0}
    )
    
    if not progress:
        # Create new progress record
        progress = {
            "userId": user_id,
            "courseId": course_id,
            "lessons": {},
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "completedAt": None,
            "isCompleted": False
        }
        await db.training_progress.insert_one(progress)
    
    return progress


@router.post("/progress/{user_id}/{course_id}/lessons/{lesson_id}/start")
async def start_lesson(user_id: str, course_id: str, lesson_id: str):
    """Mark a lesson as started"""
    # Get or create progress
    progress = await db.training_progress.find_one(
        {"userId": user_id, "courseId": course_id}
    )
    
    if not progress:
        progress = {
            "userId": user_id,
            "courseId": course_id,
            "lessons": {},
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "completedAt": None,
            "isCompleted": False
        }
        await db.training_progress.insert_one(progress)
    
    # Update lesson progress if not already started
    lessons = progress.get("lessons", {})
    if lesson_id not in lessons:
        lessons[lesson_id] = {
            "lessonId": lesson_id,
            "completed": False,
            "score": None,
            "attempts": 0,
            "lastAttemptAt": None,
            "completedAt": None,
            "answers": None
        }
        
        await db.training_progress.update_one(
            {"userId": user_id, "courseId": course_id},
            {"$set": {"lessons": lessons}}
        )
    
    return {"message": "Урок начат"}


@router.post("/progress/{user_id}/{course_id}/lessons/{lesson_id}/complete")
async def complete_lesson(user_id: str, course_id: str, lesson_id: str):
    """Mark a lesson as completed (for lessons without tests)"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Get course to check if completed
    course = await db.training_courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Get or create progress
    progress = await db.training_progress.find_one(
        {"userId": user_id, "courseId": course_id}
    )
    
    if not progress:
        progress = {
            "userId": user_id,
            "courseId": course_id,
            "lessons": {},
            "startedAt": now,
            "completedAt": None,
            "isCompleted": False
        }
        await db.training_progress.insert_one(progress)
    
    # Update lesson progress
    lessons_progress = progress.get("lessons", {})
    lessons_progress[lesson_id] = {
        "lessonId": lesson_id,
        "completed": True,
        "score": 100,  # No test = 100%
        "attempts": 1,
        "lastAttemptAt": now,
        "completedAt": now,
        "answers": None
    }
    
    # Check if course is completed
    all_lessons = course.get("lessons", [])
    active_lessons = [l for l in all_lessons if l.get("isActive", True)]
    completed_count = sum(
        1 for l in active_lessons 
        if lessons_progress.get(l["id"], {}).get("completed", False)
    )
    course_completed = completed_count >= len(active_lessons) and len(active_lessons) > 0
    
    update_data = {
        "lessons": lessons_progress,
        "isCompleted": course_completed
    }
    
    if course_completed and not progress.get("completedAt"):
        update_data["completedAt"] = now
    
    await db.training_progress.update_one(
        {"userId": user_id, "courseId": course_id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Урок завершён", "courseCompleted": course_completed}


@router.post("/progress/{user_id}/{course_id}/lessons/{lesson_id}/submit")
async def submit_test(
    user_id: str,
    course_id: str,
    lesson_id: str,
    request: SubmitTestRequest
):
    """Submit test answers for a lesson"""
    # Get course and lesson
    course = await db.training_courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    lesson = next((l for l in course.get("lessons", []) if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    questions = lesson.get("questions", [])
    if not questions:
        raise HTTPException(status_code=400, detail="В этом уроке нет теста")
    
    # Calculate score
    correct_count = 0
    results = []
    
    for q in questions:
        q_id = q["id"]
        user_answer = request.answers.get(q_id)
        is_correct = user_answer == q["correctAnswer"]
        
        if is_correct:
            correct_count += 1
        
        results.append({
            "questionId": q_id,
            "questionText": q["text"],
            "userAnswer": user_answer,
            "correctAnswer": q["correctAnswer"],
            "isCorrect": is_correct,
            "explanation": q.get("explanation")
        })
    
    total_questions = len(questions)
    score = round((correct_count / total_questions) * 100) if total_questions > 0 else 0
    passing_score = lesson.get("passingScore", 100)
    passed = score >= passing_score
    
    # Update progress
    now = datetime.now(timezone.utc).isoformat()
    
    progress = await db.training_progress.find_one(
        {"userId": user_id, "courseId": course_id}
    )
    
    if not progress:
        progress = {
            "userId": user_id,
            "courseId": course_id,
            "lessons": {},
            "startedAt": now,
            "completedAt": None,
            "isCompleted": False
        }
    
    lessons_progress = progress.get("lessons", {})
    lesson_progress = lessons_progress.get(lesson_id, {
        "lessonId": lesson_id,
        "completed": False,
        "score": None,
        "attempts": 0,
        "lastAttemptAt": None,
        "completedAt": None,
        "answers": None
    })
    
    lesson_progress["attempts"] = lesson_progress.get("attempts", 0) + 1
    lesson_progress["lastAttemptAt"] = now
    lesson_progress["score"] = score
    lesson_progress["answers"] = request.answers
    
    if passed:
        lesson_progress["completed"] = True
        lesson_progress["completedAt"] = now
    
    lessons_progress[lesson_id] = lesson_progress
    
    # Check if course is completed
    all_lessons = course.get("lessons", [])
    active_lessons = [l for l in all_lessons if l.get("isActive", True)]
    completed_count = sum(
        1 for l in active_lessons 
        if lessons_progress.get(l["id"], {}).get("completed", False)
    )
    course_completed = completed_count >= len(active_lessons) and len(active_lessons) > 0
    
    update_data = {
        "lessons": lessons_progress,
        "isCompleted": course_completed
    }
    
    if course_completed and not progress.get("completedAt"):
        update_data["completedAt"] = now
    
    await db.training_progress.update_one(
        {"userId": user_id, "courseId": course_id},
        {"$set": update_data},
        upsert=True
    )
    
    return SubmitTestResponse(
        passed=passed,
        score=score,
        correctAnswers=correct_count,
        totalQuestions=total_questions,
        requiredScore=passing_score,
        results=results
    )


# ============= Statistics (Admin) =============

@router.get("/statistics")
async def get_training_statistics():
    """Get overall training statistics (admin only)"""
    # Get all courses
    courses = await db.training_courses.find({}, {"_id": 0}).to_list(100)
    
    # Get all progress
    all_progress = await db.training_progress.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate stats
    stats = {
        "totalCourses": len(courses),
        "totalLessons": sum(len(c.get("lessons", [])) for c in courses),
        "totalEnrollments": len(all_progress),
        "completedCourses": sum(1 for p in all_progress if p.get("isCompleted")),
        "courseStats": []
    }
    
    for course in courses:
        course_progress = [p for p in all_progress if p.get("courseId") == course["id"]]
        lessons = course.get("lessons", [])
        
        course_stat = {
            "courseId": course["id"],
            "courseTitle": course.get("title", ""),
            "totalLessons": len(lessons),
            "enrollments": len(course_progress),
            "completions": sum(1 for p in course_progress if p.get("isCompleted")),
            "averageProgress": 0
        }
        
        if course_progress and lessons:
            total_progress = 0
            for p in course_progress:
                lessons_done = sum(
                    1 for l in lessons 
                    if p.get("lessons", {}).get(l["id"], {}).get("completed", False)
                )
                total_progress += (lessons_done / len(lessons)) * 100
            course_stat["averageProgress"] = round(total_progress / len(course_progress))
        
        stats["courseStats"].append(course_stat)
    
    return stats


@router.get("/statistics/users")
async def get_users_training_status():
    """Get training status for all users (admin only)"""
    # Get all users
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    
    # Get all progress
    all_progress = await db.training_progress.find({}, {"_id": 0}).to_list(1000)
    
    # Get all courses
    courses = await db.training_courses.find({"isActive": True}, {"_id": 0}).to_list(100)
    
    result = []
    for user in users:
        user_id = user.get("id") or user.get("username")
        user_progress = [p for p in all_progress if p.get("userId") == user_id]
        
        completed_courses = sum(1 for p in user_progress if p.get("isCompleted"))
        
        result.append({
            "userId": user_id,
            "username": user.get("username", ""),
            "role": user.get("role", ""),
            "totalCourses": len(courses),
            "completedCourses": completed_courses,
            "inProgressCourses": len(user_progress) - completed_courses,
            "completionRate": round((completed_courses / len(courses)) * 100) if courses else 0
        })
    
    return result


# ============= Client Objections (Возражения клиентов) =============

class ObjectionCreate(BaseModel):
    """Create objection request"""
    question: str  # The objection/question from client
    context: Optional[str] = None  # Additional context
    category: Optional[str] = "general"  # Category: general, price, quality, delivery, etc.
    calculator_type: Optional[str] = "both"  # balia, sauna, or both


class ObjectionResponse(BaseModel):
    """Admin response to objection"""
    answer: str  # The answer/response
    script: Optional[str] = None  # Script for handling this objection


@router.get("/objections")
async def get_objections(status: str = "all", category: str = "all", calculator_type: str = "all"):
    """Get all client objections"""
    query = {}
    if status != "all":
        query["status"] = status
    if category != "all":
        query["category"] = category
    if calculator_type != "all":
        # Return objections for specific calculator or "both"
        query["$or"] = [
            {"calculator_type": calculator_type},
            {"calculator_type": "both"},
            {"calculator_type": {"$exists": False}}  # Legacy objections without type
        ]
    
    objections = await db.training_objections.find(query, {"_id": 0}).sort("createdAt", -1).to_list(500)
    return objections


@router.get("/objections/{objection_id}")
async def get_objection(objection_id: str):
    """Get a single objection"""
    objection = await db.training_objections.find_one({"id": objection_id}, {"_id": 0})
    if not objection:
        raise HTTPException(status_code=404, detail="Возражение не найдено")
    return objection


@router.post("/objections")
async def create_objection(objection: ObjectionCreate, user_id: str = None, username: str = None):
    """Create a new objection (manager submits)"""
    now = datetime.now(timezone.utc).isoformat()
    
    objection_data = {
        "id": str(ObjectId()),
        "question": objection.question,
        "context": objection.context,
        "category": objection.category or "general",
        "calculator_type": objection.calculator_type or "both",
        "submittedBy": username or user_id or "anonymous",
        "submittedById": user_id,
        "status": "pending",  # pending, answered, archived
        "answer": None,
        "script": None,
        "answeredBy": None,
        "answeredAt": None,
        "createdAt": now,
        "updatedAt": now,
        "isPublished": False,  # Whether to show in FAQ list
        "views": 0,
        "helpful": 0
    }
    
    await db.training_objections.insert_one(objection_data)
    objection_data.pop("_id", None)
    
    return objection_data


@router.put("/objections/{objection_id}/answer")
async def answer_objection(objection_id: str, response: ObjectionResponse, admin_username: str = None):
    """Admin answers an objection"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check objection exists
    objection = await db.training_objections.find_one({"id": objection_id})
    if not objection:
        raise HTTPException(status_code=404, detail="Возражение не найдено")
    
    update_data = {
        "answer": response.answer,
        "script": response.script,
        "status": "answered",
        "answeredBy": admin_username or "admin",
        "answeredAt": now,
        "updatedAt": now,
        "isPublished": True  # Auto-publish when answered
    }
    
    await db.training_objections.update_one(
        {"id": objection_id},
        {"$set": update_data}
    )
    
    # Return updated objection
    updated = await db.training_objections.find_one({"id": objection_id}, {"_id": 0})
    return updated


@router.put("/objections/{objection_id}")
async def update_objection(objection_id: str, updates: dict):
    """Update objection (admin)"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check objection exists
    objection = await db.training_objections.find_one({"id": objection_id})
    if not objection:
        raise HTTPException(status_code=404, detail="Возражение не найдено")
    
    # Filter allowed fields
    allowed_fields = ["question", "answer", "script", "category", "status", "isPublished", "context", "calculator_type"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    update_data["updatedAt"] = now
    
    await db.training_objections.update_one(
        {"id": objection_id},
        {"$set": update_data}
    )
    
    updated = await db.training_objections.find_one({"id": objection_id}, {"_id": 0})
    return updated


@router.delete("/objections/{objection_id}")
async def delete_objection(objection_id: str):
    """Delete an objection (admin)"""
    result = await db.training_objections.delete_one({"id": objection_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Возражение не найдено")
    return {"message": "Возражение удалено"}


@router.post("/objections/{objection_id}/helpful")
async def mark_objection_helpful(objection_id: str):
    """Mark an objection answer as helpful (any user)"""
    result = await db.training_objections.update_one(
        {"id": objection_id},
        {"$inc": {"helpful": 1}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Возражение не найдено")
    return {"message": "Спасибо за оценку!"}
