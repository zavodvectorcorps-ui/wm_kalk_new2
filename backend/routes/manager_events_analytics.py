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
    # Scoring weights (0-100)
    weightReactionSpeed: int = 25
    weightProcessingPercent: int = 25
    weightEventActivity: int = 20
    weightDealProgress: int = 20
    weightProblemLeads: int = 10


@router.get("/settings")
async def get_event_analytics_settings():
    settings = await db.event_analytics_settings.find_one({"type": "event_analytics"}, {"_id": 0})
    if not settings:
        settings = EventAnalyticsSettings().dict()
    return settings


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
    sync_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    await db.event_analytics_sync.insert_one({
        "sync_id": sync_id, "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "date_from": date_from, "date_to": date_to
    })
    background_tasks.add_task(_run_events_sync, sync_id, date_from, date_to)
    return {"status": "started", "sync_id": sync_id}


@router.get("/sync-status")
async def get_events_sync_status():
    status = await db.event_analytics_sync.find_one({}, {"_id": 0}, sort=[("startedAt", -1)])
    return status or {"status": "never"}


async def _run_events_sync(sync_id: str, date_from_str: str = None, date_to_str: str = None):
    """Background: fetch events, normalize, store, compute stats."""
    try:
        ts_from = int(datetime.fromisoformat(date_from_str).timestamp()) if date_from_str else None
        ts_to = int(datetime.fromisoformat(date_to_str).timestamp()) if date_to_str else None

        # Fetch users
        users_data = await _amo_get("/api/v4/users")
        user_map = {}
        if users_data:
            for u in users_data.get("_embedded", {}).get("users", []):
                user_map[str(u["id"])] = u.get("name", f"User {u['id']}")

        # Fetch all events for the period
        events = await _fetch_events_batch(ts_from, ts_to)
        logger.info(f"Events sync {sync_id}: fetched {len(events)} events")

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

        # Compute manager stats from events
        await _compute_event_manager_stats(sync_id, ts_from, ts_to, user_map)

        await db.event_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "eventsProcessed": stored
            }}
        )
        logger.info(f"Events sync {sync_id}: completed, {stored} events stored")
    except Exception as e:
        logger.error(f"Events sync {sync_id} failed: {e}", exc_info=True)
        await db.event_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {"status": "error", "error": str(e),
                       "completedAt": datetime.now(timezone.utc).isoformat()}}
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
        "reaction": settings.get("weightReactionSpeed", 25),
        "processing": settings.get("weightProcessingPercent", 25),
        "activity": settings.get("weightEventActivity", 20),
        "progress": settings.get("weightDealProgress", 20),
        "problems": settings.get("weightProblemLeads", 10),
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

        total_weight = sum(weights.values()) or 100
        score = round(
            (reaction_score * weights["reaction"] +
             processing_score * weights["processing"] +
             activity_score * weights["activity"] +
             progress_score * weights["progress"] +
             problem_score * weights["problems"]) / total_weight
        )

        stat["reactionScore"] = reaction_score
        stat["processingScore"] = processing_score
        stat["activityScore"] = activity_score
        stat["progressScore"] = progress_score
        stat["problemScore"] = problem_score
        stat["performanceScore"] = score

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

@router.get("/manager-stats")
async def get_event_manager_stats():
    """Get latest event-based manager statistics."""
    last_sync = await db.event_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    if not last_sync:
        return {"managers": [], "sync_id": None}

    sync_id = last_sync.get("sync_id")
    managers = await db.event_manager_stats.find(
        {"sync_id": sync_id}, {"_id": 0}
    ).sort("rank", 1).to_list(length=100)

    return {"managers": managers, "sync_id": sync_id}


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

    # Latest stats
    last_sync = await db.event_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    stats = None
    if last_sync:
        stats = await db.event_manager_stats.find_one(
            {"userId": user_id, "sync_id": last_sync["sync_id"]}, {"_id": 0}
        )

    return {
        "stats": stats,
        "events": events[:200],
        "totalEvents": len(events),
        "problemLeads": problem_leads,
        "noFirstAction": no_first_action[:50],
        "noProgress": no_progress[:50],
        "longIdle": long_idle[:50],
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
