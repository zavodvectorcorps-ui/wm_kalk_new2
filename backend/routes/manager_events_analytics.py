"""Manager Events Analytics - Event-based manager performance tracking from amoCRM Analytics Events API."""
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from database import db
from routes.amocrm import get_amocrm_settings
from routes.lead_analytics import _amo_get, _fetch_all_pages
from routes.binotel_analytics import aggregate_by_amocrm_user as _binotel_by_amocrm_user, _is_configured as _binotel_is_configured

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead-analytics/events", tags=["Manager Events Analytics"])


# --- Settings Model ---

class EventAnalyticsSettings(BaseModel):
    usefulEventTypes: List[str] = [
        "lead_added", "lead_status_changed", "entity_linked",
        "note_added", "task_added", "task_completed",
        "incoming_call", "outgoing_call", "incoming_chat_message", "outgoing_chat_message"
    ]
    progressStageIds: List[str] = []
    successStageIds: List[str] = []
    slaFirstActionHours: int = 5
    stalledThresholdHours: int = 24
    # Scoring weights (must roughly sum to 100; UI shows percentage of total).
    # Rebalanced Feb 2026 to punish "fire-and-forget" managers — progress &
    # follow-up together carry 45%, raw activity only 10.
    weightReactionSpeed: int = 20
    weightProcessingPercent: int = 20
    weightEventActivity: int = 10
    weightDealProgress: int = 25
    weightFollowUp: int = 20
    weightProblemLeads: int = 5
    # Daily Telegram digest (sent once per day after auto-sync).
    dailyReportEnabled: bool = False
    dailyReportHour: int = 8  # UTC hour, 0..23
    dailyReportChatId: str = ""  # leave empty → use TELEGRAM_CHAT_ID env
    dailyReportAiAdvice: bool = True  # append GPT-5.2 insights at the bottom
    # Daily unified sync (leads + events) — runs independently of the digest
    # so the dashboard is always fresh when the team arrives in the morning.
    autoDailySyncEnabled: bool = False
    autoDailySyncHour: int = 6  # UTC hour, 0..23 — defaults to ~7-8 Warsaw


@router.get("/settings")
async def get_event_analytics_settings():
    settings = await db.event_analytics_settings.find_one({"type": "event_analytics"}, {"_id": 0})
    # Always start from current model defaults so newly-added fields (e.g. the
    # follow-up weight) appear even if the DB doc was created before the schema
    # was extended.
    defaults = EventAnalyticsSettings().dict()
    if settings:
        for k, v in defaults.items():
            settings.setdefault(k, v)
        return settings
    return defaults


@router.put("/settings")
async def save_event_analytics_settings(settings: EventAnalyticsSettings):
    data = settings.dict()
    data["type"] = "event_analytics"
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db.event_analytics_settings.update_one(
        {"type": "event_analytics"}, {"$set": data}, upsert=True
    )
    return {"status": "ok"}


# --- Events Sync ---

async def _fetch_events_batch(date_from_ts: int = None, date_to_ts: int = None,
                               created_by: str = None, event_type: str = None) -> list:
    """Fetch events from amoCRM Analytics Events API with filters."""
    params = {}
    if date_from_ts:
        params["filter[created_at][from]"] = date_from_ts
    if date_to_ts:
        params["filter[created_at][to]"] = date_to_ts
    if created_by:
        params["filter[created_by]"] = created_by
    if event_type:
        params["filter[type]"] = event_type
    return await _fetch_all_pages("/api/v4/events", params, "events", max_pages=40)


def _normalize_event(ev: dict, user_map: dict) -> dict:
    """Normalize raw amoCRM event into storable format."""
    ev_id = ev.get("id", "")
    ev_type = ev.get("type", "")
    created_at = ev.get("created_at", 0)
    created_by = str(ev.get("created_by", ""))
    entity_type = ""
    entity_id = None

    # Parse entity from event type or embedded data
    if "lead" in ev_type:
        entity_type = "lead"
    elif "contact" in ev_type:
        entity_type = "contact"
    elif "task" in ev_type:
        entity_type = "task"
    elif "note" in ev_type:
        entity_type = "note"

    # Try to get entity_id
    entity_id = ev.get("entity_id")

    # Value before/after
    value_before = ev.get("value_before", [])
    value_after = ev.get("value_after", [])

    # For lead_status_changed, extract pipeline/status info
    lead_id = None
    status_before = None
    status_after = None
    pipeline_id = None

    if ev_type == "lead_status_changed":
        entity_type = "lead"
        lead_id = entity_id
        if value_before and isinstance(value_before, list) and len(value_before) > 0:
            ls = value_before[0].get("lead_status", {})
            status_before = str(ls.get("id", ""))
            pipeline_id = str(ls.get("pipeline_id", ""))
        if value_after and isinstance(value_after, list) and len(value_after) > 0:
            ls = value_after[0].get("lead_status", {})
            status_after = str(ls.get("id", ""))
            if not pipeline_id:
                pipeline_id = str(ls.get("pipeline_id", ""))

    if ev_type == "lead_added":
        entity_type = "lead"
        lead_id = entity_id

    return {
        "event_id": ev_id,
        "type": ev_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "lead_id": lead_id,
        "created_at_ts": created_at,
        "created_at": datetime.fromtimestamp(created_at, tz=timezone.utc).isoformat() if created_at else None,
        "created_by": created_by,
        "created_by_name": user_map.get(created_by, f"ID:{created_by}"),
        "pipeline_id": pipeline_id,
        "status_before": status_before,
        "status_after": status_after,
        "value_before_raw": str(value_before)[:500] if value_before else None,
        "value_after_raw": str(value_after)[:500] if value_after else None,
    }


@router.post("/sync")
async def start_events_sync(background_tasks: BackgroundTasks,
                              date_from: str = None, date_to: str = None):
    """Start background sync of events from amoCRM."""
    # Auto-cancel any stale running sync so the user can always restart.
    await db.event_analytics_sync.update_many(
        {"status": "running"},
        {"$set": {
            "status": "error",
            "error": "Заменено новой синхронизацией",
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }}
    )
    sync_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    await db.event_analytics_sync.insert_one({
        "sync_id": sync_id, "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "date_from": date_from, "date_to": date_to,
        "progress": "Запуск…",
    })
    background_tasks.add_task(_run_events_sync, sync_id, date_from, date_to)
    return {"status": "started", "sync_id": sync_id}


