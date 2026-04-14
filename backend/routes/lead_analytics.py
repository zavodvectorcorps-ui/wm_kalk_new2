"""Lead Analytics Module - Manager performance tracking for amoCRM leads."""
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from database import db
from routes.amocrm import get_amocrm_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead-analytics", tags=["Lead Analytics"])

# --- Pydantic Models ---

class AnalyticsSettings(BaseModel):
    pipelineId: str = ""
    newLeadStageIds: List[str] = []  # stages considered "new lead"
    managerWorkStageIds: List[str] = []  # stages where manager starts working (after bot)
    successStageIds: List[str] = []  # stages considered successful processing
    slaFirstActionHours: int = 5
    stalledThresholdHours: int = 24
    botUserIds: List[str] = []  # amoCRM user IDs for bots (excluded from "first action")
    managerUserIds: List[str] = []  # amoCRM user IDs considered managers
    countNoteAsAction: bool = True
    countTaskAsAction: bool = True
    countStageChangeAsAction: bool = True
    countCommunicationAsAction: bool = True


# --- Settings Endpoints ---

@router.get("/settings")
async def get_analytics_settings():
    settings = await db.lead_analytics_settings.find_one({"type": "lead_analytics"}, {"_id": 0})
    if not settings:
        settings = AnalyticsSettings().dict()
        settings["type"] = "lead_analytics"
    return settings


@router.put("/settings")
async def save_analytics_settings(settings: AnalyticsSettings):
    data = settings.dict()
    data["type"] = "lead_analytics"
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db.lead_analytics_settings.update_one(
        {"type": "lead_analytics"}, {"$set": data}, upsert=True
    )
    return {"status": "ok"}


# --- amoCRM Data Fetching Helpers ---

async def _amo_get(path: str, params: dict = None) -> Optional[dict]:
    amo = get_amocrm_settings()
    domain = amo.get("amocrm_domain", "")
    token = amo.get("amocrm_token", "")
    if not domain or not token:
        return None
    url = f"https://{domain}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 204:
                return {"_embedded": {}}
            logger.warning(f"amoCRM GET {path} returned {resp.status_code}")
            return None
    except Exception as e:
        logger.error(f"amoCRM GET {path} error: {e}")
        return None


async def _fetch_all_pages(path: str, params: dict, embedded_key: str, max_pages: int = 20) -> list:
    """Fetch all pages from amoCRM paginated endpoint."""
    all_items = []
    page = 1
    while page <= max_pages:
        p = {**params, "page": page, "limit": 250}
        data = await _amo_get(path, p)
        if not data:
            break
        items = data.get("_embedded", {}).get(embedded_key, [])
        if not items:
            break
        all_items.extend(items)
        if len(items) < 250:
            break
        page += 1
    return all_items


async def _fetch_leads_for_pipeline(pipeline_id: str, date_from: int = None, date_to: int = None) -> list:
    params = {"filter[pipeline_id]": pipeline_id, "with": "contacts"}
    if date_from:
        params["filter[created_at][from]"] = date_from
    if date_to:
        params["filter[created_at][to]"] = date_to
    return await _fetch_all_pages("/api/v4/leads", params, "leads")


async def _fetch_events_for_lead(lead_id: int) -> list:
    params = {"filter[entity]": "lead", "filter[entity_id]": lead_id}
    return await _fetch_all_pages("/api/v4/events", params, "events", max_pages=5)


async def _fetch_notes_for_lead(lead_id: int) -> list:
    return await _fetch_all_pages(f"/api/v4/leads/{lead_id}/notes", {}, "notes", max_pages=3)


async def _fetch_tasks_for_lead(lead_id: int) -> list:
    params = {"filter[entity_type]": "leads", "filter[entity_id]": lead_id}
    return await _fetch_all_pages("/api/v4/tasks", params, "tasks", max_pages=3)


async def _fetch_amo_users() -> list:
    data = await _amo_get("/api/v4/users")
    if not data:
        return []
    return data.get("_embedded", {}).get("users", [])


