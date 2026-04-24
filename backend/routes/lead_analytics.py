"""Lead Analytics Module - Manager performance tracking for amoCRM leads."""
import logging
import os
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv

from database import db
from routes.amocrm import get_amocrm_settings

load_dotenv()
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead-analytics", tags=["Lead Analytics"])

# --- Pydantic Models ---

class AnalyticsSettings(BaseModel):
    pipelineId: str = ""
    analyticsStartDate: str = "2026-01-01"  # Don't load deals created before this date
    newLeadStageIds: List[str] = []  # stages considered "new lead"
    managerWorkStageIds: List[str] = []  # stages where manager starts working (after bot)
    successStageIds: List[str] = []  # stages considered successful processing
    closedLostStageIds: List[str] = []  # stages for "closed/lost" deals — excluded from main stats
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
async def start_sync(background_tasks: BackgroundTasks,
                     date_from: str = None, date_to: str = None, force: bool = False):
    """Start background sync. force=true for full resync, otherwise incremental."""
    settings = await get_analytics_settings()
    pipeline_id = settings.get("pipelineId", "")
    if not pipeline_id:
        raise HTTPException(status_code=400, detail="Pipeline ID не указан в настройках")

    sync_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    await db.lead_analytics_sync.insert_one({
        "sync_id": sync_id, "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "date_from": date_from, "date_to": date_to,
        "mode": "full" if force else "incremental",
        "progress": "подготовка..."
    })

    background_tasks.add_task(_run_sync, sync_id, settings, date_from, date_to, force)
    return {"status": "started", "sync_id": sync_id, "mode": "full" if force else "incremental"}


@router.get("/sync-status")
async def get_sync_status():
    status = await db.lead_analytics_sync.find_one({}, {"_id": 0}, sort=[("startedAt", -1)])
    return status or {"status": "never"}


@router.post("/clear-all")
async def clear_all_analytics_data():
    """Clear ALL analytics data across all modules for a fresh start."""
    results = {}
    for col_name in [
        "lead_analytics_leads", "lead_analytics_managers", "lead_analytics_sync",
        "lead_analytics_ai_history",
        "amocrm_events", "event_manager_stats", "event_analytics_sync",
        "advanced_analytics_data", "advanced_analytics_sync",
    ]:
        r = await db[col_name].delete_many({})
        results[col_name] = r.deleted_count
    return {"status": "ok", "deleted": results}


@router.post("/purge-before-start-date")
async def purge_leads_before_start_date():
    """Remove all analytics leads with createdAtTs before the configured analyticsStartDate.

    Use this after changing analyticsStartDate to clean up legacy data from older syncs.
    """
    settings = await get_analytics_settings()
    start = settings.get("analyticsStartDate")
    if not start:
        raise HTTPException(status_code=400, detail="analyticsStartDate не задана в настройках")
    ts_from = int(datetime.fromisoformat(start).timestamp())

    lead_del = await db.lead_analytics_leads.delete_many({"createdAtTs": {"$lt": ts_from}})
    # Manager aggregates are rebuilt on each sync — just clear stale ones:
    # we keep them; they'll be overwritten on the next sync.
    return {"status": "ok", "startDate": start, "deletedLeads": lead_del.deleted_count}


async def _get_default_date_from() -> str:
    """Return analyticsStartDate as ISO string to use as default lower bound in queries."""
    settings = await get_analytics_settings()
    return settings.get("analyticsStartDate") or None




