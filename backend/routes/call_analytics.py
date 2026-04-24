"""Call Analytics — sync calls from amoCRM, transcribe (Whisper), analyze (GPT-5.2)."""
import logging
import os
import asyncio
import json
import uuid
import io
import tempfile
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from pydantic import BaseModel, Field
from database import db
from routes.amocrm import get_amocrm_settings
import httpx

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/call-analytics", tags=["Call Analytics"])

EMERGENT_PROXY = "https://integrations.emergentagent.com/llm"
CALLS_COL = "call_analytics_calls"
RULES_COL = "call_analytics_rules"
SETTINGS_COL = "call_analytics_settings"
SYNC_COL = "call_analytics_sync"

BINOTEL_API = "https://api.binotel.com/api/4.0"


def _api_key():
    return os.environ.get("EMERGENT_LLM_KEY", "")


def _binotel_creds():
    return {
        "key": os.environ.get("BINOTEL_API_KEY", ""),
        "secret": os.environ.get("BINOTEL_API_SECRET", ""),
    }


async def _binotel_get_calls(start_ts: int, end_ts: int, direction: str = "incoming") -> list:
    """Fetch calls from Binotel API for a period. direction: 'incoming' or 'outgoing'."""
    creds = _binotel_creds()
    if not creds["key"]:
        return []
    endpoint = f"{BINOTEL_API}/stats/{direction}-calls-for-period.json"
    body = {**creds, "startTime": str(start_ts), "stopTime": str(end_ts)}
    try:
        async with httpx.AsyncClient(timeout=30) as cl:
            resp = await cl.post(endpoint, json=body)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                return list(data.get("callDetails", {}).values())
        logger.warning(f"Binotel {direction} calls: {resp.status_code} — {resp.text[:200]}")
    except Exception as e:
        logger.error(f"Binotel API error: {e}")
    return []


async def _binotel_get_audio_url(general_call_id: str) -> str:
    """Get temporary audio URL from Binotel (valid 15 min)."""
    creds = _binotel_creds()
    if not creds["key"] or not general_call_id:
        return ""
    try:
        async with httpx.AsyncClient(timeout=15) as cl:
            resp = await cl.post(
                f"{BINOTEL_API}/stats/call-record.json",
                json={**creds, "generalCallID": str(general_call_id)}
            )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                return data.get("url", "")
            logger.warning(f"Binotel record: {data}")
    except Exception as e:
        logger.error(f"Binotel audio URL error: {e}")
    return ""


async def _find_binotel_call(phone: str, call_ts: int, direction: str) -> str:
    """Find generalCallID by matching phone and approximate time."""
    # Search in a window of ±5 minutes
    start = call_ts - 300
    end = call_ts + 300
    bino_dir = "incoming" if direction == "inbound" else "outgoing"
    calls = await _binotel_get_calls(start, end, bino_dir)
    # Clean phone for matching
    phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "")[-9:]
    for c in calls:
        ext_num = str(c.get("externalNumber", "")).replace("+", "").replace(" ", "")[-9:]
        if ext_num and phone_clean and ext_num == phone_clean:
            return str(c.get("generalCallID", ""))
    return ""


# ── Models ────────────────────────────────────────

class CallAnalyticsSettings(BaseModel):
    pipelineId: str = ""
    stageIds: List[str] = []
    lastSyncAt: Optional[str] = None
    autoTranscribe: bool = True
    autoAnalyze: bool = True
    minDurationSeconds: int = 30  # Skip calls shorter than this


class Rule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    description: str = ""
    promptTemplate: str = ""
    isDefault: bool = False
    configJson: dict = {}


# ── Settings ──────────────────────────────────────

@router.get("/settings")
async def get_settings():
    doc = await db[SETTINGS_COL].find_one({}, {"_id": 0})
    return doc or CallAnalyticsSettings().model_dump()


@router.put("/settings")
async def save_settings(settings: CallAnalyticsSettings):
    d = settings.model_dump()
    await db[SETTINGS_COL].update_one({}, {"$set": d}, upsert=True)
    return d


# ── Sync ──────────────────────────────────────────

@router.post("/sync")
async def start_sync(background_tasks: BackgroundTasks,
                     date_from: str = None, mode: str = "from_date"):
    """mode: 'from_date' or 'from_last_sync'"""
    settings = await get_settings()
    if not settings.get("pipelineId"):
        raise HTTPException(status_code=400, detail="Воронка не выбрана в настройках")

    sync_id = datetime.now(timezone.utc).strftime("csync_%Y%m%d_%H%M%S")
    await db[SYNC_COL].insert_one({
        "syncId": sync_id, "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "progress": "запуск...", "mode": mode
    })
    background_tasks.add_task(_run_call_sync, sync_id, settings, date_from, mode)
    return {"status": "started", "syncId": sync_id}


@router.get("/sync-status")
async def get_sync_status():
    s = await db[SYNC_COL].find_one({}, {"_id": 0}, sort=[("startedAt", -1)])
    return s or {"status": "never"}


