"""Daily summary of orders created by managers, pinned in the alerts chat."""
from datetime import datetime, timezone, timedelta
import logging

from services.telegram_service import send_and_pin_message

logger = logging.getLogger(__name__)


async def build_orders_summary_text(db, day: datetime = None) -> str:
    """Build the daily summary text for the given UTC day (defaults to yesterday)."""
    now = datetime.now(timezone.utc)
    target = day or (now - timedelta(days=1))
    dstr = target.strftime("%Y-%m-%d")
    disp = target.strftime("%d.%m.%Y")

    # Orders created in the calculator that day (grouped by author/manager).
    orders = await db.sauna_orders.find(
        {"createdAt": {"$regex": f"^{dstr}"}},
        {"_id": 0, "createdBy": 1, "amocrm_id": 1},
    ).to_list(20000)
    calc_count = len(orders)
    by_mgr = {}
    for o in orders:
        m = o.get("createdBy") or "—"
        by_mgr[m] = by_mgr.get(m, 0) + 1

    # New CRM leads that day (amoCRM ones counted as processed requests).
    leads = await db.sauna_crm_leads.find(
        {"createdAt": {"$regex": f"^{dstr}"}},
        {"_id": 0, "amocrm_id": 1},
    ).to_list(20000)
    leads_count = len(leads)
    amo_count = sum(1 for l in leads if l.get("amocrm_id"))

    lines = [f"📊 <b>Сводка за {disp}</b>", ""]
    lines.append(f"🧮 Заказы из калькулятора: <b>{calc_count}</b>")
    for m, cnt in sorted(by_mgr.items(), key=lambda x: -x[1]):
        lines.append(f"   • {m}: {cnt}")
    lines.append("")
    lines.append(f"🗂 Новые лиды CRM: <b>{leads_count}</b>")
    lines.append(f"📥 Обработанные заявки (amoCRM): <b>{amo_count}</b>")
    return "\n".join(lines)


async def send_daily_orders_summary(db, chat_id: str, day: datetime = None) -> bool:
    """Send + pin the daily orders summary to the alerts chat."""
    if not chat_id:
        logger.info("daily orders summary skipped: no alerts chat configured")
        return False
    text = await build_orders_summary_text(db, day=day)
    return await send_and_pin_message(text, chat_id=chat_id)
