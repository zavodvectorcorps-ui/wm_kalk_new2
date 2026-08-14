"""Telegram Production integration — send order details to a forum Topic.

Separate from the order-notification / backup bot. Uses the dedicated
production bot + supergroup (TELEGRAM_PRODUCTION_BOT_TOKEN /
TELEGRAM_PRODUCTION_CHAT_ID). Telegram here is only a communication + files
channel for the production team; the order status still lives only in CRM.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import logging
import httpx
import os

from database import db
from services.telegram_service import (
    create_forum_topic,
    send_telegram_message,
    send_telegram_file,
    edit_forum_topic,
    close_forum_topic,
    reopen_forum_topic,
    get_production_telegram_config,
)

router = APIRouter(prefix="/api/integrations/telegram", tags=["telegram-production"])
logger = logging.getLogger(__name__)

_MASK = "••••••••"


async def _resolve_prod_config() -> dict:
    """Resolve production Telegram config: DB settings first, env fallback.

    Lets the bot/group be configured via UI (no new deploy secrets needed).
    """
    doc = await db.telegram_production_settings.find_one({"_id": "config"}, {"_id": 0})
    env = get_production_telegram_config()
    bot_token = (doc or {}).get("bot_token") or env.get("bot_token") or ""
    chat_id = (doc or {}).get("chat_id") or env.get("chat_id") or ""
    enabled = (doc or {}).get("enabled", True)
    return {"bot_token": bot_token, "chat_id": chat_id, "enabled": enabled}


# Telegram custom-emoji icon ids for production stages (from getForumTopicIconStickers)
_EMOJI_ACCEPTED = "5373251851074415873"      # 📝 заявка принята
_EMOJI_IN_PRODUCTION = "5312016608254762256"  # ⚡️ в работе
_EMOJI_READY = "5350699789551935589"          # 🛍 готово к отгрузке
_EMOJI_SHIPPED = "5237699328843200968"        # ✅ отгружено

# Production stage -> (name emoji prefix, custom-emoji icon id, is_final)
def _stage_visual(stage_id: str, stage_name: str = ""):
    sid = (stage_id or "").lower()
    name = (stage_name or "").lower()
    if sid in ("shipped", "delivered", "done") or "отгруж" in name or "доставлен" in name:
        return "✅", _EMOJI_SHIPPED, True
    if sid == "ready" or "готов" in name:
        return "📦", _EMOJI_READY, False
    if sid in ("in_production", "production") or "производ" in name:
        return "🏭", _EMOJI_IN_PRODUCTION, False
    # accepted / queue / default
    return "⏳", _EMOJI_ACCEPTED, False


def _base_topic_name(lead: dict, order: dict) -> str:
    order_id = lead.get("id", "")
    client = lead.get("clientName") or "—"
    model = lead.get("modelName") or lead.get("field_1") or (order or {}).get("modelName") or "—"
    return f"#{order_id} {client} — {model}"


async def _get_calc_order(lead: dict):
    """Fetch the linked calculator order (for the full options spec)."""
    calc_order_id = lead.get("calculatorOrderId")
    calc_collection = lead.get("calculatorCollection", "sauna_orders")
    order = None
    if calc_order_id:
        order = await db[calc_collection].find_one({"id": calc_order_id}, {"_id": 0})
    if not order and lead.get("amocrm_id"):
        for coll in ["sauna_orders", "balia_orders", "greenhouse_orders"]:
            order = await db[coll].find_one({"amocrm_id": lead["amocrm_id"]}, {"_id": 0})
            if order:
                break
    return order


def _format_deadline(lead: dict) -> str:
    raw = lead.get("readyDate") or lead.get("productionDate") or ""
    if not raw:
        return ""
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d.%m.%Y")
    except Exception:
        return str(raw)[:10]


def _build_spec_lines(lead: dict, order: dict) -> list:
    """Full, non-truncated options list (specification)."""
    selected = []
    if order and isinstance(order.get("selectedOptions"), list):
        selected = order["selectedOptions"]
    elif isinstance((lead.get("calculatorData") or {}).get("selectedOptions"), list):
        selected = lead["calculatorData"]["selectedOptions"]

    lines = []
    for opt in selected:
        if not isinstance(opt, dict):
            continue
        name = opt.get("optionName") or opt.get("name") or opt.get("namePl") or ""
        if not name:
            continue
        qty = opt.get("quantity") or 1
        line = f"• {name}"
        try:
            if int(qty) > 1:
                line += f" ×{int(qty)}"
        except Exception:
            pass
        lines.append(line)
    return lines


def _build_message(lead: dict, order: dict, is_update: bool) -> str:
    header = "🔄 <b>ОБНОВЛЕНИЕ ЗАКАЗА</b>" if is_update else "🏭 <b>ЗАКАЗ В ПРОИЗВОДСТВО</b>"
    order_id = lead.get("id", "")
    client = lead.get("clientName") or "—"
    model = lead.get("modelName") or lead.get("field_1") or (order or {}).get("modelName") or "—"

    parts = [
        header,
        "",
        f"🔢 <b>Заказ:</b> {order_id}",
        f"👤 <b>Клиент:</b> {client}",
        f"🛁 <b>Модель:</b> {model}",
    ]

    spec_lines = _build_spec_lines(lead, order)
    if spec_lines:
        parts.append("")
        parts.append("📋 <b>Спецификация (опции):</b>")
        parts.extend(spec_lines)

    wishes = (lead.get("notes") or "").strip() or (lead.get("amoComment") or "").strip()
    if not wishes and order:
        wishes = (order.get("notes") or "").strip()
    if wishes:
        parts.append("")
        parts.append(f"📝 <b>Нестандартные пожелания:</b>\n{wishes}")

    deadline = _format_deadline(lead)
    if deadline:
        parts.append("")
        parts.append(f"📅 <b>Срок готовности:</b> {deadline}")

    if lead.get("amocrm_link"):
        parts.append(f"🔗 <b>Карточка в amoCRM:</b> {lead['amocrm_link']}")

    return "\n".join(parts)


@router.post("/send-to-production/{order_id}")
async def send_to_production(order_id: str):
    """Create (or reuse) a forum topic and post the order spec + documents.

    First call: creates a topic, saves telegram_topic_id, posts start message.
    Repeat call: posts an "Обновление" message into the SAME topic (no new topic).
    Attaches all lead documents to the topic.
    """
    cfg = await _resolve_prod_config()
    if not cfg["bot_token"] or not cfg["chat_id"]:
        raise HTTPException(status_code=400, detail="Telegram производства не настроен (нет бота/чата)")

    lead = await db.sauna_crm_leads.find_one({"id": order_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    order = await _get_calc_order(lead)
    existing_topic_id = lead.get("telegram_topic_id")
    is_update = existing_topic_id is not None

    topic_id = existing_topic_id

    # Create a new topic on first send
    if not is_update:
        emoji, icon_emoji_id, _ = _stage_visual(lead.get("productionStageId"), "")
        topic_name = f"{emoji} {_base_topic_name(lead, order)}"
        created = await create_forum_topic(
            name=topic_name, icon_custom_emoji_id=icon_emoji_id,
            chat_id=cfg["chat_id"], bot_token=cfg["bot_token"],
        )
        if not created.get("success"):
            raise HTTPException(status_code=502, detail=f"Не удалось создать тему в Telegram: {created.get('error')}")
        topic_id = created["message_thread_id"]
        await db.sauna_crm_leads.update_one(
            {"id": order_id},
            {"$set": {"telegram_topic_id": topic_id, "updatedAt": datetime.now(timezone.utc).isoformat()}},
        )

    # Post the message (start message carries the control buttons)
    message = _build_message(lead, order, is_update)
    reply_markup = None if is_update else _order_keyboard(order_id)
    sent = await send_telegram_message(
        text=message,
        chat_id=cfg["chat_id"],
        bot_token=cfg["bot_token"],
        message_thread_id=topic_id,
        reply_markup=reply_markup,
    )
    if not sent:
        # Topic may have been manually deleted in Telegram — surface it, don't swallow.
        if is_update:
            raise HTTPException(
                status_code=502,
                detail="Не удалось отправить в тему. Возможно, тема была удалена в Telegram. Обратитесь к администратору для пересоздания.",
            )
        raise HTTPException(status_code=502, detail="Тема создана, но сообщение отправить не удалось.")

    # Attach all documents to the topic (except the contract — not for production)
    docs = lead.get("documents") or []
    sent_docs = 0
    failed_docs = []
    for doc in docs:
        if doc.get("type") == "contract":
            continue
        url = doc.get("url")
        if not url:
            continue
        fname = doc.get("filename") or doc.get("name") or "document"
        try:
            async with httpx.AsyncClient(timeout=60.0) as client_http:
                r = await client_http.get(url)
                if r.status_code != 200:
                    failed_docs.append(fname)
                    continue
                file_bytes = r.content
            res = await send_telegram_file(
                file_data=file_bytes,
                filename=fname,
                caption=doc.get("name") or fname,
                chat_id=cfg["chat_id"],
                bot_token=cfg["bot_token"],
                message_thread_id=topic_id,
            )
            if res.get("success"):
                sent_docs += 1
            else:
                failed_docs.append(fname)
        except Exception as e:
            logger.error(f"Failed to attach doc {fname} to topic: {e}")
            failed_docs.append(fname)

    # Keep the pinned group summary fresh
    await refresh_production_summary()

    return {
        "success": True,
        "isUpdate": is_update,
        "topicId": topic_id,
        "documentsSent": sent_docs,
        "documentsFailed": failed_docs,
        "message": ("Обновление отправлено в тему" if is_update else "Тема создана, заказ отправлен в производство"),
    }


# ============== LOW-LEVEL API HELPER ==============

async def _tg_call(method: str, payload: dict, bot_token: str) -> dict:
    """Raw Bot API call returning parsed JSON."""
    url = f"https://api.telegram.org/bot{bot_token}/{method}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload)
            return r.json()
    except Exception as e:
        logger.error(f"Telegram {method} failed: {e}")
        return {"ok": False, "error": str(e)}


# ============== FEATURE B: message from CRM card -> topic (logged) ==============

@router.post("/send-message/{order_id}")
async def send_message_to_topic(order_id: str, data: dict):
    """Send a free-text message from the CRM/production card into the order's
    Telegram topic AND log it on the order card (productionMessages).
    """
    text = (data.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Пустое сообщение")

    cfg = await _resolve_prod_config()
    if not cfg["bot_token"] or not cfg["chat_id"]:
        raise HTTPException(status_code=400, detail="Telegram производства не настроен")

    lead = await db.sauna_crm_leads.find_one({"id": order_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    topic_id = lead.get("telegram_topic_id")
    if not topic_id:
        raise HTTPException(status_code=400, detail="Тема ещё не создана — сначала нажмите «Отправить в Telegram»")

    author = (data.get("author") or "Менеджер").strip()
    tg_text = f"💬 <b>{author}:</b>\n{text}"
    sent = await send_telegram_message(text=tg_text, chat_id=cfg["chat_id"], bot_token=cfg["bot_token"], message_thread_id=topic_id)
    if not sent:
        raise HTTPException(status_code=502, detail="Не удалось отправить сообщение в Telegram")

    now = datetime.now(timezone.utc).isoformat()
    entry = {"text": text, "author": author, "at": now, "direction": "out", "channel": "telegram"}
    await db.sauna_crm_leads.update_one(
        {"id": order_id},
        {"$push": {"productionMessages": entry}, "$set": {"updatedAt": now}},
    )
    return {"success": True, "entry": entry}


# ============== FEATURE A: pinned production summary ==============

_SUMMARY_STAGES = [
    ("accepted", "⏳ В очереди"),
    ("in_production", "🏭 В производстве"),
    ("ready", "🛍 Готово к отгрузке"),
]


def _order_keyboard(order_id: str) -> dict:
    """Inline keyboard attached to a topic's start message."""
    return {
        "inline_keyboard": [
            [{"text": "✅ Принял в работу", "callback_data": f"ack:{order_id}"}],
            [
                {"text": "📅 Дата старта", "callback_data": f"set:startDate:{order_id}"},
                {"text": "🏭 Дата производства", "callback_data": f"set:prodDate:{order_id}"},
            ],
            [{"text": "💬 Комментарий", "callback_data": f"set:comment:{order_id}"}],
        ]
    }