async def _run_sync(sync_id: str, settings: dict, date_from_str: str = None, date_to_str: str = None, force: bool = False):
    """Background task: incremental sync — only fetch events/notes/tasks for changed leads."""
    try:
        pipeline_id = settings.get("pipelineId", "")

        # Date filters
        ts_from = None
        ts_to = None
        analytics_start = settings.get("analyticsStartDate", "2026-01-01")
        if analytics_start:
            ts_from = int(datetime.fromisoformat(analytics_start).timestamp())
        if date_from_str:
            date_from_ts = int(datetime.fromisoformat(date_from_str).timestamp())
            if ts_from is None or date_from_ts > ts_from:
                ts_from = date_from_ts
        if date_to_str:
            ts_to = int(datetime.fromisoformat(date_to_str).timestamp())

        # 1. Fetch leads list (fast — just lead metadata)
        await _update_sync_progress(sync_id, "загрузка списка сделок...")
        leads = await _fetch_leads_for_pipeline(pipeline_id, ts_from, ts_to)
        # DEFENSIVE: amoCRM sometimes returns leads outside the filter window.
        # Re-filter client-side to guarantee we only ingest leads CREATED in range.
        if ts_from is not None:
            before_filter = len(leads)
            leads = [ld for ld in leads if (ld.get("created_at") or 0) >= ts_from]
            if before_filter != len(leads):
                logger.info(f"Sync {sync_id}: dropped {before_filter - len(leads)} leads with created_at < {ts_from}")
        if ts_to is not None:
            leads = [ld for ld in leads if (ld.get("created_at") or 0) <= ts_to]
        total_leads = len(leads)
        logger.info(f"Sync {sync_id}: {total_leads} leads after client-side created_at filter (ts_from={ts_from})")

        # 1b. Purge any previously-synced docs that are older than the start date.
        # This cleans up legacy data from earlier syncs when analyticsStartDate was different/absent.
        if ts_from is not None:
            old_purged = await db.lead_analytics_leads.delete_many({
                "pipelineId": pipeline_id,
                "createdAtTs": {"$lt": ts_from},
            })
            if old_purged.deleted_count:
                logger.info(f"Sync {sync_id}: purged {old_purged.deleted_count} legacy leads before start date")

        # 2. Build cache of existing lead updated_at
        cached_updated = {}
        if not force:
            cached_docs = await db.lead_analytics_leads.find(
                {}, {"amocrm_lead_id": 1, "amo_updated_at": 1, "_id": 0}
            ).to_list(length=20000)
            for doc in cached_docs:
                cached_updated[doc.get("amocrm_lead_id")] = doc.get("amo_updated_at", 0)

        # 3. Split into changed and unchanged
        changed_leads = []
        unchanged_ids = []
        for lead in leads:
            lid = lead.get("id")
            amo_updated = lead.get("updated_at", 0)
            if not force and lid in cached_updated and cached_updated[lid] == amo_updated:
                unchanged_ids.append(lid)
            else:
                changed_leads.append(lead)

        logger.info(f"Sync {sync_id}: {len(changed_leads)} changed, {len(unchanged_ids)} unchanged (force={force})")
        await _update_sync_progress(sync_id, f"обработка {len(changed_leads)} изменённых из {total_leads}...")

        # 4. Fetch users
        users = await _fetch_amo_users()
        user_map = {str(u["id"]): u.get("name", f"User {u['id']}") for u in users}

        # 5. Process changed leads
        processed = 0
        for i, lead in enumerate(changed_leads):
            lead_id = lead.get("id")
            if not lead_id:
                continue

            events = await _fetch_events_for_lead(lead_id)
            notes = await _fetch_notes_for_lead(lead_id)
            tasks = await _fetch_tasks_for_lead(lead_id)

            record = _compute_lead_metrics(lead, events, notes, tasks, user_map, settings)
            record["amo_updated_at"] = lead.get("updated_at", 0)
            record["sync_id"] = sync_id
            record["syncedAt"] = datetime.now(timezone.utc).isoformat()

            await db.lead_analytics_leads.update_one(
                {"amocrm_lead_id": lead_id},
                {"$set": record},
                upsert=True
            )
            processed += 1

            if (i + 1) % 10 == 0 or i == len(changed_leads) - 1:
                await _update_sync_progress(sync_id, f"обработано {i+1}/{len(changed_leads)} сделок")

        # 6. Update sync_id for unchanged leads (keep old data, just mark as current sync)
        if unchanged_ids:
            await db.lead_analytics_leads.update_many(
                {"amocrm_lead_id": {"$in": unchanged_ids}},
                {"$set": {"sync_id": sync_id, "syncedAt": datetime.now(timezone.utc).isoformat()}}
            )

        # 7. Remove leads deleted from amoCRM
        all_amo_ids = [l.get("id") for l in leads if l.get("id")]
        if all_amo_ids:
            deleted = await db.lead_analytics_leads.delete_many({
                "amocrm_lead_id": {"$nin": all_amo_ids},
                "pipelineId": pipeline_id
            })
            if deleted.deleted_count:
                logger.info(f"Sync {sync_id}: removed {deleted.deleted_count} deleted leads")

        # 8. Compute manager aggregates
        await _update_sync_progress(sync_id, "расчёт статистики менеджеров...")
        await _compute_manager_stats(sync_id, settings)

        await db.lead_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "leadsProcessed": processed,
                "leadsSkipped": len(unchanged_ids),
                "leadsTotal": total_leads,
                "progress": f"готово: {processed} обработано, {len(unchanged_ids)} пропущено"
            }}
        )
        logger.info(f"Sync {sync_id}: completed — {processed} processed, {len(unchanged_ids)} skipped")
    except Exception as e:
        logger.error(f"Lead analytics sync {sync_id} failed: {e}", exc_info=True)
        await db.lead_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {"status": "error", "error": str(e),
                       "completedAt": datetime.now(timezone.utc).isoformat()}}
        )