@router.get("/sync-status")
async def get_events_sync_status():
    status = await db.event_analytics_sync.find_one({}, {"_id": 0}, sort=[("startedAt", -1)])
    if not status:
        return {"status": "never"}
    # Auto-recover stale "running" syncs — if the backend was restarted (or the
    # task crashed silently) the doc would otherwise stay "running" forever and
    # block the user from kicking off a fresh sync.
    if status.get("status") == "running":
        started_at = status.get("startedAt")
        try:
            started_dt = datetime.fromisoformat(started_at) if started_at else None
        except Exception:
            started_dt = None
        if started_dt:
            age_min = (datetime.now(timezone.utc) - started_dt).total_seconds() / 60
            if age_min > 60:  # 60 min budget — accommodates large amoCRM accounts
                stale_msg = (
                    f"Синхронизация подвисла >{int(age_min)} мин — "
                    "автоматически помечена как ошибка. Запустите заново."
                )
                await db.event_analytics_sync.update_one(
                    {"sync_id": status["sync_id"]},
                    {"$set": {
                        "status": "error",
                        "error": stale_msg,
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    }}
                )
                status["status"] = "error"
                status["error"] = stale_msg
    return status


@router.post("/sync/cancel")
async def cancel_running_sync():
    """Mark any currently-running sync as cancelled so a new one can start."""
    res = await db.event_analytics_sync.update_many(
        {"status": "running"},
        {"$set": {
            "status": "error",
            "error": "Отменено пользователем",
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"cancelled": res.modified_count}


async def _run_events_sync(sync_id: str, date_from_str: str = None, date_to_str: str = None):
    """Background: fetch events, normalize, store, compute stats."""
    async def _set_progress(text: str):
        try:
            await db.event_analytics_sync.update_one(
                {"sync_id": sync_id}, {"$set": {"progress": text}}
            )
        except Exception:
            pass
    try:
        ts_from = int(datetime.fromisoformat(date_from_str).timestamp()) if date_from_str else None
        ts_to = int(datetime.fromisoformat(date_to_str).timestamp()) if date_to_str else None

        # Fetch users
        await _set_progress("Загрузка пользователей amoCRM…")
        users_data = await _amo_get("/api/v4/users")
        user_map = {}
        if users_data:
            for u in users_data.get("_embedded", {}).get("users", []):
                user_map[str(u["id"])] = u.get("name", f"User {u['id']}")

        # Fetch all events for the period
        await _set_progress("Загрузка событий из amoCRM…")
        events = await _fetch_events_batch(ts_from, ts_to)
        logger.info(f"Events sync {sync_id}: fetched {len(events)} events")
        await _set_progress(f"Получено {len(events)} событий, сохранение…")

        # Normalize and store
        stored = 0
        for ev in events:
            normalized = _normalize_event(ev, user_map)
            normalized["sync_id"] = sync_id
            await db.amocrm_events.update_one(
                {"event_id": normalized["event_id"]},
                {"$set": normalized},
                upsert=True
            )
            stored += 1
            if stored % 500 == 0:
                await _set_progress(f"Сохранено {stored}/{len(events)} событий…")

        # Compute manager stats from events
        await _set_progress("Расчёт статистики по менеджерам…")
        await _compute_event_manager_stats(sync_id, ts_from, ts_to, user_map)

        await db.event_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "eventsProcessed": stored,
                "progress": f"Готово · {stored} событий",
            }}
        )
        logger.info(f"Events sync {sync_id}: completed, {stored} events stored")
    except Exception as e:
        logger.error(f"Events sync {sync_id} failed: {e}", exc_info=True)
        await db.event_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {"status": "error", "error": str(e),
                       "completedAt": datetime.now(timezone.utc).isoformat(),
                       "progress": f"Ошибка: {str(e)[:200]}"}}
        )