async def _run_call_sync(sync_id: str, settings: dict, date_from: str, mode: str):
    try:
        amo = get_amocrm_settings()
        domain = amo.get("amocrm_domain", "")
        token = amo.get("amocrm_token", "")
        if not domain or not token:
            raise Exception("amoCRM не настроен")

        headers = {"Authorization": f"Bearer {token}"}
        pipeline_id = settings.get("pipelineId", "")
        stage_ids = settings.get("stageIds", [])

        # Determine start date
        if mode == "from_last_sync" and settings.get("lastSyncAt"):
            ts_from = int(datetime.fromisoformat(settings["lastSyncAt"]).timestamp())
        elif date_from:
            ts_from = int(datetime.fromisoformat(date_from).timestamp())
        else:
            ts_from = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp())

        await _update_call_sync(sync_id, "загрузка лидов из amoCRM...")

        # Fetch leads from selected stages, filtered by updated_at >= ts_from
        all_leads = []
        seen_ids = set()
        for sid in (stage_ids or [""]):
            params = [
                ("filter[statuses][0][pipeline_id]", pipeline_id),
                ("limit", "250"),
                ("with", "contacts"),
            ]
            if sid:
                params.append(("filter[statuses][0][status_id]", sid))
            if ts_from:
                params.append(("filter[updated_at][from]", str(ts_from)))
            page = 1
            while page <= 20:
                page_params = params + [("page", str(page))]
                async with httpx.AsyncClient(timeout=30) as cl:
                    r = await cl.get(f"https://{domain}/api/v4/leads", headers=headers, params=page_params)
                if r.status_code == 204:
                    break
                if r.status_code != 200:
                    logger.warning(f"Call sync: leads fetch status={r.status_code}")
                    break
                leads = r.json().get("_embedded", {}).get("leads", [])
                for ld in leads:
                    if ld["id"] not in seen_ids:
                        all_leads.append(ld)
                        seen_ids.add(ld["id"])
                if len(leads) < 250:
                    break
                page += 1

        logger.info(f"Call sync {sync_id}: {len(all_leads)} leads in pipeline (filtered from {ts_from})")
        await _update_call_sync(sync_id, f"найдено {len(all_leads)} сделок (обновлённых с {datetime.fromtimestamp(ts_from, tz=timezone.utc).strftime('%d.%m.%Y') if ts_from else 'начала'}), загрузка звонков...")

        # Fetch call notes — try lead notes first, then contact notes
        imported = 0
        updated = 0
        users_cache = {}
        processed_leads = 0
        total_notes_scanned = 0

        for ld in all_leads:
            lid = ld["id"]
            # Fetch call notes — try lead notes first, then contact notes
            notes = []
            call_notes = []
            try:
                # 1. All notes from lead (no filter — Binotel/other integrations use different note types)
                async with httpx.AsyncClient(timeout=15) as cl:
                    nr = await cl.get(
                        f"https://{domain}/api/v4/leads/{lid}/notes",
                        headers=headers,
                        params=[("limit", "250")]
                    )
                if nr.status_code == 200:
                    all_notes = nr.json().get("_embedded", {}).get("notes", [])
                    for n in all_notes:
                        nt = n.get("note_type", "")
                        p = n.get("params", {}) or {}
                        # Strict filter: standard call types OR note with actual audio link OR duration>0
                        # (phone alone is not enough — it may be a contact-info update, not a real call)
                        is_call = nt in ("call_in", "call_out", 10, 11)
                        has_real_call = isinstance(p, dict) and (
                            p.get("link") or int(p.get("duration") or 0) > 0
                        )
                        if is_call or has_real_call:
                            call_notes.append(n)
                    if processed_leads < 3:
                        note_types = set(str(n.get("note_type")) for n in all_notes)
                        logger.info(f"Lead {lid}: {len(all_notes)} notes, types={note_types}, calls={len(call_notes)}")

                # 2. If no calls on lead, check contacts
                if not call_notes:
                    contacts = ld.get("_embedded", {}).get("contacts", [])
                    for contact in contacts[:3]:
                        cid = contact.get("id")
                        if not cid:
                            continue
                        async with httpx.AsyncClient(timeout=15) as cl:
                            cr = await cl.get(
                                f"https://{domain}/api/v4/contacts/{cid}/notes",
                                headers=headers,
                                params=[("limit", "250")]
                            )
                        if cr.status_code == 200:
                            c_notes = cr.json().get("_embedded", {}).get("notes", [])
                            for n in c_notes:
                                nt = n.get("note_type", "")
                                p = n.get("params", {}) or {}
                                is_call = nt in ("call_in", "call_out", 10, 11)
                                has_real_call = isinstance(p, dict) and (
                                    p.get("link") or int(p.get("duration") or 0) > 0
                                )
                                if is_call or has_real_call:
                                    call_notes.append(n)
                            if processed_leads < 3:
                                c_types = set(str(n.get("note_type")) for n in c_notes)
                                logger.info(f"Contact {cid} of lead {lid}: {len(c_notes)} notes, types={c_types}, calls={len(call_notes)}")
                        await asyncio.sleep(0.1)

                notes = call_notes
            except Exception as e:
                logger.warning(f"Failed to fetch notes for lead {lid}: {e}")

            # Process each call note
            for note in notes:
                note_created = note.get("created_at", 0)
                if note_created < ts_from:
                    continue

                params_n = note.get("params", {})
                note_type = note.get("note_type", "")

                amo_call_id = str(note.get("id", ""))
                existing = await db[CALLS_COL].find_one({"amo_call_id": amo_call_id})

                # Direction from note type (string or int) or from params
                if note_type in ("call_in", 10):
                    direction = "inbound"
                elif note_type in ("call_out", 11):
                    direction = "outbound"
                elif isinstance(params_n, dict):
                    # Binotel/other: try to detect from params
                    call_type = str(params_n.get("call_type", params_n.get("callType", ""))).lower()
                    direction = "inbound" if "in" in call_type else "outbound"
                else:
                    direction = "unknown"
                duration = int(params_n.get("duration", 0)) if isinstance(params_n, dict) else 0
                audio_url = params_n.get("link", "") if isinstance(params_n, dict) else ""
                phone = params_n.get("phone", "") if isinstance(params_n, dict) else ""

                # Contact info
                contacts = ld.get("_embedded", {}).get("contacts", [])
                client_name = contacts[0].get("name", "") if contacts else ld.get("name", "")
                contact_id = str(contacts[0].get("id", "")) if contacts else ""

                # Manager (cached)
                resp_user_id = str(ld.get("responsible_user_id", ""))
                if resp_user_id and resp_user_id not in users_cache:
                    try:
                        async with httpx.AsyncClient(timeout=10) as cl:
                            ur = await cl.get(f"https://{domain}/api/v4/users/{resp_user_id}", headers=headers)
                        if ur.status_code == 200:
                            users_cache[resp_user_id] = ur.json().get("name", "")
                    except:
                        users_cache[resp_user_id] = ""
                manager_name = users_cache.get(resp_user_id, "")

                call_data = {
                    "amo_call_id": amo_call_id,
                    "lead_id": str(lid),
                    "contact_id": contact_id,
                    "manager_id": str(resp_user_id),
                    "manager_name": manager_name,
                    "client_name": client_name,
                    "deal_name": ld.get("name", ""),
                    "deal_stage": str(ld.get("status_id", "")),
                    "deal_price": ld.get("price", 0),
                    "product": "",
                    "amo_link": f"https://{domain}/leads/detail/{lid}",
                    "audio_url": audio_url,
                    "phone": phone,
                    "datetime": datetime.fromtimestamp(note_created, tz=timezone.utc).isoformat(),
                    "direction": direction,
                    "duration_seconds": duration,
                    "pipeline_id": str(ld.get("pipeline_id", "")),
                    "status_id": str(ld.get("status_id", "")),
                }

                if existing:

                    await db[CALLS_COL].update_one(
                        {"amo_call_id": amo_call_id},
                        {"$set": {**call_data, "updatedAt": datetime.now(timezone.utc).isoformat()}}
                    )
                    updated += 1
                else:
                    call_data.update({
                        "id": f"CALL-{uuid.uuid4().hex[:8]}",
                        "language": None,
                        "transcript_pl": None,
                        "transcript_ru": None,
                        "score": None,
                        "has_strong_negative": False,
                        "checks_json": None,
                        "summary_ru": None,
                        "key_issues_json": None,
                        "recommendations_json": None,
                        "rule_id": None,
                        "status": "new",
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    })
                    await db[CALLS_COL].update_one(
                        {"amo_call_id": amo_call_id},
                        {"$setOnInsert": call_data},
                        upsert=True
                    )
                    imported += 1

            processed_leads += 1
            if processed_leads <= 5:
                logger.info(f"Call sync lead {lid}: {len(notes)} calls found")
            if processed_leads % 20 == 0:
                await _update_call_sync(sync_id, f"обработано {processed_leads}/{len(all_leads)} сделок, звонков: +{imported}")
            # Rate limit protection
            if processed_leads % 5 == 0:
                await asyncio.sleep(0.3)

        # Update lastSyncAt
        now = datetime.now(timezone.utc).isoformat()
        await db[SETTINGS_COL].update_one({}, {"$set": {"lastSyncAt": now}}, upsert=True)

        await db[SYNC_COL].update_one({"syncId": sync_id}, {"$set": {
            "status": "completed", "completedAt": now,
            "imported": imported, "updated": updated,
            "progress": f"готово: +{imported} новых, {updated} обновлено"
        }})
        logger.info(f"Call sync {sync_id}: imported={imported}, updated={updated}")

    except Exception as e:
        logger.error(f"Call sync {sync_id} failed: {e}", exc_info=True)
        await db[SYNC_COL].update_one({"syncId": sync_id}, {"$set": {
            "status": "error", "error": str(e),
            "completedAt": datetime.now(timezone.utc).isoformat()
        }})