async def _update_sync_progress(sync_id: str, progress: str):
    await db.lead_analytics_sync.update_one(
        {"sync_id": sync_id}, {"$set": {"progress": progress}}
    )


def _compute_lead_metrics(lead: dict, events: list, notes: list, tasks: list,
                          user_map: dict, settings: dict) -> dict:
    """Compute all metrics for a single lead."""
    bot_ids = set(str(x) for x in settings.get("botUserIds", []))
    # Auto-detect bots by name patterns
    BOT_NAME_PATTERNS = ["salesbot", "робот", "robot", "tilda", "бот", "bot",
                         "биржа лидов", "digital pipeline", "автоматизация"]
    for uid, uname in user_map.items():
        name_lower = uname.lower()
        if any(p in name_lower for p in BOT_NAME_PATTERNS):
            bot_ids.add(str(uid))
    sla_hours = settings.get("slaFirstActionHours", 5)
    stalled_hours = settings.get("stalledThresholdHours", 24)
    manager_work_stages = set(str(x) for x in settings.get("managerWorkStageIds", []))  # noqa: F841
    success_stages = set(str(x) for x in settings.get("successStageIds", []))
    closed_lost_stages = set(str(x) for x in settings.get("closedLostStageIds", []))
    # amoCRM system status 143 = "Закрыто и не реализовано" — always exclude
    closed_lost_stages.add("143")
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
    is_closed_lost = status_id in closed_lost_stages
    # If responsible user is a bot, treat as not processed by human
    responsible_is_bot = responsible_id in bot_ids
    if is_closed_lost:
        processing_status = "closed_lost"
    elif responsible_is_bot or not actions:
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

    is_stalled = idle_hours is not None and idle_hours > stalled_hours and not is_in_success_stage and not is_closed_lost
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
        "isClosedLost": is_closed_lost,
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
                "totalLeadsExclClosed": 0,
                "processedFast": 0,
                "processedLate": 0,
                "notProcessed": 0,
                "weakProcessing": 0,
                "closedLost": 0,
                "stalledCount": 0,
                "withProgress": 0,
                "reactionTimes": [],
                "totalActions": 0,
            }

        m = manager_map[uid]
        m["totalLeads"] += 1
        status = lead.get("processingStatus", "")

        if status == "closed_lost":
            m["closedLost"] += 1
        else:
            m["totalLeadsExclClosed"] += 1
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
        if lead.get("timeToFirstActionHours") is not None and status != "closed_lost":
            m["reactionTimes"].append(lead["timeToFirstActionHours"])
        if status != "closed_lost":
            m["totalActions"] += lead.get("totalActions", 0)

    # Compute averages and save
    for uid, m in manager_map.items():
        reaction_times = m.pop("reactionTimes", [])
        m["avgReactionHours"] = round(sum(reaction_times) / len(reaction_times), 2) if reaction_times else None
        active_leads = m["totalLeadsExclClosed"]
        m["processedPercent"] = round((m["processedFast"] + m["processedLate"]) / active_leads * 100, 1) if active_leads > 0 else 0
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
    # Fallback to analyticsStartDate so legacy docs never leak through
    if not date_from:
        date_from = await _get_default_date_from()
    query = {}
    if date_from:
        query["createdAt"] = {"$gte": date_from}
    if date_to:
        query.setdefault("createdAt", {})["$lte"] = date_to + "T23:59:59"

    leads = await db.lead_analytics_leads.find(query, {"_id": 0}).to_list(length=10000)

    # Separate closed/lost from active leads
    closed_lost_leads = [ld for ld in leads if ld.get("processingStatus") == "closed_lost"]
    active_leads = [ld for ld in leads if ld.get("processingStatus") != "closed_lost"]

    total = len(active_leads)
    if total == 0:
        return {
            "totalLeads": 0, "processedFast": 0, "processedLate": 0,
            "notProcessed": 0, "weakProcessing": 0, "stalledCount": 0,
            "closedLost": len(closed_lost_leads), "totalWithClosed": len(leads),
            "avgReactionHours": None, "conversionByStage": {}
        }

    processed_fast = sum(1 for ld in active_leads if ld.get("processingStatus") == "processed_fast")
    processed_late = sum(1 for ld in active_leads if ld.get("processingStatus") == "processed_late")
    not_processed = sum(1 for ld in active_leads if ld.get("processingStatus") == "not_processed")
    weak = sum(1 for ld in active_leads if ld.get("processingStatus") == "weak_processing")
    stalled = sum(1 for ld in active_leads if ld.get("isStalled"))

    reaction_times = [ld["timeToFirstActionHours"] for ld in active_leads if ld.get("timeToFirstActionHours") is not None]
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
        "closedLost": len(closed_lost_leads),
        "totalWithClosed": len(leads),
        "avgReactionHours": avg_reaction,
        "conversionByStage": stage_counts
    }