async def _compute_event_manager_stats(sync_id: str, ts_from: int = None, ts_to: int = None,
                                         user_map: dict = None):
    """Compute per-manager stats from stored events."""
    # Get settings
    settings = await get_event_analytics_settings()
    useful_types = set(settings.get("usefulEventTypes", []))
    sla_hours = settings.get("slaFirstActionHours", 5)
    stalled_hours = settings.get("stalledThresholdHours", 24)
    success_stages = set(str(x) for x in settings.get("successStageIds", []))
    progress_stages = set(str(x) for x in settings.get("progressStageIds", []))
    weights = {
        "reaction": settings.get("weightReactionSpeed", 20),
        "processing": settings.get("weightProcessingPercent", 20),
        "activity": settings.get("weightEventActivity", 10),
        "progress": settings.get("weightDealProgress", 25),
        "followUp": settings.get("weightFollowUp", 20),
        "problems": settings.get("weightProblemLeads", 5),
    }

    # Get events for this sync period
    query = {}
    if ts_from:
        query["created_at_ts"] = {"$gte": ts_from}
    if ts_to:
        query.setdefault("created_at_ts", {})["$lte"] = ts_to

    events = await db.amocrm_events.find(query, {"_id": 0}).to_list(length=50000)

    # Also get lead analytics data for cross-referencing
    lead_query = {}
    if ts_from:
        dt_from = datetime.fromtimestamp(ts_from, tz=timezone.utc).isoformat()
        lead_query["createdAt"] = {"$gte": dt_from}
    if ts_to:
        dt_to = datetime.fromtimestamp(ts_to, tz=timezone.utc).isoformat()
        lead_query.setdefault("createdAt", {})["$lte"] = dt_to
    analyzed_leads = await db.lead_analytics_leads.find(lead_query, {"_id": 0}).to_list(length=10000)

    # Index leads by responsible
    leads_by_manager = {}
    for ld in analyzed_leads:
        uid = ld.get("responsibleUserId", "")
        if uid not in leads_by_manager:
            leads_by_manager[uid] = []
        leads_by_manager[uid].append(ld)

    # Aggregate events by manager
    mgr_events = {}
    for ev in events:
        uid = ev.get("created_by", "unknown")
        if uid not in mgr_events:
            mgr_events[uid] = []
        mgr_events[uid].append(ev)

    # All manager IDs (union of event creators and lead responsibles)
    all_managers = set(mgr_events.keys()) | set(leads_by_manager.keys())
    if user_map is None:
        user_map = {}

    # Apply bot exclusion + (optional) manager whitelist from lead_analytics
    # settings so we don't waste compute or DB space on bot accounts.
    la_settings = await db.lead_analytics_settings.find_one(
        {"type": "lead_analytics"}, {"_id": 0}
    ) or {}
    bot_ids = {str(x) for x in (la_settings.get("botUserIds") or [])}
    bot_ids.update({"0", "", "None", "unknown"})
    manager_whitelist = {str(x) for x in (la_settings.get("managerUserIds") or [])}
    # Capture orphan/unassigned leads BEFORE filtering them out — they
    # represent leads with responsibleUserId="0"/"" in amoCRM (= no manager
    # assigned). Without this they vanish from the dashboard and the user
    # sees totals like "36 лидов / 2 на менеджерах" with no explanation.
    orphan_leads = []
    for orphan_uid in ("", "0", "None", "unknown"):
        orphan_leads.extend(leads_by_manager.get(orphan_uid, []))
    orphan_count = len(orphan_leads)

    all_managers = {
        uid for uid in all_managers
        if str(uid) not in bot_ids
        and (not manager_whitelist or str(uid) in manager_whitelist)
    }

    # Pre-fetch authoritative call counts per manager from call_analytics_calls
    # — note-based counts in lead_analytics miss Binotel-only calls and calls
    # that arrive via call analytics sync (separate pipeline).
    call_query = {}
    if ts_from:
        dt_from = datetime.fromtimestamp(ts_from, tz=timezone.utc).isoformat()
        call_query["datetime"] = {"$gte": dt_from}
    if ts_to:
        dt_to = datetime.fromtimestamp(ts_to, tz=timezone.utc).isoformat()
        call_query.setdefault("datetime", {})["$lte"] = dt_to
    calls_pipeline = [
        {"$match": call_query} if call_query else {"$match": {}},
        {"$group": {
            "_id": {"manager": "$manager_id", "direction": "$direction"},
            "count": {"$sum": 1},
        }},
    ]
    calls_by_mgr: dict[str, dict] = {}
    try:
        async for row in db.call_analytics_calls.aggregate(calls_pipeline):
            mid = (row["_id"].get("manager") or "unknown")
            direction = (row["_id"].get("direction") or "").lower()
            slot = calls_by_mgr.setdefault(mid, {"out": 0, "in": 0})
            if direction in ("outbound", "out", "outgoing"):
                slot["out"] += row["count"]
            elif direction in ("inbound", "in", "incoming"):
                slot["in"] += row["count"]
    except Exception as e:
        logger.warning(f"Failed to aggregate call_analytics_calls: {e}")

    # Compute stats per manager
    all_stats = []
    max_events = 1
    max_progress = 1

    for uid in all_managers:
        evts = mgr_events.get(uid, [])
        lds = leads_by_manager.get(uid, [])
        name = user_map.get(uid, f"ID:{uid}")

        total_events = len(evts)
        lead_events = sum(1 for e in evts if e.get("entity_type") == "lead")
        contact_events = sum(1 for e in evts if e.get("entity_type") == "contact")
        stage_changes = sum(1 for e in evts if e.get("type") == "lead_status_changed")
        task_events = sum(1 for e in evts if "task" in e.get("type", ""))
        note_events = sum(1 for e in evts if "note" in e.get("type", ""))
        useful_events = sum(1 for e in evts if e.get("type") in useful_types)

        # Lead-based metrics — exclude closed_lost from main stats
        active_lds = [l for l in lds if l.get("processingStatus") != "closed_lost"]
        closed_lost_count = len(lds) - len(active_lds)
        total_leads = len(active_lds)
        processed = sum(1 for l in active_lds if l.get("processingStatus") in ("processed_fast", "processed_late"))
        not_processed = sum(1 for l in active_lds if l.get("processingStatus") == "not_processed")
        weak = sum(1 for l in active_lds if l.get("processingStatus") == "weak_processing")
        stalled = sum(1 for l in active_lds if l.get("isStalled"))
        with_progress = sum(1 for l in active_lds if l.get("hasProgress"))
        to_success = sum(1 for l in active_lds if l.get("statusId") in success_stages)
        single_action = sum(1 for l in active_lds if l.get("totalActions") == 1)
        no_progress_stage = sum(1 for l in active_lds if not l.get("hasProgress") and l.get("totalActions", 0) > 0)

        first_action_leads = sum(1 for l in active_lds if l.get("timeToFirstActionHours") is not None)
        reaction_times = [l["timeToFirstActionHours"] for l in active_lds if l.get("timeToFirstActionHours") is not None]
        avg_reaction = round(sum(reaction_times) / len(reaction_times), 2) if reaction_times else None
        processed_pct = round(processed / total_leads * 100, 1) if total_leads > 0 else 0

        # === Quality / "real work" guardrails (Feb 2026) ===
        # Manual vs automatic touch breakdown for THIS manager's leads.
        manual_actions = sum(l.get("manualActionCount", 0) or 0 for l in active_lds)
        # Prefer authoritative counts from call_analytics_calls when available,
        # fall back to amoCRM note-based counts when the calls collection is
        # empty (e.g. Binotel sync not configured).
        note_outgoing = sum(l.get("outgoingCallCount", 0) or 0 for l in active_lds)
        note_incoming = sum(l.get("incomingCallCount", 0) or 0 for l in active_lds)
        ca_calls = calls_by_mgr.get(uid, {"out": 0, "in": 0})
        outgoing_calls = ca_calls["out"] or note_outgoing
        incoming_calls = ca_calls["in"] or note_incoming
        outgoing_emails = sum(l.get("outgoingEmailCount", 0) or 0 for l in active_lds)
        outgoing_messages = sum(l.get("outgoingMessageCount", 0) or 0 for l in active_lds)
        # Follow-up: of leads that ever got a manual touch, how many got ≥2 inside 72 h.
        leads_with_touch = [l for l in active_lds if (l.get("manualActionCount", 0) or 0) > 0]
        followups = sum(1 for l in leads_with_touch if l.get("followUpWithin72h"))
        follow_up_rate = round(followups / len(leads_with_touch) * 100, 1) if leads_with_touch else 0
        # Single-touch and auto-only leads.
        single_touch = sum(1 for l in active_lds if l.get("singleTouchLead"))
        auto_only = sum(1 for l in active_lds if l.get("autoOnlyLead"))
        single_touch_pct = round(single_touch / total_leads * 100, 1) if total_leads > 0 else 0
        auto_only_pct = round(auto_only / total_leads * 100, 1) if total_leads > 0 else 0
        avg_actions_per_lead = round(manual_actions / total_leads, 2) if total_leads > 0 else 0
        calls_per_lead = round(outgoing_calls / total_leads, 2) if total_leads > 0 else 0
        # Auto-touch ratio for the events feed.
        auto_events = sum(1 for e in evts if str(e.get("created_by", "")) in ("0",))  # bot events
        manual_event_share = round((total_events - auto_events) / total_events * 100, 1) if total_events > 0 else 0

        # New lead actions
        new_lead_actions = sum(1 for e in evts if e.get("type") in ("lead_added", "lead_status_changed") and e.get("entity_type") == "lead")

        if total_events > max_events:
            max_events = total_events
        if with_progress > max_progress:
            max_progress = with_progress

        stat = {
            "userId": uid,
            "userName": name,
            "sync_id": sync_id,
            "computedAt": datetime.now(timezone.utc).isoformat(),
            # Event metrics
            "totalEvents": total_events,
            "usefulEvents": useful_events,
            "autoEvents": auto_events,
            "manualEventShare": manual_event_share,
            "leadEvents": lead_events,
            "contactEvents": contact_events,
            "stageChanges": stage_changes,
            "taskEvents": task_events,
            "noteEvents": note_events,
            "newLeadActions": new_lead_actions,
            # Lead metrics (excluding closed/lost)
            "totalLeads": total_leads,
            "closedLostLeads": closed_lost_count,
            "processedLeads": processed,
            "notProcessedLeads": not_processed,
            "weakLeads": weak,
            "stalledLeads": stalled,
            "withProgress": with_progress,
            "toSuccessStage": to_success,
            "singleActionLeads": single_action,
            "noProgressStageLeads": no_progress_stage,
            "firstActionLeads": first_action_leads,
            "avgReactionHours": avg_reaction,
            "processedPercent": processed_pct,
            # Quality guardrails — Feb 2026
            "manualActions": manual_actions,
            "avgActionsPerLead": avg_actions_per_lead,
            "outgoingCalls": outgoing_calls,
            "incomingCalls": incoming_calls,
            "outgoingEmails": outgoing_emails,
            "outgoingMessages": outgoing_messages,
            "callsPerLead": calls_per_lead,
            "followUpRate": follow_up_rate,
            "singleTouchLeads": single_touch,
            "singleTouchPercent": single_touch_pct,
            "autoOnlyLeads": auto_only,
            "autoOnlyPercent": auto_only_pct,
        }
        all_stats.append(stat)

    # Compute scores
    for stat in all_stats:
        reaction_score = 100
        if stat["avgReactionHours"] is not None:
            if stat["avgReactionHours"] <= sla_hours:
                reaction_score = 100
            elif stat["avgReactionHours"] <= sla_hours * 2:
                reaction_score = 60
            elif stat["avgReactionHours"] <= sla_hours * 4:
                reaction_score = 30
            else:
                reaction_score = 10

        processing_score = stat["processedPercent"]
        activity_score = min(100, round(stat["totalEvents"] / max(max_events, 1) * 100))
        progress_score = min(100, round(stat["withProgress"] / max(max_progress, 1) * 100))
        problem_score = 100 - min(100, round((stat["stalledLeads"] + stat["notProcessedLeads"]) / max(stat["totalLeads"], 1) * 100))
        # New: follow-up score directly mirrors the % of leads with ≥2 manual
        # touches in 72 h. 0 if no leads with any touch (avoid /0).
        follow_up_score = stat.get("followUpRate", 0)
        # Soft penalty for fire-and-forget (single-touch) leads. We translate
        # the % into a -20..0 deduction applied at the end.
        single_touch_pct = stat.get("singleTouchPercent", 0) or 0
        single_touch_penalty = min(20, round(single_touch_pct * 0.3))  # 70% single-touch → -20

        total_weight = sum(weights.values()) or 100
        score = round(
            (reaction_score * weights["reaction"] +
             processing_score * weights["processing"] +
             activity_score * weights["activity"] +
             progress_score * weights["progress"] +
             follow_up_score * weights["followUp"] +
             problem_score * weights["problems"]) / total_weight
        )
        score = max(0, score - single_touch_penalty)

        stat["reactionScore"] = reaction_score
        stat["processingScore"] = processing_score
        stat["activityScore"] = activity_score
        stat["progressScore"] = progress_score
        stat["followUpScore"] = follow_up_score
        stat["problemScore"] = problem_score
        stat["singleTouchPenalty"] = single_touch_penalty
        stat["performanceScore"] = score

    # ── Orphan / Unassigned bucket ────────────────────────────────────
    # Synthetic "manager" card representing leads with responsibleUserId=0
    # (no manager assigned in amoCRM). Surfaces a problem that previously
    # vanished from analytics (e.g. "36 лидов but only 2 у менеджеров").
    if orphan_count > 0:
        orphan_active = [l for l in orphan_leads if l.get("processingStatus") != "closed_lost"]
        orphan_closed_lost = orphan_count - len(orphan_active)
        orphan_processed = sum(1 for l in orphan_active if l.get("processingStatus") in ("processed_fast", "processed_late"))
        orphan_not_processed = sum(1 for l in orphan_active if l.get("processingStatus") == "not_processed")
        orphan_weak = sum(1 for l in orphan_active if l.get("processingStatus") == "weak_processing")
        orphan_stalled = sum(1 for l in orphan_active if l.get("isStalled"))
        all_stats.append({
            "userId": "unassigned",
            "userName": "⚠️ Без ответственного",
            "sync_id": sync_id,
            "computedAt": datetime.now(timezone.utc).isoformat(),
            "totalEvents": 0,
            "totalLeads": len(orphan_active),
            "closedLostLeads": orphan_closed_lost,
            "processedLeads": orphan_processed,
            "notProcessedLeads": orphan_not_processed,
            "weakLeads": orphan_weak,
            "stalledLeads": orphan_stalled,
            "singleTouchLeads": 0,
            "autoOnlyLeads": 0,
            "withProgress": 0,
            "toSuccess": 0,
            "leadEvents": 0,
            "contactEvents": 0,
            "stageChanges": 0,
            "taskEvents": 0,
            "noteEvents": 0,
            "usefulEvents": 0,
            "manualActions": 0,
            "outgoingCalls": 0,
            "incomingCalls": 0,
            "outgoingEmails": 0,
            "outgoingMessages": 0,
            "newLeadActions": 0,
            "avgReactionHours": None,
            "processedPercent": 0,
            "processedPct": 0,
            "singleTouchPercent": 0,
            "singleTouchPct": 0,
            "autoOnlyPercent": 0,
            "autoOnlyPct": 0,
            "followUpRate": 0,
            "avgActionsPerLead": 0,
            "callsPerLead": 0,
            "manualEventShare": 0,
            "reactionScore": 0,
            "processingScore": 0,
            "activityScore": 0,
            "progressScore": 0,
            "followUpScore": 0,
            "problemScore": 0,
            "singleTouchPenalty": 0,
            "performanceScore": 0,
            "isUnassigned": True,
        })

    # Rank by score
    all_stats.sort(key=lambda s: s.get("performanceScore", 0), reverse=True)
    for i, stat in enumerate(all_stats):
        stat["rank"] = i + 1
        await db.event_manager_stats.update_one(
            {"userId": stat["userId"], "sync_id": sync_id},
            {"$set": stat},
            upsert=True
        )