# --- Sync Logic ---

@router.post("/sync")
async def start_sync(background_tasks: BackgroundTasks, date_from: str = None, date_to: str = None):
    """Start background sync of leads from amoCRM for analytics."""
    settings = await get_analytics_settings()
    pipeline_id = settings.get("pipelineId", "")
    if not pipeline_id:
        raise HTTPException(status_code=400, detail="Pipeline ID не указан в настройках")

    sync_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    await db.lead_analytics_sync.insert_one({
        "sync_id": sync_id, "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "date_from": date_from, "date_to": date_to
    })

    background_tasks.add_task(_run_sync, sync_id, settings, date_from, date_to)
    return {"status": "started", "sync_id": sync_id}


@router.get("/sync-status")
async def get_sync_status():
    status = await db.lead_analytics_sync.find_one({}, {"_id": 0}, sort=[("startedAt", -1)])
    return status or {"status": "never"}


async def _run_sync(sync_id: str, settings: dict, date_from_str: str = None, date_to_str: str = None):
    """Background task: fetch leads, events, notes, tasks and compute metrics."""
    try:
        pipeline_id = settings.get("pipelineId", "")

        # Date filters
        ts_from = None
        ts_to = None
        if date_from_str:
            ts_from = int(datetime.fromisoformat(date_from_str).timestamp())
        if date_to_str:
            ts_to = int(datetime.fromisoformat(date_to_str).timestamp())

        # Fetch leads
        leads = await _fetch_leads_for_pipeline(pipeline_id, ts_from, ts_to)
        logger.info(f"Lead analytics sync {sync_id}: fetched {len(leads)} leads")

        # Fetch users for name mapping
        users = await _fetch_amo_users()
        user_map = {str(u["id"]): u.get("name", f"User {u['id']}") for u in users}

        processed = 0
        for lead in leads:
            lead_id = lead.get("id")
            if not lead_id:
                continue

            # Fetch related data
            events = await _fetch_events_for_lead(lead_id)
            notes = await _fetch_notes_for_lead(lead_id)
            tasks = await _fetch_tasks_for_lead(lead_id)

            # Compute metrics
            record = _compute_lead_metrics(lead, events, notes, tasks, user_map, settings)
            record["sync_id"] = sync_id
            record["syncedAt"] = datetime.now(timezone.utc).isoformat()

            # Upsert
            await db.lead_analytics_leads.update_one(
                {"amocrm_lead_id": lead_id},
                {"$set": record},
                upsert=True
            )
            processed += 1

        # Compute manager aggregates
        await _compute_manager_stats(sync_id, settings)

        await db.lead_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "leadsProcessed": processed
            }}
        )
        logger.info(f"Lead analytics sync {sync_id}: completed, {processed} leads processed")
    except Exception as e:
        logger.error(f"Lead analytics sync {sync_id} failed: {e}", exc_info=True)
        await db.lead_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {"status": "error", "error": str(e),
                       "completedAt": datetime.now(timezone.utc).isoformat()}}
        )