@router.get("/managers")
async def get_manager_stats(date_from: str = None, date_to: str = None):
    """Get per-manager statistics."""
    # Always apply analyticsStartDate as lower bound so legacy data never leaks
    if not date_from:
        date_from = await _get_default_date_from()
    # Get latest sync
    last_sync = await db.lead_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    if not last_sync:
        return {"managers": []}

    sync_id = last_sync.get("sync_id")
    query = {"sync_id": sync_id}

    # If date filters, recompute from leads instead of using cached manager stats
    if date_from or date_to:
        lead_query = {"sync_id": sync_id, "processingStatus": {"$ne": "closed_lost"}}
        if date_from:
            lead_query["createdAt"] = {"$gte": date_from}
        if date_to:
            lead_query.setdefault("createdAt", {})["$lte"] = date_to + "T23:59:59"
        leads = await db.lead_analytics_leads.find(lead_query, {"_id": 0}).to_list(length=10000)

        manager_map = {}
        for lead in leads:
            uid = lead.get("responsibleUserId", "unknown")
            if uid not in manager_map:
                manager_map[uid] = {
                    "userId": uid, "userName": lead.get("responsibleUserName", ""),
                    "totalLeads": 0, "processedFast": 0, "processedLate": 0,
                    "notProcessed": 0, "weakProcessing": 0, "closedLost": 0,
                    "stalledCount": 0, "withProgress": 0, "reactionTimes": [], "totalActions": 0,
                }
            m = manager_map[uid]
            m["totalLeads"] += 1
            status = lead.get("processingStatus", "")
            if status == "processed_fast": m["processedFast"] += 1
            elif status == "processed_late": m["processedLate"] += 1
            elif status == "not_processed": m["notProcessed"] += 1
            elif status == "weak_processing": m["weakProcessing"] += 1
            if lead.get("isStalled"): m["stalledCount"] += 1
            if lead.get("hasProgress"): m["withProgress"] += 1
            if lead.get("timeToFirstActionHours") is not None:
                m["reactionTimes"].append(lead["timeToFirstActionHours"])
            m["totalActions"] += lead.get("totalActions", 0)

        managers = []
        for uid, m in manager_map.items():
            rt = m.pop("reactionTimes", [])
            m["avgReactionHours"] = round(sum(rt) / len(rt), 2) if rt else None
            m["processedPercent"] = round((m["processedFast"] + m["processedLate"]) / m["totalLeads"] * 100, 1) if m["totalLeads"] > 0 else 0
            managers.append(m)
    else:
        managers = await db.lead_analytics_managers.find(query, {"_id": 0}).to_list(length=100)

    # Sort by processedPercent descending (rating)
    managers.sort(key=lambda m: m.get("processedPercent", 0), reverse=True)
    for i, m in enumerate(managers):
        m["rank"] = i + 1

    return {"managers": managers, "sync_id": sync_id}