# --- Data Endpoints ---

async def _live_calls_by_manager(date_from: str = None, date_to: str = None) -> dict:
    """Aggregate live call counts from call_analytics_calls collection.

    Manager stats are stored as a snapshot at sync time, but calls often arrive
    via a separate (call_analytics) sync that runs on a different schedule.
    To avoid the UI displaying stale `0` call counts, we recompute fresh totals
    at read time from the authoritative `call_analytics_calls` collection.

    Returns: { manager_id_str: {"out": int, "in": int, "total": int} }
    """
    match: dict = {}
    if date_from:
        match["datetime"] = {"$gte": date_from}
    if date_to:
        # Accept either plain date ("YYYY-MM-DD") or ISO datetime — only
        # append the time suffix when it's a bare date.
        upper = date_to if "T" in date_to else f"{date_to}T23:59:59"
        match.setdefault("datetime", {})["$lte"] = upper
    pipeline = [
        {"$match": match} if match else {"$match": {}},
        {"$group": {
            "_id": {"manager": "$manager_id", "direction": "$direction"},
            "count": {"$sum": 1},
        }},
    ]
    out: dict[str, dict] = {}
    try:
        async for row in db.call_analytics_calls.aggregate(pipeline):
            mid_raw = row["_id"].get("manager")
            if mid_raw is None or mid_raw == "":
                continue
            mid = str(mid_raw)
            direction = (row["_id"].get("direction") or "").lower()
            slot = out.setdefault(mid, {"out": 0, "in": 0, "total": 0})
            slot["total"] += row["count"]
            if direction in ("outbound", "out", "outgoing"):
                slot["out"] += row["count"]
            elif direction in ("inbound", "in", "incoming"):
                slot["in"] += row["count"]
    except Exception as e:
        logger.warning(f"_live_calls_by_manager aggregation failed: {e}")
    return out


