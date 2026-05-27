"""Binotel-based call statistics for Manager Analytics.

Pulls live call data directly from the Binotel API (/stats/...-calls-for-period.json)
and maps Binotel employeeID → amoCRM userId via a small, admin-managed mapping
collection. Used as the authoritative source of call counts/durations/answer-rate
in the Manager Events Analytics screen; AI call scoring still comes from the
local `call_analytics_calls` collection.

Mapping strategy: auto-match Binotel employee names against amoCRM user names
(case-insensitive, normalized) on demand, then let the admin fine-tune via
PUT /binotel/mapping.
"""
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional, Dict, List

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import db
from routes.lead_analytics import _amo_get

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead-analytics/binotel", tags=["Binotel Analytics"])

BINOTEL_API = "https://api.binotel.com/api/4.0"
MAPPING_COLL = "binotel_user_mapping"

# Disposition buckets — Binotel returns lowercase strings like "answered",
# "no-answer", "busy", "failed", "cancelled". We collapse everything that isn't
# a clear connect into "missed".
ANSWERED_DISPOSITIONS = {"answered", "answer", "completed"}


# ─────────────────────────── Binotel HTTP ───────────────────────────

def _creds() -> dict:
    return {
        "key": os.environ.get("BINOTEL_API_KEY", ""),
        "secret": os.environ.get("BINOTEL_API_SECRET", ""),
    }


def _is_configured() -> bool:
    c = _creds()
    return bool(c["key"] and c["secret"])


async def _fetch_period(start_ts: int, end_ts: int, direction: str) -> List[dict]:
    """direction: 'incoming' or 'outgoing'."""
    creds = _creds()
    if not creds["key"]:
        return []
    endpoint = f"{BINOTEL_API}/stats/{direction}-calls-for-period.json"
    body = {**creds, "startTime": str(start_ts), "stopTime": str(end_ts)}
    try:
        async with httpx.AsyncClient(timeout=45) as cl:
            resp = await cl.post(endpoint, json=body)
        if resp.status_code != 200:
            logger.warning(f"Binotel {direction} {resp.status_code}: {resp.text[:200]}")
            return []
        data = resp.json()
        if data.get("status") != "success":
            logger.warning(f"Binotel {direction} non-success: {data}")
            return []
        details = data.get("callDetails", {})
        # callDetails is normally a dict keyed by generalCallID — sometimes a list.
        if isinstance(details, dict):
            return list(details.values())
        if isinstance(details, list):
            return details
        return []
    except Exception as e:
        logger.error(f"Binotel {direction} fetch error: {e}")
        return []


# ─────────────────────────── Field extraction ───────────────────────────

def _extract_employee(call: dict) -> tuple[str, str]:
    """Return (employeeID, employeeName) — defensive against schema drift.

    Real Binotel responses store the answering operator at the top level as
    ``employeeData`` (dict with ``name`` + ``email`` — no numeric ID), e.g.::

        "employeeData": {"name": "Viyaleta WM-sauna ПК",
                          "email": "wmsauna10+1@gmail.com"}

    For unanswered calls the field is an empty list ``[]``. We also look in
    ``historyData[*].employeeData`` because the answering operator can be in
    a later history entry (e.g. queue → ring → answer). For mapping
    purposes we use ``email`` as the stable ID (falling back to name).
    """
    def _parse_emp_dict(emp) -> tuple[str, str]:
        if not isinstance(emp, dict) or not emp:
            return ("", "")
        # Prefer explicit numeric employeeID when present.
        eid = (
            emp.get("employeeID") or emp.get("employeeId")
            or emp.get("id") or emp.get("email") or emp.get("name") or ""
        )
        name = emp.get("employeeName") or emp.get("name") or emp.get("email") or ""
        if eid:
            return (str(eid), str(name))
        return ("", "")

    # 1. Top-level employeeData (most common in real Binotel responses)
    eid, name = _parse_emp_dict(call.get("employeeData"))
    if eid:
        return (eid, name)

    # 2. Older nested schema: internalAdditionalData.employeeData
    iad = call.get("internalAdditionalData") or {}
    if isinstance(iad, dict):
        eid, name = _parse_emp_dict(iad.get("employeeData"))
        if eid:
            return (eid, name)

    # 3. Flat schema (legacy)
    eid = call.get("employeeID") or call.get("employeeId") or call.get("companyEmployeeID")
    if eid:
        name = call.get("employeeName") or call.get("employee_name") or ""
        return (str(eid), str(name))

    # 4. ``employees`` array (some setups)
    emps = call.get("employees") or []
    if isinstance(emps, list) and emps and isinstance(emps[0], dict):
        eid, name = _parse_emp_dict(emps[0])
        if eid:
            return (eid, name)

    # 5. historyData[*].employeeData — answering operator may live here when
    # the call passed through a queue/IVR before being picked up.
    hd = call.get("historyData") or []
    if isinstance(hd, list):
        for h in hd:
            if not isinstance(h, dict):
                continue
            eid, name = _parse_emp_dict(h.get("employeeData"))
            if eid:
                return (eid, name)

    return ("", "")