async def _update_call_sync(sync_id, progress):
    await db[SYNC_COL].update_one({"syncId": sync_id}, {"$set": {"progress": progress}})



@router.get("/calls/{call_id}/debug-audio")
async def debug_audio_download(call_id: str):
    """Debug: show what server actually downloads from the audio URL."""
    call = await db[CALLS_COL].find_one({"id": call_id}, {"_id": 0})
    if not call or not call.get("audio_url"):
        return {"error": "No audio URL"}
    audio_url = call["audio_url"]
    amo = get_amocrm_settings()
    dl_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    if amo.get("amocrm_token") and amo.get("amocrm_domain") and amo["amocrm_domain"] in audio_url:
        dl_headers["Authorization"] = f"Bearer {amo['amocrm_token']}"
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as cl:
        resp = await cl.get(audio_url, headers=dl_headers)
    content = resp.content
    return {
        "url": audio_url,
        "status": resp.status_code,
        "content_type": resp.headers.get("content-type", ""),
        "content_length": len(content),
        "first_bytes_hex": content[:32].hex(),
        "first_bytes_text": content[:200].decode('utf-8', errors='replace')[:200],
        "is_html": b"<html" in content[:500].lower() or b"<!doctype" in content[:500].lower(),
    }


@router.get("/debug-first-call")
async def debug_first_call():
    """Debug: check first call's audio download without needing call ID."""
    call = await db[CALLS_COL].find_one({"audio_url": {"$ne": ""}}, {"_id": 0, "id": 1, "audio_url": 1, "manager_name": 1, "client_name": 1, "error": 1})
    if not call:
        return {"error": "Нет звонков с audio_url"}
    audio_url = call["audio_url"]
    amo = get_amocrm_settings()
    dl_headers = {"User-Agent": "Mozilla/5.0"}
    if amo.get("amocrm_token") and amo.get("amocrm_domain") and amo["amocrm_domain"] in audio_url:
        dl_headers["Authorization"] = f"Bearer {amo['amocrm_token']}"
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as cl:
            resp = await cl.get(audio_url, headers=dl_headers)
        content = resp.content
        return {
            "call_id": call["id"],
            "audio_url": audio_url,
            "http_status": resp.status_code,
            "content_type": resp.headers.get("content-type", ""),
            "size_bytes": len(content),
            "is_html": b"<html" in content[:500].lower() or b"<!doctype" in content[:500].lower(),
            "first_100_chars": content[:100].decode('utf-8', errors='replace'),
            "diagnosis": "HTML-страница вместо аудио — Binotel требует авторизацию" if b"<html" in content[:500].lower() else "Файл скачан, формат: " + content[:4].hex()
        }
    except Exception as e:
        return {"call_id": call["id"], "audio_url": audio_url, "error": str(e)}




