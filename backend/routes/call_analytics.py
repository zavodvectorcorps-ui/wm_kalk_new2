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
from fastapi import APIRouter, HTTPException, BackgroundTasks
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


def _api_key():
    return os.environ.get("EMERGENT_LLM_KEY", "")


# ── Models ────────────────────────────────────────

class CallAnalyticsSettings(BaseModel):
    pipelineId: str = ""
    stageIds: List[str] = []
    lastSyncAt: Optional[str] = None
    autoTranscribe: bool = True
    autoAnalyze: bool = True


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

        # Fetch leads from selected stages
        all_leads = []
        for sid in (stage_ids or [""]):
            params = {"filter[statuses][0][pipeline_id]": pipeline_id, "limit": 250, "with": "contacts"}
            if sid:
                params["filter[statuses][0][status_id]"] = sid
            page = 1
            while page <= 20:
                params["page"] = page
                async with httpx.AsyncClient(timeout=30) as cl:
                    r = await cl.get(f"https://{domain}/api/v4/leads", headers=headers, params=params)
                if r.status_code == 204:
                    break
                if r.status_code != 200:
                    break
                leads = r.json().get("_embedded", {}).get("leads", [])
                all_leads.extend(leads)
                if len(leads) < 250:
                    break
                page += 1

        logger.info(f"Call sync {sync_id}: {len(all_leads)} leads in pipeline")
        await _update_call_sync(sync_id, f"найдено {len(all_leads)} сделок, загрузка звонков...")

        # Fetch call notes for each lead
        imported = 0
        updated = 0
        lead_cache = {}
        for ld in all_leads:
            lead_cache[str(ld["id"])] = ld

        processed_leads = 0
        for ld in all_leads:
            lid = ld["id"]
            # Fetch notes for this lead
            notes = []
            try:
                async with httpx.AsyncClient(timeout=15) as cl:
                    nr = await cl.get(
                        f"https://{domain}/api/v4/leads/{lid}/notes",
                        headers=headers,
                        params={"filter[note_type][]": ["call_in", "call_out"], "limit": 250}
                    )
                if nr.status_code == 200:
                    notes = nr.json().get("_embedded", {}).get("notes", [])
            except Exception as e:
                logger.warning(f"Failed to fetch notes for lead {lid}: {e}")

            # Process each call note
            for note in notes:
                note_created = note.get("created_at", 0)
                if note_created < ts_from:
                    continue

                params_n = note.get("params", {})
                if not params_n:
                    continue

                amo_call_id = str(note.get("id", ""))
                existing = await db[CALLS_COL].find_one({"amo_call_id": amo_call_id})

                # Extract contact info
                contacts = ld.get("_embedded", {}).get("contacts", [])
                client_name = contacts[0].get("name", "") if contacts else ld.get("name", "")
                contact_id = str(contacts[0].get("id", "")) if contacts else ""

                # Manager
                resp_user_id = ld.get("responsible_user_id", "")

                # Users cache
                manager_name = ""
                try:
                    async with httpx.AsyncClient(timeout=10) as cl:
                        ur = await cl.get(f"https://{domain}/api/v4/users/{resp_user_id}", headers=headers)
                    if ur.status_code == 200:
                        manager_name = ur.json().get("name", "")
                except:
                    pass

                direction = "inbound" if note.get("note_type") == "call_in" else "outbound"
                duration = int(params_n.get("duration", 0))
                audio_url = params_n.get("link", "")
                phone = params_n.get("phone", "")

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
            if processed_leads % 20 == 0:
                await _update_call_sync(sync_id, f"обработано {processed_leads}/{len(all_leads)} сделок, звонков: +{imported}")

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
    # Find calls needing transcription
    new_calls = await db[CALLS_COL].find(
        {"status": "new", "audio_url": {"$ne": ""}},
        {"id": 1, "_id": 0}
    ).limit(limit).to_list(length=limit)

    # Find calls needing analysis
    transcribed = await db[CALLS_COL].find(
        {"status": "transcribed", "transcript_ru": {"$ne": None}},
        {"id": 1, "_id": 0}
    ).limit(limit).to_list(length=limit)

    for c in new_calls:
        background_tasks.add_task(_transcribe_single, c["id"])
    for c in transcribed:
        background_tasks.add_task(_analyze_single, c["id"])

    return {"queued_transcribe": len(new_calls), "queued_analyze": len(transcribed)}


