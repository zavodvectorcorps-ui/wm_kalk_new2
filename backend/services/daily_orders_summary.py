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


async def build_weekly_summary_text(db, ref: datetime = None) -> str:
    """Weekly recap for the previous full week (Mon–Sun): order counts,
    average margin %, top-3 managers by number of calculator orders."""
    now = ref or datetime.now(timezone.utc)
    this_monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    last_monday = this_monday - timedelta(days=7)
    last_sunday = this_monday - timedelta(days=1)
    from_str = last_monday.strftime("%Y-%m-%d")
    to_str = last_sunday.strftime("%Y-%m-%d")

    def in_range(ca):
        d = (ca or "")[:10]
        return from_str <= d <= to_str

    orders = await db.sauna_orders.find(
        {"createdAt": {"$gte": from_str}},
        {"_id": 0, "createdBy": 1, "amocrm_id": 1, "total": 1, "totalCost": 1, "retailExtraCost": 1, "createdAt": 1},
    ).to_list(50000)
    orders = [o for o in orders if in_range(o.get("createdAt"))]
    calc_count = len(orders)
    by_mgr = {}
    pcts = []
    for o in orders:
        m = o.get("createdBy") or "—"
        by_mgr[m] = by_mgr.get(m, 0) + 1
        total = float(o.get("total") or 0)
        cost = float(o.get("totalCost") or 0)
        if total > 0 and cost > 0:
            netto = total / 1.23
            extras = float(o.get("retailExtraCost") or 0)
            pcts.append((netto - cost - extras) / netto * 100)

    leads = await db.sauna_crm_leads.find(
        {"createdAt": {"$gte": from_str}}, {"_id": 0, "amocrm_id": 1, "createdAt": 1}
    ).to_list(50000)
    leads = [l for l in leads if in_range(l.get("createdAt"))]
    leads_count = len(leads)
    amo_count = sum(1 for l in leads if l.get("amocrm_id"))
    avg_margin = round(sum(pcts) / len(pcts), 1) if pcts else None
    top = sorted(by_mgr.items(), key=lambda x: -x[1])[:3]

    disp = f"{last_monday.strftime('%d.%m')}–{last_sunday.strftime('%d.%m.%Y')}"
    lines = [
        f"📅 <b>Итоги недели {disp}</b>", "",
        f"🧮 Заказы из калькулятора: <b>{calc_count}</b>",
        f"🗂 Новые лиды CRM: <b>{leads_count}</b> (amoCRM: {amo_count})",
        (f"📈 Средняя маржа: <b>{avg_margin}%</b>" if avg_margin is not None else "📈 Средняя маржа: —"),
        "", "🏆 Топ менеджеров (по заказам):",
    ]
    if top:
        for i, (m, cnt) in enumerate(top, 1):
            lines.append(f"   {i}. {m}: {cnt}")
    else:
        lines.append("   — нет данных")
    return "\n".join(lines)


async def send_weekly_summary(db, chat_id: str, ref: datetime = None) -> bool:
    """Send the weekly recap to the alerts chat (not pinned — daily pin stays on top)."""
    if not chat_id:
        logger.info("weekly summary skipped: no alerts chat configured")
        return False
    from services.telegram_service import send_telegram_message
    text = await build_weekly_summary_text(db, ref=ref)
    return await send_telegram_message(text, chat_id=chat_id)
