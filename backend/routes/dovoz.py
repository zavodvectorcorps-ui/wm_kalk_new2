"""Dovoz (additional deliveries) management routes for greenhouse orders."""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging
import httpx
import os

from database import db
from services.auth_service import get_current_user

router = APIRouter(prefix="/dovoz", tags=["Dovoz"])
logger = logging.getLogger(__name__)

# Collections (async motor)
dovoz_orders = db["dovoz_orders"]
dovoz_history = db["dovoz_history"]

# Dovoz stages (ordered: accepted → sent → with_driver → delivered)
DOVOZ_STAGES = {
    "accepted": "Довоз принят",
    "sent": "Довоз отправлен",
    "with_driver": "Отправлено с водителем",
    "delivered": "Довоз доставлен"
}


# amoCRM settings
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "wm_kalkulator")


def get_amocrm_settings():
    """Get amoCRM settings - uses sync pymongo for settings access."""
    from pymongo import MongoClient
    sync_client = MongoClient(MONGO_URL)
    sync_db = sync_client[DB_NAME]
    settings = sync_db["integration_settings"].find_one({"type": "amocrm"}, {"_id": 0})
    return settings or {}


def get_warehouse_settings():
    """Get warehouse settings - uses sync pymongo."""
    from pymongo import MongoClient
    sync_client = MongoClient(MONGO_URL)
    sync_db = sync_client[DB_NAME]
    settings = sync_db["warehouse_settings"].find_one({"type": "warehouse"}, {"_id": 0})
    if not settings:
        return {
            "type": "warehouse",
            "sections_enabled": {
                "orders": True,
                "trips": True,
                "dovoz": True
            },
            "dovoz_config": {
                "source_pipeline_id": "",
                "source_status_id": "",
                "sent_status_id": "",
                "delivered_status_id": ""
            }
        }
    return settings


def save_warehouse_settings(settings: dict):
    """Save warehouse settings - uses sync pymongo."""
    from pymongo import MongoClient
    sync_client = MongoClient(MONGO_URL)
    sync_db = sync_client[DB_NAME]
    sync_db["warehouse_settings"].update_one(
        {"type": "warehouse"},
        {"$set": settings},
        upsert=True
    )


def check_warehouse_access(user: dict):
    access = user.get("access", [])
    role = user.get("role", "")
    if role == "admin":
        return True
    if isinstance(access, str):
        return access in ["warehouse", "all"]
    return "warehouse" in access or "all" in access


# --- Settings endpoints ---

@router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return get_warehouse_settings()


@router.put("/settings")
async def update_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Только для администраторов")
    
    settings["type"] = "warehouse"
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    settings["updated_by"] = current_user.get("username", "unknown")
    
    save_warehouse_settings(settings)
    
    return {"success": True, "message": "Настройки сохранены"}


# --- Dovoz CRUD ---

