"""Daily manager-analytics digest sent to Telegram.

Builds a compact summary of yesterday's manager performance — designed to
surface "fire-and-forget" cases (single-touch, low follow-up, auto-only
leads) so the head of sales sees them every morning without opening
the dashboard.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from services.telegram_service import send_telegram_message

logger = logging.getLogger(__name__)


def _esc(s) -> str:
    """HTML-escape a value for Telegram's HTML parse mode."""
    if s is None:
        return ""
    return (str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;"))


def _fmt_pct(v) -> str:
    try:
        return f"{float(v):.0f}%"
    except (TypeError, ValueError):
        return "—"


def _build_report_text(stats: list, period_label: str, date_str: str) -> str:
    """Compose the HTML text for the digest.

    ``stats`` are per-manager dicts straight from ``event_manager_stats``.
    """
    if not stats:
        return (
            f"<b>📊 Аналитика менеджеров — {period_label}</b>\n"
            f"<i>{date_str}</i>\n\n"
            "За этот период нет данных. Возможно, ни один менеджер не работал с лидами."
        )

    # Sort by performance score descending.
    ranked = sorted(stats, key=lambda s: s.get("performanceScore", 0), reverse=True)

    # Aggregates across the whole team.
    total_leads = sum(s.get("totalLeads", 0) for s in stats)
    total_processed = sum(s.get("processedLeads", 0) for s in stats)
    total_followups = sum(
        round((s.get("followUpRate", 0) / 100.0) * len([1 for _ in range(s.get("totalLeads", 0))]))
        for s in stats
    )  # rough; not used directly — better to weighted-average follow-up:
    total_calls = sum(s.get("outgoingCalls", 0) for s in stats)
    total_emails = sum(s.get("outgoingEmails", 0) for s in stats)
    total_single_touch = sum(s.get("singleTouchLeads", 0) for s in stats)
    total_auto_only = sum(s.get("autoOnlyLeads", 0) for s in stats)

    avg_follow = (
        sum(s.get("followUpRate", 0) for s in stats) / len(stats)
        if stats else 0
    )

    lines: list[str] = []
    lines.append(f"<b>📊 Аналитика менеджеров — {period_label}</b>")
    lines.append(f"<i>{date_str}</i>")
    lines.append("")
    lines.append("<b>Сводка по команде:</b>")
    lines.append(f"• Лидов: <b>{total_leads}</b>  ·  обработано: <b>{total_processed}</b>")
    lines.append(f"• Follow-up в среднем: <b>{_fmt_pct(avg_follow)}</b>")
    lines.append(f"• Звонков исх.: <b>{total_calls}</b>  ·  писем: <b>{total_emails}</b>")
    lines.append(f"• ⚠ Single-touch лидов: <b>{total_single_touch}</b>")
    lines.append(f"• 🤖 Auto-only лидов: <b>{total_auto_only}</b>")
    lines.append("")

    # Top 3 by score.
    top3 = ranked[:3]
    lines.append("<b>🥇 ТОП-3 по баллу:</b>")
    for i, s in enumerate(top3, 1):
        emoji = ["🥇", "🥈", "🥉"][i - 1]
        lines.append(
            f"{emoji} <b>{_esc(s.get('userName'))}</b> — "
            f"балл <b>{s.get('performanceScore', 0)}</b> · "
            f"follow-up {_fmt_pct(s.get('followUpRate', 0))} · "
            f"звонков {s.get('outgoingCalls', 0)}"
        )
    lines.append("")

    # Suspicious managers: high score but weak fundamentals.
    suspicious = [
        s for s in ranked
        if s.get("performanceScore", 0) >= 70 and (
            (s.get("followUpRate", 0) < 40) or (s.get("singleTouchPercent", 0) > 40)
        )
    ]
    if suspicious:
        lines.append("<b>⚠ Подозрительные (высокий балл, слабые фундаменталы):</b>")
        for s in suspicious[:5]:
            lines.append(
                f"• <b>{_esc(s.get('userName'))}</b> — балл {s.get('performanceScore', 0)}, "
                f"но follow-up {_fmt_pct(s.get('followUpRate', 0))}, "
                f"single-touch {_fmt_pct(s.get('singleTouchPercent', 0))}"
            )
        lines.append("")

    # Bottom: low follow-up or very low manual ratio.
    weak = [s for s in ranked if s.get("totalLeads", 0) > 0]
    weak = sorted(
        weak,
        key=lambda s: (s.get("followUpRate", 0), s.get("avgActionsPerLead", 0)),
    )[:3]
    if weak:
        lines.append("<b>🚨 Внизу рейтинга:</b>")
        for s in weak:
            lines.append(
                f"• <b>{_esc(s.get('userName'))}</b> — балл {s.get('performanceScore', 0)} · "
                f"follow-up {_fmt_pct(s.get('followUpRate', 0))} · "
                f"действий/лид {s.get('avgActionsPerLead', 0):.1f} · "
                f"звон./лид {s.get('callsPerLead', 0):.1f}"
            )
        lines.append("")

    lines.append("<i>Полная картина — в админке → Аналитика менеджеров.</i>")
    return "\n".join(lines)


async def send_manager_digest(
    db,
    period_label: Optional[str] = None,
    chat_id: Optional[str] = None,
) -> dict:
    """Send the digest for the latest completed sync.

    Returns a small dict ``{ok, reason, sent, recipients}`` so callers
    (HTTP endpoint, scheduler) can log meaningfully.
    """
    last_sync = await db.event_analytics_sync.find_one(
        {"status": "completed"}, {"_id": 0}, sort=[("completedAt", -1)]
    )
    if not last_sync:
        return {"ok": False, "reason": "no_sync_yet"}

    stats = await db.event_manager_stats.find(
        {"sync_id": last_sync["sync_id"]}, {"_id": 0}
    ).to_list(length=200)

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%d.%m.%Y")
    label = period_label or f"вчера ({yesterday})"
    text = _build_report_text(stats, label, datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M UTC"))

    # Override chat_id if a settings-level override is provided.
    ok = await send_telegram_message(text, chat_id=chat_id)
    return {
        "ok": bool(ok),
        "reason": "sent" if ok else "telegram_failed",
        "managersInReport": len(stats),
        "syncId": last_sync["sync_id"],
    }