@router.get("/manager-stats")
async def get_event_manager_stats(date_from: str = None, date_to: str = None,
                                    attribution_mode: str = "responsible",
                                    date_field: str = "created"):
    """Get latest event-based manager statistics.

    ``attribution_mode``:
      * ``responsible`` (default) — group leads by ``responsibleUserId``
        (the assigned owner in amoCRM). Legacy behaviour.
      * ``activity`` — for leads with no assigned manager
        (responsibleUserId in "", "0"), credit them to the manager who
        performed the **first manual action** (call/note/stage-change/task
        — opens / views are excluded). Surfaces real work in shops where
        managers don't bother setting themselves as responsible.

    ``date_field``:
      * ``created`` (default) — filter leads by ``createdAt`` (when the
        lead arrived in amoCRM).
      * ``processed`` — filter by ``firstActionAt`` (when a manager
        actually worked the lead). Use this to evaluate manager activity
        in a period regardless of when the lead originated.

    Call counts (outgoingCalls / incomingCalls / callsPerLead) are recomputed
    at read time from `call_analytics_calls` so the UI always reflects the
    latest call-sync data, even if the events sync ran earlier.
    """
    last_sync = await db.event_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    if not last_sync:
        return {"managers": [], "sync_id": None}

    sync_id = last_sync.get("sync_id")
    raw_managers = await db.event_manager_stats.find(
        {"sync_id": sync_id}, {"_id": 0}
    ).sort("rank", 1).to_list(length=200)

    # Filter out bot accounts and (when configured) restrict to known managers.
    # Both lists live in lead_analytics settings — single source of truth.
    la_settings = await db.lead_analytics_settings.find_one(
        {"type": "lead_analytics"}, {"_id": 0}
    ) or {}
    bot_ids = {str(x) for x in (la_settings.get("botUserIds") or [])}
    manager_ids = {str(x) for x in (la_settings.get("managerUserIds") or [])}
    # Always hide synthetic "ID:0" / unknown bucket — that's amoCRM bot events
    # without a real user.
    synthetic_ids = {"0", "", "None"}
    excluded_bots = []
    excluded_other = []
    managers = []
    for m in raw_managers:
        uid = str(m.get("userId", ""))
        if uid in synthetic_ids or uid in bot_ids:
            excluded_bots.append({"userId": uid, "userName": m.get("userName", "")})
            continue
        if manager_ids and uid not in manager_ids:
            excluded_other.append({"userId": uid, "userName": m.get("userName", "")})
            continue
        managers.append(m)
    # Re-rank after filtering so the UI numbering matches what's visible.
    for i, m in enumerate(managers):
        m["rank"] = i + 1
    filter_info = {
        "totalBeforeFilter": len(raw_managers),
        "botsExcluded": len(excluded_bots),
        "outsideWhitelistExcluded": len(excluded_other),
        "whitelistActive": bool(manager_ids),
        "configuredBotIds": sorted(bot_ids),
        "configuredManagerIds": sorted(manager_ids),
    }

    # Use the sync's own date range so call counts match the analyzed period.
    df = date_from or last_sync.get("date_from")
    dt = date_to or last_sync.get("date_to")

    # ── Lead-count recompute by user-selected date range ──────────────
    # `event_manager_stats` is a snapshot frozen at sync time, so its
    # totalLeads/processedLeads/etc. reflect the sync's date range, not the
    # range the user has chosen in the UI. When the user explicitly passes
    # date_from / date_to (i.e. they differ from the sync), recompute the
    # key lead metrics on-the-fly from `lead_analytics_leads` so the
    # numbers match the «Сводка» tab. Event-derived metrics (totalEvents,
    # performanceScore) stay from sync because they are expensive to
    # recompute and the user mostly cares about lead counts here.
    user_overrode_dates = (date_from is not None) or (date_to is not None)
    activity_mode = (attribution_mode == "activity")
    # We need on-the-fly recompute when:
    #   1. User picked a date range different from sync window, OR
    #   2. Activity attribution is requested (re-bucket orphan leads by
    #      `firstManualActionBy`).
    need_recompute = user_overrode_dates or activity_mode
    if need_recompute and managers:
        # Honour the same "По созданию / По обработке" toggle the Сводка uses.
        fld = "firstActionAt" if str(date_field).lower() == "processed" else "createdAt"

        # ── In "processed" mode (date_field=processed) we want a different,
        # more useful semantic for manager analytics: not "leads whose FIRST
        # global action was in the period" but "leads where THIS manager
        # touched anything in the period". Otherwise, a manager who took over
        # a March-old lead on 29.05 and worked it hard would see 0 leads
        # because firstActionAt < 29.05. Re-bucket leads via amocrm_events:
        # group events by created_by → distinct entity_id (lead) → hydrate.
        use_activity_query = (fld == "firstActionAt")
        leads_in_range = []
        activity_by_uid: dict = {}
        if use_activity_query:
            ts_from = None
            ts_to = None
            try:
                if date_from:
                    ts_from = int(datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc).timestamp())
                if date_to:
                    ts_to = int(datetime.fromisoformat(date_to + "T23:59:59").replace(tzinfo=timezone.utc).timestamp())
            except Exception:
                pass
            ev_query = {"entity_id": {"$exists": True, "$ne": None}}
            if ts_from is not None:
                ev_query["created_at_ts"] = {"$gte": ts_from}
            if ts_to is not None:
                ev_query.setdefault("created_at_ts", {})["$lte"] = ts_to
            pipeline = [
                {"$match": ev_query},
                {"$group": {"_id": {"uid": "$created_by", "lead": "$entity_id"}}},
                {"$group": {"_id": "$_id.uid", "leadIds": {"$addToSet": "$_id.lead"}}},
            ]
            async for doc in db.amocrm_events.aggregate(pipeline):
                activity_by_uid[str(doc["_id"])] = doc["leadIds"]
            all_lead_ids = {lid for lst in activity_by_uid.values() for lid in lst}
            if all_lead_ids:
                docs = await db.lead_analytics_leads.find(
                    {"amocrm_lead_id": {"$in": list(all_lead_ids)}},
                    {"_id": 0,
                     "amocrm_lead_id": 1, "responsibleUserId": 1, "processingStatus": 1,
                     "isStalled": 1, "timeToFirstActionHours": 1, "manualActionCount": 1,
                     "singleTouchLead": 1, "autoOnlyLead": 1, "followUpWithin72h": 1,
                     "hasProgress": 1, "totalActions": 1, "firstManualActionBy": 1}
                ).to_list(length=20000)
                leads_by_id = {d.get("amocrm_lead_id"): d for d in docs}
                leads_in_range = list(leads_by_id.values())
            else:
                leads_by_id = {}
            filter_info["activityQueryUsed"] = True
        else:
            lead_filter = {}
            if date_from:
                lead_filter[fld] = {"$gte": date_from}
            if date_to:
                lead_filter.setdefault(fld, {})["$lte"] = date_to + "T23:59:59"
            leads_in_range = await db.lead_analytics_leads.find(
                lead_filter, {"_id": 0,
                              "amocrm_lead_id": 1, "responsibleUserId": 1, "processingStatus": 1,
                              "isStalled": 1, "timeToFirstActionHours": 1,
                              "manualActionCount": 1, "singleTouchLead": 1,
                              "autoOnlyLead": 1, "followUpWithin72h": 1,
                              "hasProgress": 1, "totalActions": 1,
                              "firstManualActionBy": 1}
            ).to_list(length=20000)
            leads_by_id = {l.get("amocrm_lead_id"): l for l in leads_in_range}
        # Bucket by responsible OR by first action user (activity mode).
        # In activity mode: leads with a real responsibleUserId still go to that
        # manager (preserves explicit assignments); only orphans get re-routed
        # to whoever first worked the lead.
        # In "по обработке" date_field mode: re-bucket using `activity_by_uid`
        # from the events query — credit the lead to EVERY manager who acted
        # on it in the period. (Same lead can count for multiple managers,
        # which is the right semantic for activity attribution.)
        by_uid: dict = {}
        activity_reattributed = 0
        if use_activity_query:
            for uid, lead_ids in activity_by_uid.items():
                bucket = [leads_by_id[lid] for lid in lead_ids if lid in leads_by_id]
                if bucket:
                    by_uid[str(uid)] = bucket
        else:
            for ld in leads_in_range:
                resp_uid = str(ld.get("responsibleUserId", ""))
                is_orphan = resp_uid in ("", "0", "None", "unknown")
                if activity_mode and is_orphan:
                    first_by = str(ld.get("firstManualActionBy", "") or "")
                    if first_by and first_by not in ("0", "", "None"):
                        by_uid.setdefault(first_by, []).append(ld)
                        activity_reattributed += 1
                    else:
                        by_uid.setdefault(resp_uid, []).append(ld)
                else:
                    by_uid.setdefault(resp_uid, []).append(ld)
        if activity_mode:
            filter_info["attributionMode"] = "activity"
            filter_info["activityReattributedLeads"] = activity_reattributed
        for m in managers:
            uid = str(m.get("userId", ""))
            mgr_leads = by_uid.get(uid, [])
            active = [l for l in mgr_leads if l.get("processingStatus") != "closed_lost"]
            closed_lost = len(mgr_leads) - len(active)
            total = len(active)
            processed = sum(1 for l in active if l.get("processingStatus") in ("processed_fast", "processed_late"))
            not_proc = sum(1 for l in active if l.get("processingStatus") == "not_processed")
            weak = sum(1 for l in active if l.get("processingStatus") == "weak_processing")
            stalled = sum(1 for l in active if l.get("isStalled"))
            single_touch = sum(1 for l in active if l.get("singleTouchLead"))
            auto_only = sum(1 for l in active if l.get("autoOnlyLead"))
            reaction_times = [l["timeToFirstActionHours"] for l in active
                              if l.get("timeToFirstActionHours") is not None]
            avg_reaction = round(sum(reaction_times) / len(reaction_times), 2) if reaction_times else None
            leads_with_touch = [l for l in active if (l.get("manualActionCount", 0) or 0) > 0]
            followups = sum(1 for l in leads_with_touch if l.get("followUpWithin72h"))
            m["totalLeads"] = total
            m["closedLostLeads"] = closed_lost
            m["processedLeads"] = processed
            m["notProcessedLeads"] = not_proc
            m["weakLeads"] = weak
            m["stalledLeads"] = stalled
            m["singleTouchLeads"] = single_touch
            m["autoOnlyLeads"] = auto_only
            m["avgReactionHours"] = avg_reaction
            m["processedPct"] = round(processed / total * 100, 1) if total > 0 else 0
            m["singleTouchPct"] = round(single_touch / total * 100, 1) if total > 0 else 0
            m["autoOnlyPct"] = round(auto_only / total * 100, 1) if total > 0 else 0
            m["followUpRate"] = round(followups / len(leads_with_touch) * 100, 1) if leads_with_touch else 0

        # Recompute the synthetic "unassigned" card too — only meaningful when
        # we're filtering by createdAt. In "по обработке" (activity-query) mode
        # the bucketing is already by activity, so a lead with no responsible
        # is automatically credited to whoever acted on it — no need for a
        # separate "Без ответственного" card.
        if not use_activity_query:
            def _is_orphan(ld):
                resp = str(ld.get("responsibleUserId", ""))
                if resp not in ("", "0", "None", "unknown"):
                    return False
                if activity_mode:
                    first_by = str(ld.get("firstManualActionBy", "") or "")
                    if first_by and first_by not in ("0", "", "None"):
                        return False  # got re-attributed
                return True
            orphan_in_range = [l for l in leads_in_range if _is_orphan(l)]
            if orphan_in_range:
                active = [l for l in orphan_in_range if l.get("processingStatus") != "closed_lost"]
                existing = next((m for m in managers if m.get("userId") == "unassigned"), None)
                stat = existing or {
                    "userId": "unassigned", "userName": "⚠️ Без ответственного",
                    "isUnassigned": True, "performanceScore": 0,
                    "totalEvents": 0, "outgoingCalls": 0, "incomingCalls": 0,
                }
                stat["totalLeads"] = len(active)
                stat["closedLostLeads"] = len(orphan_in_range) - len(active)
                stat["processedLeads"] = sum(1 for l in active if l.get("processingStatus") in ("processed_fast", "processed_late"))
                stat["notProcessedLeads"] = sum(1 for l in active if l.get("processingStatus") == "not_processed")
                stat["weakLeads"] = sum(1 for l in active if l.get("processingStatus") == "weak_processing")
                stat["stalledLeads"] = sum(1 for l in active if l.get("isStalled"))
                stat["processedPct"] = round(stat["processedLeads"] / stat["totalLeads"] * 100, 1) if stat["totalLeads"] > 0 else 0
                if not existing:
                    managers.append(stat)

        filter_info["leadsRecomputedForDateRange"] = True

    live_calls = await _live_calls_by_manager(df, dt)
    if live_calls:
        for m in managers:
            uid = str(m.get("userId", ""))
            slot = live_calls.get(uid)
            if not slot:
                continue
            m["outgoingCalls"] = slot["out"] or m.get("outgoingCalls", 0)
            m["incomingCalls"] = slot["in"] or m.get("incomingCalls", 0)
            total_leads = m.get("totalLeads") or 0
            if total_leads > 0:
                m["callsPerLead"] = round(m["outgoingCalls"] / total_leads, 2)

    # Binotel is the authoritative source for call counts when configured.
    # Overlay (replacing earlier estimates) so the UI shows live phone-system
    # data instead of an amoCRM-note-derived snapshot.
    binotel_used = False
    if _binotel_is_configured():
        try:
            bino = await _binotel_by_amocrm_user(df, dt)
            if bino:
                binotel_used = True
                for m in managers:
                    uid = str(m.get("userId", ""))
                    bs = bino.get(uid)
                    if not bs:
                        # Mapped users with no calls in period still get zeros.
                        m["binotelTotal"] = 0
                        m["binotelOutgoing"] = 0
                        m["binotelIncoming"] = 0
                        m["binotelAnswered"] = 0
                        m["binotelMissed"] = 0
                        m["binotelAnswerRate"] = 0
                        m["binotelAvgTalkSec"] = 0
                        continue
                    m["outgoingCalls"] = bs["outgoing"]
                    m["incomingCalls"] = bs["incoming"]
                    m["binotelTotal"] = bs["total"]
                    m["binotelOutgoing"] = bs["outgoing"]
                    m["binotelIncoming"] = bs["incoming"]
                    m["binotelAnswered"] = bs["answered"]
                    m["binotelMissed"] = bs["missed"]
                    m["binotelAnswerRate"] = bs["answerRate"]
                    m["binotelAvgTalkSec"] = bs["avgTalkSec"]
                    total_leads = m.get("totalLeads") or 0
                    if total_leads > 0:
                        m["callsPerLead"] = round(bs["outgoing"] / total_leads, 2)
        except Exception as e:
            logger.warning(f"Binotel overlay failed (non-fatal): {e}")

    return {"managers": managers, "sync_id": sync_id, "binotelUsed": binotel_used,
            "filterInfo": filter_info, "syncDateFrom": last_sync.get("date_from"),
            "syncDateTo": last_sync.get("date_to")}