@router.get("/orders")
async def get_dovoz_orders(
    stage: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа")
    
    query = {}
    if stage:
        query["dovozStage"] = stage
    
    orders = await dovoz_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    if search:
        search_lower = search.lower()
        orders = [
            o for o in orders
            if search_lower in o.get("client_name", "").lower()
            or search_lower in o.get("amocrm_id", "").lower()
            or search_lower in o.get("id", "").lower()
            or search_lower in o.get("lead_name", "").lower()
        ]
    
    # Group by stage
    by_stage = {s: [] for s in DOVOZ_STAGES}
    for o in orders:
        s = o.get("dovozStage", "accepted")
        if s in by_stage:
            by_stage[s].append(o)
    
    return {
        "orders": orders,
        "by_stage": by_stage,
        "total": len(orders),
        "stages": DOVOZ_STAGES
    }


@router.put("/orders/{order_id}/stage")
async def update_dovoz_stage(
    order_id: str,
    stage: str = Query(..., description="New stage: accepted, sent, delivered"),
    current_user: dict = Depends(get_current_user)
):
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа")
    
    if stage not in DOVOZ_STAGES:
        raise HTTPException(status_code=400, detail=f"Неверный этап. Допустимые: {list(DOVOZ_STAGES.keys())}")
    
    now = datetime.now(timezone.utc).isoformat()
    username = current_user.get("username", "unknown")
    
    order = await dovoz_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    old_stage = order.get("dovozStage", "accepted")
    
    # Update in DB
    await dovoz_orders.update_one(
        {"id": order_id},
        {"$set": {
            "dovozStage": stage,
            "dovoz_updated_at": now,
            "dovoz_updated_by": username
        }}
    )
    
    # Record history
    history_entry = {
        "id": str(uuid.uuid4()),
        "orderId": order_id,
        "amocrm_id": order.get("amocrm_id", ""),
        "oldStage": old_stage,
        "newStage": stage,
        "changedBy": username,
        "changedAt": now
    }
    await dovoz_history.insert_one(history_entry)
    
    # Sync to amoCRM if stage changed to sent or delivered
    amo_sync_result = None
    if stage in ("sent", "delivered"):
        amo_sync_result = await sync_stage_to_amocrm(order, stage)
    
    logger.info(f"Dovoz stage updated: order={order_id}, {old_stage} -> {stage}, by={username}")
    
    return {
        "success": True,
        "message": f"Этап изменён на '{DOVOZ_STAGES[stage]}'",
        "order_id": order_id,
        "old_stage": old_stage,
        "new_stage": stage,
        "amo_sync": amo_sync_result
    }


@router.get("/orders/{order_id}/history")
async def get_dovoz_history(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа")
    
    history = await dovoz_history.find(
        {"orderId": order_id}, {"_id": 0}
    ).sort("changedAt", -1).to_list(100)
    
    return {"order_id": order_id, "history": history}


@router.delete("/orders/{order_id}")
async def delete_dovoz_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Только для администраторов")
    
    result = await dovoz_orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    return {"success": True, "deleted": order_id}


# --- amoCRM Sync ---

async def sync_stage_to_amocrm(order: dict, stage: str) -> dict:
    """Update lead status in amoCRM when dovoz stage changes."""
    amo_settings = get_amocrm_settings()
    wh_settings = get_warehouse_settings()
    dovoz_config = wh_settings.get("dovoz_config", {})
    
    domain = amo_settings.get("amocrm_domain", "")
    token = amo_settings.get("amocrm_token", "")
    amocrm_id = order.get("amocrm_id", "")
    
    if not domain or not token or not amocrm_id:
        return {"status": "skipped", "reason": "amoCRM не настроен или нет amocrm_id"}
    
    # Determine target status_id. For multi-stage buckets (with_driver) we
    # push to the FIRST configured id by default — that's the most common
    # ("primary" driver). Admin can re-configure if needed.
    target_status_id = ""
    if stage == "sent":
        target_status_id = dovoz_config.get("sent_status_id", "")
    elif stage == "delivered":
        target_status_id = dovoz_config.get("delivered_status_id", "")
    elif stage == "with_driver":
        # New multi-stage bucket: list of driver-specific amoCRM statuses.
        ids = dovoz_config.get("with_driver_status_ids") or []
        if isinstance(ids, list) and ids:
            target_status_id = str(ids[0])
        else:
            # Backward-compat: also accept a single legacy id field if set.
            target_status_id = str(dovoz_config.get("with_driver_status_id", ""))
    
    if not target_status_id:
        return {"status": "skipped", "reason": f"Не настроен status_id для этапа '{stage}'"}
    
    # Get pipeline_id from config
    pipeline_id = dovoz_config.get("source_pipeline_id", "")
    if not pipeline_id:
        return {"status": "skipped", "reason": "Не настроен pipeline_id"}
    
    try:
        url = f"https://{domain}/api/v4/leads/{amocrm_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "pipeline_id": int(pipeline_id),
            "status_id": int(target_status_id)
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.patch(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                logger.info(f"amoCRM lead {amocrm_id} moved to status {target_status_id}")
                return {"status": "ok", "amocrm_id": amocrm_id, "new_status_id": target_status_id}
            else:
                logger.error(f"amoCRM sync error: {response.status_code} - {response.text}")
                return {"status": "error", "code": response.status_code, "detail": response.text[:200]}
    except Exception as e:
        logger.error(f"amoCRM sync failed: {e}")
        return {"status": "error", "detail": str(e)}


def _parse_amo_timestamp(ts) -> str:
    """Convert amoCRM unix timestamp to ISO date string."""
    if not ts:
        return ""
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except Exception:
        return ""


def _extract_debt(field_values_by_id: dict, dovoz_config: dict) -> float:
    """Extract debt amount from a configurable amoCRM field."""
    fid = str(dovoz_config.get("debt_field_id", "") or "")
    if fid and fid in field_values_by_id:
        try:
            return float(str(field_values_by_id[fid]).replace(",", ".").replace(" ", ""))
        except (ValueError, TypeError):
            pass
    return 0


def _extract_products(field_values_by_id: dict, field_all_values_by_id: dict, dovoz_config: dict) -> str:
    """Extract and merge products from two configurable amoCRM fields."""
    fid1 = str(dovoz_config.get("products_field_id_1", "") or "")
    fid2 = str(dovoz_config.get("products_field_id_2", "") or "")
    parts = []
    for fid in [fid1, fid2]:
        if fid:
            val = field_all_values_by_id.get(fid, "") or field_values_by_id.get(fid, "")
            val = val.strip()
            if val:
                parts.append(val)
    return "\n".join(parts)


@router.post("/sync-from-amocrm")
async def sync_from_amocrm(current_user: dict = Depends(get_current_user)):
    """Pull leads from configured amoCRM stages into Dovoz.

    Supports two kinds of stage mappings:
      * ``source_status_id`` (single) → import to ``accepted`` stage.
      * ``with_driver_status_ids`` (list of N stage ids, one per driver) →
        import to the new ``with_driver`` stage. Existing orders that have
        moved into a driver stage are updated (NOT re-inserted) so the card
        flips from "sent" / "accepted" into "with_driver" automatically.

    All configured stages are queried in a SINGLE amoCRM call using the
    ``filter[statuses][N]`` repeat-key syntax. We then decide each lead's
    bucket by comparing its current ``status_id`` against the config.
    """
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа")

    amo_settings = get_amocrm_settings()
    wh_settings = get_warehouse_settings()
    dovoz_config = wh_settings.get("dovoz_config", {})

    domain = amo_settings.get("amocrm_domain", "")
    token = amo_settings.get("amocrm_token", "")
    source_pipeline_id = dovoz_config.get("source_pipeline_id", "")
    source_status_id = str(dovoz_config.get("source_status_id", "") or "")
    with_driver_ids = [str(x) for x in (dovoz_config.get("with_driver_status_ids") or []) if str(x).strip()]

    if not domain or not token:
        raise HTTPException(status_code=400, detail="amoCRM не настроен. Укажите домен и токен в настройках интеграций.")

    if not source_pipeline_id or (not source_status_id and not with_driver_ids):
        raise HTTPException(
            status_code=400,
            detail="Не настроен ни source_status_id, ни with_driver_status_ids в настройках довоза.",
        )

    # Build amoCRM filter for ALL configured stages in one call.
    stage_ids_to_bucket: dict[str, str] = {}
    if source_status_id:
        stage_ids_to_bucket[source_status_id] = "accepted"
    for sid in with_driver_ids:
        stage_ids_to_bucket[sid] = "with_driver"

    try:
        headers_amo = {"Authorization": f"Bearer {token}"}
        url = f"https://{domain}/api/v4/leads"
        # amoCRM accepts repeating filter[statuses][N] params for OR-of-statuses.
        params = [
            ("limit", "250"),
            ("with", "contacts"),
        ]
        for idx, sid in enumerate(stage_ids_to_bucket.keys()):
            params.append((f"filter[statuses][{idx}][pipeline_id]", str(source_pipeline_id)))
            params.append((f"filter[statuses][{idx}][status_id]", sid))

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=headers_amo, params=params)

            if response.status_code == 204:
                return {"success": True, "imported": 0, "skipped": 0, "moved": 0, "message": "Нет лидов на настроенных этапах"}

            if response.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Ошибка amoCRM API: {response.status_code}")

            data = response.json()
            leads = data.get("_embedded", {}).get("leads", [])

        imported = 0
        skipped = 0
        moved = 0  # existing orders whose dovozStage was advanced this run
        now = datetime.now(timezone.utc).isoformat()
        
        # Fetch amoCRM users for responsible user names
        users_map = {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as cl:
                ur = await cl.get(f"https://{domain}/api/v4/users", headers=headers_amo)
                if ur.status_code == 200:
                    for u in ur.json().get("_embedded", {}).get("users", []):
                        users_map[u["id"]] = u.get("name", "")
        except Exception as e:
            logger.warning(f"Could not fetch amoCRM users: {e}")
        
        for lead in leads:
            lead_id = str(lead.get("id", ""))
            
            # Extract custom fields from lead
            custom_fields = lead.get("custom_fields_values", [])
            field_values_by_id = {}
            field_all_values_by_id = {}
            field_values_by_name = {}
            for field in custom_fields:
                fid = str(field.get("field_id", ""))
                fname = str(field.get("field_name", "")).lower()
                fcode = str(field.get("field_code", "")).lower()
                values = field.get("values", [])
                value = ""
                all_vals = []
                if isinstance(values, list) and values:
                    for v in values:
                        vv = v.get("value", "") if isinstance(v, dict) else str(v)
                        if vv:
                            all_vals.append(str(vv))
                    first_val = values[0]
                    value = first_val.get("value", "") if isinstance(first_val, dict) else str(first_val)
                if fid and value:
                    field_values_by_id[fid] = value
                if fid and all_vals:
                    field_all_values_by_id[fid] = "\n".join(all_vals)
                if fname and value:
                    field_values_by_name[fname] = value
                if fcode and value:
                    field_values_by_name[fcode] = value
            
            # Get field mapping from amoCRM settings for greenhouse
            field_mapping = amo_settings.get("field_mapping", {}).get("greenhouse", {})
            
            def get_field_val(mapping_key, keywords=None):
                if field_mapping.get(mapping_key):
                    val = field_values_by_id.get(field_mapping[mapping_key], "")
                    if val:
                        return val
                if keywords:
                    for name, val in field_values_by_name.items():
                        if any(kw in name for kw in keywords):
                            return val
                return ""
            
            # Extract address fields
            index_val = get_field_val("addressIndex", ["индекс", "postal", "zip", "kod"])
            city_val = get_field_val("addressCity", ["город", "city", "населенный пункт", "miasto"])
            street_val = get_field_val("addressStreet", ["улица", "street", "ул.", "adres", "адрес"])
            addr_parts = [p for p in [street_val, city_val, index_val] if p]
            full_address = ", ".join(addr_parts)
            
            # Extract contact info
            contacts = lead.get("_embedded", {}).get("contacts", [])
            contact_name = ""
            contact_phone = ""
            if contacts:
                contact_name = contacts[0].get("name", "")
            
            # Fetch contact details for phone
            if contacts and domain and token:
                try:
                    contact_id = contacts[0].get("id")
                    if contact_id:
                        contact_url = f"https://{domain}/api/v4/contacts/{contact_id}"
                        async with httpx.AsyncClient(timeout=10.0) as cl:
                            cr = await cl.get(contact_url, headers=headers_amo)
                            if cr.status_code == 200:
                                cd = cr.json()
                                for cf in cd.get("custom_fields_values", []):
                                    fc = cf.get("field_code", "")
                                    vals = cf.get("values", [])
                                    if fc == "PHONE" and vals:
                                        contact_phone = vals[0].get("value", "")
                                    # Also try to get address from contact if not found in lead
                                    if not full_address and fc == "ADDRESS" and vals:
                                        full_address = vals[0].get("value", "")
                except Exception:
                    pass
            
            # Also try phone from lead custom fields if not found in contact
            if not contact_phone:
                contact_phone = get_field_val("phoneNumber", ["телефон", "phone", "тел", "моб"])
            
            # Client name: custom field > contact name > lead name
            name_field_id = str(wh_settings.get("dovoz_config", {}).get("name_field_id", "") or "")
            custom_name = field_values_by_id.get(name_field_id, "").strip() if name_field_id else ""
            client_name = custom_name or contact_name or lead.get("name", "")
            
            dovoz_order = {
                "id": f"DOV-{lead_id}",
                "amocrm_id": lead_id,
                "lead_name": lead.get("name", ""),
                "client_name": client_name,
                "phone": contact_phone,
                "address": full_address,
                "address_street": street_val,
                "address_city": city_val,
                "address_index": index_val,
                "price": lead.get("price", 0),
                "products": _extract_products(field_values_by_id, field_all_values_by_id, wh_settings.get("dovoz_config", {})),
                "debt": _extract_debt(field_values_by_id, wh_settings.get("dovoz_config", {})),
                "deal_created_at": _parse_amo_timestamp(lead.get("created_at")),
                "responsible_user": users_map.get(lead.get("responsible_user_id"), ""),
                # Decide the Dovoz bucket from the lead's CURRENT amoCRM status.
                "dovozStage": stage_ids_to_bucket.get(str(lead.get("status_id", "")), "accepted"),
                "pipeline_id": str(lead.get("pipeline_id", "")),
                "status_id": str(lead.get("status_id", "")),
                "created_at": now,
                "synced_at": now,
                "synced_by": current_user.get("username", "unknown")
            }
            
            existing = await dovoz_orders.find_one({"amocrm_id": lead_id})
            if existing:
                # Refresh data + if lead moved into a different bucket (e.g.
                # was 'sent' but is now in driver's amoCRM stage), upgrade
                # the order's dovozStage too.
                update_fields = {
                    "lead_name": dovoz_order["lead_name"],
                    "client_name": dovoz_order["client_name"],
                    "phone": dovoz_order["phone"],
                    "address": dovoz_order["address"],
                    "address_street": dovoz_order["address_street"],
                    "address_city": dovoz_order["address_city"],
                    "address_index": dovoz_order["address_index"],
                    "price": dovoz_order["price"],
                    "products": dovoz_order["products"],
                    "debt": dovoz_order["debt"],
                    "deal_created_at": dovoz_order["deal_created_at"],
                    "responsible_user": dovoz_order["responsible_user"],
                    "status_id": dovoz_order["status_id"],
                    "synced_at": now,
                }
                new_bucket = dovoz_order["dovozStage"]
                old_bucket = existing.get("dovozStage", "accepted")
                bucket_changed = (
                    new_bucket != old_bucket
                    # Don't undo a manual progression: never demote from
                    # delivered → with_driver/sent/accepted just because the
                    # sync sees an earlier status. Only advance.
                    and not (old_bucket == "delivered")
                )
                if bucket_changed:
                    update_fields["dovozStage"] = new_bucket
                    moved += 1
                await dovoz_orders.update_one({"amocrm_id": lead_id}, {"$set": update_fields})
                if not bucket_changed:
                    skipped += 1
                continue
            
            await dovoz_orders.insert_one(dovoz_order)
            imported += 1
        
        logger.info(f"Dovoz sync: imported={imported}, skipped={skipped}, moved={moved}")
        
        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "moved": moved,
            "total_on_stage": len(leads),
            "message": f"Импортировано: {imported}, обновлено этапов: {moved}, без изменений: {skipped}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dovoz sync from amoCRM failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_dovoz_stats(current_user: dict = Depends(get_current_user)):
    if not check_warehouse_access(current_user):
        raise HTTPException(status_code=403, detail="Нет доступа")
    
    stats = {}
    for stage_key in DOVOZ_STAGES:
        count = await dovoz_orders.count_documents({"dovozStage": stage_key})
        stats[stage_key] = count
    
    total = sum(stats.values())
    
    return {"by_stage": stats, "total": total, "stages": DOVOZ_STAGES}