def _extract_billsec(call: dict) -> int:
    for k in ("billsec", "billSec", "duration", "talkTime", "talk_sec"):
        v = call.get(k)
        if isinstance(v, (int, float)):
            return int(v)
        if isinstance(v, str) and v.isdigit():
            return int(v)
    return 0


def _is_answered(call: dict) -> bool:
    d = str(call.get("disposition") or call.get("status") or "").lower()
    if d in ANSWERED_DISPOSITIONS:
        return True
    # Fallback heuristic — non-zero talk time means it connected.
    return _extract_billsec(call) > 0


# ─────────────────────────── Aggregation ───────────────────────────

async def aggregate_by_employee(date_from: Optional[str], date_to: Optional[str]) -> Dict[str, dict]:
    """Aggregate Binotel calls grouped by Binotel employeeID.

    Returns: {
        emp_id: {
            "binotelEmployeeId": "...",
            "binotelEmployeeName": "...",
            "outgoing": int, "incoming": int, "total": int,
            "answered": int, "missed": int,
            "answerRate": float,        # 0..100, only over outbound+inbound attempts
            "totalTalkSec": int,
            "avgTalkSec": int,          # over ANSWERED only
        }
    }
    """
    if not _is_configured():
        return {}
    try:
        ts_from = int(datetime.fromisoformat(date_from).timestamp()) if date_from else \
            int((datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)).timestamp())
        # Use full day for date_to (23:59:59)
        if date_to:
            dt_to = datetime.fromisoformat(date_to)
            if dt_to.hour == 0 and dt_to.minute == 0:
                dt_to = dt_to.replace(hour=23, minute=59, second=59)
            ts_to = int(dt_to.timestamp())
        else:
            ts_to = int(datetime.now(timezone.utc).timestamp())
    except Exception as e:
        logger.warning(f"binotel aggregate: bad date range {date_from}..{date_to}: {e}")
        return {}

    inbound = await _fetch_period(ts_from, ts_to, "incoming")
    outbound = await _fetch_period(ts_from, ts_to, "outgoing")

    by_emp: Dict[str, dict] = {}

    def _slot(eid: str, name: str) -> dict:
        s = by_emp.get(eid)
        if not s:
            s = {
                "binotelEmployeeId": eid,
                "binotelEmployeeName": name,
                "outgoing": 0, "incoming": 0, "total": 0,
                "answered": 0, "missed": 0,
                "totalTalkSec": 0, "answeredTalkSec": 0,
            }
            by_emp[eid] = s
        # Keep first non-empty name we see.
        if name and not s.get("binotelEmployeeName"):
            s["binotelEmployeeName"] = name
        return s

    for c in inbound:
        eid, name = _extract_employee(c)
        if not eid:
            continue
        s = _slot(eid, name)
        s["incoming"] += 1
        s["total"] += 1
        bs = _extract_billsec(c)
        s["totalTalkSec"] += bs
        if _is_answered(c):
            s["answered"] += 1
            s["answeredTalkSec"] += bs
        else:
            s["missed"] += 1

    for c in outbound:
        eid, name = _extract_employee(c)
        if not eid:
            continue
        s = _slot(eid, name)
        s["outgoing"] += 1
        s["total"] += 1
        bs = _extract_billsec(c)
        s["totalTalkSec"] += bs
        if _is_answered(c):
            s["answered"] += 1
            s["answeredTalkSec"] += bs
        else:
            s["missed"] += 1

    # Derive ratios
    for s in by_emp.values():
        s["answerRate"] = round(s["answered"] / s["total"] * 100, 1) if s["total"] > 0 else 0.0
        s["avgTalkSec"] = round(s["answeredTalkSec"] / s["answered"]) if s["answered"] > 0 else 0
    return by_emp


