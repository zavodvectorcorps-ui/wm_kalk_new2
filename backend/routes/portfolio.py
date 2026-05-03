"""Public portfolio KPI endpoint — no auth, aggregates real system stats for the case study page."""
from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
import logging

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])
logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")
_client = AsyncIOMotorClient(MONGO_URL)
_db = _client[DB_NAME]


async def _count(collection: str, flt: dict = None) -> int:
    try:
        return await _db[collection].count_documents(flt or {})
    except Exception:
        return 0


async def _avg(collection: str, field: str, flt: dict = None) -> float:
    try:
        pipeline = [{"$match": flt or {}}, {"$group": {"_id": None, "avg": {"$avg": f"${field}"}}}]
        async for doc in _db[collection].aggregate(pipeline):
            return float(doc.get("avg") or 0)
    except Exception:
        pass
    return 0.0


@router.get("/kpi")
async def portfolio_kpi():
    """Aggregated, safe-to-expose numbers for the public portfolio page.
    No secrets or PII — only counts and averages."""
    # Orders across both product lines and greenhouse
    sauna_orders = await _count("sauna_orders")
    balia_orders = await _count("orders")
    greenhouse_orders = await _count("greenhouse_orders")
    total_orders = sauna_orders + balia_orders + greenhouse_orders

    # Calls
    calls_total = await _count("calls")
    calls_analyzed = await _count("calls", {"status": "analyzed"})

    # Leads (lead analytics)
    leads_total = await _count("lead_analytics_leads")

    # Average first-response time (in minutes) from lead analytics
    avg_response_sec = await _avg("lead_analytics_leads", "responseTimeSeconds",
                                  {"responseTimeSeconds": {"$gt": 0}})
    avg_response_min = round(avg_response_sec / 60.0, 1) if avg_response_sec else 0.0

    # Automation % = analyzed / total calls (how many calls did AI score without human)
    automation_pct = round((calls_analyzed / calls_total) * 100) if calls_total else 0

    # Estimated saved hours = each analyzed call saves ~6 min of manual review
    saved_hours = round((calls_analyzed * 6) / 60)

    # Managers (employees) tracked
    managers = await _count("users", {"role": {"$in": ["admin", "employee", "manager"]}})

    # Uptime proxy: days since system start (backup_schedule first run) — fallback to 365
    days_live = 365
    try:
        earliest = await _db["sales_records"].find({}, {"createdAt": 1}).sort("createdAt", 1).limit(1).to_list(1)
        if earliest and earliest[0].get("createdAt"):
            start = datetime.fromisoformat(earliest[0]["createdAt"].replace("Z", "+00:00"))
            days_live = max(1, (datetime.now(timezone.utc) - start).days)
    except Exception:
        pass

    return {
        "ordersProcessed": total_orders,
        "callsAnalyzedByAI": calls_analyzed,
        "callsTotal": calls_total,
        "leadsTracked": leads_total,
        "avgFirstResponseMinutes": avg_response_min,
        "automationPercent": min(automation_pct, 100),
        "hoursSaved": saved_hours,
        "managersOnboard": managers,
        "daysLive": days_live,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