def _compute_lead_metrics(lead: dict, events: list, notes: list, tasks: list,
                          user_map: dict, settings: dict) -> dict:
    """Compute all metrics for a single lead."""
    bot_ids = set(str(x) for x in settings.get("botUserIds", []))
    sla_hours = settings.get("slaFirstActionHours", 5)
    stalled_hours = settings.get("stalledThresholdHours", 24)
    manager_work_stages = set(str(x) for x in settings.get("managerWorkStageIds", []))  # noqa: F841
    success_stages = set(str(x) for x in settings.get("successStageIds", []))
    count_note = settings.get("countNoteAsAction", True)
    count_task = settings.get("countTaskAsAction", True)
    count_stage = settings.get("countStageChangeAsAction", True)

    lead_id = lead.get("id")
    created_at = lead.get("created_at", 0)
    created_dt = datetime.fromtimestamp(created_at, tz=timezone.utc) if created_at else datetime.now(timezone.utc)
    responsible_id = str(lead.get("responsible_user_id", ""))
    responsible_name = user_map.get(responsible_id, f"ID:{responsible_id}")
    pipeline_id = str(lead.get("pipeline_id", ""))
    status_id = str(lead.get("status_id", ""))

    # Contact info
    contacts = lead.get("_embedded", {}).get("contacts", [])
    contact_name = contacts[0].get("name", "") if contacts else ""

    # Collect all human actions (excluding bot)
    actions = []

    # Events (stage changes, etc.)
    has_stage_changes = False
    stage_change_count = 0
    for ev in events:
        ev_created = ev.get("created_at", 0)
        ev_user = str(ev.get("created_by", ""))
        ev_type = ev.get("type", "")
        is_bot = ev_user in bot_ids

        if ev_type == "lead_status_changed":
            has_stage_changes = True
            stage_change_count += 1

        if not is_bot and count_stage and "status_changed" in ev_type:
            actions.append({"ts": ev_created, "type": "stage_change", "user": ev_user})

    # Notes
    has_notes = len(notes) > 0
    note_count = 0
    has_communication = False
    for note in notes:
        n_created = note.get("created_at", 0)
        n_user = str(note.get("responsible_user_id", note.get("created_by", "")))
        n_type = note.get("note_type", "")
        is_bot = n_user in bot_ids

        note_count += 1

        # Communication types in amoCRM
        if n_type in ("call_in", "call_out", "sms_in", "sms_out", "message_cashier",
                       "amomail_message", "wechat", "whatsapp"):
            has_communication = True

        if not is_bot and count_note:
            actions.append({"ts": n_created, "type": "note", "user": n_user})

    # Tasks
    has_tasks = len(tasks) > 0
    task_count = 0
    for task in tasks:
        t_created = task.get("created_at", 0)
        t_user = str(task.get("responsible_user_id", ""))
        is_bot = t_user in bot_ids
        task_count += 1

        if not is_bot and count_task:
            actions.append({"ts": t_created, "type": "task", "user": t_user})

    # Sort actions by time
    actions.sort(key=lambda a: a["ts"])

    # Find first & last action
    first_action_ts = actions[0]["ts"] if actions else None
    last_action_ts = actions[-1]["ts"] if actions else None
    first_action_dt = datetime.fromtimestamp(first_action_ts, tz=timezone.utc) if first_action_ts else None
    last_action_dt = datetime.fromtimestamp(last_action_ts, tz=timezone.utc) if last_action_ts else None

    # Time to first action (in hours)
    time_to_first_action = None
    if first_action_dt:
        time_to_first_action = round((first_action_dt - created_dt).total_seconds() / 3600, 2)

    # Idle time (hours since last action)
    now = datetime.now(timezone.utc)
    idle_hours = None
    if last_action_dt:
        idle_hours = round((now - last_action_dt).total_seconds() / 3600, 2)
    else:
        idle_hours = round((now - created_dt).total_seconds() / 3600, 2)

    # Processing status
    is_in_success_stage = status_id in success_stages
    if not actions:
        processing_status = "not_processed"
    elif time_to_first_action is not None and time_to_first_action <= sla_hours:
        if stage_change_count > 1 or is_in_success_stage:
            processing_status = "processed_fast"
        else:
            processing_status = "weak_processing"
    elif time_to_first_action is not None and time_to_first_action > sla_hours:
        processing_status = "processed_late"
    else:
        processing_status = "not_processed"

    # Override: if in success stage, always "processed"
    if is_in_success_stage and processing_status in ("weak_processing", "not_processed"):
        processing_status = "processed_fast" if time_to_first_action and time_to_first_action <= sla_hours else "processed_late"

    is_stalled = idle_hours is not None and idle_hours > stalled_hours and not is_in_success_stage
    has_progress = stage_change_count > 1

    return {
        "amocrm_lead_id": lead_id,
        "leadName": lead.get("name", ""),
        "contactName": contact_name,
        "responsibleUserId": responsible_id,
        "responsibleUserName": responsible_name,
        "pipelineId": pipeline_id,
        "statusId": status_id,
        "createdAt": created_dt.isoformat(),
        "createdAtTs": created_at,
        "firstActionAt": first_action_dt.isoformat() if first_action_dt else None,
        "lastActionAt": last_action_dt.isoformat() if last_action_dt else None,
        "timeToFirstActionHours": time_to_first_action,
        "idleHours": idle_hours,
        "processingStatus": processing_status,
        "isStalled": is_stalled,
        "hasProgress": has_progress,
        "hasStageChanges": has_stage_changes,
        "stageChangeCount": stage_change_count,
        "hasNotes": has_notes,
        "noteCount": note_count,
        "hasTasks": has_tasks,
        "taskCount": task_count,
        "hasCommunication": has_communication,
        "totalActions": len(actions),
        "amocrm_link": f"https://{get_amocrm_settings().get('amocrm_domain', '')}/leads/detail/{lead_id}",
    }