@router.post("/calls/{call_id}/upload-audio")
async def upload_audio_for_call(call_id: str, file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    """Upload audio file for a call (when direct download is not possible)."""
    call = await db[CALLS_COL].find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Звонок не найден")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл > 50MB")
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="Файл слишком маленький — возможно скачалась HTML-страница")

    # Save audio to GridFS or as base64 in DB
    import base64
    audio_b64 = base64.b64encode(content).decode()
    await db[CALLS_COL].update_one({"id": call_id}, {"$set": {
        "audio_data": audio_b64,
        "audio_size": len(content),
        "status": "new",
        "error": None,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }})
    if background_tasks:
        background_tasks.add_task(_transcribe_single, call_id)
    return {"status": "ok", "size": len(content), "callId": call_id}



# ── Transcription ─────────────────────────────────

@router.post("/calls/{call_id}/transcribe")
async def transcribe_call(call_id: str, background_tasks: BackgroundTasks):
    call = await db[CALLS_COL].find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Звонок не найден")
    if not call.get("audio_url"):
        raise HTTPException(status_code=400, detail="Нет ссылки на аудио")
    background_tasks.add_task(_transcribe_single, call_id)
    return {"status": "started", "callId": call_id}


@router.post("/process-pending")
async def process_pending(background_tasks: BackgroundTasks, limit: int = 10):
    """Process pending calls: transcribe + analyze."""
    settings = await get_settings()
    min_dur = settings.get("minDurationSeconds", 30)

    new_calls = await db[CALLS_COL].find(
        {"status": "new", "audio_url": {"$ne": ""}, "duration_seconds": {"$gte": min_dur}},
        {"id": 1, "_id": 0}
    ).limit(limit).to_list(length=limit)

    # Mark short calls as skipped
    skipped = await db[CALLS_COL].update_many(
        {"status": "new", "duration_seconds": {"$lt": min_dur, "$gt": 0}},
        {"$set": {"status": "skipped", "error": f"Короткий звонок (<{min_dur}с)"}}
    )

    transcribed = await db[CALLS_COL].find(
        {"status": "transcribed", "transcript_ru": {"$ne": None}},
        {"id": 1, "_id": 0}
    ).limit(limit).to_list(length=limit)

    for c in new_calls:
        background_tasks.add_task(_transcribe_single, c["id"])
    for c in transcribed:
        background_tasks.add_task(_analyze_single, c["id"])

    return {"queued_transcribe": len(new_calls), "queued_analyze": len(transcribed), "skipped_short": skipped.modified_count}


@router.get("/stats")
async def get_call_stats():
    """Get counts by status + total cost."""
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    results = await db[CALLS_COL].aggregate(pipeline).to_list(length=20)
    stats = {r["_id"]: r["count"] for r in results}
    total = sum(stats.values())
    # Total cost
    cost_pipeline = [{"$group": {"_id": None, "total_cost": {"$sum": {"$ifNull": ["$cost_total", 0]}}}}]
    cost_result = await db[CALLS_COL].aggregate(cost_pipeline).to_list(length=1)
    total_cost = round(cost_result[0]["total_cost"], 2) if cost_result else 0
    return {"total": total, "byStatus": stats, "totalCost": total_cost}


@router.post("/process-all")
async def process_all(background_tasks: BackgroundTasks):
    """Queue ALL pending calls for processing."""
    settings = await get_settings()
    min_dur = settings.get("minDurationSeconds", 30)

    # Mark short calls as skipped
    skipped = await db[CALLS_COL].update_many(
        {"status": {"$in": ["new", "error"]}, "duration_seconds": {"$lt": min_dur, "$gt": 0}},
        {"$set": {"status": "skipped", "error": f"Короткий звонок (<{min_dur}с)"}}
    )

    new_calls = await db[CALLS_COL].find(
        {"status": "new", "audio_url": {"$ne": ""}, "duration_seconds": {"$gte": min_dur}},
        {"id": 1, "_id": 0}
    ).to_list(length=1000)

    transcribed = await db[CALLS_COL].find(
        {"status": "transcribed", "transcript_ru": {"$ne": None}},
        {"id": 1, "_id": 0}
    ).to_list(length=1000)

    # Reset errors for retry (only long enough calls)
    errors = await db[CALLS_COL].find(
        {"status": "error", "audio_url": {"$ne": ""}, "duration_seconds": {"$gte": min_dur}},
        {"id": 1, "_id": 0}
    ).to_list(length=1000)
    if errors:
        error_ids = [c["id"] for c in errors]
        await db[CALLS_COL].update_many({"id": {"$in": error_ids}}, {"$set": {"status": "new"}})

    for c in new_calls + errors:
        background_tasks.add_task(_transcribe_single, c["id"])
    for c in transcribed:
        background_tasks.add_task(_analyze_single, c["id"])

    return {
        "queued_transcribe": len(new_calls) + len(errors),
        "queued_analyze": len(transcribed),
        "errors_reset": len(errors),
        "skipped_short": skipped.modified_count
    }