async def refresh_production_summary():
    """(Re)build the pinned summary message in the group with live stage counts.
    Best-effort: never raises. Stores summary_message_id in settings doc.
    """
    try:
        cfg = await _resolve_prod_config()
        if not cfg["bot_token"] or not cfg["chat_id"]:
            return
        counts = {"accepted": 0, "in_production": 0, "ready": 0}
        total = 0
        unacked = 0
        async for l in db.sauna_crm_leads.find({"inProduction": True}, {"productionStageId": 1, "productionAckedAt": 1, "telegram_topic_id": 1}):
            sid = (l.get("productionStageId") or "accepted").lower()
            if sid in ("shipped", "delivered", "done"):
                continue
            counts[sid if sid in counts else "accepted"] += 1
            total += 1
            if l.get("telegram_topic_id") and not l.get("productionAckedAt"):
                unacked += 1

        lines = ["📊 <b>Сводка производства</b>", ""]
        for sid, label in _SUMMARY_STAGES:
            lines.append(f"{label}: <b>{counts[sid]}</b>")
        lines.append("")
        lines.append(f"Всего в работе: <b>{total}</b>")
        if unacked:
            lines.append(f"⚠️ Не подтверждено производством: <b>{unacked}</b>")
        lines.append(f"<i>обновлено {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M:%S')} UTC</i>")
        text = "\n".join(lines)

        doc = await db.telegram_production_settings.find_one({"_id": "config"}) or {}
        msg_id = doc.get("summary_message_id")

        edited = False
        if msg_id:
            r = await _tg_call("editMessageText", {
                "chat_id": cfg["chat_id"], "message_id": msg_id,
                "text": text, "parse_mode": "HTML",
            }, cfg["bot_token"])
            edited = bool(r.get("ok"))
            if not edited and "message to edit not found" not in str(r.get("description", "")).lower() and "not modified" in str(r.get("description", "")).lower():
                edited = True  # unchanged text counts as fine

        if not edited:
            r = await _tg_call("sendMessage", {
                "chat_id": cfg["chat_id"], "text": text, "parse_mode": "HTML",
            }, cfg["bot_token"])
            if r.get("ok"):
                new_id = r["result"]["message_id"]
                await _tg_call("pinChatMessage", {
                    "chat_id": cfg["chat_id"], "message_id": new_id, "disable_notification": True,
                }, cfg["bot_token"])
                await db.telegram_production_settings.update_one(
                    {"_id": "config"}, {"$set": {"summary_message_id": new_id}}, upsert=True)
    except Exception as e:
        logger.error(f"refresh_production_summary failed: {e}")