@router.get("/problem-leads")
async def get_problem_leads(date_from: str = None, date_to: str = None, limit: int = 100):
    """Get leads with problems (not processed, stalled, no progress). Excludes closed/lost."""
    if not date_from:
        date_from = await _get_default_date_from()
    query = {
        "processingStatus": {"$ne": "closed_lost"},
        "isClosedLost": {"$ne": True},
        "$or": [
            {"processingStatus": "not_processed"},
            {"processingStatus": "weak_processing"},
            {"isStalled": True},
        ]
    }
    if date_from:
        query["createdAt"] = {"$gte": date_from}
    if date_to:
        query.setdefault("createdAt", {})["$lte"] = date_to + "T23:59:59"
    leads = await db.lead_analytics_leads.find(
        query, {"_id": 0}
    ).sort("idleHours", -1).to_list(length=limit)

    return {"leads": leads, "total": len(leads)}


@router.get("/closed-lost")
async def get_closed_lost_leads(
    date_from: str = None, date_to: str = None,
    manager_id: str = None, limit: int = 200, skip: int = 0
):
    """Get leads in closed/lost stages for monitoring."""
    if not date_from:
        date_from = await _get_default_date_from()
    query = {"processingStatus": "closed_lost"}
    if date_from:
        query["createdAt"] = {"$gte": date_from}
    if date_to:
        query.setdefault("createdAt", {})["$lte"] = date_to + "T23:59:59"
    if manager_id:
        query["responsibleUserId"] = manager_id

    leads = await db.lead_analytics_leads.find(
        query, {"_id": 0}
    ).sort("createdAtTs", -1).skip(skip).to_list(length=limit)

    total = await db.lead_analytics_leads.count_documents(query)

    # Per-manager breakdown
    mgr_counts = {}
    all_closed = await db.lead_analytics_leads.find(
        {"processingStatus": "closed_lost"}, {"responsibleUserId": 1, "responsibleUserName": 1, "_id": 0}
    ).to_list(length=10000)
    for ld in all_closed:
        uid = ld.get("responsibleUserId", "unknown")
        if uid not in mgr_counts:
            mgr_counts[uid] = {"userId": uid, "userName": ld.get("responsibleUserName", ""), "count": 0}
        mgr_counts[uid]["count"] += 1

    return {
        "leads": leads,
        "total": total,
        "byManager": sorted(mgr_counts.values(), key=lambda x: -x["count"])
    }



@router.get("/leads")
async def get_all_analytics_leads(
    date_from: str = None, date_to: str = None,
    manager_id: str = None, status: str = None,
    limit: int = 200, skip: int = 0
):
    """Get all analyzed leads with filters."""
    if not date_from:
        date_from = await _get_default_date_from()
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



# --- AI Recommendations ---

EMERGENT_PROXY_URL = "https://integrations.emergentagent.com/llm"

async def _call_llm(system_message: str, user_prompt: str) -> str:
    """Call LLM via Emergent proxy using direct HTTP (no litellm dependency)."""
    import httpx
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="EMERGENT_LLM_KEY не настроен")
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{EMERGENT_PROXY_URL}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-5.2",
                "messages": [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_prompt},
                ],
            }
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"LLM error: {resp.status_code} {resp.text[:300]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]

AI_SYSTEM_MSG = """Ты — аналитик отдела продаж. Анализируешь данные по обработке входящих лидов менеджерами.
Пиши на русском языке. Будь конкретен, используй цифры из предоставленных данных.
Не используй markdown-заголовки (#), пиши простым текстом с абзацами.
Формат: краткие абзацы с выводами и рекомендациями."""