async def _transcribe_single(call_id: str):
    try:
        call = await db[CALLS_COL].find_one({"id": call_id})
        if not call:
            return
        if not call.get("audio_url") and not call.get("audio_data"):
            return

        audio_url = call.get("audio_url", "")
        api_key = _api_key()
        if not api_key:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "No API key"}})
            return

        amo = get_amocrm_settings()
        await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "transcribing"}})

        # Get audio bytes — from uploaded data, Binotel API, or direct URL
        audio_bytes = None
        if call.get("audio_data"):
            import base64
            audio_bytes = base64.b64decode(call["audio_data"])
            logger.info(f"Call {call_id}: using uploaded audio ({len(audio_bytes)} bytes)")
        else:
            # Try Binotel API first (get fresh temporary URL)
            binotel_url = ""
            gcid = call.get("binotel_call_id", "")
            if not gcid and call.get("phone") and call.get("datetime"):
                call_ts = int(datetime.fromisoformat(call["datetime"]).timestamp())
                gcid = await _find_binotel_call(call.get("phone", ""), call_ts, call.get("direction", ""))
                if gcid:
                    await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"binotel_call_id": gcid}})
                    logger.info(f"Call {call_id}: found Binotel generalCallID={gcid}")

            if gcid:
                binotel_url = await _binotel_get_audio_url(gcid)
                if binotel_url:
                    logger.info(f"Call {call_id}: got Binotel audio URL")

            download_url = binotel_url or audio_url
            if download_url:
                dl_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                if not binotel_url and amo.get("amocrm_token") and amo.get("amocrm_domain") and amo["amocrm_domain"] in download_url:
                    dl_headers["Authorization"] = f"Bearer {amo['amocrm_token']}"
                async with httpx.AsyncClient(timeout=120, follow_redirects=True) as cl:
                    audio_resp = await cl.get(download_url, headers=dl_headers)
                if audio_resp.status_code != 200:
                    await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": f"Download failed: HTTP {audio_resp.status_code}"}})
                    return
                audio_bytes = audio_resp.content
                if b"<html" in audio_bytes[:500].lower():
                    await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "Получена HTML-страница вместо аудио"}})
                    return
            else:
                await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "Нет аудио URL и не удалось найти в Binotel"}})
                return

        if len(audio_bytes) > 25 * 1024 * 1024:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "Audio > 25MB"}})
            return

        # Send to Whisper via OpenAI SDK (handles multipart correctly)
        logger.info(f"Transcribing call {call_id}: {len(audio_bytes)} bytes, url={audio_url[:80]}")

        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key, base_url=EMERGENT_PROXY)

            whisper_result = await client.audio.transcriptions.create(
                model="whisper-1",
                file=("call.mp3", audio_bytes),
                response_format="verbose_json"
            )

            transcript = whisper_result.text or ""
            language = getattr(whisper_result, 'language', 'unknown') or 'unknown'
        except Exception as whisper_err:
            error_msg = str(whisper_err)[:500]
            logger.error(f"Whisper error for {call_id}: {error_msg}")
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {
                "status": "error",
                "error": f"Whisper: {error_msg}"
            }})
            return

        update = {"status": "transcribed", "language": language}
        # Cost: Whisper = $0.006/min
        dur_min = (call.get("duration_seconds") or 60) / 60
        cost_whisper = round(dur_min * 0.006, 4)
        cost_diarize = 0.0

        lang_lower = language.lower()
        if lang_lower in ("polish", "pl"):
            update["transcript_pl"] = transcript
            update["language"] = "pl"
            # Diarize + translate to Russian
            diarized_ru = await _diarize_and_translate(transcript, call, "pl")
            update["transcript_ru"] = diarized_ru
            cost_diarize = _estimate_gpt_cost(transcript, diarized_ru, "gpt-4o-mini")
        elif lang_lower in ("russian", "ru"):
            update["language"] = "ru"
            diarized = await _diarize_and_translate(transcript, call, "ru")
            update["transcript_ru"] = diarized
            cost_diarize = _estimate_gpt_cost(transcript, diarized, "gpt-4o-mini")
        else:
            update["transcript_pl"] = transcript
            update["language"] = lang_lower
            diarized_ru = await _diarize_and_translate(transcript, call, lang_lower)
            update["transcript_ru"] = diarized_ru
            cost_diarize = _estimate_gpt_cost(transcript, diarized_ru, "gpt-4o-mini")

        update["cost_whisper"] = cost_whisper
        update["cost_diarize"] = cost_diarize
        update["cost_total"] = round(cost_whisper + cost_diarize, 4)

        await db[CALLS_COL].update_one({"id": call_id}, {"$set": update})
        logger.info(f"Transcribed call {call_id}: lang={language}, len={len(transcript)}")

        # Auto-analyze if configured
        settings = await get_settings()
        if settings.get("autoAnalyze"):
            await _analyze_single(call_id)

    except Exception as e:
        logger.error(f"Transcription error for {call_id}: {e}", exc_info=True)
        await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": str(e)}})