@router.get("/manager-detail/{user_id}")
async def get_manager_detail(user_id: str, date_from: str = None, date_to: str = None):
    """Get detailed events and lead data for a specific manager."""
    # Events by this manager
    query = {"created_by": user_id}
    if date_from:
        ts_from = int(datetime.fromisoformat(date_from).timestamp())
        query["created_at_ts"] = {"$gte": ts_from}
    if date_to:
        ts_to = int(datetime.fromisoformat(date_to).timestamp())
        query.setdefault("created_at_ts", {})["$lte"] = ts_to

    events = await db.amocrm_events.find(
        query, {"_id": 0}
    ).sort("created_at_ts", -1).to_list(length=500)

    # Problem leads for this manager
    lead_query = {"responsibleUserId": user_id, "$or": [
        {"processingStatus": "not_processed"},
        {"processingStatus": "weak_processing"},
        {"isStalled": True},
    ]}
    problem_leads = await db.lead_analytics_leads.find(
        lead_query, {"_id": 0}
    ).sort("idleHours", -1).to_list(length=100)

    # All leads for this manager
    all_leads = await db.lead_analytics_leads.find(
        {"responsibleUserId": user_id}, {"_id": 0}
    ).to_list(length=500)

    no_first_action = [l for l in all_leads if l.get("processingStatus") == "not_processed"]
    no_progress = [l for l in all_leads if not l.get("hasProgress") and l.get("totalActions", 0) > 0]
    long_idle = [l for l in all_leads if l.get("isStalled")]
    # "Fire-and-forget": exactly one manual touch, then silence.
    single_touch_leads = [l for l in all_leads if l.get("singleTouchLead")]
    # Auto-only: bot moved the lead, manager never touched.
    auto_only_leads = [l for l in all_leads if l.get("autoOnlyLead")]
    # Latest stats
    last_sync = await db.event_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    stats = None
    if last_sync:
        stats = await db.event_manager_stats.find_one(
            {"userId": user_id, "sync_id": last_sync["sync_id"]}, {"_id": 0}
        )

    # Cross-link to call analytics: pull last 30 calls for this manager.
    # Note: we do NOT filter by audio_url here — even calls without recordings
    # should appear in the manager's call list so the UI matches the call sync
    # totals. Audio availability is shown per-row via the `status` field.
    recent_calls = []
    try:
        recent_calls = await db.call_analytics_calls.find(
            {"manager_id": str(user_id)},
            {
                "_id": 0,
                "id": 1,
                "datetime": 1,
                "duration_seconds": 1,
                "phone": 1,
                "client_name": 1,
                "status": 1,
                "score": 1,
                "has_strong_negative": 1,
                "direction": 1,
                "summary_ru": 1,
                "audio_url": 1,
            },
        ).sort("datetime", -1).to_list(length=30)
    except Exception:
        recent_calls = []
    # Total call count for this manager (independent of the 30-row preview).
    total_calls_for_mgr = 0
    try:
        total_calls_for_mgr = await db.call_analytics_calls.count_documents(
            {"manager_id": str(user_id)}
        )
    except Exception:
        total_calls_for_mgr = len(recent_calls)
    # Normalize summary field for the frontend (it reads `summary`).
    for c in recent_calls:
        if "summary_ru" in c and "summary" not in c:
            c["summary"] = c.get("summary_ru")
    # Quick call KPIs.
    call_kpi = {"total": total_calls_for_mgr, "withAi": 0, "avgScore": None, "criticalCount": 0}
    if recent_calls:
        scored = [c for c in recent_calls if isinstance(c.get("score"), (int, float))]
        call_kpi["withAi"] = len(scored)
        if scored:
            call_kpi["avgScore"] = round(sum(c["score"] for c in scored) / len(scored), 1)
        call_kpi["criticalCount"] = sum(
            1 for c in recent_calls
            if (isinstance(c.get("score"), (int, float)) and c["score"] < 5)
            or c.get("has_strong_negative") is True
        )

    # Also refresh outgoing/incoming totals on the stats snapshot so the
    # header KPIs aren't stale.
    if stats:
        live = await _live_calls_by_manager(date_from, date_to)
        slot = live.get(str(user_id))
        if slot:
            stats["outgoingCalls"] = slot["out"] or stats.get("outgoingCalls", 0)
            stats["incomingCalls"] = slot["in"] or stats.get("incomingCalls", 0)
            total_leads = stats.get("totalLeads") or 0
            if total_leads > 0:
                stats["callsPerLead"] = round(stats["outgoingCalls"] / total_leads, 2)

    # Binotel overlay — authoritative when configured.
    binotel_stats = None
    if _binotel_is_configured():
        try:
            bino = await _binotel_by_amocrm_user(date_from, date_to)
            bs = bino.get(str(user_id))
            if bs:
                binotel_stats = bs
                if stats:
                    stats["outgoingCalls"] = bs["outgoing"]
                    stats["incomingCalls"] = bs["incoming"]
                    stats["binotelTotal"] = bs["total"]
                    stats["binotelAnswered"] = bs["answered"]
                    stats["binotelMissed"] = bs["missed"]
                    stats["binotelAnswerRate"] = bs["answerRate"]
                    stats["binotelAvgTalkSec"] = bs["avgTalkSec"]
                    total_leads = stats.get("totalLeads") or 0
                    if total_leads > 0:
                        stats["callsPerLead"] = round(bs["outgoing"] / total_leads, 2)
                # Promote Binotel totals into the call KPI panel
                call_kpi["total"] = bs["total"]
                call_kpi["binotelAnswered"] = bs["answered"]
                call_kpi["binotelMissed"] = bs["missed"]
                call_kpi["binotelAnswerRate"] = bs["answerRate"]
                call_kpi["binotelAvgTalkSec"] = bs["avgTalkSec"]
        except Exception as e:
            logger.warning(f"Binotel detail overlay failed: {e}")

    return {
        "stats": stats,
        "events": events[:200],
        "totalEvents": len(events),
        "problemLeads": problem_leads,
        "noFirstAction": no_first_action[:50],
        "noProgress": no_progress[:50],
        "longIdle": long_idle[:50],
        "singleTouchLeads": single_touch_leads[:50],
        "autoOnlyLeads": auto_only_leads[:50],
        "recentCalls": recent_calls,
        "callKpi": call_kpi,
        "binotelStats": binotel_stats,
    }


