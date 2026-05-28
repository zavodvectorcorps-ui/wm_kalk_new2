"""Call Analytics — sync calls from amoCRM, transcribe (Whisper), analyze (GPT-5.2)."""
import logging
import os
import asyncio
import json
import uuid
import io
import tempfile
import hashlib
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
ANALYSIS_CACHE_COL = "call_analytics_analysis_cache"

BINOTEL_API = "https://api.binotel.com/api/4.0"

# Limit parallel Whisper / LLM calls to avoid rate limits & memory spikes.
# 4 concurrent transcriptions ≈ steady throughput ~10-15 calls/min without 429s.
_TRANSCRIBE_SEM = asyncio.Semaphore(4)
_ANALYZE_SEM = asyncio.Semaphore(8)


def _transcript_hash(text: str, rule_id: str = "") -> str:
    """Stable hash of (transcript, rule_id) — used to cache AI analysis and avoid re-billing."""
    h = hashlib.sha256()
    h.update((rule_id or "").encode("utf-8"))
    h.update(b"|")
    h.update((text or "").encode("utf-8"))
    return h.hexdigest()


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
    """Upload audio file for a call. Stores in Cloudinary (falls back to base64 if Cloudinary not configured)."""
    call = await db[CALLS_COL].find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Звонок не найден")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл > 50MB")
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="Файл слишком маленький — возможно скачалась HTML-страница")

    update = {
        "audio_size": len(content),
        "status": "new",
        "error": None,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Try Cloudinary first
    from services.cloudinary_service import upload_audio as cloud_upload_audio, is_cloudinary_configured
    if is_cloudinary_configured():
        result = await cloud_upload_audio(content, f"call_{call_id}.{(file.filename or 'audio.mp3').rsplit('.', 1)[-1]}")
        if result and result.get("url"):
            update["audio_url"] = result["url"]
            update["audio_cloudinary_id"] = result.get("public_id")
            update["audio_data"] = None  # clean up old base64 if any
        else:
            # Cloudinary upload failed — fallback to base64
            import base64
            update["audio_data"] = base64.b64encode(content).decode()
    else:
        import base64
        update["audio_data"] = base64.b64encode(content).decode()

    await db[CALLS_COL].update_one({"id": call_id}, {"$set": update})
    if background_tasks:
        background_tasks.add_task(_transcribe_single, call_id)
    return {"status": "ok", "size": len(content), "callId": call_id, "storedAt": "cloudinary" if "audio_cloudinary_id" in update else "mongo_b64"}


@router.post("/calls/migrate-audio-to-cloudinary")
async def migrate_audio_to_cloudinary(batch_size: int = 10):
    """Move base64 audio_data from MongoDB to Cloudinary in batches.

    Idempotent: only processes calls that have `audio_data` and no `audio_cloudinary_id`.
    Returns counts so the frontend can poll until `pending == 0`.
    """
    from services.cloudinary_service import upload_audio as cloud_upload_audio, is_cloudinary_configured
    if not is_cloudinary_configured():
        raise HTTPException(status_code=400, detail="Cloudinary не настроен в .env")

    import base64
    pending_total = await db[CALLS_COL].count_documents({"audio_data": {"$nin": [None, ""]}})
    if pending_total == 0:
        return {"status": "ok", "migrated": 0, "failed": 0, "remaining": 0, "message": "Нет звонков для миграции"}

    cursor = db[CALLS_COL].find(
        {"audio_data": {"$nin": [None, ""]}},
        {"_id": 0, "id": 1, "audio_data": 1, "client_name": 1, "datetime": 1}
    ).limit(batch_size)
    calls = await cursor.to_list(length=batch_size)

    migrated, failed = 0, 0
    for c in calls:
        try:
            audio_b64 = c.get("audio_data") or ""
            if not audio_b64:
                continue
            audio_bytes = base64.b64decode(audio_b64)
            filename = f"call_{c['id']}_{(c.get('datetime') or 'audio')[:10]}.mp3"
            result = await cloud_upload_audio(audio_bytes, filename)
            if result and result.get("url"):
                await db[CALLS_COL].update_one(
                    {"id": c["id"]},
                    {"$set": {
                        "audio_url": result["url"],
                        "audio_cloudinary_id": result.get("public_id"),
                        "audio_data": None,  # free up the bytes
                    }, "$unset": {"audio_data": ""}}
                )
                migrated += 1
                logger.info(f"Migrated audio for {c['id']} → {result['url']}")
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Migrate failed for {c.get('id')}: {e}")
            failed += 1

    remaining = await db[CALLS_COL].count_documents({"audio_data": {"$nin": [None, ""]}})
    return {
        "status": "ok",
        "migrated": migrated,
        "failed": failed,
        "remaining": remaining,
        "totalBefore": pending_total,
    }


@router.get("/calls/audio-storage-stats")
async def audio_storage_stats():
    """Quick stats on how much audio is in Mongo vs Cloudinary."""
    in_mongo = await db[CALLS_COL].count_documents({"audio_data": {"$nin": [None, ""]}})
    in_cloudinary = await db[CALLS_COL].count_documents({"audio_cloudinary_id": {"$nin": [None, ""]}})
    no_audio = await db[CALLS_COL].count_documents({
        "$and": [
            {"$or": [{"audio_data": {"$in": [None, ""]}}, {"audio_data": {"$exists": False}}]},
            {"$or": [{"audio_cloudinary_id": {"$in": [None, ""]}}, {"audio_cloudinary_id": {"$exists": False}}]},
        ]
    })
    # Sample audio_size sum (only if stored)
    pipeline = [
        {"$match": {"audio_size": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "totalBytes": {"$sum": "$audio_size"}, "count": {"$sum": 1}}}
    ]
    sz = await db[CALLS_COL].aggregate(pipeline).to_list(1)
    total_bytes = sz[0]["totalBytes"] if sz else 0
    return {
        "inMongoB64": in_mongo,
        "inCloudinary": in_cloudinary,
        "noAudio": no_audio,
        "approxTotalAudioMB": round(total_bytes / (1024 * 1024), 2),
    }



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
    # Auto-reset any calls stuck from a previous server restart
    await _reset_stale_calls()
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


async def _reset_stale_calls(stale_minutes: int = 5) -> int:
    """Mark as 'error' any call stuck in transcribing/analyzing longer than stale_minutes.

    Background tasks can be killed by a server restart while the DB still says
    the call is being processed. This unblocks them so the next process-all picks them up.
    """
    threshold = datetime.now(timezone.utc) - timedelta(minutes=stale_minutes)
    threshold_iso = threshold.isoformat()
    result = await db[CALLS_COL].update_many(
        {
            "status": {"$in": ["transcribing", "analyzing"]},
            "$or": [
                {"updatedAt": {"$lt": threshold_iso}},
                {"updatedAt": {"$exists": False}},
            ],
        },
        {"$set": {"status": "error", "error": f"Зависший процесс (>{stale_minutes} мин без активности) — сброшен"}}
    )
    if result.modified_count:
        logger.info(f"Reset {result.modified_count} stale calls (>{stale_minutes} min in transcribing/analyzing)")
    return result.modified_count


@router.post("/reset-stale")
async def reset_stale_calls_endpoint(stale_minutes: int = 10):
    """Reset stuck calls AND skip ALL unprocessable `new` calls.

    Three cleanup actions in one click:
      1. Stale ``transcribing``/``analyzing`` calls (no progress for
         ``stale_minutes`` minutes) → status=error.
      2. ``new`` calls that will never move forward because they have no
         ``audio_url`` AND no ``audio_data`` → status=skipped.
      3. ``new`` calls with zero / missing duration → status=skipped.
         These can't pass the ``duration_seconds >= min_dur`` filter
         in process-all and would otherwise sit in the queue forever.
         Usually amoCRM didn't record duration (no real conversation —
         missed/instant-hangup calls).
    """
    n_stale = await _reset_stale_calls(stale_minutes)
    # Skip "new" calls with no audio at all.
    no_audio_res = await db[CALLS_COL].update_many(
        {
            "status": "new",
            "$and": [
                {"$or": [{"audio_url": ""}, {"audio_url": None}, {"audio_url": {"$exists": False}}]},
                {"$or": [{"audio_data": {"$exists": False}}, {"audio_data": None}, {"audio_data": ""}]},
            ],
        },
        {"$set": {"status": "skipped", "error": "Нет аудио (импорт-«пустышка»)"}}
    )
    # Skip "new" calls with zero / missing duration — they would loop
    # forever past the >=min_dur filter even when audio is present.
    no_dur_res = await db[CALLS_COL].update_many(
        {
            "status": "new",
            "$or": [
                {"duration_seconds": {"$lte": 0}},
                {"duration_seconds": {"$exists": False}},
                {"duration_seconds": None},
            ],
        },
        {"$set": {"status": "skipped", "error": "Нет длительности (amoCRM не передал)"}}
    )
    return {
        "status": "ok",
        "reset": n_stale,
        "skipped": no_audio_res.modified_count + no_dur_res.modified_count,
    }


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
    # Auto-reset any calls stuck from a previous server restart
    await _reset_stale_calls()
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
    async with _TRANSCRIBE_SEM:
        await _transcribe_single_impl(call_id)


async def _transcribe_single_impl(call_id: str):
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
        await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "transcribing", "updatedAt": datetime.now(timezone.utc).isoformat()}})

        # Get audio bytes — from uploaded data, Cloudinary archive, Binotel API, or direct URL
        audio_bytes = None
        if call.get("audio_data"):
            import base64
            audio_bytes = base64.b64decode(call["audio_data"])
            logger.info(f"Call {call_id}: using uploaded audio ({len(audio_bytes)} bytes)")
        else:
            # 1) Cloudinary archive — permanent, fastest. Prefer it when present.
            cloud_url = call.get("audio_url") if call.get("audio_cloudinary_id") else ""

            # 2) Binotel API — get fresh 15-min URL.
            binotel_url = ""
            gcid = call.get("binotel_call_id", "")
            if not gcid and call.get("phone") and call.get("datetime"):
                call_ts = int(datetime.fromisoformat(call["datetime"]).timestamp())
                gcid = await _find_binotel_call(call.get("phone", ""), call_ts, call.get("direction", ""))
                if gcid:
                    await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"binotel_call_id": gcid}})
                    logger.info(f"Call {call_id}: found Binotel generalCallID={gcid}")

            if gcid and not cloud_url:
                binotel_url = await _binotel_get_audio_url(gcid)
                if binotel_url:
                    logger.info(f"Call {call_id}: got Binotel audio URL")

            # Build a prioritised list of candidate URLs — first that returns
            # real bytes wins. We retry only the cases where we got HTML
            # (expired amoCRM link) or a non-200.
            candidates = []
            if cloud_url:
                candidates.append(("cloudinary", cloud_url))
            if binotel_url:
                candidates.append(("binotel", binotel_url))
            if audio_url and audio_url != cloud_url and audio_url != binotel_url:
                candidates.append(("amocrm", audio_url))

            if not candidates:
                await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "Нет аудио URL и не удалось найти в Binotel"}})
                return

            last_err = ""
            for source, dl_url in candidates:
                dl_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                if source == "amocrm" and amo.get("amocrm_token") and amo.get("amocrm_domain") and amo["amocrm_domain"] in dl_url:
                    dl_headers["Authorization"] = f"Bearer {amo['amocrm_token']}"
                try:
                    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as cl:
                        audio_resp = await cl.get(dl_url, headers=dl_headers)
                except Exception as e:
                    last_err = f"{source}: {e}"
                    logger.warning(f"Call {call_id}: download from {source} crashed: {e}")
                    continue
                if audio_resp.status_code != 200:
                    last_err = f"{source}: HTTP {audio_resp.status_code}"
                    logger.warning(f"Call {call_id}: download from {source} → {audio_resp.status_code}")
                    continue
                body = audio_resp.content
                if b"<html" in body[:500].lower() or b"<!doctype" in body[:500].lower():
                    last_err = f"{source}: получили HTML вместо аудио (ссылка протухла или нужна авторизация)"
                    logger.warning(f"Call {call_id}: {source} returned HTML — trying next source")
                    # If amoCRM URL expired and we still have a Binotel ID we
                    # didn't try yet, try fetching a fresh Binotel URL right now.
                    if source == "amocrm" and gcid and "binotel" not in [s for s, _ in candidates]:
                        fresh = await _binotel_get_audio_url(gcid)
                        if fresh:
                            candidates.append(("binotel-fresh", fresh))
                    continue
                # Got real audio bytes.
                audio_bytes = body
                logger.info(f"Call {call_id}: downloaded {len(audio_bytes)} bytes from {source}")
                break

            if audio_bytes is None:
                await db[CALLS_COL].update_one(
                    {"id": call_id},
                    {"$set": {"status": "error", "error": last_err or "Не удалось скачать аудио ни из одного источника"}}
                )
                return

        if len(audio_bytes) > 25 * 1024 * 1024:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "Audio > 25MB"}})
            return

        # Persist a permanent copy in Cloudinary (Binotel URLs expire). Best-effort.
        if not call.get("audio_cloudinary_id"):
            try:
                from services.cloudinary_service import upload_audio as cloud_upload_audio, is_cloudinary_configured
                if is_cloudinary_configured():
                    fname = f"call_{call_id}_{(call.get('datetime') or 'audio')[:10]}.mp3"
                    cloud_res = await cloud_upload_audio(audio_bytes, fname)
                    if cloud_res and cloud_res.get("url"):
                        await db[CALLS_COL].update_one(
                            {"id": call_id},
                            {"$set": {
                                "audio_url": cloud_res["url"],
                                "audio_cloudinary_id": cloud_res.get("public_id"),
                                "audio_size": len(audio_bytes),
                            }, "$unset": {"audio_data": ""}}
                        )
                        logger.info(f"Call {call_id}: archived audio to Cloudinary")
            except Exception as cloud_err:
                logger.warning(f"Cloudinary archive failed for {call_id}: {cloud_err}")

        # Send to Whisper via OpenAI SDK (handles multipart correctly)
        logger.info(f"Transcribing call {call_id}: {len(audio_bytes)} bytes, url={audio_url[:80]}")

        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key, base_url=EMERGENT_PROXY)

            whisper_result = await client.audio.transcriptions.create(
                model="whisper-1",
                file=("call.mp3", audio_bytes),
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

            transcript = whisper_result.text or ""
            language = getattr(whisper_result, 'language', 'unknown') or 'unknown'
            # Save Whisper segments — used by diarization for better speaker detection
            segments = []
            for s in (getattr(whisper_result, 'segments', None) or []):
                seg = s if isinstance(s, dict) else (s.model_dump() if hasattr(s, 'model_dump') else dict(s))
                segments.append({
                    "start": seg.get("start"),
                    "end": seg.get("end"),
                    "text": seg.get("text", "").strip(),
                })
        except Exception as whisper_err:
            error_msg = str(whisper_err)[:500]
            logger.error(f"Whisper error for {call_id}: {error_msg}")
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {
                "status": "error",
                "error": f"Whisper: {error_msg}"
            }})
            return

        update = {"status": "transcribed", "language": language, "transcript_segments": segments}
        # Cost: Whisper = $0.006/min
        dur_min = (call.get("duration_seconds") or 60) / 60
        cost_whisper = round(dur_min * 0.006, 4)
        cost_diarize = 0.0

        lang_lower = language.lower()
        if lang_lower in ("polish", "pl"):
            update["transcript_pl"] = transcript
            update["language"] = "pl"
            # Diarize + translate to Russian (pass segments for better chunking + speaker detection)
            call_for_diar = {**call, "transcript_segments": segments}
            diarized_ru = await _diarize_and_translate(transcript, call_for_diar, "pl")
            update["transcript_ru"] = diarized_ru
            cost_diarize = _estimate_gpt_cost(transcript, diarized_ru, "gpt-4o-mini")
        elif lang_lower in ("russian", "ru"):
            update["language"] = "ru"
            call_for_diar = {**call, "transcript_segments": segments}
            diarized = await _diarize_and_translate(transcript, call_for_diar, "ru")
            update["transcript_ru"] = diarized
            cost_diarize = _estimate_gpt_cost(transcript, diarized, "gpt-4o-mini")
        else:
            update["transcript_pl"] = transcript
            update["language"] = lang_lower
            call_for_diar = {**call, "transcript_segments": segments}
            diarized_ru = await _diarize_and_translate(transcript, call_for_diar, lang_lower)
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


