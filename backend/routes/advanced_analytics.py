"""Advanced Manager Analytics — deep per-manager metrics for tracked managers."""
import logging
import os
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from database import db
from routes.amocrm import get_amocrm_settings
from routes.lead_analytics import _amo_get, _fetch_all_pages

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead-analytics/advanced", tags=["Advanced Analytics"])

PIPELINE_ID = "8969514"
TRACKED_MANAGER_NAMES = ["Vlada WM Group", "Andrzej WM-sauna", "Viyaleta WM-sauna"]
CLOSED_STATUS_IDS = {"142", "143"}


# ── helpers ──────────────────────────────────────────────

async def _pipeline_info() -> dict:
    data = await _amo_get(f"/api/v4/leads/pipelines/{PIPELINE_ID}")
    if not data:
        return {"stages": {}, "stageOrder": [], "jeszcze_id": None, "nie_dodzw_id": None, "kp_stage_id": None}
    statuses = data.get("_embedded", {}).get("statuses", [])
    stages = {}
    order = []
    jeszcze_id = nie_dodzw_id = kp_stage_id = None
    for s in sorted(statuses, key=lambda x: x.get("sort", 0)):
        sid = str(s["id"])
        name = s.get("name", "")
        stages[sid] = name
        order.append(sid)
        nl = name.lower().strip()
        if "jeszcze nie wiem" in nl:
            jeszcze_id = sid
        if "не дозвонились" in nl or "nie dodzwon" in nl:
            nie_dodzw_id = sid
        if "кп" in nl or "расчет" in nl or "расчёт" in nl or "kp" in nl or "wycen" in nl:
            kp_stage_id = sid
    return {"stages": stages, "stageOrder": order, "jeszcze_id": jeszcze_id,
            "nie_dodzw_id": nie_dodzw_id, "kp_stage_id": kp_stage_id}


async def _find_tracked_managers() -> list:
    data = await _amo_get("/api/v4/users")
    if not data:
        return []
    users = data.get("_embedded", {}).get("users", [])
    tracked = []
    names_lower = {n.strip().lower(): n for n in TRACKED_MANAGER_NAMES}
    for u in users:
        name = u.get("name", "").strip()
        if name.lower() in names_lower:
            tracked.append({"id": str(u["id"]), "name": name})
    return tracked


async def _fetch_manager_leads(user_id: str) -> list:
    return await _fetch_all_pages(
        "/api/v4/leads",
        {"filter[pipeline_id]": PIPELINE_ID, "filter[responsible_user_id]": user_id, "with": "contacts"},
        "leads", max_pages=20
    )


async def _fetch_active_tasks(user_id: str) -> list:
    return await _fetch_all_pages(
        "/api/v4/tasks",
        {"filter[responsible_user_id]": user_id, "filter[is_completed]": "0"},
        "tasks", max_pages=5
    )


async def _fetch_call_events(user_id: str, ts_from: int = None, ts_to: int = None) -> list:
    all_calls = []
    for ctype in ["incoming_call", "outgoing_call"]:
        params = {"filter[type]": ctype, "filter[created_by]": user_id}
        if ts_from:
            params["filter[created_at][from]"] = ts_from
        if ts_to:
            params["filter[created_at][to]"] = ts_to
        evts = await _fetch_all_pages("/api/v4/events", params, "events", max_pages=10)
        for e in evts:
            e["_call_type"] = ctype
        all_calls.extend(evts)
    return all_calls


async def _fetch_notes_sample(lead_ids: list, limit: int = 15) -> list:
    """Fetch notes for a sample of leads to get call durations."""
    all_notes = []
    for lid in lead_ids[:limit]:
        notes = await _fetch_all_pages(f"/api/v4/leads/{lid}/notes", {}, "notes", max_pages=2)
        all_notes.extend(notes)
        await asyncio.sleep(0.15)
    return all_notes


def _extract_call_duration(event: dict) -> int:
    """Try to extract call duration in seconds from event value_after."""
    va = event.get("value_after", [])
    if isinstance(va, list):
        for item in va:
            if isinstance(item, dict):
                call = item.get("call", {})
                if isinstance(call, dict) and call.get("duration"):
                    return int(call["duration"])
    return 0


def _parse_call_notes(notes: list) -> list:
    """Extract call durations from notes."""
    calls = []
    for n in notes:
        nt = n.get("note_type", "")
        if nt in ("call_in", "call_out"):
            params = n.get("params", {})
            duration = int(params.get("duration", 0)) if isinstance(params, dict) else 0
            calls.append({
                "type": "incoming" if nt == "call_in" else "outgoing",
                "duration": duration,
                "created_at": n.get("created_at", 0),
                "lead_id": n.get("entity_id", 0)
            })
    return calls