@router.post("/ai/department-summary")
async def ai_department_summary(date_from: str = None, date_to: str = None):
    """AI-generated department summary."""

    # Get summary data
    query = {}
    if date_from:
        query["createdAt"] = {"$gte": date_from}
    if date_to:
        query.setdefault("createdAt", {})["$lte"] = date_to + "T23:59:59"
    leads = await db.lead_analytics_leads.find(query, {"_id": 0}).to_list(length=5000)

    if not leads:
        return {"text": "Нет данных для анализа. Запустите синхронизацию лидов."}

    total = len(leads)
    fast = sum(1 for ld in leads if ld.get("processingStatus") == "processed_fast")
    late = sum(1 for ld in leads if ld.get("processingStatus") == "processed_late")
    not_proc = sum(1 for ld in leads if ld.get("processingStatus") == "not_processed")
    weak = sum(1 for ld in leads if ld.get("processingStatus") == "weak_processing")
    stalled = sum(1 for ld in leads if ld.get("isStalled"))
    reactions = [ld["timeToFirstActionHours"] for ld in leads if ld.get("timeToFirstActionHours") is not None]
    avg_reaction = round(sum(reactions) / len(reactions), 2) if reactions else None

    prompt = f"""Проанализируй работу отдела продаж за период.

Данные:
- Всего лидов: {total}
- Обработано быстро (в рамках SLA): {fast} ({round(fast/total*100)}%)
- Обработано с задержкой: {late} ({round(late/total*100)}%)
- Не обработано: {not_proc} ({round(not_proc/total*100)}%)
- Слабая обработка (действие было, но без прогресса): {weak} ({round(weak/total*100)}%)
- Зависших сделок: {stalled}
- Среднее время до первого действия: {avg_reaction} часов
- Период: {date_from or 'не указан'} — {date_to or 'не указан'}

Напиши:
1. Краткий общий вывод по отделу (2-3 предложения)
2. Основные проблемы (если есть)
3. Конкретные рекомендации по улучшению
4. Что делается хорошо (если есть)"""

    try:
        text = await _call_llm(AI_SYSTEM_MSG, prompt)
        await db.lead_analytics_ai_history.insert_one({
            "type": "department_summary",
            "date_from": date_from, "date_to": date_to,
            "text": text,
            "createdAt": datetime.now(timezone.utc).isoformat()
        })
        return {"text": text}
    except Exception as e:
        logger.error(f"AI department summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/manager-analysis")
async def ai_manager_analysis(manager_id: str = None):
    """AI-generated per-manager analysis."""

    # Get latest manager stats
    last_sync = await db.lead_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    if not last_sync:
        return {"analyses": []}

    sync_id = last_sync.get("sync_id")
    query = {"sync_id": sync_id}
    if manager_id:
        query["userId"] = manager_id
    managers = await db.lead_analytics_managers.find(query, {"_id": 0}).to_list(length=50)

    if not managers:
        return {"analyses": []}

    # Build data block for each manager
    manager_blocks = []
    for m in managers:
        manager_blocks.append(
            f"Менеджер: {m.get('userName', 'Неизвестно')}\n"
            f"  Лидов: {m.get('totalLeads', 0)}\n"
            f"  Быстро обработано: {m.get('processedFast', 0)}\n"
            f"  С задержкой: {m.get('processedLate', 0)}\n"
            f"  Не обработано: {m.get('notProcessed', 0)}\n"
            f"  Слабая обработка: {m.get('weakProcessing', 0)}\n"
            f"  % обработки: {m.get('processedPercent', 0)}%\n"
            f"  Ср. время реакции: {m.get('avgReactionHours', 'нет данных')} ч\n"
            f"  Зависших: {m.get('stalledCount', 0)}\n"
            f"  С прогрессом по этапам: {m.get('withProgress', 0)}"
        )

    prompt = f"""Проанализируй работу каждого менеджера по обработке лидов.

Данные по менеджерам:
{chr(10).join(manager_blocks)}

По каждому менеджеру напиши (через пустую строку):
- Имя менеджера (жирным, т.е. **Имя**)
- Оценка работы (1-2 предложения)
- Сильные стороны
- Что нужно улучшить
- Конкретная рекомендация"""

    try:
        text = await _call_llm(AI_SYSTEM_MSG, prompt)
        await db.lead_analytics_ai_history.insert_one({
            "type": "manager_analysis",
            "manager_id": manager_id,
            "text": text,
            "createdAt": datetime.now(timezone.utc).isoformat()
        })
        return {"text": text}
    except Exception as e:
        logger.error(f"AI manager analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/problem-lead-advice")
