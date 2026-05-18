"""Planner module — internal task manager.

Admin-only access (governed by `planner` access key). All users with the
access see all tasks (no row-level filtering inside the module).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

from database import db
from models.planner import (
    TaskCreate, TaskUpdate, CommentCreate, ChecklistItemCreate, DirectionCreate,
    Comment, ChecklistItem, HistoryEntry, STATUSES, PRIORITIES,
)
from services.auth_service import get_current_user, get_admin_user

router = APIRouter(prefix="/planner", tags=["Planner"])
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------------

DEFAULT_DIRECTIONS = [
    {"id": "sauna",        "name": "Сауны",            "color": "#f97316", "sortOrder": 1},
    {"id": "greenhouse",   "name": "Теплицы",          "color": "#10b981", "sortOrder": 2},
    {"id": "wm_finance",   "name": "WM Finance",       "color": "#0ea5e9", "sortOrder": 3},
    {"id": "wm_kalkulator","name": "WM Kalkulator",    "color": "#8b5cf6", "sortOrder": 4},
    {"id": "marketing",    "name": "Маркетинг",        "color": "#ec4899", "sortOrder": 5},
    {"id": "it",           "name": "IT / Разработка",  "color": "#6366f1", "sortOrder": 6},
    {"id": "admin",        "name": "Административное", "color": "#64748b", "sortOrder": 7},
    {"id": "other",        "name": "Другое",           "color": "#94a3b8", "sortOrder": 99},
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _actor(user: dict) -> dict:
    return {
        "userId": user.get("sub") or user.get("id") or "",
        "username": user.get("username") or "",
    }


def _strip(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


async def _ensure_user_lookup(user_id: Optional[str]) -> Optional[str]:
    """Return the username for a given user id (or empty)."""
    if not user_id:
        return ""
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1})
    return (u or {}).get("username") or ""


async def _ensure_default_directions():
    """Seed default directions on first access."""
    total = await db.planner_directions.count_documents({})
    if total == 0:
        await db.planner_directions.insert_many([dict(d) for d in DEFAULT_DIRECTIONS])


# ------------------------------------------------------------------------
# DIRECTIONS (admin-only writes)
# ------------------------------------------------------------------------

@router.get("/directions")
async def list_directions(_: dict = Depends(get_current_user)):
    await _ensure_default_directions()
    items = await db.planner_directions.find({}, {"_id": 0}).sort("sortOrder", 1).to_list(length=200)
    return {"items": items}


@router.post("/directions")
async def add_direction(body: DirectionCreate, _: dict = Depends(get_admin_user)):
    item = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "color": body.color or "#64748b",
        "sortOrder": body.sortOrder or 100,
    }
    if not item["name"]:
        raise HTTPException(400, "Name required")
    await db.planner_directions.insert_one(item)
    return _strip(item)


@router.put("/directions/{direction_id}")
async def update_direction(direction_id: str, body: DirectionCreate, _: dict = Depends(get_admin_user)):
    res = await db.planner_directions.update_one(
        {"id": direction_id},
        {"$set": {"name": body.name, "color": body.color, "sortOrder": body.sortOrder or 100}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Direction not found")
    return {"ok": True}


@router.delete("/directions/{direction_id}")
async def delete_direction(direction_id: str, _: dict = Depends(get_admin_user)):
    res = await db.planner_directions.delete_one({"id": direction_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Direction not found")
    return {"ok": True}


# ------------------------------------------------------------------------
# TASKS
# ------------------------------------------------------------------------

@router.get("/tasks")
async def list_tasks(
    status: Optional[str] = None,
    assignee: Optional[str] = None,
    direction: Optional[str] = None,
    priority: Optional[str] = None,
    archived: Optional[bool] = False,
    search: Optional[str] = None,
    overdue: Optional[bool] = None,
    mine: Optional[bool] = None,
    _: dict = Depends(get_current_user),
):
    """List tasks with filters. Admin-only at access layer; no row filtering here."""
    q: dict = {}
    if archived is None:
        q["archived"] = {"$ne": True}
    else:
        q["archived"] = bool(archived)
    if status:
        q["status"] = {"$in": status.split(",")}
    if assignee:
        q["assigneeUserId"] = assignee
    if direction:
        q["businessDirection"] = direction
    if priority:
        q["priority"] = {"$in": priority.split(",")}
    if mine:
        q["assigneeUserId"] = _.get("sub") or _.get("id") or ""
    if overdue:
        today = datetime.now(timezone.utc).date().isoformat()
        q["dueDate"] = {"$ne": "", "$lt": today}
        q["status"] = {"$nin": ["done", "cancelled"]}
    if search:
        q["$or"] = [
            {"title":       {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags":        {"$regex": search, "$options": "i"}},
        ]
    cursor = db.planner_tasks.find(q, {"_id": 0}).sort([("sortOrder", 1), ("createdAt", -1)]).limit(1000)
    items = await cursor.to_list(length=1000)
    return {"items": items, "count": len(items)}


@router.post("/tasks")
async def create_task(body: TaskCreate, user: dict = Depends(get_current_user)):
    return await _create_task_impl(body, user)


async def _create_task_impl(body: TaskCreate, user: dict) -> dict:
    if not body.title.strip():
        raise HTTPException(400, "Title required")
    if body.status and body.status not in STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of {STATUSES}")
    if body.priority and body.priority not in PRIORITIES:
        raise HTTPException(400, f"Invalid priority. Must be one of {PRIORITIES}")

    actor = _actor(user)
    assignee_username = await _ensure_user_lookup(body.assigneeUserId)
    now = _now()
    task = {
        "id": str(uuid.uuid4()),
        "title": body.title.strip(),
        "description": body.description or "",
        "businessDirection": body.businessDirection or "other",
        "assigneeUserId": body.assigneeUserId or "",
        "assigneeUsername": assignee_username,
        "createdByUserId": actor["userId"],
        "createdByUsername": actor["username"],
        "status": body.status or "planned",
        "priority": body.priority or "medium",
        "dueDate": body.dueDate or "",
        "startDate": body.startDate or "",
        "completedAt": "",
        "sortOrder": 0,
        "tags": body.tags or [],
        "checklist": [c.model_dump() if hasattr(c, "model_dump") else c for c in (body.checklist or [])],
        "comments": [],
        "history": [HistoryEntry(
            actorUserId=actor["userId"], actorUsername=actor["username"],
            action="created", newValue=body.title.strip(),
        ).model_dump()],
        "archived": False,
        "createdAt": now,
        "updatedAt": now,
    }
    await db.planner_tasks.insert_one(task)
    return _strip(task)


@router.post("/tasks/bulk-create")
async def bulk_create_tasks(
    body: dict,
    user: dict = Depends(get_current_user),
):
    """Create N tasks in one call. Used by the AI-parse preview confirmation.

    Body: ``{"tasks": [TaskCreate, …]}``. Returns ``{created: int, ids: list}``.
    """
    raw_list = (body or {}).get("tasks") or []
    if not isinstance(raw_list, list) or not raw_list:
        raise HTTPException(400, "tasks list is required")
    if len(raw_list) > 50:
        raise HTTPException(400, "Maximum 50 tasks per request")

    created_ids: list[str] = []
    for raw in raw_list:
        if not isinstance(raw, dict):
            continue
        try:
            t = await _create_task_impl(TaskCreate(**raw), user)
            created_ids.append(t["id"])
        except HTTPException as e:
            logger.warning(f"bulk-create skipped one row: {e.detail}")
        except Exception as e:
            logger.warning(f"bulk-create skipped one row (exc): {e}")
    return {"created": len(created_ids), "ids": created_ids}


@router.post("/ai-parse")
async def ai_parse_tasks(
    body: dict,
    user: dict = Depends(get_current_user),
):
    """Parse a free-form Russian (or any-language) text blob into a structured
    array of task drafts using an LLM. **Does NOT write to DB** — the frontend
    shows the parsed result for review, then commits via ``/tasks/bulk-create``.

    Body::

        {
          "text": "...",                # required, free-form
          "defaultDirection": "sauna",  # optional fallback for parsed tasks
          "assignableUsers": [           # optional list of {id, username}; if
            {"id": "...", "username": "..."}  # LLM matches a name in the text
          ]                                   # to one of these, it sets assignee.
        }

    Returns ``{tasks: [TaskCreate-shaped dicts…], rawCount: int}``.
    """
    import os
    text = (body or {}).get("text") or ""
    if not text.strip():
        raise HTTPException(400, "Field 'text' is required")
    if len(text) > 10000:
        raise HTTPException(400, "Text too long (max 10 000 chars)")

    default_direction = ((body or {}).get("defaultDirection") or "other").strip() or "other"
    assignable_users = (body or {}).get("assignableUsers") or []
    valid_directions = [d["id"] for d in DEFAULT_DIRECTIONS]
    # Pull custom user-defined directions too so the LLM can use them.
    try:
        async for d in db.planner_directions.find({}, {"_id": 0, "id": 1}):
            if d.get("id") and d["id"] not in valid_directions:
                valid_directions.append(d["id"])
    except Exception:  # noqa: BLE001
        pass

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured on the server")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: F401
    except ModuleNotFoundError as e:
        logger.error(f"AI parse: missing dependency — {e}")
        raise HTTPException(
            503,
            "ИИ-парсер временно недоступен: на сервере не установлены зависимости "
            f"(emergentintegrations / litellm). Передеплойте приложение — "
            f"пакет '{e.name or 'litellm'}' доустановится во время сборки. "
            "Если ошибка повторится после ре-деплоя, обратитесь в поддержку Emergent.",
        )
    import json as _json

    users_hint = "\n".join(f"  - {u.get('username','')} (id={u.get('id','')})" for u in assignable_users[:40])
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_weekday = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][datetime.now(timezone.utc).weekday()]

    system_prompt = (
        f"Сегодня: {today_iso} ({today_weekday}).\n"
        "Ты помощник менеджера, который разбирает заметки на отдельные задачи "
        "для системы планирования. На вход дают свободный текст (русский или "
        "польский), на выходе нужно вернуть СТРОГИЙ JSON без markdown, "
        "без обрамления ```, без пояснений. Только сам JSON-массив объектов.\n\n"
        "Каждый объект — одна задача. Если в тексте перечислены несколько "
        "задач (через переносы строк, дефисы, нумерацию или просто список), "
        "выдели каждую в отдельный элемент массива. Если задача только одна — "
        "вернёшь массив из одного элемента.\n\n"
        "Схема элемента:\n"
        "{\n"
        '  "title":             string (короткое, до 80 символов, без точки в конце),\n'
        '  "description":       string (детали из исходного текста, может быть пустой),\n'
        '  "businessDirection": один из ' + str(valid_directions) + ',\n'
        '  "priority":          один из ["low","medium","high","urgent"],\n'
        '  "dueDate":           ISO date "YYYY-MM-DD" если в тексте есть срок, иначе пустая строка. '
        f'Считай от сегодня ({today_iso}). "сегодня"→{today_iso}, '
        '"завтра"→+1 день, "пятница"/"в пятницу"→ближайшая будущая пятница, '
        '"через неделю"→+7 дней. Если срок неоднозначен — пустая строка.,\n'
        '  "tags":              массив строк (опционально),\n'
        '  "checklist":         массив объектов {"text": string} (опционально, для подпунктов задачи),\n'
        '  "assigneeUsername":  username из списка ниже если в тексте упоминается этот человек, иначе пустая строка\n'
        "}\n\n"
        "Доступные исполнители (если упоминаются — заполни assigneeUsername):\n"
        + (users_hint or "  (нет — оставляй пустым)") + "\n\n"
        "Правила:\n"
        "- Если businessDirection не понятно из контекста — поставь \"" + default_direction + "\".\n"
        "- priority по умолчанию 'medium'. 'urgent' только если в тексте 'срочно', 'asap', 'горит'.\n"
        "- Чек-лист используй если задача содержит несколько мелких подпунктов (1.x).\n"
        "- ОТВЕТ — ТОЛЬКО JSON-массив. Никаких пояснений до или после."
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=f"planner-ai-parse-{user.get('username','anon')}",
        system_message=system_prompt,
    ).with_model("gemini", "gemini-2.5-flash")

    try:
        raw_response = await chat.send_message(UserMessage(text=text))
    except Exception as e:
        logger.error(f"AI parse LLM call failed: {e}")
        raise HTTPException(502, f"AI service error: {e}")

    # Robust JSON extraction — strip markdown fences if the model wraps anyway.
    raw_str = (raw_response or "").strip()
    if raw_str.startswith("```"):
        # Drop the opening fence (```json or ```) and the closing fence.
        raw_str = raw_str.split("```", 2)
        raw_str = raw_str[1] if len(raw_str) >= 2 else ""
        if raw_str.lower().startswith("json"):
            raw_str = raw_str[4:]
        raw_str = raw_str.rsplit("```", 1)[0].strip()

    try:
        parsed = _json.loads(raw_str)
    except _json.JSONDecodeError as e:
        logger.warning(f"AI parse returned non-JSON: {raw_response[:200]!r}")
        raise HTTPException(502, f"AI returned malformed JSON: {e}")

    if isinstance(parsed, dict):
        # Some models wrap in {"tasks": [...]} — accept both shapes.
        parsed = parsed.get("tasks") or parsed.get("items") or [parsed]
    if not isinstance(parsed, list):
        raise HTTPException(502, "AI returned unexpected shape (expected JSON array)")

    # Map usernames → user IDs for assignment
    by_username = {u.get("username","").lower(): u.get("id","") for u in assignable_users}

    cleaned: list[dict] = []
    for item in parsed[:50]:  # hard cap
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        if not title:
            continue
        direction = (item.get("businessDirection") or "").strip()
        if direction not in valid_directions:
            direction = default_direction
        priority = (item.get("priority") or "").strip().lower()
        if priority not in PRIORITIES:
            priority = "medium"
        due = (item.get("dueDate") or "").strip()
        assignee_username = (item.get("assigneeUsername") or "").strip().lower()
        cleaned.append({
            "title": title[:120],
            "description": (item.get("description") or "").strip(),
            "businessDirection": direction,
            "priority": priority,
            "dueDate": due,
            "tags": [t for t in (item.get("tags") or []) if isinstance(t, str)][:10],
            "checklist": [{"text": c.get("text") if isinstance(c, dict) else str(c)}
                          for c in (item.get("checklist") or []) if c][:30],
            "assigneeUserId": by_username.get(assignee_username, ""),
            "assigneeUsernameHint": assignee_username or "",
        })

    return {"tasks": cleaned, "rawCount": len(parsed)}


@router.get("/tasks/{task_id}")
async def get_task(task_id: str, _: dict = Depends(get_current_user)):
    task = await db.planner_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskUpdate, user: dict = Depends(get_current_user)):
    task = await db.planner_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")

    actor = _actor(user)
    update_data: dict = {}
    history: List[dict] = list(task.get("history") or [])
    now = _now()

    def _log(action: str, old, new):
        history.append(HistoryEntry(
            actorUserId=actor["userId"], actorUsername=actor["username"],
            action=action,
            oldValue=str(old) if old not in (None, "") else "",
            newValue=str(new) if new not in (None, "") else "",
        ).model_dump())

    payload = body.model_dump(exclude_unset=True)
    if "title" in payload and payload["title"] != task.get("title"):
        update_data["title"] = (payload["title"] or "").strip()
        _log("title", task.get("title"), update_data["title"])
    if "description" in payload:
        update_data["description"] = payload["description"] or ""
    if "businessDirection" in payload and payload["businessDirection"] != task.get("businessDirection"):
        update_data["businessDirection"] = payload["businessDirection"]
        _log("direction", task.get("businessDirection"), payload["businessDirection"])
    if "assigneeUserId" in payload and payload["assigneeUserId"] != task.get("assigneeUserId"):
        new_id = payload["assigneeUserId"] or ""
        update_data["assigneeUserId"] = new_id
        update_data["assigneeUsername"] = await _ensure_user_lookup(new_id)
        _log("assignee", task.get("assigneeUsername") or task.get("assigneeUserId"), update_data["assigneeUsername"] or new_id)
    if "status" in payload and payload["status"] != task.get("status"):
        if payload["status"] not in STATUSES:
            raise HTTPException(400, f"Invalid status. Must be one of {STATUSES}")
        update_data["status"] = payload["status"]
        _log("status", task.get("status"), payload["status"])
        if payload["status"] == "done" and not task.get("completedAt"):
            update_data["completedAt"] = now
        elif payload["status"] != "done":
            update_data["completedAt"] = ""
    if "priority" in payload and payload["priority"] != task.get("priority"):
        if payload["priority"] not in PRIORITIES:
            raise HTTPException(400, f"Invalid priority. Must be one of {PRIORITIES}")
        update_data["priority"] = payload["priority"]
        _log("priority", task.get("priority"), payload["priority"])
    if "dueDate" in payload and payload["dueDate"] != task.get("dueDate"):
        update_data["dueDate"] = payload["dueDate"] or ""
        _log("due_date", task.get("dueDate"), payload["dueDate"])
    if "startDate" in payload:
        update_data["startDate"] = payload["startDate"] or ""
    if "tags" in payload:
        update_data["tags"] = payload["tags"] or []
    if "sortOrder" in payload:
        update_data["sortOrder"] = int(payload["sortOrder"] or 0)
    if "archived" in payload and bool(payload["archived"]) != bool(task.get("archived")):
        update_data["archived"] = bool(payload["archived"])
        _log("archived", task.get("archived"), payload["archived"])

    if update_data:
        update_data["updatedAt"] = now
        update_data["history"] = history
        await db.planner_tasks.update_one({"id": task_id}, {"$set": update_data})

    fresh = await db.planner_tasks.find_one({"id": task_id}, {"_id": 0})
    return fresh


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, _: dict = Depends(get_admin_user)):
    """Hard delete (admin-only). Use PUT archived=true for soft delete."""
    res = await db.planner_tasks.delete_one({"id": task_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Task not found")
    return {"ok": True}


# ------------------------------------------------------------------------
# COMMENTS (embedded in the task doc)
# ------------------------------------------------------------------------

@router.post("/tasks/{task_id}/comments")
async def add_comment(task_id: str, body: CommentCreate, user: dict = Depends(get_current_user)):
    task = await db.planner_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    if not body.text.strip():
        raise HTTPException(400, "Text required")
    actor = _actor(user)
    comment = Comment(
        authorUserId=actor["userId"], authorUsername=actor["username"], text=body.text.strip(),
    ).model_dump()
    history = task.get("history") or []
    history.append(HistoryEntry(
        actorUserId=actor["userId"], actorUsername=actor["username"],
        action="comment", newValue=body.text.strip()[:80],
    ).model_dump())
    await db.planner_tasks.update_one(
        {"id": task_id},
        {"$push": {"comments": comment}, "$set": {"updatedAt": _now(), "history": history}},
    )
    return comment


@router.put("/tasks/{task_id}/comments/{comment_id}")
async def edit_comment(task_id: str, comment_id: str, body: CommentCreate, user: dict = Depends(get_current_user)):
    task = await db.planner_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    actor = _actor(user)
    comments = task.get("comments") or []
    edited = False
    for c in comments:
        if c.get("id") == comment_id:
            if c.get("authorUserId") != actor["userId"] and user.get("role") != "admin":
                raise HTTPException(403, "Can edit only own comment")
            c["text"] = body.text.strip()
            c["editedAt"] = _now()
            edited = True
            break
    if not edited:
        raise HTTPException(404, "Comment not found")
    await db.planner_tasks.update_one({"id": task_id}, {"$set": {"comments": comments, "updatedAt": _now()}})
    return {"ok": True}


@router.delete("/tasks/{task_id}/comments/{comment_id}")
async def delete_comment(task_id: str, comment_id: str, user: dict = Depends(get_current_user)):
    task = await db.planner_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    actor = _actor(user)
    comments = task.get("comments") or []
    new_comments = []
    removed = False
    for c in comments:
        if c.get("id") == comment_id:
            if c.get("authorUserId") != actor["userId"] and user.get("role") != "admin":
                raise HTTPException(403, "Can delete only own comment")
            removed = True
            continue
        new_comments.append(c)
    if not removed:
        raise HTTPException(404, "Comment not found")
    await db.planner_tasks.update_one({"id": task_id}, {"$set": {"comments": new_comments, "updatedAt": _now()}})
    return {"ok": True}


# ------------------------------------------------------------------------
# CHECKLIST
# ------------------------------------------------------------------------

@router.post("/tasks/{task_id}/checklist")
async def add_checklist_item(task_id: str, body: ChecklistItemCreate, user: dict = Depends(get_current_user)):
    task = await db.planner_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    item = ChecklistItem(text=body.text.strip()).model_dump()
    await db.planner_tasks.update_one(
        {"id": task_id}, {"$push": {"checklist": item}, "$set": {"updatedAt": _now()}}
    )
    return item


@router.patch("/tasks/{task_id}/checklist/{item_id}")
async def toggle_checklist_item(task_id: str, item_id: str, user: dict = Depends(get_current_user)):
    task = await db.planner_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    actor = _actor(user)
    items = task.get("checklist") or []
    toggled = False
    for it in items:
        if it.get("id") == item_id:
            it["done"] = not it.get("done")
            if it["done"]:
                it["doneByUserId"] = actor["userId"]
                it["doneByUsername"] = actor["username"]
                it["doneAt"] = _now()
            else:
                it["doneByUserId"] = ""
                it["doneByUsername"] = ""
                it["doneAt"] = ""
            toggled = True
            break
    if not toggled:
        raise HTTPException(404, "Checklist item not found")
    await db.planner_tasks.update_one({"id": task_id}, {"$set": {"checklist": items, "updatedAt": _now()}})
    return {"ok": True}


@router.delete("/tasks/{task_id}/checklist/{item_id}")
async def delete_checklist_item(task_id: str, item_id: str, _: dict = Depends(get_current_user)):
    res = await db.planner_tasks.update_one(
        {"id": task_id},
        {"$pull": {"checklist": {"id": item_id}}, "$set": {"updatedAt": _now()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Task not found")
    return {"ok": True}


# ------------------------------------------------------------------------
# DASHBOARD
# ------------------------------------------------------------------------

@router.get("/dashboard")
async def planner_dashboard(user: dict = Depends(get_current_user)):
    actor = _actor(user)
    today = datetime.now(timezone.utc).date().isoformat()
    # compute 7 days back
    from datetime import timedelta
    seven_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    pipeline_by_status = [
        {"$match": {"archived": {"$ne": True}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    by_status = {x["_id"]: x["count"] for x in await db.planner_tasks.aggregate(pipeline_by_status).to_list(length=20)}

    pipeline_by_direction = [
        {"$match": {"archived": {"$ne": True}, "status": {"$nin": ["done", "cancelled"]}}},
        {"$group": {"_id": "$businessDirection", "count": {"$sum": 1}}},
    ]
    by_direction = {x["_id"]: x["count"] for x in await db.planner_tasks.aggregate(pipeline_by_direction).to_list(length=50)}

    pipeline_by_assignee = [
        {"$match": {"archived": {"$ne": True}, "status": {"$nin": ["done", "cancelled"]}, "assigneeUserId": {"$ne": ""}}},
        {"$group": {"_id": {"id": "$assigneeUserId", "name": "$assigneeUsername"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    by_assignee = [
        {"userId": x["_id"]["id"], "username": x["_id"]["name"], "count": x["count"]}
        for x in await db.planner_tasks.aggregate(pipeline_by_assignee).to_list(length=10)
    ]

    total_active = await db.planner_tasks.count_documents({
        "archived": {"$ne": True}, "status": {"$nin": ["done", "cancelled"]},
    })
    my_active = await db.planner_tasks.count_documents({
        "archived": {"$ne": True}, "status": {"$nin": ["done", "cancelled"]},
        "assigneeUserId": actor["userId"],
    })
    overdue = await db.planner_tasks.count_documents({
        "archived": {"$ne": True}, "status": {"$nin": ["done", "cancelled"]},
        "dueDate": {"$ne": "", "$lt": today},
    })
    completed_7d = await db.planner_tasks.count_documents({
        "status": "done", "completedAt": {"$gte": seven_ago},
    })
    urgent = await db.planner_tasks.count_documents({
        "archived": {"$ne": True}, "status": {"$nin": ["done", "cancelled"]},
        "priority": "urgent",
    })

    return {
        "totalActive": total_active,
        "myActive": my_active,
        "overdue": overdue,
        "completed7d": completed_7d,
        "urgent": urgent,
        "byStatus": by_status,
        "byDirection": by_direction,
        "byAssignee": by_assignee,
    }


# ------------------------------------------------------------------------
# FILTER PRESETS (saved searches per user)
# ------------------------------------------------------------------------

@router.get("/filter-presets")
async def list_filter_presets(user: dict = Depends(get_current_user)):
    actor = _actor(user)
    items = await db.planner_filter_presets.find(
        {"$or": [{"userId": actor["userId"]}, {"shared": True}]},
        {"_id": 0},
    ).sort("createdAt", -1).to_list(length=100)
    return {"items": items}


@router.post("/filter-presets")
async def save_filter_preset(body: dict, user: dict = Depends(get_current_user)):
    actor = _actor(user)
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    preset = {
        "id": str(uuid.uuid4()),
        "userId": actor["userId"],
        "username": actor["username"],
        "name": name,
        "filters": body.get("filters") or {},
        "shared": bool(body.get("shared")),
        "createdAt": _now(),
    }
    await db.planner_filter_presets.insert_one(preset)
    _strip(preset)
    return preset


@router.delete("/filter-presets/{preset_id}")
async def delete_filter_preset(preset_id: str, user: dict = Depends(get_current_user)):
    actor = _actor(user)
    q = {"id": preset_id}
    if user.get("role") != "admin":
        q["userId"] = actor["userId"]
    res = await db.planner_filter_presets.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(404, "Preset not found or access denied")
    return {"ok": True}