# ── sync ─────────────────────────────────────────────────

@router.post("/sync")
async def start_advanced_sync(background_tasks: BackgroundTasks,
                               date_from: str = None, date_to: str = None):
    sync_id = datetime.now(timezone.utc).strftime("adv_%Y%m%d_%H%M%S")
    await db.advanced_analytics_sync.insert_one({
        "sync_id": sync_id, "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat()
    })
    background_tasks.add_task(_run_advanced_sync, sync_id, date_from, date_to)
    return {"status": "started", "sync_id": sync_id}


@router.get("/sync-status")
async def get_advanced_sync_status():
    s = await db.advanced_analytics_sync.find_one({}, {"_id": 0}, sort=[("startedAt", -1)])
    return s or {"status": "never"}


async def _run_advanced_sync(sync_id: str, date_from: str = None, date_to: str = None):
    try:
        ts_from = int(datetime.fromisoformat(date_from).timestamp()) if date_from else None
        ts_to = int(datetime.fromisoformat(date_to).timestamp()) if date_to else None
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        h48_ago = now - timedelta(hours=48)
        h48_ts = int(h48_ago.timestamp())

        pipe = await _pipeline_info()
        managers = await _find_tracked_managers()
        if not managers:
            raise Exception("Tracked managers not found in amoCRM users")

        amo_settings = get_amocrm_settings()
        amo_domain = amo_settings.get("amocrm_domain", "")

        all_manager_results = []
        total_active_all = 0

        for mgr in managers:
            uid = mgr["id"]
            name = mgr["name"]
            leads = await _fetch_manager_leads(uid)
            tasks = await _fetch_active_tasks(uid)
            call_events = await _fetch_call_events(uid, ts_from, ts_to)

            # Active leads (not closed)
            active_leads = [l for l in leads if str(l.get("status_id", "")) not in CLOSED_STATUS_IDS]
            all_leads_count = len(leads)
            active_count = len(active_leads)
            total_active_all += active_count

            # Task index: lead_id -> has active task
            task_lead_ids = set()
            for t in tasks:
                eid = t.get("entity_id")
                if eid:
                    task_lead_ids.add(int(eid))

            # Cached lead analytics for action history
            cached_leads = {}
            cached_list = await db.lead_analytics_leads.find(
                {"responsibleUserId": uid, "pipelineId": PIPELINE_ID}, {"_id": 0}
            ).to_list(length=5000)
            for cl in cached_list:
                cached_leads[cl.get("amocrm_lead_id")] = cl

            # ── Stage metrics ───
            jeszcze_leads = []
            nie_dodzw_leads = []
            for l in active_leads:
                sid = str(l.get("status_id", ""))
                lid = l.get("id")
                cached = cached_leads.get(lid, {})
                idle = cached.get("idleHours")
                has_task = lid in task_lead_ids
                contact_name = ""
                contacts = l.get("_embedded", {}).get("contacts", [])
                if contacts:
                    contact_name = contacts[0].get("name", "")
                lead_info = {
                    "leadId": lid, "leadName": l.get("name", ""), "contactName": contact_name,
                    "price": l.get("price", 0), "statusId": sid,
                    "statusName": pipe["stages"].get(sid, sid),
                    "hasActiveTask": has_task, "idleHours": idle,
                    "lastActionAt": cached.get("lastActionAt"),
                    "totalActions": cached.get("totalActions", 0),
                    "link": f"https://{amo_domain}/leads/detail/{lid}" if amo_domain else ""
                }
                if sid == pipe.get("jeszcze_id"):
                    jeszcze_leads.append(lead_info)
                if sid == pipe.get("nie_dodzw_id"):
                    nie_dodzw_leads.append(lead_info)

            jeszcze_no_task = [l for l in jeszcze_leads if not l["hasActiveTask"]]
            jeszcze_no_action_48 = [l for l in jeszcze_leads if l["idleHours"] and l["idleHours"] > 48]
            nie_dodzw_no_followup = [l for l in nie_dodzw_leads if l["idleHours"] and l["idleHours"] > 48]
            stage_alert_count = len(jeszcze_no_task) + len(jeszcze_no_action_48) + len(nie_dodzw_no_followup)

            # ── Empty amount ───
            empty_amount_leads = [
                {"leadId": l.get("id"), "leadName": l.get("name", ""), "price": l.get("price", 0),
                 "statusName": pipe["stages"].get(str(l.get("status_id", "")), ""),
                 "link": f"https://{amo_domain}/leads/detail/{l.get('id')}" if amo_domain else ""}
                for l in active_leads if not l.get("price")
            ]
            empty_pct = round(len(empty_amount_leads) / active_count * 100, 1) if active_count else 0

            # ── Call analysis ───
            incoming_events = [e for e in call_events if e.get("_call_type") == "incoming_call"]
            outgoing_events = [e for e in call_events if e.get("_call_type") == "outgoing_call"]
            in_count = len(incoming_events)
            out_count = len(outgoing_events)
            total_calls = in_count + out_count

            # Duration from events
            in_durations = [_extract_call_duration(e) for e in incoming_events]
            out_durations = [_extract_call_duration(e) for e in outgoing_events]
            in_durations = [d for d in in_durations if d > 0]
            out_durations = [d for d in out_durations if d > 0]

            # If no duration from events, try notes
            if not in_durations and not out_durations and total_calls > 0:
                call_lead_ids = list(set(e.get("entity_id") for e in call_events if e.get("entity_id")))
                notes = await _fetch_notes_sample(call_lead_ids, limit=15)
                parsed = _parse_call_notes(notes)
                in_durations = [c["duration"] for c in parsed if c["type"] == "incoming" and c["duration"] > 0]
                out_durations = [c["duration"] for c in parsed if c["type"] == "outgoing" and c["duration"] > 0]

            avg_in = round(sum(in_durations) / len(in_durations)) if in_durations else 0
            avg_out = round(sum(out_durations) / len(out_durations)) if out_durations else 0
            all_dur = in_durations + out_durations
            avg_all = round(sum(all_dur) / len(all_dur)) if all_dur else 0
            short_call_alert = avg_all > 0 and avg_all < 90 and total_calls > 100

            # ── Events for activity analysis ───
            cached_events = await db.amocrm_events.find(
                {"created_by": uid}, {"_id": 0}
            ).sort("created_at_ts", -1).to_list(length=5000)

            # Notes this week
            week_ago_ts = int(week_ago.timestamp())
            notes_this_week = sum(1 for e in cached_events
                                  if e.get("type") == "note_added" and (e.get("created_at_ts") or 0) >= week_ago_ts)

            # Stage changes (forward)
            stage_order = pipe.get("stageOrder", [])
            stage_changes_all = [e for e in cached_events if e.get("type") == "lead_status_changed"]
            forward_changes = 0
            for sc in stage_changes_all:
                sb = sc.get("status_before")
                sa = sc.get("status_after")
                if sb and sa and sb in stage_order and sa in stage_order:
                    if stage_order.index(sa) > stage_order.index(sb):
                        forward_changes += 1

            # Post-KP follow-up (for Andrzej)
            kp_stage = pipe.get("kp_stage_id")
            post_kp_no_followup = []
            if kp_stage:
                kp_leads = [l for l in active_leads if str(l.get("status_id", "")) == kp_stage]
                for l in kp_leads:
                    lid = l.get("id")
                    cached = cached_leads.get(lid, {})
                    idle = cached.get("idleHours")
                    if idle and idle > 48:
                        contacts = l.get("_embedded", {}).get("contacts", [])
                        cn = contacts[0].get("name", "") if contacts else ""
                        post_kp_no_followup.append({
                            "leadId": lid, "leadName": l.get("name", ""),
                            "contactName": cn, "idleHours": idle,
                            "link": f"https://{amo_domain}/leads/detail/{lid}" if amo_domain else ""
                        })

            # Avg time per stage
            avg_time_per_stage = {}
            for sid, sname in pipe["stages"].items():
                stage_leads = [l for l in leads if str(l.get("status_id", "")) == sid]
                if stage_leads:
                    ages = []
                    for l in stage_leads:
                        updated = l.get("updated_at", l.get("created_at", 0))
                        if updated:
                            age_h = (now.timestamp() - updated) / 3600
                            ages.append(round(age_h, 1))
                    if ages:
                        avg_time_per_stage[sid] = {"name": sname, "avgHours": round(sum(ages)/len(ages), 1), "count": len(ages)}

            # Call vs chat ratio (for Viyaleta)
            chat_events = sum(1 for e in cached_events if e.get("type") in
                              ("incoming_chat_message", "outgoing_chat_message"))
            call_touch = in_count + out_count
            total_touches = call_touch + chat_events
            call_ratio = round(call_touch / total_touches * 100, 1) if total_touches else 0

            # Avg touches per deal
            deal_actions = {}
            for e in cached_events:
                eid = e.get("entity_id")
                if eid:
                    deal_actions[eid] = deal_actions.get(eid, 0) + 1
            avg_touches = round(sum(deal_actions.values()) / len(deal_actions), 1) if deal_actions else 0

            # ── Specific alerts ───
            alerts = []
            name_lower = name.lower()

            if empty_pct > 30:
                alerts.append({"type": "empty_amount", "severity": "warning",
                               "message": f"Менеджер не заполняет суммы сделок ({empty_pct}%) — аналитика недостоверна"})
            if short_call_alert:
                alerts.append({"type": "short_calls", "severity": "warning",
                               "message": f"Звонки без реального разговора — средняя длительность {avg_all}с при {total_calls} звонках"})
            if stage_alert_count > 20:
                alerts.append({"type": "stage_overload", "severity": "critical",
                               "message": f"Более 20 сделок без действий на этапах 'Jeszcze nie wiem' / 'Не дозвонились' ({stage_alert_count})"})

            # Vlada specifics
            if "vlada" in name_lower:
                alerts.append({"type": "vlada_stage_progress", "severity": "info",
                               "message": f"Реальных смен этапов вперёд: {forward_changes}"})
            # Andrzej specifics
            if "andrzej" in name_lower and post_kp_no_followup:
                alerts.append({"type": "andrzej_post_kp", "severity": "critical",
                               "message": f"После КП нет касания >48ч: {len(post_kp_no_followup)} сделок"})
            # Viyaleta specifics
            if "viyaleta" in name_lower:
                if notes_this_week < 20:
                    alerts.append({"type": "viyaleta_notes", "severity": "warning",
                                   "message": f"Примечаний за неделю: {notes_this_week} (норма ≥20)"})
                if call_ratio < 20 and total_touches > 10:
                    alerts.append({"type": "viyaleta_calls_low", "severity": "warning",
                                   "message": f"Доля звонков {call_ratio}% — преобладает текстовая коммуникация"})
                if avg_touches > 0 and avg_touches < 3:
                    alerts.append({"type": "viyaleta_few_touches", "severity": "warning",
                                   "message": f"Среднее касаний на сделку: {avg_touches} (норма ≥3)"})

            result = {
                "userId": uid, "userName": name,
                "activeDeals": active_count, "totalDeals": all_leads_count,
                "jeszcze_nie_wiem": {
                    "total": len(jeszcze_leads), "noActiveTask": len(jeszcze_no_task),
                    "noActionIn48h": len(jeszcze_no_action_48), "deals": jeszcze_leads[:30]
                },
                "nie_dodzwonilismy": {
                    "total": len(nie_dodzw_leads), "noFollowUp": len(nie_dodzw_no_followup),
                    "deals": nie_dodzw_leads[:30]
                },
                "stageAlertCount": stage_alert_count, "stageAlert": stage_alert_count > 20,
                "emptyAmount": {
                    "total": active_count, "emptyCount": len(empty_amount_leads),
                    "percent": empty_pct, "alert": empty_pct > 30,
                    "deals": empty_amount_leads[:30]
                },
                "calls": {
                    "incomingCount": in_count, "outgoingCount": out_count, "totalCount": total_calls,
                    "incomingAvgDuration": avg_in, "outgoingAvgDuration": avg_out,
                    "avgDuration": avg_all, "shortCallAlert": short_call_alert,
                    "durationAvailable": bool(all_dur)
                },
                "notesThisWeek": notes_this_week,
                "forwardStageChanges": forward_changes,
                "postKPNoFollowUp": post_kp_no_followup,
                "avgTimePerStage": avg_time_per_stage,
                "callRatio": call_ratio, "chatEvents": chat_events,
                "avgTouchesPerDeal": avg_touches,
                "specificAlerts": alerts,
            }
            all_manager_results.append(result)

        # Load concentration
        for r in all_manager_results:
            pct = round(r["activeDeals"] / total_active_all * 100, 1) if total_active_all else 0
            r["loadPercent"] = pct
            r["loadAlert"] = pct > 35
            if pct > 35:
                r["specificAlerts"].append({
                    "type": "load_concentration", "severity": "warning",
                    "message": f"Высокая концентрация нагрузки: {pct}% активных сделок"
                })

        # Urgent actions
        urgent = _compute_urgent_actions(all_manager_results, pipe, h48_ts)

        # Store
        result_doc = {
            "sync_id": sync_id, "computedAt": now.isoformat(),
            "pipeline": pipe, "totalActiveDeals": total_active_all,
            "managers": all_manager_results, "urgentActions": urgent[:10]
        }
        await db.advanced_analytics_data.update_one(
            {"sync_id": sync_id}, {"$set": result_doc}, upsert=True
        )
        await db.advanced_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {"status": "completed", "completedAt": now.isoformat()}}
        )
        logger.info(f"Advanced sync {sync_id} completed: {len(all_manager_results)} managers")

    except Exception as e:
        logger.error(f"Advanced sync {sync_id} failed: {e}", exc_info=True)
        await db.advanced_analytics_sync.update_one(
            {"sync_id": sync_id},
            {"$set": {"status": "error", "error": str(e),
                       "completedAt": datetime.now(timezone.utc).isoformat()}}
        )