async def ai_problem_lead_advice(lead_id: int):
    """AI advice for a specific problem lead."""

    lead = await db.lead_analytics_leads.find_one({"amocrm_lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    status_labels = {
        "processed_fast": "обработано быстро",
        "processed_late": "обработано с задержкой",
        "not_processed": "не обработано",
        "weak_processing": "слабая обработка"
    }

    prompt = f"""Проанализируй проблемную сделку и дай рекомендации менеджеру.

Данные сделки:
- Название: {lead.get('leadName', '')}
- Клиент: {lead.get('contactName', '')}
- Менеджер: {lead.get('responsibleUserName', '')}
- Дата создания: {lead.get('createdAt', '')}
- Статус обработки: {status_labels.get(lead.get('processingStatus', ''), lead.get('processingStatus', ''))}
- Время до первого действия: {lead.get('timeToFirstActionHours', 'нет')} часов
- Время бездействия: {lead.get('idleHours', 0):.0f} часов
- Кол-во действий: {lead.get('totalActions', 0)}
- Смена этапов: {lead.get('stageChangeCount', 0)}
- Есть примечания: {'да' if lead.get('hasNotes') else 'нет'}
- Есть задачи: {'да' if lead.get('hasTasks') else 'нет'}
- Есть коммуникация: {'да' if lead.get('hasCommunication') else 'нет'}
- Прогресс по этапам: {'да' if lead.get('hasProgress') else 'нет'}
- Зависшая: {'да' if lead.get('isStalled') else 'нет'}

Напиши:
1. Краткий анализ ситуации (2 предложения)
2. Что пошло не так
3. Рекомендуемый следующий шаг для менеджера
4. Вариант follow-up сообщения клиенту (1-2 предложения, дружелюбно и профессионально)"""

    try:
        text = await _call_llm(AI_SYSTEM_MSG, prompt)
        await db.lead_analytics_ai_history.insert_one({
            "type": "problem_lead_advice",
            "lead_id": lead_id,
            "text": text,
            "createdAt": datetime.now(timezone.utc).isoformat()
        })
        return {"text": text, "leadId": lead_id}
    except Exception as e:
        logger.error(f"AI problem lead advice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/common-errors")
async def ai_common_errors():
    """AI analysis of common errors and improvement suggestions."""

    # Get all problem leads
    problem_leads = await db.lead_analytics_leads.find(
        {"$or": [
            {"processingStatus": "not_processed"},
            {"processingStatus": "weak_processing"},
            {"isStalled": True},
        ]}, {"_id": 0}
    ).to_list(length=500)

    if not problem_leads:
        return {"text": "Нет проблемных сделок для анализа. Отличная работа отдела!"}

    # Aggregate patterns
    by_manager = {}
    by_status = {"not_processed": 0, "weak_processing": 0, "stalled": 0}
    no_notes = 0
    no_tasks = 0
    no_communication = 0

    for ld in problem_leads:
        mgr = ld.get("responsibleUserName", "unknown")
        by_manager[mgr] = by_manager.get(mgr, 0) + 1
        st = ld.get("processingStatus", "")
        if st in by_status:
            by_status[st] += 1
        if ld.get("isStalled"):
            by_status["stalled"] += 1
        if not ld.get("hasNotes"):
            no_notes += 1
        if not ld.get("hasTasks"):
            no_tasks += 1
        if not ld.get("hasCommunication"):
            no_communication += 1

    manager_summary = "\n".join(f"  {name}: {count} проблемных" for name, count in sorted(by_manager.items(), key=lambda x: -x[1]))

    prompt = f"""Проанализируй типовые ошибки отдела продаж на основе проблемных сделок.

Статистика проблемных сделок ({len(problem_leads)} всего):
- Не обработано: {by_status['not_processed']}
- Слабая обработка: {by_status['weak_processing']}
- Зависших: {by_status['stalled']}
- Без примечаний: {no_notes}
- Без задач: {no_tasks}
- Без коммуникации: {no_communication}

По менеджерам:
{manager_summary}

Напиши:
1. Список типовых ошибок (пронумерованный)
2. Системные проблемы (если видишь паттерны)
3. Конкретные рекомендации по улучшению процессов
4. Приоритетные действия на ближайшую неделю"""

    try:
        text = await _call_llm(AI_SYSTEM_MSG, prompt)
        await db.lead_analytics_ai_history.insert_one({
            "type": "common_errors",
            "text": text,
            "createdAt": datetime.now(timezone.utc).isoformat()
        })
        return {"text": text}
    except Exception as e:
        logger.error(f"AI common errors error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/closed-lost-analysis")
async def ai_closed_lost_analysis(date_from: str = None, date_to: str = None):
    """AI analysis of closed/lost deals — patterns, reasons, and recommendations."""

    query = {"processingStatus": "closed_lost"}
    if date_from:
        query["createdAt"] = {"$gte": date_from}
    if date_to:
        query.setdefault("createdAt", {})["$lte"] = date_to + "T23:59:59"

    closed_leads = await db.lead_analytics_leads.find(query, {"_id": 0}).to_list(length=5000)

    if not closed_leads:
        return {"text": "Нет закрытых сделок для анализа."}

    total = len(closed_leads)

    # Per-manager breakdown
    by_manager = {}
    for ld in closed_leads:
        mgr = ld.get("responsibleUserName", "Неизвестно")
        if mgr not in by_manager:
            by_manager[mgr] = {"count": 0, "with_comm": 0, "with_notes": 0,
                               "with_tasks": 0, "with_progress": 0, "actions": [],
                               "reaction_times": []}
        m = by_manager[mgr]
        m["count"] += 1
        if ld.get("hasCommunication"):
            m["with_comm"] += 1
        if ld.get("hasNotes"):
            m["with_notes"] += 1
        if ld.get("hasTasks"):
            m["with_tasks"] += 1
        if ld.get("hasProgress"):
            m["with_progress"] += 1
        m["actions"].append(ld.get("totalActions", 0))
        if ld.get("timeToFirstActionHours") is not None:
            m["reaction_times"].append(ld["timeToFirstActionHours"])

    # Overall stats
    no_comm = sum(1 for ld in closed_leads if not ld.get("hasCommunication"))
    no_notes = sum(1 for ld in closed_leads if not ld.get("hasNotes"))
    no_tasks = sum(1 for ld in closed_leads if not ld.get("hasTasks"))
    no_actions = sum(1 for ld in closed_leads if (ld.get("totalActions") or 0) == 0)
    single_action = sum(1 for ld in closed_leads if (ld.get("totalActions") or 0) == 1)
    with_progress = sum(1 for ld in closed_leads if ld.get("hasProgress"))
    all_actions = [ld.get("totalActions", 0) for ld in closed_leads]
    avg_actions = round(sum(all_actions) / len(all_actions), 1) if all_actions else 0
    reaction_times = [ld["timeToFirstActionHours"] for ld in closed_leads if ld.get("timeToFirstActionHours") is not None]
    avg_reaction = round(sum(reaction_times) / len(reaction_times), 1) if reaction_times else None

    manager_lines = []
    for mgr_name, m in sorted(by_manager.items(), key=lambda x: -x[1]["count"]):
        avg_a = round(sum(m["actions"]) / len(m["actions"]), 1) if m["actions"] else 0
        avg_r = round(sum(m["reaction_times"]) / len(m["reaction_times"]), 1) if m["reaction_times"] else None
        manager_lines.append(
            f"  {mgr_name}: {m['count']} закрытых, "
            f"ср. действий: {avg_a}, "
            f"с коммуникацией: {m['with_comm']}/{m['count']}, "
            f"с прогрессом: {m['with_progress']}/{m['count']}, "
            f"ср. реакция: {avg_r or 'нет'} ч"
        )

    prompt = f"""Проанализируй закрытые/нереализованные сделки отдела продаж. Это сделки, которые менеджеры не смогли довести до продажи.

Общая статистика ({total} закрытых сделок):
- Без коммуникации (звонки, сообщения): {no_comm} ({round(no_comm/total*100)}%)
- Без примечаний: {no_notes} ({round(no_notes/total*100)}%)
- Без задач: {no_tasks} ({round(no_tasks/total*100)}%)
- Без единого действия: {no_actions} ({round(no_actions/total*100)}%)
- Только 1 действие и закрыто: {single_action} ({round(single_action/total*100)}%)
- С прогрессом по этапам перед закрытием: {with_progress} ({round(with_progress/total*100)}%)
- Среднее кол-во действий до закрытия: {avg_actions}
- Среднее время реакции: {avg_reaction or 'нет данных'} ч
- Период: {date_from or 'не указан'} — {date_to or 'не указан'}

По менеджерам:
{chr(10).join(manager_lines)}

Напиши подробный анализ:
1. Ключевые паттерны — почему сделки закрываются без реализации (на основе данных)
2. На каком этапе чаще всего теряются клиенты (до коммуникации, после первого контакта, после нескольких действий)
3. Какие менеджеры закрывают больше всех и есть ли у них паттерны
4. Сделки без действий — это системная проблема или единичные случаи
5. Три главных рекомендации по снижению % закрытых
6. Предложи конкретный чек-лист для менеджера перед закрытием сделки (3-5 пунктов)"""

    try:
        text = await _call_llm(AI_SYSTEM_MSG, prompt)
        await db.lead_analytics_ai_history.insert_one({
            "type": "closed_lost_analysis",
            "date_from": date_from, "date_to": date_to,
            "text": text,
            "createdAt": datetime.now(timezone.utc).isoformat()
        })
        return {"text": text}
    except Exception as e:
        logger.error(f"AI closed-lost analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