async def _compute_manager_stats(sync_id: str, settings: dict):
    """Compute aggregated stats per manager."""
    leads = await db.lead_analytics_leads.find(
        {"sync_id": sync_id}, {"_id": 0}
    ).to_list(length=10000)

    manager_map = {}
    for lead in leads:
        uid = lead.get("responsibleUserId", "unknown")
        if uid not in manager_map:
            manager_map[uid] = {
                "userId": uid,
                "userName": lead.get("responsibleUserName", ""),
                "totalLeads": 0,
                "processedFast": 0,
                "processedLate": 0,
                "notProcessed": 0,
                "weakProcessing": 0,
                "stalledCount": 0,
                "withProgress": 0,
                "reactionTimes": [],
                "totalActions": 0,
            }

        m = manager_map[uid]
        m["totalLeads"] += 1
        status = lead.get("processingStatus", "")
        if status == "processed_fast":
            m["processedFast"] += 1
        elif status == "processed_late":
            m["processedLate"] += 1
        elif status == "not_processed":
            m["notProcessed"] += 1
        elif status == "weak_processing":
            m["weakProcessing"] += 1

        if lead.get("isStalled"):
            m["stalledCount"] += 1
        if lead.get("hasProgress"):
            m["withProgress"] += 1
        if lead.get("timeToFirstActionHours") is not None:
            m["reactionTimes"].append(lead["timeToFirstActionHours"])
        m["totalActions"] += lead.get("totalActions", 0)

    # Compute averages and save
    for uid, m in manager_map.items():
        reaction_times = m.pop("reactionTimes", [])
        m["avgReactionHours"] = round(sum(reaction_times) / len(reaction_times), 2) if reaction_times else None
        m["processedPercent"] = round((m["processedFast"] + m["processedLate"]) / m["totalLeads"] * 100, 1) if m["totalLeads"] > 0 else 0
        m["sync_id"] = sync_id
        m["computedAt"] = datetime.now(timezone.utc).isoformat()

        await db.lead_analytics_managers.update_one(
            {"userId": uid, "sync_id": sync_id},
            {"$set": m},
            upsert=True
        )


# --- Data Endpoints ---

@router.get("/summary")
async def get_summary(date_from: str = None, date_to: str = None):
    """Get summary metrics for the dashboard."""
    query = {}
    if date_from:
        query["createdAt"] = {"$gte": date_from}
    if date_to:
        query.setdefault("createdAt", {})["$lte"] = date_to + "T23:59:59"

    leads = await db.lead_analytics_leads.find(query, {"_id": 0}).to_list(length=10000)
    total = len(leads)
    if total == 0:
        return {
            "totalLeads": 0, "processedFast": 0, "processedLate": 0,
            "notProcessed": 0, "weakProcessing": 0, "stalledCount": 0,
            "avgReactionHours": None, "conversionByStage": {}
        }

    processed_fast = sum(1 for ld in leads if ld.get("processingStatus") == "processed_fast")
    processed_late = sum(1 for ld in leads if ld.get("processingStatus") == "processed_late")
    not_processed = sum(1 for ld in leads if ld.get("processingStatus") == "not_processed")
    weak = sum(1 for ld in leads if ld.get("processingStatus") == "weak_processing")
    stalled = sum(1 for ld in leads if ld.get("isStalled"))

    reaction_times = [ld["timeToFirstActionHours"] for ld in leads if ld.get("timeToFirstActionHours") is not None]
    avg_reaction = round(sum(reaction_times) / len(reaction_times), 2) if reaction_times else None

    # Stage conversion
    stage_counts = {}
    for ld in leads:
        sid = ld.get("statusId", "unknown")
        stage_counts[sid] = stage_counts.get(sid, 0) + 1

    return {
        "totalLeads": total,
        "processedFast": processed_fast,
        "processedLate": processed_late,
        "notProcessed": not_processed,
        "weakProcessing": weak,
        "stalledCount": stalled,
        "avgReactionHours": avg_reaction,
        "conversionByStage": stage_counts
    }