def _compute_urgent_actions(managers: list, pipe: dict, h48_ts: int) -> list:
    actions = []
    for m in managers:
        mgr_name = m["userName"]
        # Red: no task on jeszcze/nie_dodzw
        for deal in m["jeszcze_nie_wiem"].get("deals", []):
            if not deal.get("hasActiveTask"):
                actions.append({
                    "severity": "red", "type": "no_task_on_stage",
                    "manager": mgr_name, "dealName": deal["leadName"],
                    "dealId": deal["leadId"], "contactName": deal.get("contactName", ""),
                    "idleHours": deal.get("idleHours"), "link": deal.get("link", ""),
                    "stageName": pipe["stages"].get(deal.get("statusId"), ""),
                    "recommendation": "Создать задачу и связаться с клиентом"
                })
        for deal in m["nie_dodzwonilismy"].get("deals", []):
            if deal.get("idleHours") and deal["idleHours"] > 48:
                actions.append({
                    "severity": "red", "type": "no_followup_nie_dodzw",
                    "manager": mgr_name, "dealName": deal["leadName"],
                    "dealId": deal["leadId"], "contactName": deal.get("contactName", ""),
                    "idleHours": deal["idleHours"], "link": deal.get("link", ""),
                    "stageName": pipe["stages"].get(deal.get("statusId"), ""),
                    "recommendation": "Повторить попытку связи"
                })
        # Red: no action 48h (any stage)
        for deal in m["jeszcze_nie_wiem"].get("deals", []) + m["nie_dodzwonilismy"].get("deals", []):
            if deal.get("idleHours") and deal["idleHours"] > 48:
                if not any(a["dealId"] == deal["leadId"] for a in actions):
                    actions.append({
                        "severity": "red", "type": "no_action_48h",
                        "manager": mgr_name, "dealName": deal["leadName"],
                        "dealId": deal["leadId"], "contactName": deal.get("contactName", ""),
                        "idleHours": deal["idleHours"], "link": deal.get("link", ""),
                        "stageName": pipe["stages"].get(deal.get("statusId"), ""),
                        "recommendation": "Связаться с клиентом — бездействие >48ч"
                    })
        # Orange: empty amount with alert
        if m["emptyAmount"]["alert"]:
            for deal in m["emptyAmount"]["deals"][:5]:
                actions.append({
                    "severity": "orange", "type": "empty_amount",
                    "manager": mgr_name, "dealName": deal["leadName"],
                    "dealId": deal["leadId"], "contactName": "",
                    "idleHours": None, "link": deal.get("link", ""),
                    "stageName": deal.get("statusName", ""),
                    "recommendation": "Заполнить сумму сделки"
                })
        # Orange: post-KP no follow-up
        for deal in m.get("postKPNoFollowUp", []):
            actions.append({
                "severity": "orange", "type": "post_kp_no_followup",
                "manager": mgr_name, "dealName": deal["leadName"],
                "dealId": deal["leadId"], "contactName": deal.get("contactName", ""),
                "idleHours": deal.get("idleHours"), "link": deal.get("link", ""),
                "stageName": "КП/Расчёт",
                "recommendation": "Follow-up после КП — клиент ждёт"
            })
        # Yellow: low notes
        if m.get("notesThisWeek", 0) < 20:
            actions.append({
                "severity": "yellow", "type": "low_notes",
                "manager": mgr_name, "dealName": "",
                "dealId": None, "contactName": "",
                "idleHours": None, "link": "",
                "stageName": "",
                "recommendation": f"Мало примечаний за неделю ({m['notesThisWeek']}) — повысить активность"
            })

    # Sort: red first, then orange, then yellow
    severity_order = {"red": 0, "orange": 1, "yellow": 2}
    actions.sort(key=lambda a: (severity_order.get(a["severity"], 3), -(a.get("idleHours") or 0)))
    return actions


