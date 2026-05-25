"""Pydantic models for the Planner (internal task manager)."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Status constants (English keys; UI labels are Russian)
STATUSES = ("idea", "planned", "in_progress", "review", "done", "cancelled")
PRIORITIES = ("low", "medium", "high", "urgent")


class ChecklistItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    done: bool = False
    doneByUserId: Optional[str] = None
    doneByUsername: Optional[str] = None
    doneAt: Optional[str] = None


class Comment(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    authorUserId: str
    authorUsername: str
    text: str
    createdAt: str = Field(default_factory=_now_iso)
    editedAt: Optional[str] = None


class HistoryEntry(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    actorUserId: str
    actorUsername: str
    action: str  # "created", "status", "assignee", "due_date", "priority", "title", "checklist", "comment", "archived"
    oldValue: Optional[str] = None
    newValue: Optional[str] = None
    at: str = Field(default_factory=_now_iso)


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    businessDirection: str = "other"
    assigneeUserId: Optional[str] = None  # legacy: single assignee
    assigneeUserIds: Optional[List[str]] = None  # NEW: multiple assignees
    status: Optional[str] = "planned"
    priority: Optional[str] = "medium"
    dueDate: Optional[str] = None
    startDate: Optional[str] = None
    tags: Optional[List[str]] = []
    checklist: Optional[List[ChecklistItem]] = []


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="allow")
    title: Optional[str] = None
    description: Optional[str] = None
    businessDirection: Optional[str] = None
    assigneeUserId: Optional[str] = None  # legacy single; "" to clear
    assigneeUserIds: Optional[List[str]] = None  # NEW multi; [] to clear
    status: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None  # ISO date string; "" to clear
    startDate: Optional[str] = None
    tags: Optional[List[str]] = None
    sortOrder: Optional[int] = None
    archived: Optional[bool] = None


class CommentCreate(BaseModel):
    text: str


class ChecklistItemCreate(BaseModel):
    text: str


class DirectionCreate(BaseModel):
    name: str
    color: Optional[str] = "#64748b"  # tailwind slate-500
    sortOrder: Optional[int] = 100
