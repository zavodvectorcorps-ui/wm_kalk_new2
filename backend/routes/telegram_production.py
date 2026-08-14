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

from database import db
from services.telegram_service import (
    create_forum_topic,
    send_telegram_message,
    send_telegram_file,
    get_production_telegram_config,
)

router = APIRouter(prefix="/api/integrations/telegram", tags=["telegram-production"])
logger = logging.getLogger(__name__)


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
    cfg = get_production_telegram_config()
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
        client = lead.get("clientName") or "—"
        model = lead.get("modelName") or lead.get("field_1") or (order or {}).get("modelName") or "—"
        topic_name = f"#{order_id} {client} — {model}"
        created = await create_forum_topic(name=topic_name)
        if not created.get("success"):
            raise HTTPException(status_code=502, detail=f"Не удалось создать тему в Telegram: {created.get('error')}")
        topic_id = created["message_thread_id"]
        await db.sauna_crm_leads.update_one(
            {"id": order_id},
            {"$set": {"telegram_topic_id": topic_id, "updatedAt": datetime.now(timezone.utc).isoformat()}},
        )

    # Post the message
    message = _build_message(lead, order, is_update)
    sent = await send_telegram_message(
        text=message,
        chat_id=cfg["chat_id"],
        bot_token=cfg["bot_token"],
        message_thread_id=topic_id,
    )
    if not sent:
        # Topic may have been manually deleted in Telegram — surface it, don't swallow.
        if is_update:
            raise HTTPException(
                status_code=502,
                detail="Не удалось отправить в тему. Возможно, тема была удалена в Telegram. Обратитесь к администратору для пересоздания.",
            )
        raise HTTPException(status_code=502, detail="Тема создана, но сообщение отправить не удалось.")

    # Attach all documents to the topic
    docs = lead.get("documents") or []
    sent_docs = 0
    failed_docs = []
    for doc in docs:
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

    return {
        "success": True,
        "isUpdate": is_update,
        "topicId": topic_id,
        "documentsSent": sent_docs,
        "documentsFailed": failed_docs,
        "message": ("Обновление отправлено в тему" if is_update else "Тема создана, заказ отправлен в производство"),
    }