def _estimate_gpt_cost(input_text: str, output_text: str, model: str = "gpt-5.2") -> float:
    """Estimate GPT cost. gpt-5.2: $0.01/$0.03 per 1K tokens. gpt-4o-mini: $0.00015/$0.0006."""
    in_t = len(input_text or "") / 4
    out_t = len(output_text or "") / 4
    if "mini" in model:
        cost = (in_t * 0.00015 + out_t * 0.0006) / 1000
    else:
        cost = (in_t * 0.01 + out_t * 0.03) / 1000
    return round(cost, 4)


async def _translate_to_russian(text: str) -> str:
    api_key = _api_key()
    async with httpx.AsyncClient(timeout=120) as cl:
        resp = await cl.post(
            f"{EMERGENT_PROXY}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "gpt-4o-mini", "messages": [
                {"role": "system", "content": "Переведи текст с польского на русский. Верни только перевод, без пояснений."},
                {"role": "user", "content": text}
            ]}
        )
    if resp.status_code == 200:
        return resp.json()["choices"][0]["message"]["content"]
    return text


async def _diarize_and_translate(transcript: str, call: dict, source_lang: str) -> str:
    """Use GPT to split transcript into dialog (M: manager / C: client) and translate to Russian."""
    api_key = _api_key()
    if not api_key:
        return transcript

    manager_name = call.get("manager_name", "Менеджер")
    client_name = call.get("client_name", "Клиент")
    direction = call.get("direction", "outbound")

    prompt = f"""Ниже транскрипт телефонного звонка между менеджером и клиентом. Твоя задача:

1. Разбей текст на реплики, определив кто говорит — менеджер (М) или клиент (К).
2. {'Переведи каждую реплику на русский язык.' if source_lang != 'ru' else 'Оставь текст на русском.'}
3. Верни результат в формате диалога:

М: текст реплики менеджера
К: текст реплики клиента
М: следующая реплика
...

Контекст:
- Менеджер: {manager_name}
- Клиент: {client_name or 'неизвестен'}
- Направление: {'исходящий (менеджер звонит клиенту)' if direction == 'outbound' else 'входящий (клиент звонит)'}
- {'Исходящий звонок — первым обычно говорит клиент (берёт трубку), менеджер представляется.' if direction == 'outbound' else 'Входящий звонок — первым обычно говорит менеджер (принимает звонок).'}

Правила:
- Определяй спикера по контексту: менеджер представляется, предлагает продукт, задаёт вопросы о потребностях. Клиент отвечает на вопросы, задаёт вопросы о цене/сроках.
- Если не можешь точно определить — используй лучшее предположение.
- Не добавляй ничего от себя, только разметь и переведи.

Транскрипт ({source_lang}):
{transcript[:10000]}"""

    try:
        async with httpx.AsyncClient(timeout=120) as cl:
            resp = await cl.post(
                f"{EMERGENT_PROXY}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini", "messages": [
                    {"role": "system", "content": "Ты — эксперт по диаризации телефонных разговоров. Разбиваешь транскрипт на реплики М (менеджер) и К (клиент). Отвечай только диалогом, без пояснений."},
                    {"role": "user", "content": prompt}
                ]}
            )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning(f"Diarization failed for call {call.get('id')}: {e}")

    # Fallback: just translate without diarization
    if source_lang != "ru":
        return await _translate_to_russian(transcript)
    return transcript


# ── AI Analysis ───────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """Ты — ИИ-аналитик качества продаж. Анализируешь звонки менеджеров с клиентами на основе транскриптов.

Чек-лист: greeting, needs, presentation, objections, next_step, politeness, compliance.
Каждый пункт: score 0-2, comment на русском.
Общий score: 0-10.

Всегда возвращай ТОЛЬКО JSON без текста вне него. Все текстовые поля на русском."""


@router.post("/calls/{call_id}/analyze")
async def analyze_call(call_id: str, background_tasks: BackgroundTasks):
    call = await db[CALLS_COL].find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Звонок не найден")
    if not call.get("transcript_ru"):
        raise HTTPException(status_code=400, detail="Нет транскрипта")
    background_tasks.add_task(_analyze_single, call_id)
    return {"status": "started", "callId": call_id}


async def _analyze_single(call_id: str):
    try:
        call = await db[CALLS_COL].find_one({"id": call_id})
        if not call or not call.get("transcript_ru"):
            return

        api_key = _api_key()
        if not api_key:
            return

        # Get rule
        rule = None
        if call.get("rule_id"):
            rule = await db[RULES_COL].find_one({"id": call["rule_id"]}, {"_id": 0})
        if not rule:
            rule = await db[RULES_COL].find_one({"isDefault": True}, {"_id": 0})

        rules_json = json.dumps(rule.get("configJson", {}) if rule else {}, ensure_ascii=False)

        transcript = call.get("transcript_ru", "")
        user_prompt = f"""Проанализируй звонок и верни результат строго в формате JSON.

[МЕТАДАННЫЕ]
- call_id: {call_id}
- datetime: {call.get('datetime', '')}
- manager_name: {call.get('manager_name', '')}
- client_name: {call.get('client_name', '')}
- direction: {call.get('direction', '')}
- duration_seconds: {call.get('duration_seconds', 0)}
- deal_stage: {call.get('deal_stage', '')}
- product: {call.get('product', '')}
- transcript_source_language: {call.get('language', 'ru')}

[ПРАВИЛА ОЦЕНКИ]
{rules_json}

[ТРАНСКРИПТ]
{transcript[:12000]}