@router.post("/refresh-summary")
async def refresh_summary_endpoint():
    await refresh_production_summary()
    return {"success": True}




async def sync_topic_for_stage(order_id: str, stage_id: str, stage_name: str = ""):
    """Update the Telegram topic (name prefix + icon color) to reflect the
    production stage, and close it on the final stage. No-op if the order has
    no topic yet (i.e. "Отправить в Telegram" was never pressed). Best-effort:
    failures are logged, never raised.
    """
    try:
        cfg = await _resolve_prod_config()
        if not cfg["bot_token"] or not cfg["chat_id"]:
            return
        lead = await db.sauna_crm_leads.find_one({"id": order_id}, {"_id": 0})
        if not lead or not lead.get("telegram_topic_id"):
            return
        topic_id = lead["telegram_topic_id"]

        order = await _get_calc_order(lead)
        emoji, icon_emoji_id, is_final = _stage_visual(stage_id, stage_name)
        new_name = f"{emoji} {_base_topic_name(lead, order)}"

        await edit_forum_topic(message_thread_id=topic_id, name=new_name,
                               icon_custom_emoji_id=icon_emoji_id,
                               chat_id=cfg["chat_id"], bot_token=cfg["bot_token"])

        was_closed = bool(lead.get("telegram_topic_closed"))
        if is_final:
            if not was_closed:
                await close_forum_topic(message_thread_id=topic_id, chat_id=cfg["chat_id"], bot_token=cfg["bot_token"])
                await db.sauna_crm_leads.update_one({"id": order_id}, {"$set": {"telegram_topic_closed": True}})
        else:
            # Reopen only if it was actually closed (moved back from final)
            if was_closed:
                await reopen_forum_topic(message_thread_id=topic_id, chat_id=cfg["chat_id"], bot_token=cfg["bot_token"])
                await db.sauna_crm_leads.update_one({"id": order_id}, {"$set": {"telegram_topic_closed": False}})
    except Exception as e:
        logger.error(f"sync_topic_for_stage failed for {order_id}: {e}")