# ─────────────────────────── Mapping store ───────────────────────────

async def _load_mapping() -> Dict[str, str]:
    """Return dict[binotelEmployeeId -> amocrmUserId]."""
    docs = await db[MAPPING_COLL].find({}, {"_id": 0}).to_list(length=500)
    return {str(d["binotelEmployeeId"]): str(d.get("amocrmUserId") or "")
            for d in docs if d.get("binotelEmployeeId")}


def _normalize_name(n: str) -> str:
    """Lowercase, collapse whitespace, strip punctuation for fuzzy name compare."""
    n = (n or "").lower()
    n = re.sub(r"[^\w\s]", " ", n, flags=re.UNICODE)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def _name_tokens(n: str) -> set:
    return {t for t in _normalize_name(n).split() if len(t) > 1}


async def aggregate_by_amocrm_user(
    date_from: Optional[str], date_to: Optional[str]
) -> Dict[str, dict]:
    """Return Binotel stats grouped by amoCRM userId using the saved mapping."""
    by_emp = await aggregate_by_employee(date_from, date_to)
    if not by_emp:
        return {}
    mapping = await _load_mapping()
    by_user: Dict[str, dict] = {}
    for eid, s in by_emp.items():
        amo_uid = mapping.get(eid)
        if not amo_uid:
            continue
        slot = by_user.setdefault(amo_uid, {
            "amocrmUserId": amo_uid,
            "outgoing": 0, "incoming": 0, "total": 0,
            "answered": 0, "missed": 0,
            "totalTalkSec": 0, "answeredTalkSec": 0,
            "binotelEmployees": [],
        })
        slot["outgoing"] += s["outgoing"]
        slot["incoming"] += s["incoming"]
        slot["total"] += s["total"]
        slot["answered"] += s["answered"]
        slot["missed"] += s["missed"]
        slot["totalTalkSec"] += s["totalTalkSec"]
        slot["answeredTalkSec"] += s["answeredTalkSec"]
        slot["binotelEmployees"].append(
            {"id": s["binotelEmployeeId"], "name": s["binotelEmployeeName"]}
        )
    for s in by_user.values():
        s["answerRate"] = round(s["answered"] / s["total"] * 100, 1) if s["total"] > 0 else 0.0
        s["avgTalkSec"] = round(s["answeredTalkSec"] / s["answered"]) if s["answered"] > 0 else 0
    return by_user


# ─────────────────────────── Endpoints ───────────────────────────

class MappingItem(BaseModel):
    binotelEmployeeId: str
    binotelEmployeeName: str = ""
    amocrmUserId: str = ""  # empty means "unmapped / ignore"
    amocrmUserName: str = ""


class MappingPayload(BaseModel):
    items: List[MappingItem]


@router.get("/config")
async def get_config():
    """Whether Binotel credentials are configured (no keys exposed)."""
    return {"configured": _is_configured()}


@router.get("/stats")
async def get_binotel_stats(date_from: Optional[str] = None, date_to: Optional[str] = None):
    """Live Binotel call stats grouped by amoCRM userId."""
    if not _is_configured():
        return {"configured": False, "byUser": {}, "unmapped": []}
    by_user = await aggregate_by_amocrm_user(date_from, date_to)
    # Also surface unmapped employees so the admin sees what's missing.
    by_emp = await aggregate_by_employee(date_from, date_to)
    mapping = await _load_mapping()
    unmapped = [
        {**s} for eid, s in by_emp.items()
        if not mapping.get(eid) and s["total"] > 0
    ]
    return {"configured": True, "byUser": by_user, "unmapped": unmapped}


@router.get("/employees")
async def get_binotel_employees(date_from: Optional[str] = None, date_to: Optional[str] = None):
    """List Binotel employees seen in calls during the period (for mapping UI)."""
    if not _is_configured():
        raise HTTPException(400, "Binotel API не настроен (BINOTEL_API_KEY/SECRET)")
    by_emp = await aggregate_by_employee(date_from, date_to)
    return {
        "employees": sorted(
            [
                {
                    "binotelEmployeeId": s["binotelEmployeeId"],
                    "binotelEmployeeName": s["binotelEmployeeName"],
                    "callsInPeriod": s["total"],
                }
                for s in by_emp.values()
            ],
            key=lambda x: -x["callsInPeriod"],
        )
    }