def _chunk_segments(segments: list, max_chars: int = 6000) -> list:
    """Split Whisper segments into chunks of ~max_chars total text length, on segment boundaries."""
    chunks, cur, cur_len = [], [], 0
    for s in segments:
        t = s.get("text", "")
        if cur and cur_len + len(t) > max_chars:
            chunks.append(cur)
            cur, cur_len = [], 0
        cur.append(s)
        cur_len += len(t)
    if cur:
        chunks.append(cur)
    return chunks


async def _diarize_chunk(chunk_lines: str, call: dict, source_lang: str, prev_tail: str = "", chunk_idx: int = 0, total_chunks: int = 1) -> str:
    """Diarize a single chunk (assumed to fit comfortably in the context window)."""
    api_key = _api_key()
    if not api_key:
        return chunk_lines

    manager_name = call.get("manager_name", "Менеджер")
    client_name = call.get("client_name", "Клиент")
    direction = call.get("direction", "outbound")
    deal_name = call.get("deal_name", "")

    translate_clause = "Переведи каждую реплику на русский язык." if source_lang != "ru" else "Оставь текст на русском."
    open_clause = (
        "Исходящий звонок — менеджер инициирует. После «алло» обычно говорит менеджер: представляется, спрашивает по теме."
        if direction == "outbound"
        else "Входящий звонок — менеджер принимает. Менеджер сразу здоровается («Добрый день, WM-Sauna, Иван слушает»). Клиент задаёт вопрос."
    )
    context_clause = f"\n\n[Контекст из предыдущего фрагмента — закончилось на: {prev_tail}]\n" if prev_tail else ""

    prompt = f"""Перед тобой фрагмент {chunk_idx + 1}/{total_chunks} транскрипта телефонного звонка с таймкодами и сегментами от Whisper.

ЗАДАЧА:
1. Разбей текст на реплики менеджера (М) и клиента (К). Используй смену темы/паузу между сегментами как сильный сигнал смены спикера.
2. {translate_clause}
3. Верни ТОЛЬКО диалог в формате «М: ...» / «К: ...», по одной реплике на строку. Без таймкодов и пояснений.

КОНТЕКСТ ЗВОНКА:
- Менеджер: {manager_name} (компания WM-Sauna — продажа саун/балий/теплиц)
- Клиент: {client_name or 'неизвестно'}
- Сделка: {deal_name or '—'}
- Направление: {direction}
- {open_clause}

ПРИЗНАКИ МЕНЕДЖЕРА:
- Представляется компанией/именем
- Уточняет потребности («какой размер? сколько человек? для дачи или дома?»)
- Презентует продукт, цены, сроки доставки
- Использует профессиональные термины (печь, парилка, кедр, осина, конструктив)
- Договаривается о следующем шаге («давайте я отправлю КП», «когда удобно созвониться?»)
- Прощается официально

ПРИЗНАКИ КЛИЕНТА:
- Спрашивает о цене, сроках, гарантии
- Описывает свою ситуацию («у меня участок», «нужна для семьи»)
- Возражает («дорого», «подумаю», «у конкурентов дешевле»)
- Часто говорит короче и менее уверенно технически
{context_clause}
ФРАГМЕНТ ТРАНСКРИПТА (с таймкодами в секундах):
{chunk_lines}

Выдай результат — только реплики М: / К:, ничего лишнего."""

    try:
        async with httpx.AsyncClient(timeout=180) as cl:
            resp = await cl.post(
                f"{EMERGENT_PROXY}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini", "messages": [
                    {"role": "system", "content": "Ты — эксперт по диаризации телефонных разговоров продажников. Твоя задача — точно определить кто говорит (М/К) и перевести при необходимости. Отвечаешь строго в формате диалога без пояснений."},
                    {"role": "user", "content": prompt},
                ]}
            )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        logger.warning(f"Diarize chunk {chunk_idx}: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Diarize chunk {chunk_idx} failed: {e}")
    return chunk_lines