@router.get("/event-feed")
async def get_event_feed(manager_id: str = None, event_type: str = None,
                          date_from: str = None, date_to: str = None,
                          limit: int = 100, skip: int = 0):
    """Get event feed with filters."""
    query = {}
    if manager_id:
        query["created_by"] = manager_id
    if event_type:
        query["type"] = event_type
    if date_from:
        ts_from = int(datetime.fromisoformat(date_from).timestamp())
        query["created_at_ts"] = {"$gte": ts_from}
    if date_to:
        ts_to = int(datetime.fromisoformat(date_to).timestamp())
        query.setdefault("created_at_ts", {})["$lte"] = ts_to

    events = await db.amocrm_events.find(
        query, {"_id": 0}
    ).sort("created_at_ts", -1).skip(skip).to_list(length=limit)

    total = await db.amocrm_events.count_documents(query)
    return {"events": events, "total": total}


# --- AI Manager Analysis ---

@router.post("/ai/manager-deep-analysis")
async def ai_manager_deep_analysis(user_id: str):
    """AI deep analysis for a specific manager based on events and metrics."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    # Get stats
    last_sync = await db.event_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    if not last_sync:
        return {"text": "Нет данных. Запустите синхронизацию событий."}

    stats = await db.event_manager_stats.find_one(
        {"userId": user_id, "sync_id": last_sync["sync_id"]}, {"_id": 0}
    )
    if not stats:
        return {"text": "Нет данных по этому менеджеру."}

    prompt = f"""Проанализируй работу менеджера по обработке лидов на основе событий amoCRM.