# ── dashboard endpoint ────────────────────────────────────

@router.get("/dashboard")
async def get_advanced_dashboard():
    last_sync = await db.advanced_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    if not last_sync:
        return {"managers": [], "urgentActions": [], "totalActiveDeals": 0, "syncStatus": "never"}

    data = await db.advanced_analytics_data.find_one(
        {"sync_id": last_sync["sync_id"]}, {"_id": 0}
    )
    if not data:
        return {"managers": [], "urgentActions": [], "totalActiveDeals": 0, "syncStatus": "no_data"}

    data["syncStatus"] = "ok"
    data["syncCompletedAt"] = last_sync.get("completedAt")
    return data


# ── AI comparison ─────────────────────────────────────────

@router.post("/ai/comparison")
async def ai_manager_comparison():
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    data = await get_advanced_dashboard()
    managers = data.get("managers", [])
    if not managers:
        return {"text": "Нет данных. Запустите синхронизацию расширенной аналитики."}

    blocks = []
    for m in managers:
        ca = m.get("calls", {})
        ea = m.get("emptyAmount", {})
        blocks.append(f"""Менеджер: {m['userName']}
- Активных сделок: {m['activeDeals']} ({m.get('loadPercent', 0)}% от общих)
- 'Jeszcze nie wiem': {m['jeszcze_nie_wiem']['total']} (без задачи: {m['jeszcze_nie_wiem']['noActiveTask']}, без действия 48ч: {m['jeszcze_nie_wiem']['noActionIn48h']})
- 'Не дозвонились': {m['nie_dodzwonilismy']['total']} (без повтора: {m['nie_dodzwonilismy']['noFollowUp']})
- Критич. без действий: {m.get('stageAlertCount', 0)} {'⚠ АЛЕРТ >20' if m.get('stageAlert') else ''}
- Пустая сумма: {ea.get('emptyCount', 0)}/{ea.get('total', 0)} ({ea.get('percent', 0)}%) {'⚠ АЛЕРТ >30%' if ea.get('alert') else ''}
- Звонки: входящих {ca.get('incomingCount', 0)}, исходящих {ca.get('outgoingCount', 0)}, ср. длит. {ca.get('avgDuration', 0)}с {'⚠ КОРОТКИЕ' if ca.get('shortCallAlert') else ''}
- Примечаний за неделю: {m.get('notesThisWeek', 0)}
- Реальных смен этапа вперёд: {m.get('forwardStageChanges', 0)}
- Сделок без follow-up после КП: {len(m.get('postKPNoFollowUp', []))}
- Доля звонков от всех касаний: {m.get('callRatio', 0)}%
- Ср. касаний на сделку: {m.get('avgTouchesPerDeal', 0)}
- Алерты: {', '.join(a['message'] for a in m.get('specificAlerts', [])) or 'нет'}""")

    prompt = f"""Сравни трёх менеджеров отдела продаж саун. Все данные ниже.

{chr(10).join(blocks)}

Напиши подробный СРАВНИТЕЛЬНЫЙ АНАЛИЗ:

1. Кто из трёх системно слабее по ключевым показателям и ПОЧЕМУ (с цифрами).

2. Специфическая проблема каждого менеджера:
   - У кого нет финансового результата несмотря на активность
   - У кого мало звонков и преобладают мессенджеры
   - Кто теряет сделки после КП/расчёта
   - Кто не заполняет суммы

3. Итоговый рейтинг по 5 критериям (каждый из 10):
   - Скорость реакции
   - Активность (действия, касания)
   - Качество ведения CRM (заполнение сумм, задачи, примечания)
   - Конверсия по этапам (реальные смены вперёд)
   - Финансовый результат (заполненность сумм как индикатор)

4. Три конкретные рекомендации для руководителя.

5. Персональная рекомендация для каждого менеджера (1-2 предложения)."""

    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"adv-comparison-{datetime.now(timezone.utc).strftime('%H%M%S')}",
            system_message="Ты — жёсткий аналитик продаж. Пиши на русском, конкретно, с цифрами. Не приукрашивай."
        ).with_model("openai", "gpt-5.2")
        text = await chat.send_message(UserMessage(text=prompt))
        return {"text": text}
    except Exception as e:
        logger.error(f"AI comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
