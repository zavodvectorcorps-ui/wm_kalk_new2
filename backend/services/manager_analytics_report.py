"""Daily manager-analytics digest sent to Telegram.

Builds a compact summary of yesterday's manager performance — designed to
surface "fire-and-forget" cases (single-touch, low follow-up, auto-only
leads) so the head of sales sees them every morning without opening
the dashboard.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from services.telegram_service import send_telegram_message

logger = logging.getLogger(__name__)

EMERGENT_PROXY_URL = "https://integrations.emergentagent.com/llm"


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


def _build_ai_prompt(stats: list, period_label: str) -> str:
    """Compact stats dump that the LLM can reason over."""
    ranked = sorted(stats, key=lambda s: s.get("performanceScore", 0), reverse=True)
    lines = [f"Период: {period_label}", f"Менеджеров с данными: {len(stats)}", ""]
    lines.append("Сводка по каждому менеджеру:")
    for s in ranked:
        lines.append(
            f"- {s.get('userName')}: "
            f"балл {s.get('performanceScore', 0)}, "
            f"лидов {s.get('totalLeads', 0)}, "
            f"обработано {s.get('processedPercent', 0)}%, "
            f"follow-up {s.get('followUpRate', 0)}%, "
            f"single-touch {s.get('singleTouchPercent', 0)}%, "
            f"auto-only {s.get('autoOnlyPercent', 0)}%, "
            f"звонков {s.get('outgoingCalls', 0)} ({s.get('callsPerLead', 0):.2f}/лид), "
            f"писем {s.get('outgoingEmails', 0)}, "
            f"действий/лид {s.get('avgActionsPerLead', 0):.1f}, "
            f"средняя реакция {s.get('avgReactionHours') or '—'} ч"
        )
    return "\n".join(lines)


async def _get_ai_advice(stats: list, period_label: str) -> Optional[str]:
    """Ask the LLM for 3 short, actionable insights based on the data.

    Returns ``None`` if EMERGENT_LLM_KEY is not set or the call fails — the
    digest still gets sent without AI in that case.
    """
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        logger.info("AI advice skipped — EMERGENT_LLM_KEY not configured.")
        return None
    if not stats:
        return None

    prompt = _build_ai_prompt(stats, period_label)
    system_msg = (
        "Ты — опытный руководитель отдела продаж саун и купелей. "
        "Тебе дают ежедневную сводку метрик менеджеров. Главные сигналы тревоги: "
        "низкий follow-up (<40%), высокий single-touch (>30%), много auto-only лидов, "
        "мало звонков на лид (<0.3). Дорогие сделки требуют звонков, а не одних emails. "
        "Ответ строго в формате обычного текста (без markdown-заголовков, без HTML-тегов). "
        "Структура: \n"
        "🔍 ГЛАВНОЕ — 1 предложение про самую важную закономерность дня.\n"
        "⚠ РИСКИ — 2-3 пунктов через тире про конкретных менеджеров (имена!) и что у них не так.\n"
        "✅ ДЕЙСТВИЯ — 2-3 конкретных действия для руководителя на сегодня (например: "
        "«позвонить Иванову насчёт 3 лидов в стадии Х», «провести 1:1 с Петровым про звонки»).\n"
        "Каждый блок максимум 3-4 строки. Без воды."
    )
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{EMERGENT_PROXY_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}",
                          "Content-Type": "application/json"},
                json={
                    "model": "gpt-5.2",
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            if resp.status_code != 200:
                logger.warning(f"AI advice failed: {resp.status_code} {resp.text[:200]}")
                return None
            data = resp.json()
            return (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        logger.warning(f"AI advice request crashed: {e}")
        return None


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
    include_ai: bool = True,
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

    ai_used = False
    if include_ai and stats:
        advice = await _get_ai_advice(stats, label)
        if advice:
            ai_used = True
            text = f"{text}\n\n<b>🤖 Совет AI</b>\n<i>{_esc(advice)}</i>"

    # Override chat_id if a settings-level override is provided.
    ok = await send_telegram_message(text, chat_id=chat_id)
    return {
        "ok": bool(ok),
        "reason": "sent" if ok else "telegram_failed",
        "managersInReport": len(stats),
        "syncId": last_sync["sync_id"],
        "aiAdviceIncluded": ai_used,
    }