@router.get("/managers")
async def get_manager_stats():
    """Get per-manager statistics."""
    # Get latest sync
    last_sync = await db.lead_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    if not last_sync:
        return {"managers": []}

    sync_id = last_sync.get("sync_id")
    managers = await db.lead_analytics_managers.find(
        {"sync_id": sync_id}, {"_id": 0}
    ).to_list(length=100)

    # Sort by processedPercent descending (rating)
    managers.sort(key=lambda m: m.get("processedPercent", 0), reverse=True)
    for i, m in enumerate(managers):
        m["rank"] = i + 1

    return {"managers": managers, "sync_id": sync_id}


@router.get("/problem-leads")
async def get_problem_leads(limit: int = 100):
    """Get leads with problems (not processed, stalled, no progress)."""
    query = {
        "$or": [
            {"processingStatus": "not_processed"},
            {"processingStatus": "weak_processing"},
            {"isStalled": True},
        ]
    }
    leads = await db.lead_analytics_leads.find(
        query, {"_id": 0}
    ).sort("idleHours", -1).to_list(length=limit)

    return {"leads": leads, "total": len(leads)}


@router.get("/leads")
async def get_all_analytics_leads(
    date_from: str = None, date_to: str = None,
    manager_id: str = None, status: str = None,
    limit: int = 200, skip: int = 0
):
    """Get all analyzed leads with filters."""
    query = {}
    if date_from:
        query["createdAt"] = {"$gte": date_from}
    if date_to:
        query.setdefault("createdAt", {})["$lte"] = date_to + "T23:59:59"
    if manager_id:
        query["responsibleUserId"] = manager_id
    if status:
        query["processingStatus"] = status

    leads = await db.lead_analytics_leads.find(
        query, {"_id": 0}
    ).sort("createdAtTs", -1).skip(skip).to_list(length=limit)

    total = await db.lead_analytics_leads.count_documents(query)
    return {"leads": leads, "total": total}


@router.get("/pipelines-and-users")
async def get_pipelines_and_users():
    """Fetch pipelines and users from amoCRM for settings configuration."""
    amo = get_amocrm_settings()
    domain = amo.get("amocrm_domain", "")
    token = amo.get("amocrm_token", "")
    if not domain or not token:
        return {"pipelines": [], "users": [], "error": "amoCRM не настроен"}

    pipelines_data = await _amo_get("/api/v4/leads/pipelines")
    users_data = await _amo_get("/api/v4/users")

    pipelines = []
    if pipelines_data:
        for p in pipelines_data.get("_embedded", {}).get("pipelines", []):
            statuses = p.get("_embedded", {}).get("statuses", [])
            pipelines.append({
                "id": str(p["id"]),
                "name": p.get("name", ""),
                "statuses": [{"id": str(s["id"]), "name": s.get("name", "")} for s in statuses]
            })

    users = []
    if users_data:
        for u in users_data.get("_embedded", {}).get("users", []):
            users.append({
                "id": str(u["id"]),
                "name": u.get("name", ""),
                "email": u.get("email", ""),
            })

    return {"pipelines": pipelines, "users": users}