# ============== SETTINGS (DB-backed, editable via UI) ==============

@router.get("/settings")
async def get_prod_telegram_settings():
    """Return current production-Telegram config. Bot token is masked."""
    doc = await db.telegram_production_settings.find_one({"_id": "config"}, {"_id": 0})
    env = get_production_telegram_config()
    token = (doc or {}).get("bot_token") or ""
    chat_id = (doc or {}).get("chat_id") or ""
    enabled = (doc or {}).get("enabled", True)
    # env fallback (so UI shows "configured" even before first DB save)
    source = "db" if (doc and token) else ("env" if env.get("bot_token") else "none")
    if not token and env.get("bot_token"):
        chat_id = chat_id or env.get("chat_id", "")
    token_set = bool(token or env.get("bot_token"))
    return {
        "bot_token_set": token_set,
        "bot_token_masked": _MASK if token_set else "",
        "chat_id": chat_id,
        "enabled": enabled,
        "source": source,
    }


@router.post("/settings")
async def save_prod_telegram_settings(data: dict):
    """Save production-Telegram config to DB. Sending the mask keeps the token."""
    update = {}
    incoming_token = (data.get("bot_token") or "").strip()
    if incoming_token and incoming_token != _MASK:
        update["bot_token"] = incoming_token
    if "chat_id" in data:
        update["chat_id"] = (data.get("chat_id") or "").strip()
    if "enabled" in data:
        update["enabled"] = bool(data.get("enabled"))
    if not update:
        return {"status": "ok", "changed": False}
    update["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db.telegram_production_settings.update_one({"_id": "config"}, {"$set": update}, upsert=True)
    return {"status": "ok", "changed": True}


@router.post("/test")
async def test_prod_telegram():
    """Verify the production bot (getMe) and send a test message to the chat."""
    cfg = await _resolve_prod_config()
    if not cfg["bot_token"]:
        raise HTTPException(status_code=400, detail="Токен бота не задан")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            me = await client.get(f"https://api.telegram.org/bot{cfg['bot_token']}/getMe")
            mj = me.json()
            if not mj.get("ok"):
                return {"success": False, "error": "Неверный токен бота"}
            bot_info = mj.get("result", {})
            if not cfg["chat_id"]:
                return {"success": True, "bot_username": bot_info.get("username"), "warning": "chat_id не задан — тестовое сообщение не отправлено"}
            resp = await client.post(
                f"https://api.telegram.org/bot{cfg['bot_token']}/sendMessage",
                json={"chat_id": cfg["chat_id"], "text": "✅ Telegram производства подключён. Тестовое сообщение.", "parse_mode": "HTML"},
            )
            rj = resp.json()
            if rj.get("ok"):
                return {"success": True, "bot_username": bot_info.get("username")}
            return {"success": False, "error": rj.get("description", "Ошибка отправки"), "bot_username": bot_info.get("username")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============== FEATURE C: webhook (inline buttons -> back to card) ==============

def _actor_name(from_user: dict) -> str:
    if not from_user:
        return "Производство"
    name = (from_user.get("first_name", "") + " " + from_user.get("last_name", "")).strip()
    if from_user.get("username"):
        name = f"{name} (@{from_user['username']})" if name else f"@{from_user['username']}"
    return name or "Производство"


def _parse_date(text: str):
    """Accept DD.MM.YYYY (or DD.MM.YY / DD-MM-YYYY) -> ISO YYYY-MM-DD string."""
    import re
    t = (text or "").strip()
    m = re.match(r"^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$", t)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    try:
        return datetime(y, mo, d).strftime("%Y-%m-%d")
    except ValueError:
        return None


_FIELD_PROMPTS = {
    "startDate": ("plannedStartDate", "📅 Ответьте на это сообщение <b>планируемой датой старта</b> в формате ДД.ММ.ГГГГ", "date"),
    "prodDate": ("productionDate", "🏭 Ответьте на это сообщение <b>датой производства</b> в формате ДД.ММ.ГГГГ", "date"),
    "comment": ("productionComment", "💬 Ответьте на это сообщение <b>комментарием производства</b>", "text"),
}


async def _handle_callback(cbq: dict, cfg: dict):
    data = cbq.get("data", "")
    cbq_id = cbq.get("id")
    msg = cbq.get("message", {}) or {}
    chat_id = str((msg.get("chat") or {}).get("id", cfg["chat_id"]))
    thread_id = msg.get("message_thread_id")
    bot = cfg["bot_token"]

    async def answer(text, alert=False):
        await _tg_call("answerCallbackQuery", {"callback_query_id": cbq_id, "text": text, "show_alert": alert}, bot)

    if data.startswith("ack:"):
        order_id = data[4:]
        actor = _actor_name(cbq.get("from"))
        now = datetime.now(timezone.utc).isoformat()
        lead = await db.sauna_crm_leads.find_one({"id": order_id}, {"_id": 0, "productionAckedAt": 1})
        if lead and lead.get("productionAckedAt"):
            await answer("Уже подтверждено")
            return
        await db.sauna_crm_leads.update_one({"id": order_id}, {"$set": {
            "productionAckedBy": actor, "productionAckedAt": now, "updatedAt": now,
        }})
        await answer("Принято в работу ✅")
        ts = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M")
        await send_telegram_message(text=f"✅ <b>{actor}</b> принял заказ в работу ({ts} UTC)",
                                    chat_id=chat_id, bot_token=bot, message_thread_id=thread_id)
        await refresh_production_summary()
        return

    if data.startswith("set:"):
        try:
            _, field, order_id = data.split(":", 2)
        except ValueError:
            await answer("Ошибка")
            return
        if field not in _FIELD_PROMPTS:
            await answer("Неизвестное действие")
            return
        prompt = _FIELD_PROMPTS[field][1]
        r = await _tg_call("sendMessage", {
            "chat_id": chat_id, "message_thread_id": thread_id, "text": prompt, "parse_mode": "HTML",
            "reply_markup": {"force_reply": True, "input_field_placeholder": "ДД.ММ.ГГГГ или текст"},
        }, bot)
        if r.get("ok"):
            pmid = r["result"]["message_id"]
            await db.telegram_pending_inputs.update_one(
                {"_id": f"{chat_id}:{pmid}"},
                {"$set": {"order_id": order_id, "field": field, "chat_id": chat_id,
                          "prompt_message_id": pmid, "at": datetime.now(timezone.utc).isoformat()}},
                upsert=True)
        await answer("Ответьте на сообщение бота")
        return

    await answer("")


async def _handle_reply(message: dict, cfg: dict):
    reply_to = message.get("reply_to_message") or {}
    pmid = reply_to.get("message_id")
    chat_id = str((message.get("chat") or {}).get("id", ""))
    if not pmid:
        return
    pending = await db.telegram_pending_inputs.find_one({"_id": f"{chat_id}:{pmid}"})
    if not pending:
        return
    thread_id = message.get("message_thread_id")
    bot = cfg["bot_token"]
    order_id = pending["order_id"]
    field = pending["field"]
    text = (message.get("text") or "").strip()
    db_field, _prompt, kind = _FIELD_PROMPTS[field]
    actor = _actor_name(message.get("from"))
    now = datetime.now(timezone.utc).isoformat()

    if kind == "date":
        iso = _parse_date(text)
        if not iso:
            await send_telegram_message(text="⚠️ Не понял дату. Формат: ДД.ММ.ГГГГ", chat_id=chat_id, bot_token=bot, message_thread_id=thread_id)
            return
        await db.sauna_crm_leads.update_one({"id": order_id}, {"$set": {db_field: iso, "updatedAt": now}})
        human = datetime.strptime(iso, "%Y-%m-%d").strftime("%d.%m.%Y")
        label = "Планируемая дата старта" if field == "startDate" else "Дата производства"
        await send_telegram_message(text=f"✅ {label}: <b>{human}</b> (от {actor})", chat_id=chat_id, bot_token=bot, message_thread_id=thread_id)
    else:
        entry = {"text": text, "author": actor, "at": now, "direction": "in", "channel": "telegram"}
        await db.sauna_crm_leads.update_one({"id": order_id}, {
            "$set": {db_field: text, "updatedAt": now},
            "$push": {"productionMessages": entry},
        })
        await send_telegram_message(text=f"✅ Комментарий сохранён (от {actor})", chat_id=chat_id, bot_token=bot, message_thread_id=thread_id)

    await db.telegram_pending_inputs.delete_one({"_id": f"{chat_id}:{pmid}"})


@router.post("/webhook/{secret}")
async def telegram_webhook(secret: str, update: dict):
    """Receive updates from the production bot (callback buttons + replies)."""
    doc = await db.telegram_production_settings.find_one({"_id": "config"}, {"_id": 0, "webhook_secret": 1})
    if not doc or secret != doc.get("webhook_secret"):
        raise HTTPException(status_code=403, detail="bad secret")
    cfg = await _resolve_prod_config()
    if not cfg["bot_token"]:
        return {"ok": True}
    try:
        if "callback_query" in update:
            await _handle_callback(update["callback_query"], cfg)
        elif "message" in update and (update["message"].get("reply_to_message")):
            await _handle_reply(update["message"], cfg)
    except Exception as e:
        logger.error(f"webhook handler error: {e}")
    return {"ok": True}


@router.post("/enable-webhook")
async def enable_webhook():
    """Register the Telegram webhook for the production bot."""
    import secrets as _secrets
    cfg = await _resolve_prod_config()
    if not cfg["bot_token"]:
        raise HTTPException(status_code=400, detail="Токен бота не задан")
    base = (os.environ.get("API_BASE_URL") or "").rstrip("/")
    if not base:
        raise HTTPException(status_code=400, detail="API_BASE_URL не задан на сервере")
    secret = _secrets.token_urlsafe(24)
    hook_url = f"{base}/api/integrations/telegram/webhook/{secret}"
    r = await _tg_call("setWebhook", {
        "url": hook_url, "allowed_updates": ["callback_query", "message"], "drop_pending_updates": True,
    }, cfg["bot_token"])
    if not r.get("ok"):
        raise HTTPException(status_code=502, detail=f"setWebhook: {r.get('description', 'ошибка')}")
    await db.telegram_production_settings.update_one(
        {"_id": "config"}, {"$set": {"webhook_secret": secret, "webhook_enabled": True, "webhook_url": hook_url}}, upsert=True)
    return {"success": True, "url": hook_url}


@router.post("/disable-webhook")
async def disable_webhook():
    cfg = await _resolve_prod_config()
    if cfg["bot_token"]:
        await _tg_call("deleteWebhook", {"drop_pending_updates": False}, cfg["bot_token"])
    await db.telegram_production_settings.update_one({"_id": "config"}, {"$set": {"webhook_enabled": False}}, upsert=True)
    return {"success": True}


@router.get("/webhook-status")
async def webhook_status():
    doc = await db.telegram_production_settings.find_one({"_id": "config"}, {"_id": 0, "webhook_enabled": 1}) or {}
    return {"enabled": bool(doc.get("webhook_enabled"))}