async def _diarize_and_translate(transcript: str, call: dict, source_lang: str) -> str:
    """Diarize & translate the FULL transcript, chunking long calls so nothing is dropped.

    Strategy:
      - If we have Whisper segments saved on the call → split by segments (best, has timestamps).
      - Else fall back to chunking raw text.
      - Each chunk gets the tail of the previous chunk as context so speaker continuity holds.
      - Chunks are diarized in parallel.
    """
    if not transcript or not transcript.strip():
        return transcript

    segments = call.get("transcript_segments") or []
    chunks_lines = []  # list of strings — each is a chunk to send to GPT

    if segments:
        # Format each segment as "[mm:ss] text"
        def fmt(s):
            t = s.get("text", "").strip()
            start = s.get("start") or 0
            mm = int(start // 60)
            ss = int(start % 60)
            return f"[{mm:02d}:{ss:02d}] {t}"

        groups = _chunk_segments(segments, max_chars=6000)
        for grp in groups:
            chunks_lines.append("\n".join(fmt(s) for s in grp))
    else:
        # Fallback: split raw text on ~6000 char boundaries (sentence-aware)
        step = 6000
        i = 0
        while i < len(transcript):
            end = min(i + step, len(transcript))
            # Snap to nearest sentence end if not at the very end
            if end < len(transcript):
                for sep in [". ", "! ", "? ", "\n"]:
                    p = transcript.rfind(sep, i, end)
                    if p > i + step // 2:
                        end = p + len(sep)
                        break
            chunks_lines.append(transcript[i:end])
            i = end

    total = len(chunks_lines)
    if total == 0:
        return transcript

    logger.info(f"Diarizing call {call.get('id')}: {total} chunk(s), source_lang={source_lang}")

    # Process chunks sequentially so each one can use previous tail as context
    results = []
    prev_tail = ""
    for idx, chunk in enumerate(chunks_lines):
        out = await _diarize_chunk(chunk, call, source_lang, prev_tail, idx, total)
        results.append(out)
        # Use last 2 dialog lines as context for the next chunk
        last_lines = [ln for ln in out.strip().splitlines() if ln.strip()][-2:]
        prev_tail = " | ".join(last_lines)[:300]

    return "\n".join(results)


@router.post("/calls/{call_id}/re-diarize")
async def re_diarize_call(call_id: str, background_tasks: BackgroundTasks):
    """Re-run diarization on an already-transcribed call without re-downloading audio.

    Useful after improving the diarization prompt: existing calls can be quickly upgraded
    without paying for Whisper again.
    """
    call = await db[CALLS_COL].find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Звонок не найден")
    raw_transcript = call.get("transcript_pl") or call.get("transcript_ru")
    if not raw_transcript:
        raise HTTPException(status_code=400, detail="Нет транскрипта — сначала запустите транскрибацию")

    async def _run():
        lang = (call.get("language") or "ru").lower()
        # If we have transcript_pl — diarize from PL source. Otherwise from RU.
        source_lang = "pl" if call.get("transcript_pl") else "ru"
        diarized = await _diarize_and_translate(raw_transcript, call, source_lang)
        await db[CALLS_COL].update_one(
            {"id": call_id},
            {"$set": {
                "transcript_ru": diarized,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "re_diarized_at": datetime.now(timezone.utc).isoformat(),
                # Reset analysis so it gets re-analyzed with the new diarization
                "status": "transcribed",
                "score": None, "checks_json": None, "summary_ru": None,
                "key_issues_json": None, "recommendations_json": None,
                "has_strong_negative": False,
            }}
        )
        # Auto-analyze with the new diarization
        await _analyze_single(call_id)

    background_tasks.add_task(_run)
    return {"status": "ok", "callId": call_id, "message": "Перезапущена диаризация и анализ"}


@router.post("/re-diarize-all")
async def re_diarize_all(background_tasks: BackgroundTasks, limit: int = 100):
    """Re-diarize the most recent N transcribed calls in background."""
    calls = await db[CALLS_COL].find(
        {"$or": [{"transcript_pl": {"$nin": [None, ""]}}, {"transcript_ru": {"$nin": [None, ""]}}]},
        {"_id": 0, "id": 1}
    ).sort("datetime", -1).limit(limit).to_list(length=limit)
    queued = 0
    for c in calls:
        cid = c["id"]
        async def _wrap(call_id=cid):
            call = await db[CALLS_COL].find_one({"id": call_id})
            if not call:
                return
            source_lang = "pl" if call.get("transcript_pl") else "ru"
            raw = call.get("transcript_pl") or call.get("transcript_ru") or ""
            if not raw:
                return
            diarized = await _diarize_and_translate(raw, call, source_lang)
            await db[CALLS_COL].update_one(
                {"id": call_id},
                {"$set": {
                    "transcript_ru": diarized,
                    "status": "transcribed",
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                    "re_diarized_at": datetime.now(timezone.utc).isoformat(),
                }}
            )
            await _analyze_single(call_id)
        background_tasks.add_task(_wrap)
        queued += 1
    return {"status": "ok", "queued": queued}


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


async def _pick_rule_for_call(call: dict) -> dict:
    """Pick the best matching rule for a call.

    Priority:
      1. Explicit rule_id on the call.
      2. Auto-match by direction using rule.configJson.appliesTo = 'inbound' | 'outbound'
         or by known rule id ('incoming' for inbound, 'cold_call' for outbound).
      3. Rule marked isDefault=True.
      4. Any available rule.
    """
    if call.get("rule_id"):
        r = await db[RULES_COL].find_one({"id": call["rule_id"]}, {"_id": 0})
        if r:
            return r

    direction = (call.get("direction") or "").lower()
    all_rules = await db[RULES_COL].find({}, {"_id": 0}).to_list(length=100)

    # 2a. explicit appliesTo tag
    for r in all_rules:
        applies = str((r.get("configJson") or {}).get("appliesTo", "")).lower()
        if direction and applies == direction:
            return r

    # 2b. well-known rule ids from the seed
    if direction == "inbound":
        for r in all_rules:
            if r.get("id") == "incoming":
                return r
    elif direction == "outbound":
        for r in all_rules:
            if r.get("id") == "cold_call":
                return r

    # 3. default rule
    for r in all_rules:
        if r.get("isDefault"):
            return r

    # 4. any rule
    return all_rules[0] if all_rules else {}


async def _analyze_single(call_id: str):
    async with _ANALYZE_SEM:
        await _analyze_single_impl(call_id)


async def _analyze_single_impl(call_id: str):
    try:
        call = await db[CALLS_COL].find_one({"id": call_id})
        if not call or not call.get("transcript_ru"):
            return

        api_key = _api_key()
        if not api_key:
            return

        # Pick the best matching rule (by direction / default / explicit)
        rule = await _pick_rule_for_call(call)
        rule_id_used = rule.get("id") if rule else None
        rule_name_used = rule.get("name") if rule else None

        # Cache: same transcript + same rule => reuse previous analysis (saves $$)
        transcript = call.get("transcript_ru", "")
        cache_key = _transcript_hash(transcript, rule_id_used or "")
        cached = await db[ANALYSIS_CACHE_COL].find_one({"key": cache_key}, {"_id": 0})
        if cached and cached.get("analysis"):
            analysis = cached["analysis"]
            update = {
                "status": "analyzed",
                "score": analysis.get("score"),
                "has_strong_negative": analysis.get("has_strong_negative", False),
                "checks_json": analysis.get("checks"),
                "summary_ru": analysis.get("summary_ru", ""),
                "key_issues_json": analysis.get("key_issues", []),
                "recommendations_json": analysis.get("recommendations", []),
                "rule_id_used": rule_id_used,
                "rule_name_used": rule_name_used,
                "analyzedAt": datetime.now(timezone.utc).isoformat(),
                "cost_analyze": 0.0,
                "from_cache": True,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
            current = await db[CALLS_COL].find_one({"id": call_id}, {"cost_total": 1, "cost_whisper": 1, "cost_diarize": 1, "_id": 0})
            prev_cost = (current.get("cost_whisper") or 0) + (current.get("cost_diarize") or 0)
            update["cost_total"] = round(prev_cost, 4)
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": update})
            logger.info(f"Analyzed call {call_id} from CACHE (key={cache_key[:12]})")
            return

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

        await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "analyzing", "updatedAt": datetime.now(timezone.utc).isoformat()}})

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
            "rule_id_used": rule_id_used,
            "rule_name_used": rule_name_used,
            "analyzedAt": datetime.now(timezone.utc).isoformat(),
            "cost_analyze": _estimate_gpt_cost(user_prompt, text),
        }
        # Update total cost
        current = await db[CALLS_COL].find_one({"id": call_id}, {"cost_total": 1, "cost_whisper": 1, "cost_diarize": 1, "_id": 0})
        prev_cost = (current.get("cost_whisper") or 0) + (current.get("cost_diarize") or 0)
        update["cost_total"] = round(prev_cost + update["cost_analyze"], 4)
        await db[CALLS_COL].update_one({"id": call_id}, {"$set": update})
        # Save to analysis cache (keyed by transcript+rule). Capped TTL of 90 days.
        try:
            await db[ANALYSIS_CACHE_COL].update_one(
                {"key": cache_key},
                {"$set": {
                    "key": cache_key,
                    "ruleId": rule_id_used,
                    "analysis": analysis,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
        except Exception as cache_err:
            logger.warning(f"Failed to save analysis cache: {cache_err}")
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
    category: str = None,  # 'good' | 'problem' | 'critical'
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

    # Quality category filter — based on AI score & strong-negative flag
    cat = (category or "").lower()
    if cat == "good":
        query["score"] = {**query.get("score", {}), "$gte": 8}
        query["has_strong_negative"] = {"$ne": True}
    elif cat == "problem":
        query["score"] = {**query.get("score", {}), "$gte": 5, "$lt": 8}
        query["has_strong_negative"] = {"$ne": True}
    elif cat == "critical":
        # Either score < 5 OR strong negative flag
        query["$or"] = [
            {"score": {"$lt": 5, "$ne": None}},
            {"has_strong_negative": True},
        ]

    if only_with_audio:
        # Must have either an audio URL/data or a non-zero duration
        audio_or = [
            {"audio_url": {"$nin": ["", None]}},
            {"audio_data": {"$exists": True, "$ne": None}},
            {"duration_seconds": {"$gt": 0}},
        ]
        if "$or" in query:
            # Combine with existing $or via $and
            query = {"$and": [{"$or": query.pop("$or")}, {"$or": audio_or}, query]}
        else:
            query["$or"] = audio_or

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


@router.get("/heatmap")
async def managers_heatmap(date_from: str = None, date_to: str = None):
    """Heatmap: rows = managers, columns = check categories, cells = avg score.

    Helps spot at a glance which manager is weak in which area
    (greeting / needs / objections / next_step / etc.).
    """
    q = {"status": "analyzed"}
    if date_from:
        q["datetime"] = {"$gte": date_from}
    if date_to:
        q.setdefault("datetime", {})["$lte"] = date_to + "T23:59:59"

    calls = await db[CALLS_COL].find(
        q, {"_id": 0, "manager_id": 1, "manager_name": 1, "checks_json": 1, "score": 1, "has_strong_negative": 1}
    ).to_list(length=5000)

    keys = list(CHECK_LABELS.keys())
    by_mgr = {}
    for c in calls:
        mid = c.get("manager_id") or "unknown"
        if mid not in by_mgr:
            by_mgr[mid] = {
                "managerId": mid,
                "managerName": c.get("manager_name") or f"ID:{mid}",
                "totalCalls": 0,
                "avgScoreSum": 0.0,
                "avgScoreCnt": 0,
                "negativeCount": 0,
                "checks": {k: {"sum": 0.0, "cnt": 0} for k in keys},
            }
        m = by_mgr[mid]
        m["totalCalls"] += 1
        if c.get("score") is not None:
            m["avgScoreSum"] += float(c["score"])
            m["avgScoreCnt"] += 1
        if c.get("has_strong_negative"):
            m["negativeCount"] += 1
        checks = c.get("checks_json") or {}
        for k in keys:
            v = checks.get(k)
            if isinstance(v, dict) and v.get("score") is not None:
                try:
                    m["checks"][k]["sum"] += float(v["score"])
                    m["checks"][k]["cnt"] += 1
                except (TypeError, ValueError):
                    pass

    rows = []
    for mid, m in by_mgr.items():
        cells = {}
        for k in keys:
            t = m["checks"][k]
            cells[k] = round(t["sum"] / t["cnt"], 2) if t["cnt"] else None
        rows.append({
            "managerId": mid,
            "managerName": m["managerName"],
            "totalCalls": m["totalCalls"],
            "avgScore": round(m["avgScoreSum"] / m["avgScoreCnt"], 2) if m["avgScoreCnt"] else None,
            "negativeCount": m["negativeCount"],
            "cells": cells,
        })
    rows.sort(key=lambda r: -(r["avgScore"] or 0))

    # Compute global per-column average for delta highlighting
    column_avg = {}
    for k in keys:
        vals = [r["cells"][k] for r in rows if r["cells"][k] is not None]
        column_avg[k] = round(sum(vals) / len(vals), 2) if vals else None

    return {
        "managers": rows,
        "columns": [{"key": k, "label": v, "max": 2, "avg": column_avg[k]} for k, v in CHECK_LABELS.items()],
        "totalCalls": sum(r["totalCalls"] for r in rows),
    }


# ── Manager Dashboard ─────────────────────────────

CHECK_LABELS = {
    "greeting": "Приветствие",
    "needs": "Выявление потребностей",
    "presentation": "Презентация",
    "objections": "Работа с возражениями",
    "next_step": "Закрытие / следующий шаг",
    "politeness": "Вежливость",
    "compliance": "Соответствие скрипту",
}


@router.get("/managers/{manager_id}/dashboard")
async def manager_dashboard(manager_id: str, date_from: str = None, date_to: str = None):
    """Aggregated per-manager stats over a period (no AI call here — just numbers)."""
    q = {"manager_id": manager_id, "status": "analyzed"}
    if date_from:
        q["datetime"] = {"$gte": date_from}
    if date_to:
        q.setdefault("datetime", {})["$lte"] = date_to + "T23:59:59"

    calls = await db[CALLS_COL].find(
        q,
        {"_id": 0, "audio_data": 0, "transcript_pl": 0, "transcript_ru": 0}
    ).sort("datetime", -1).to_list(length=1000)

    # Manager name (fallback: first call in whole DB)
    manager_name = ""
    if calls:
        manager_name = calls[0].get("manager_name", "")
    if not manager_name:
        any_call = await db[CALLS_COL].find_one({"manager_id": manager_id}, {"manager_name": 1, "_id": 0})
        manager_name = (any_call or {}).get("manager_name", f"ID:{manager_id}")

    total = len(calls)
    if total == 0:
        return {
            "managerId": manager_id, "managerName": manager_name,
            "total": 0, "avgScore": None, "checks": [], "distribution": {},
            "topIssues": [], "byRule": [], "durationAvg": 0, "negativeCount": 0,
            "callSamples": [],
        }

    # Score distribution
    dist = {"high": 0, "mid": 0, "low": 0}
    score_sum, score_cnt = 0, 0
    dur_sum = 0
    negative = 0
    inbound, outbound = 0, 0
    issue_counter = {}
    by_rule = {}
    check_totals = {k: {"sum": 0, "cnt": 0} for k in CHECK_LABELS}

    for c in calls:
        score = c.get("score")
        if score is not None:
            score_sum += score
            score_cnt += 1
            if score >= 8: dist["high"] += 1
            elif score >= 5: dist["mid"] += 1
            else: dist["low"] += 1
        dur_sum += c.get("duration_seconds", 0) or 0
        if c.get("has_strong_negative"): negative += 1
        d = (c.get("direction") or "").lower()
        if d == "inbound": inbound += 1
        elif d == "outbound": outbound += 1

        checks = c.get("checks_json") or {}
        for k in CHECK_LABELS:
            v = checks.get(k)
            if isinstance(v, dict) and v.get("score") is not None:
                try:
                    check_totals[k]["sum"] += float(v["score"])
                    check_totals[k]["cnt"] += 1
                except (TypeError, ValueError):
                    pass

        for issue in (c.get("key_issues_json") or []):
            if isinstance(issue, str) and issue.strip():
                key = issue.strip().lower()[:80]
                issue_counter[key] = issue_counter.get(key, 0) + 1

        rn = c.get("rule_name_used") or "—"
        by_rule[rn] = by_rule.get(rn, 0) + 1

    checks_out = []
    for k, label in CHECK_LABELS.items():
        t = check_totals[k]
        if t["cnt"]:
            checks_out.append({"key": k, "label": label, "avgScore": round(t["sum"] / t["cnt"], 2), "maxScore": 2, "count": t["cnt"]})

    top_issues = sorted(issue_counter.items(), key=lambda x: -x[1])[:10]

    # Lightweight samples (id + score + summary) — not full transcripts
    samples = [
        {
            "id": c.get("id"), "datetime": c.get("datetime"),
            "score": c.get("score"), "direction": c.get("direction"),
            "clientName": c.get("client_name"), "duration": c.get("duration_seconds"),
            "summary": (c.get("summary_ru") or "")[:300],
            "hasNegative": c.get("has_strong_negative", False),
        }
        for c in calls[:50]
    ]

    return {
        "managerId": manager_id,
        "managerName": manager_name,
        "total": total,
        "avgScore": round(score_sum / score_cnt, 2) if score_cnt else None,
        "durationAvg": int(dur_sum / total) if total else 0,
        "durationTotal": dur_sum,
        "negativeCount": negative,
        "inbound": inbound,
        "outbound": outbound,
        "distribution": dist,
        "checks": checks_out,
        "topIssues": [{"issue": i, "count": c} for i, c in top_issues],
        "byRule": [{"rule": k, "count": v} for k, v in sorted(by_rule.items(), key=lambda x: -x[1])],
        "callSamples": samples,
    }


@router.post("/managers/{manager_id}/summary")
async def manager_ai_summary(manager_id: str, date_from: str = None, date_to: str = None):
    """Generate an AI verdict + recommendations for a manager over a period.

    Cached for 10 minutes per (manager_id, date_from, date_to).
    """
    cache_key = f"{manager_id}|{date_from or ''}|{date_to or ''}"
    cached = await db["call_analytics_summaries"].find_one({"key": cache_key}, {"_id": 0})
    if cached:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(cached["createdAt"])).total_seconds()
        if age < 600:
            return {**cached, "cached": True}

    dash = await manager_dashboard(manager_id, date_from, date_to)
    if dash["total"] == 0:
        raise HTTPException(status_code=400, detail="Нет оценённых звонков за период")

    api_key = _api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="Нет EMERGENT_LLM_KEY")

    # Build a compact brief — don't dump full transcripts, just summaries + checks
    checks_lines = "\n".join(
        f"- {c['label']}: {c['avgScore']}/{c['maxScore']} (по {c['count']} звонкам)" for c in dash["checks"]
    )
    issues_lines = "\n".join(f"- {i['issue']} ({i['count']}×)" for i in dash["topIssues"][:8]) or "—"
    samples_lines = "\n".join(
        f"- [{s['score']}/10] {s['direction']} {s['clientName'] or '—'}: {s['summary']}"
        for s in dash["callSamples"][:25]
    )

    prompt = f"""Проанализируй работу менеджера продаж за период и выдай отчёт.

МЕНЕДЖЕР: {dash['managerName']}
ПЕРИОД: {date_from or 'все'} — {date_to or 'сегодня'}

СТАТИСТИКА:
- Проанализировано звонков: {dash['total']}
- Средняя оценка: {dash['avgScore']}/10
- Средняя длительность: {dash['durationAvg']} сек
- Входящих: {dash['inbound']} | Исходящих: {dash['outbound']}
- Звонков с серьёзным негативом: {dash['negativeCount']}
- Распределение оценок: высокие (≥8): {dash['distribution']['high']}, средние (5-7): {dash['distribution']['mid']}, низкие (<5): {dash['distribution']['low']}

СРЕДНИЕ БАЛЛЫ ПО ЧЕК-ЛИСТУ:
{checks_lines}

ТОП ПРОБЛЕМ (повторяющиеся замечания):
{issues_lines}

ВЫДЕРЖКИ ИЗ ЗВОНКОВ (до 25 последних):
{samples_lines[:8000]}

ЗАДАЧА:
Верни строгий JSON со следующими полями:
{{
  "verdict": "краткий общий вердикт 1-2 предложения",
  "strengths": ["сильная сторона 1", "сильная сторона 2", "сильная сторона 3"],
  "weaknesses": ["слабое место 1", "слабое место 2", "слабое место 3"],
  "recommendations": [
    {{"priority": "high|medium|low", "title": "название", "action": "что конкретно сделать"}},
    ...до 5 штук
  ],
  "trainingFocus": "на чём сфокусировать обучение в ближайшие 2 недели",
  "riskFlags": ["конкретный риск 1", ...] или []
}}

Пиши ТОЛЬКО JSON, без markdown и пояснений. Всё — на русском."""

    try:
        async with httpx.AsyncClient(timeout=120) as cl:
            resp = await cl.post(
                f"{EMERGENT_PROXY}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "gpt-5.2", "messages": [
                    {"role": "system", "content": "Ты — руководитель отдела продаж. Даёшь короткие, конкретные, действенные оценки работы менеджеров. Отвечаешь только JSON."},
                    {"role": "user", "content": prompt},
                ]},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"LLM {resp.status_code}: {resp.text[:200]}")
        text = resp.json()["choices"][0]["message"]["content"]
        start = text.find("{"); end = text.rfind("}") + 1
        parsed = json.loads(text[start:end] if start >= 0 and end > start else text)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manager summary failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    result = {
        "key": cache_key,
        "managerId": manager_id,
        "managerName": dash["managerName"],
        "dateFrom": date_from,
        "dateTo": date_to,
        "analysis": parsed,
        "basedOnCalls": dash["total"],
        "cost": _estimate_gpt_cost(prompt, text),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db["call_analytics_summaries"].update_one(
        {"key": cache_key}, {"$set": result}, upsert=True
    )
    return {**result, "cached": False}


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