Менеджер: {stats.get('userName', 'Неизвестно')}

Метрики событий:
- Всего событий за период: {stats.get('totalEvents', 0)}
- Полезных событий: {stats.get('usefulEvents', 0)}
- Событий по сделкам: {stats.get('leadEvents', 0)}
- Событий по контактам: {stats.get('contactEvents', 0)}
- Смен этапов: {stats.get('stageChanges', 0)}
- Событий по задачам: {stats.get('taskEvents', 0)}
- Примечаний: {stats.get('noteEvents', 0)}

Метрики по лидам:
- Всего лидов: {stats.get('totalLeads', 0)}
- Обработано: {stats.get('processedLeads', 0)} ({stats.get('processedPercent', 0)}%)
- Не обработано: {stats.get('notProcessedLeads', 0)}
- Слабая обработка: {stats.get('weakLeads', 0)}
- Зависших: {stats.get('stalledLeads', 0)}
- С прогрессом по этапам: {stats.get('withProgress', 0)}
- До целевого этапа: {stats.get('toSuccessStage', 0)}
- Только 1 действие без продолжения: {stats.get('singleActionLeads', 0)}
- Без прогресса по этапам: {stats.get('noProgressStageLeads', 0)}
- Среднее время реакции: {stats.get('avgReactionHours', 'нет данных')} часов

Рейтинговые баллы:
- Скорость реакции: {stats.get('reactionScore', 0)}/100
- Процент обработки: {stats.get('processingScore', 0)}/100
- Активность: {stats.get('activityScore', 0)}/100
- Прогресс сделок: {stats.get('progressScore', 0)}/100
- Проблемные лиды: {stats.get('problemScore', 0)}/100
- Итоговый балл: {stats.get('performanceScore', 0)}/100

Напиши подробный анализ:
1. Общая оценка активности менеджера (насколько активно работает с лидами)
2. Скорость реакции — быстро ли реагирует
3. Есть ли системные задержки
4. Есть ли проблемы с дожимом (много действий без результата)
5. Какие сделки требуют вмешательства
6. Три главные рекомендации по улучшению работы"""

    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"mgr-analysis-{user_id}-{datetime.now(timezone.utc).strftime('%H%M%S')}",
            system_message="Ты — аналитик отдела продаж. Пиши на русском, кратко и по делу."
        ).with_model("openai", "gpt-5.2")
        text = await chat.send_message(UserMessage(text=prompt))
        return {"text": text, "userId": user_id}
    except Exception as e:
        logger.error(f"AI manager deep analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# --- Daily Telegram digest (manual trigger) ---

@router.post("/send-daily-report")
async def send_daily_report(period_label: Optional[str] = None,
                             chat_id: Optional[str] = None):
    """Send the manager-analytics digest to Telegram on demand.

    Used both by the morning cron job and the "Send test" button in
    settings UI. Falls back to the chat_id from EventAnalyticsSettings if
    none provided in the request.
    """
    from services.manager_analytics_report import send_manager_digest
    settings = await db.event_analytics_settings.find_one(
        {"type": "event_analytics"}, {"_id": 0}
    ) or {}
    effective_chat_id = chat_id or settings.get("dailyReportChatId") or None
    include_ai = settings.get("dailyReportAiAdvice", True)
    result = await send_manager_digest(
        db, period_label=period_label, chat_id=effective_chat_id,
        include_ai=include_ai,
    )
    if not result.get("ok"):
        # 4xx if no sync yet, 5xx if telegram fails — informative for UI.
        status = 409 if result.get("reason") == "no_sync_yet" else 502
        raise HTTPException(status_code=status, detail=result)
    return result