Верни JSON: score (0-10), has_strong_negative, checks (greeting/needs/presentation/objections/next_step/politeness/compliance с score 0-2 и comment), summary_ru, key_issues[], recommendations[]."""

        await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "analyzing"}})

        async with httpx.AsyncClient(timeout=120) as cl:
            resp = await cl.post(
                f"{EMERGENT_PROXY}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "gpt-5.2", "messages": [
                    {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ]}
            )

        if resp.status_code != 200:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": f"LLM: {resp.status_code}"}})
            return

        text = resp.json()["choices"][0]["message"]["content"]

        # Parse JSON from response
        try:
            # Try to extract JSON from text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                analysis = json.loads(text[start:end])
            else:
                analysis = json.loads(text)
        except json.JSONDecodeError:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "Invalid JSON from LLM"}})
            return

        update = {
            "status": "analyzed",
            "score": analysis.get("score"),
            "has_strong_negative": analysis.get("has_strong_negative", False),
            "checks_json": analysis.get("checks"),
            "summary_ru": analysis.get("summary_ru", ""),
            "key_issues_json": analysis.get("key_issues", []),
            "recommendations_json": analysis.get("recommendations", []),
            "analyzedAt": datetime.now(timezone.utc).isoformat(),
            "cost_analyze": _estimate_gpt_cost(user_prompt, text),
        }
        # Update total cost
        current = await db[CALLS_COL].find_one({"id": call_id}, {"cost_total": 1, "cost_whisper": 1, "cost_diarize": 1, "_id": 0})
        prev_cost = (current.get("cost_whisper") or 0) + (current.get("cost_diarize") or 0)
        update["cost_total"] = round(prev_cost + update["cost_analyze"], 4)
        await db[CALLS_COL].update_one({"id": call_id}, {"$set": update})
        logger.info(f"Analyzed call {call_id}: score={analysis.get('score')}")

    except Exception as e:
        logger.error(f"Analysis error for {call_id}: {e}", exc_info=True)
        await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": str(e)}})


# ── Calls CRUD ────────────────────────────────────

@router.get("/calls")
async def get_calls(
    manager_id: str = None, date_from: str = None, date_to: str = None,
    status: str = None, score_min: float = None, score_max: float = None,
    has_negative: bool = None, only_with_audio: bool = True,
    limit: int = 50, skip: int = 0
):
    query = {}
    if manager_id:
        query["manager_id"] = manager_id
    if date_from:
        query["datetime"] = {"$gte": date_from}
    if date_to:
        query.setdefault("datetime", {})["$lte"] = date_to + "T23:59:59"
    if status:
        query["status"] = status
    if score_min is not None:
        query["score"] = {"$gte": score_min}
    if score_max is not None:
        query.setdefault("score", {})["$lte"] = score_max
    if has_negative is not None:
        query["has_strong_negative"] = has_negative
    if only_with_audio:
        # Must have either an audio URL/data or a non-zero duration
        query["$or"] = [
            {"audio_url": {"$nin": ["", None]}},
            {"audio_data": {"$exists": True, "$ne": None}},
            {"duration_seconds": {"$gt": 0}},
        ]

    calls = await db[CALLS_COL].find(query, {"_id": 0, "audio_data": 0}).sort("datetime", -1).skip(skip).to_list(length=limit)
    total = await db[CALLS_COL].count_documents(query)
    return {"calls": calls, "total": total}


@router.post("/calls/purge-empty")
async def purge_empty_calls():
    """Delete calls that have no audio and no duration (garbage from loose sync filter)."""
    result = await db[CALLS_COL].delete_many({
        "$and": [
            {"$or": [{"audio_url": ""}, {"audio_url": None}, {"audio_url": {"$exists": False}}]},
            {"$or": [{"duration_seconds": 0}, {"duration_seconds": None}, {"duration_seconds": {"$exists": False}}]},
            {"$or": [{"audio_data": {"$exists": False}}, {"audio_data": None}]},
            {"status": {"$in": ["new", "skipped", "error"]}},
        ]
    })
    return {"deleted": result.deleted_count}


@router.get("/calls/{call_id}")
async def get_call(call_id: str):
    call = await db[CALLS_COL].find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Звонок не найден")
    return call


# ── Manager Stats ─────────────────────────────────

@router.get("/managers")
async def get_manager_stats(date_from: str = None, date_to: str = None):
    match = {}
    if date_from:
        match["datetime"] = {"$gte": date_from}
    if date_to:
        match.setdefault("datetime", {})["$lte"] = date_to + "T23:59:59"

    pipeline = [
        {"$match": match} if match else {"$match": {}},
        {"$group": {
            "_id": "$manager_id",
            "manager_name": {"$first": "$manager_name"},
            "total_calls": {"$sum": 1},
            "analyzed_calls": {"$sum": {"$cond": [{"$eq": ["$status", "analyzed"]}, 1, 0]}},
            "avg_score": {"$avg": {"$cond": [{"$ne": ["$score", None]}, "$score", None]}},
            "negative_count": {"$sum": {"$cond": ["$has_strong_negative", 1, 0]}},
            "total_duration": {"$sum": "$duration_seconds"},
            "inbound": {"$sum": {"$cond": [{"$eq": ["$direction", "inbound"]}, 1, 0]}},
            "outbound": {"$sum": {"$cond": [{"$eq": ["$direction", "outbound"]}, 1, 0]}},
        }},
        {"$sort": {"total_calls": -1}}
    ]
    results = await db[CALLS_COL].aggregate(pipeline).to_list(length=100)
    managers = []
    for r in results:
        avg = round(r["avg_score"], 1) if r["avg_score"] is not None else None
        low_score = 0
        if avg is not None:
            low_score = await db[CALLS_COL].count_documents({
                "manager_id": r["_id"], "score": {"$lt": 7}, "status": "analyzed",
                **({"datetime": match["datetime"]} if "datetime" in match else {})
            })
        managers.append({
            "managerId": r["_id"],
            "managerName": r["manager_name"] or f"ID:{r['_id']}",
            "totalCalls": r["total_calls"],
            "analyzedCalls": r["analyzed_calls"],
            "avgScore": avg,
            "negativeCount": r["negative_count"],
            "lowScoreCount": low_score,
            "totalDuration": r["total_duration"],
            "inbound": r["inbound"],
            "outbound": r["outbound"],
        })
    return {"managers": managers}


# ── Rules CRUD ────────────────────────────────────

@router.get("/rules")
async def get_rules():
    rules = await db[RULES_COL].find({}, {"_id": 0}).to_list(length=100)
    return rules


@router.post("/rules")
async def create_rule(rule: Rule):
    d = rule.model_dump()
    if d.get("isDefault"):
        await db[RULES_COL].update_many({}, {"$set": {"isDefault": False}})
    await db[RULES_COL].insert_one(d)
    d.pop("_id", None)
    return d


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: str, rule: Rule):
    d = rule.model_dump()
    if d.get("isDefault"):
        await db[RULES_COL].update_many({"id": {"$ne": rule_id}}, {"$set": {"isDefault": False}})
    r = await db[RULES_COL].update_one({"id": rule_id}, {"$set": d})
    if r.matched_count == 0:
        raise HTTPException(status_code=404)
    d.pop("_id", None)
    return d


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    await db[RULES_COL].delete_one({"id": rule_id})
    return {"status": "ok"}


@router.post("/rules/upload")
async def upload_rules_file(file: UploadFile = File(...)):
    """Upload rules from JSON file. Format: array of rule objects or single object."""
    content = await file.read()
    try:
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Невалидный JSON")

    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="Ожидается массив правил или один объект")

    imported = 0
    for item in data:
        rule = {
            "id": item.get("id", str(uuid.uuid4())[:8]),
            "name": item.get("name", "Без названия"),
            "description": item.get("description", ""),
            "promptTemplate": item.get("promptTemplate", ""),
            "isDefault": item.get("isDefault", False),
            "configJson": item.get("configJson", {}),
        }
        if rule["isDefault"]:
            await db[RULES_COL].update_many({}, {"$set": {"isDefault": False}})
        await db[RULES_COL].update_one({"id": rule["id"]}, {"$set": rule}, upsert=True)
        imported += 1
    return {"status": "ok", "imported": imported}


@router.post("/rules/seed")
async def seed_default_rules():
    """Create starter rules if none exist."""
    existing = await db[RULES_COL].count_documents({})
    if existing > 0:
        return {"status": "skipped", "message": f"Уже есть {existing} правил"}

    defaults = [
        {
            "id": "incoming",
            "name": "Входящий лид",
            "description": "Стандартная оценка для входящих заявок. Клиент сам обратился — важно быстро установить контакт, выявить потребности и закрыть на следующий шаг.",
            "isDefault": True,
            "promptTemplate": "",
            "configJson": {
                "weights": {
                    "greeting": 1.0,
                    "needs": 1.5,
                    "presentation": 1.2,
                    "objections": 1.0,
                    "next_step": 1.5,
                    "politeness": 1.0,
                    "compliance": 0.8
                },
                "critical_checks": ["needs", "next_step"],
                "description": "Входящий лид — клиент уже заинтересован. Главное: выявить потребность (что именно хочет, размеры, бюджет, сроки) и договориться о следующем шаге (КП, встреча, замер). Если менеджер не задал уточняющих вопросов или не предложил следующий шаг — это провал."
            }
        },
        {
            "id": "cold_call",
            "name": "Холодный звонок",
            "description": "Исходящий звонок клиенту, который не оставлял заявку. Акцент на приветствие, вовлечение и мягкое выявление интереса.",
            "isDefault": False,
            "promptTemplate": "",
            "configJson": {
                "weights": {
                    "greeting": 2.0,
                    "needs": 1.5,
                    "presentation": 1.0,
                    "objections": 1.5,
                    "next_step": 1.2,
                    "politeness": 1.5,
                    "compliance": 0.5
                },
                "critical_checks": ["greeting", "politeness"],
                "description": "Холодный звонок — клиент не ждёт звонка. Критически важно: вежливое приветствие с представлением, быстрое обозначение причины звонка, деликатные вопросы для выявления потребности. Грубость, навязчивость или отсутствие представления — серьёзные ошибки. Если клиент отказывается — вежливо завершить, не давить."
            }
        },
        {
            "id": "follow_up_kp",
            "name": "Дообзвон после КП/расчёта",
            "description": "Звонок клиенту после отправки коммерческого предложения или расчёта. Акцент на работу с возражениями и закрытие сделки.",
            "isDefault": False,
            "promptTemplate": "",
            "configJson": {
                "weights": {
                    "greeting": 0.8,
                    "needs": 0.8,
                    "presentation": 1.5,
                    "objections": 2.0,
                    "next_step": 2.0,
                    "politeness": 1.0,
                    "compliance": 0.8
                },
                "critical_checks": ["objections", "next_step"],
                "description": "Follow-up после КП — клиент уже видел предложение. Главное: узнать реакцию на КП, обработать возражения (цена, сроки, сравнение с конкурентами), предложить альтернативы и закрыть на конкретный следующий шаг (договор, предоплата, встреча). Если менеджер просто 'звонит узнать' без конкретики — слабая работа."
            }
        }
    ]

    for rule in defaults:
        await db[RULES_COL].insert_one(rule)

    return {"status": "ok", "created": len(defaults)}