@router.get("/mapping")
async def get_mapping():
    docs = await db[MAPPING_COLL].find({}, {"_id": 0}).to_list(length=500)
    return {"items": docs}


@router.put("/mapping")
async def save_mapping(payload: MappingPayload):
    """Replace the full mapping with the provided list (idempotent)."""
    # Remove duplicates by binotelEmployeeId
    seen = set()
    cleaned = []
    for it in payload.items:
        if not it.binotelEmployeeId or it.binotelEmployeeId in seen:
            continue
        seen.add(it.binotelEmployeeId)
        cleaned.append(it.dict())
    await db[MAPPING_COLL].delete_many({})
    if cleaned:
        await db[MAPPING_COLL].insert_many(cleaned)
    return {"saved": len(cleaned)}


@router.post("/mapping/automap")
async def automap(date_from: Optional[str] = None, date_to: Optional[str] = None):
    """Auto-match unmapped Binotel employees to amoCRM users by normalized name.

    Strategy: a Binotel name matches an amoCRM user when token sets overlap by
    ≥2 tokens OR fully equal after normalization. Existing manual mappings are
    preserved (we never overwrite a non-empty amocrmUserId).
    """
    if not _is_configured():
        raise HTTPException(400, "Binotel API не настроен")
    # Fetch amoCRM users
    users_data = await _amo_get("/api/v4/users")
    amo_users = []
    if users_data:
        for u in users_data.get("_embedded", {}).get("users", []):
            amo_users.append({"id": str(u["id"]), "name": u.get("name", ""),
                              "tokens": _name_tokens(u.get("name", ""))})

    by_emp = await aggregate_by_employee(date_from, date_to)
    existing = {d["binotelEmployeeId"]: d async for d in db[MAPPING_COLL].find({})}

    matched = 0
    new_items = []
    for eid, s in by_emp.items():
        prev = existing.get(eid) or {}
        if prev.get("amocrmUserId"):
            # Preserve existing manual mapping
            new_items.append({
                "binotelEmployeeId": eid,
                "binotelEmployeeName": s["binotelEmployeeName"] or prev.get("binotelEmployeeName", ""),
                "amocrmUserId": prev.get("amocrmUserId"),
                "amocrmUserName": prev.get("amocrmUserName", ""),
            })
            continue
        bino_tokens = _name_tokens(s["binotelEmployeeName"])
        best = None
        best_score = 0
        for u in amo_users:
            if not u["tokens"]:
                continue
            overlap = len(bino_tokens & u["tokens"])
            # Heuristic: ≥2 token overlap OR full-set equality on either side.
            score = overlap
            if bino_tokens and (bino_tokens <= u["tokens"] or u["tokens"] <= bino_tokens):
                score = max(score, 3)
            if score > best_score:
                best_score = score
                best = u
        if best and best_score >= 2:
            new_items.append({
                "binotelEmployeeId": eid,
                "binotelEmployeeName": s["binotelEmployeeName"],
                "amocrmUserId": best["id"],
                "amocrmUserName": best["name"],
            })
            matched += 1
        else:
            new_items.append({
                "binotelEmployeeId": eid,
                "binotelEmployeeName": s["binotelEmployeeName"],
                "amocrmUserId": "",
                "amocrmUserName": "",
            })

    # Also keep mappings for employees that didn't appear in this period —
    # don't lose existing manual mappings just because of a quiet day.
    seen = {it["binotelEmployeeId"] for it in new_items}
    for eid, prev in existing.items():
        if eid not in seen:
            new_items.append({k: v for k, v in prev.items() if k != "_id"})

    await db[MAPPING_COLL].delete_many({})
    if new_items:
        await db[MAPPING_COLL].insert_many(new_items)
    return {"matched": matched, "total": len(new_items)}


@router.get("/amocrm-users")
async def list_amocrm_users():
    """Helper for the mapping UI: list amoCRM users for the dropdown."""
    users_data = await _amo_get("/api/v4/users")
    out = []
    if users_data:
        for u in users_data.get("_embedded", {}).get("users", []):
            out.append({"id": str(u["id"]), "name": u.get("name", "")})
    out.sort(key=lambda x: x["name"].lower())
    return {"users": out}
