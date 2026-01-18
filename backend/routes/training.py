"""
Training module for manager education.
Supports courses with video lessons (Synthesia embed) and tests.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/training", tags=["training"])

# Database connection
from motor.motor_asyncio import AsyncIOMotorClient
import os

mongo_client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
db = mongo_client[os.environ.get("DB_NAME", "wm_kalkulator")]


# ============= Models =============

class Question(BaseModel):
    """Test question model"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    text: str  # Question text
    options: List[str]  # Answer options
    correctAnswer: int  # Index of correct answer (0-based)
    explanation: Optional[str] = None  # Optional explanation for correct answer


class Lesson(BaseModel):
    """Lesson model"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    title: str
    description: Optional[str] = ""
    videoEmbed: Optional[str] = None  # Synthesia embed code (iframe)
    videoUrl: Optional[str] = None  # Alternative: direct video URL
    content: Optional[str] = ""  # Additional text content (markdown)
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
    course = await db.training_courses.find_one({"id": course_id})
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
