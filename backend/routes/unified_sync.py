"""Unified sync: runs lead-analytics sync + manager-events sync sequentially
with a single progress doc. Eliminates the "what to sync first?" confusion
in the analytics UI by providing one Полная синхронизация button.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException

from database import db
from routes.lead_analytics import (
    _run_sync as _run_lead_sync,
    get_analytics_settings,
)
from routes.manager_events_analytics import _run_events_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead-analytics/unified-sync", tags=["Unified Sync"])

UNIFIED_COL = "unified_sync"
STALE_MINUTES = 30  # total budget for both phases


async def _set_status(unified_id: str, **fields):
    fields["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db[UNIFIED_COL].update_one(
        {"unified_id": unified_id}, {"$set": fields}
    )


async def _run_unified(unified_id: str, date_from: str = None, date_to: str = None,
                         force: bool = False):
    """Background: leads sync → events sync, with composite progress."""
    try:
        # ── Phase 1: lead-analytics sync ────────────────────────────────
        leads_settings = await get_analytics_settings()
        leads_pipeline = leads_settings.get("pipelineId", "")
        if not leads_pipeline:
            await _set_status(unified_id, status="error", phase="leads",
                              error="pipelineId не указан в настройках Расш. аналитики",
                              completedAt=datetime.now(timezone.utc).isoformat())
            return

        # Cancel any previously running lead sync so we always start clean.
        await db.lead_analytics_sync.update_many(
            {"status": "running"},
            {"$set": {
                "status": "error",
                "error": "Заменено Полной синхронизацией",
                "completedAt": datetime.now(timezone.utc).isoformat(),
            }}
        )
        leads_sync_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + "_leads"
        await db.lead_analytics_sync.insert_one({
            "sync_id": leads_sync_id, "status": "running",
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "date_from": date_from, "date_to": date_to,
            "mode": "full" if force else "incremental",
            "progress": "подготовка...",
            "unified_id": unified_id,
        })
        await _set_status(unified_id, phase="leads", leadsSyncId=leads_sync_id,
                          progress="Этап 1/2: Загрузка лидов из amoCRM…")
        await _run_lead_sync(leads_sync_id, leads_settings, date_from, date_to, force)

        # Verify phase 1 succeeded
        leads_doc = await db.lead_analytics_sync.find_one(
            {"sync_id": leads_sync_id}, {"_id": 0}
        )
        if not leads_doc or leads_doc.get("status") != "completed":
            err = (leads_doc or {}).get("error", "leads sync не завершён")
            await _set_status(unified_id, status="error", phase="leads", error=err,
                              completedAt=datetime.now(timezone.utc).isoformat())
            return

        leads_processed = leads_doc.get("leadsProcessed") or leads_doc.get("processedCount") or 0

        # ── Phase 2: manager-events sync ────────────────────────────────
        await db.event_analytics_sync.update_many(
            {"status": "running"},
            {"$set": {
                "status": "error",
                "error": "Заменено Полной синхронизацией",
                "completedAt": datetime.now(timezone.utc).isoformat(),
            }}
        )
        events_sync_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + "_events"
        await db.event_analytics_sync.insert_one({
            "sync_id": events_sync_id, "status": "running",
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "date_from": date_from, "date_to": date_to,
            "progress": "Запуск…",
            "unified_id": unified_id,
        })
        await _set_status(unified_id, phase="events", eventsSyncId=events_sync_id,
                          leadsProcessed=leads_processed,
                          progress=f"Этап 2/2: Лиды готовы ({leads_processed}). Загрузка событий…")
        await _run_events_sync(events_sync_id, date_from, date_to)

        events_doc = await db.event_analytics_sync.find_one(
            {"sync_id": events_sync_id}, {"_id": 0}
        )
        if not events_doc or events_doc.get("status") != "completed":
            err = (events_doc or {}).get("error", "events sync не завершён")
            await _set_status(unified_id, status="error", phase="events", error=err,
                              completedAt=datetime.now(timezone.utc).isoformat(),
                              leadsProcessed=leads_processed)
            return

        events_processed = events_doc.get("eventsProcessed", 0)
        await _set_status(unified_id, status="completed", phase="done",
                          progress=f"Готово · {leads_processed} лидов + {events_processed} событий",
                          eventsProcessed=events_processed,
                          leadsProcessed=leads_processed,
                          completedAt=datetime.now(timezone.utc).isoformat())
        logger.info(f"Unified sync {unified_id}: completed "
                    f"({leads_processed} leads, {events_processed} events)")
    except Exception as e:
        logger.error(f"Unified sync {unified_id} failed: {e}", exc_info=True)
        await _set_status(unified_id, status="error",
                          error=str(e)[:300],
                          completedAt=datetime.now(timezone.utc).isoformat())


@router.post("")
async def start_unified_sync(background_tasks: BackgroundTasks,
                              date_from: str = None, date_to: str = None,
                              force: bool = False):
    """Start a unified leads+events sync. Cancels any in-progress unified sync."""
    # Auto-cancel stale or running unified docs
    await db[UNIFIED_COL].update_many(
        {"status": "running"},
        {"$set": {
            "status": "error",
            "error": "Заменено новой Полной синхронизацией",
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }}
    )
    unified_id = datetime.now(timezone.utc).strftime("UNI_%Y%m%d_%H%M%S")
    await db[UNIFIED_COL].insert_one({
        "unified_id": unified_id,
        "status": "running",
        "phase": "starting",
        "progress": "Подготовка…",
        "date_from": date_from, "date_to": date_to,
        "force": force,
        "startedAt": datetime.now(timezone.utc).isoformat(),
    })
    background_tasks.add_task(_run_unified, unified_id, date_from, date_to, force)
    return {"status": "started", "unified_id": unified_id}


@router.get("/status")
async def get_unified_status():
    doc = await db[UNIFIED_COL].find_one({}, {"_id": 0}, sort=[("startedAt", -1)])
    if not doc:
        return {"status": "never"}
    # Stale-recovery: if startedAt > STALE_MINUTES and still running, force error.
    if doc.get("status") == "running":
        try:
            started_dt = datetime.fromisoformat(doc.get("startedAt"))
            age_min = (datetime.now(timezone.utc) - started_dt).total_seconds() / 60
            if age_min > STALE_MINUTES:
                err = (f"Полная синхронизация подвисла >{int(age_min)} мин — "
                        "автоматически помечена как ошибка. Запустите заново.")
                await db[UNIFIED_COL].update_one(
                    {"unified_id": doc["unified_id"]},
                    {"$set": {
                        "status": "error", "error": err,
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    }}
                )
                doc["status"] = "error"
                doc["error"] = err
        except Exception:
            pass
    return doc


@router.post("/cancel")
async def cancel_unified_sync():
    """Mark any running unified sync as cancelled."""
    res = await db[UNIFIED_COL].update_many(
        {"status": "running"},
        {"$set": {
            "status": "error",
            "error": "Отменено пользователем",
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }}
    )
    # Also cancel any sub-phase sync still running
    await db.lead_analytics_sync.update_many(
        {"status": "running"},
        {"$set": {
            "status": "error",
            "error": "Отменено пользователем",
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }}
    )
    await db.event_analytics_sync.update_many(
        {"status": "running"},
        {"$set": {
            "status": "error",
            "error": "Отменено пользователем",
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"cancelled": res.modified_count}