async def _transcribe_single(call_id: str):
    try:
        call = await db[CALLS_COL].find_one({"id": call_id})
        if not call or not call.get("audio_url"):
            return

        audio_url = call["audio_url"]
        api_key = _api_key()
        if not api_key:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "No API key"}})
            return

        await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "transcribing"}})

        # Download audio (may need amoCRM auth)
        amo = get_amocrm_settings()
        dl_headers = {}
        if amo.get("amocrm_token") and amo.get("amocrm_domain") and amo["amocrm_domain"] in audio_url:
            dl_headers["Authorization"] = f"Bearer {amo['amocrm_token']}"

        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as cl:
            audio_resp = await cl.get(audio_url, headers=dl_headers)
        if audio_resp.status_code != 200:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": f"Audio download failed: {audio_resp.status_code}"}})
            return

        audio_bytes = audio_resp.content
        if len(audio_bytes) > 25 * 1024 * 1024:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": "Audio > 25MB"}})
            return

        # Send to Whisper
        async with httpx.AsyncClient(timeout=300) as cl:
            whisper_resp = await cl.post(
                f"{EMERGENT_PROXY}/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": ("call.mp3", io.BytesIO(audio_bytes), "audio/mpeg")},
                data={"model": "whisper-1", "response_format": "verbose_json"}
            )

        if whisper_resp.status_code != 200:
            await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": f"Whisper error: {whisper_resp.status_code}"}})
            return

        result = whisper_resp.json()
        transcript = result.get("text", "")
        language = result.get("language", "unknown")

        update = {"status": "transcribed", "language": language}
        if language == "polish" or language == "pl":
            update["transcript_pl"] = transcript
            update["language"] = "pl"
            # Translate to Russian
            translation = await _translate_to_russian(transcript)
            update["transcript_ru"] = translation
        else:
            update["transcript_ru"] = transcript
            update["language"] = language if language in ("ru", "russian") else language

        await db[CALLS_COL].update_one({"id": call_id}, {"$set": update})
        logger.info(f"Transcribed call {call_id}: lang={language}, len={len(transcript)}")

        # Auto-analyze if configured
        settings = await get_settings()
        if settings.get("autoAnalyze"):
            await _analyze_single(call_id)

    except Exception as e:
        logger.error(f"Transcription error for {call_id}: {e}", exc_info=True)
        await db[CALLS_COL].update_one({"id": call_id}, {"$set": {"status": "error", "error": str(e)}})


async def _translate_to_russian(text: str) -> str:
    api_key = _api_key()
    async with httpx.AsyncClient(timeout=120) as cl:
        resp = await cl.post(
            f"{EMERGENT_PROXY}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "gpt-5.2", "messages": [
                {"role": "system", "content": "Переведи текст с польского на русский. Верни только перевод, без пояснений."},
                {"role": "user", "content": text}
            ]}
        )
    if resp.status_code == 200:
        return resp.json()["choices"][0]["message"]["content"]
    return text


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
            "analyzedAt": datetime.now(timezone.utc).isoformat()
        }
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
    has_negative: bool = None, limit: int = 50, skip: int = 0
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

    calls = await db[CALLS_COL].find(query, {"_id": 0}).sort("datetime", -1).skip(skip).to_list(length=limit)
    total = await db[CALLS_COL].count_documents(query)
    return {"calls": calls, "total": total}


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


from fastapi import UploadFile, File

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
