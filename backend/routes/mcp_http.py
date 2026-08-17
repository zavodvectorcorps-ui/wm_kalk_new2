"""Remote MCP server (Streamable HTTP) mounted inside the FastAPI backend.

Exposes the same AI surface as /api/ai as MCP tools so claude.ai can connect it
as a *custom / remote connector* (also usable in Cowork). Framework-native
(no fastmcp) to stay compatible with the pinned starlette.

Auth model (kept deliberately simple and claude.ai-compatible):
  * The public /api/mcp endpoint is protected by a dedicated bearer token
    (env MCP_BEARER_TOKEN). In claude.ai you add a Request header
    `Authorization: Bearer <MCP_BEARER_TOKEN>`.
  * The INTERNAL AI_AGENT_SERVICE_KEY never leaves the server: MCP tool calls
    are forwarded server-side to the existing /api/ai/* endpoints with that key.
  * OAuth discovery metadata is served so a future upgrade to OAuth DCR is easy;
    for now the 401 challenge advertises the resource metadata.

Two-step writes, `total` immutability, forward-only changes and the 15-minute
diff token all stay in the /api/ai layer — unchanged.
"""
from __future__ import annotations

import os
import hmac
from copy import deepcopy
from uuid import uuid4

import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

router = APIRouter()

PROTOCOL = "2025-11-25"
SUPPORTED_PROTOCOLS = {"2025-03-26", "2025-06-18", "2025-11-25"}
_INTERNAL_BASE = "http://127.0.0.1:8001"

# in-memory sessions (single worker). Fine for a single-user connector.
_sessions: dict[str, dict] = {}


def _mcp_token() -> str:
    return os.environ.get("MCP_BEARER_TOKEN", "")


def _service_key() -> str:
    return os.environ.get("AI_AGENT_SERVICE_KEY", "")


def _public_base(request: Request) -> str:
    # Prefer forwarded host (ingress) so discovery URLs are the public ones.
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    return f"{proto}://{host}"


# ---- tool registry: name -> (http method, /api/ai path template, description, schema)
def _obj(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or []}


TOOLS: list[dict] = [
    {"name": "get_context", "method": "GET", "path": "/api/ai/context",
     "description": "Обзор сервиса, возможности, правила и счётчики. Вызови первым.",
     "inputSchema": _obj({})},
    {"name": "list_orders", "method": "GET", "path": "/api/ai/orders",
     "description": "Список заказов (light). Фильтры: status, manager, limit.",
     "inputSchema": _obj({"status": {"type": "string"}, "manager": {"type": "string"},
                          "limit": {"type": "integer", "minimum": 1, "maximum": 500}})},
    {"name": "get_order", "method": "GET", "path": "/api/ai/orders/{order_id}",
     "description": "Полный заказ по id (себестоимость, маржа, состав).",
     "inputSchema": _obj({"order_id": {"type": "string"}}, ["order_id"])},
    {"name": "get_pricing", "method": "GET", "path": "/api/ai/pricing",
     "description": "Конфигурация цен/себестоимости калькулятора (только чтение).",
     "inputSchema": _obj({})},
    {"name": "list_tech_cards", "method": "GET", "path": "/api/ai/tech-cards",
     "description": "Список техкарт (BOM).", "inputSchema": _obj({})},
    {"name": "get_tech_card", "method": "GET", "path": "/api/ai/tech-cards/{card_id}",
     "description": "Техкарта по id.", "inputSchema": _obj({"card_id": {"type": "string"}}, ["card_id"])},
    {"name": "list_components", "method": "GET", "path": "/api/ai/components",
     "description": "Комплектующие/материалы с закупочной ценой.", "inputSchema": _obj({})},
    {"name": "list_procurement", "method": "GET", "path": "/api/ai/procurement/requests",
     "description": "Заявки на закупку.", "inputSchema": _obj({})},
    {"name": "get_audit", "method": "GET", "path": "/api/ai/audit",
     "description": "Журнал действий AI-агента.",
     "inputSchema": _obj({"limit": {"type": "integer", "minimum": 1, "maximum": 500}})},
    # ---- two-step writes ----
    {"name": "order_update_preview", "method": "POST", "path": "/api/ai/orders/{order_id}/update/preview",
     "description": "ШАГ 1. Превью изменения заказа. field = status|comment|assignee. Вернёт diff и token.",
     "inputSchema": _obj({"order_id": {"type": "string"}, "field": {"type": "string"},
                          "value": {"type": "string"}}, ["order_id", "field", "value"]),
     "body": ["field", "value"]},
    {"name": "order_update_apply", "method": "POST", "path": "/api/ai/orders/{order_id}/update/apply",
     "description": "ШАГ 2. Применить изменение заказа по token из шага 1.",
     "inputSchema": _obj({"order_id": {"type": "string"}, "token": {"type": "string"}}, ["order_id", "token"]),
     "body": ["token"]},
    {"name": "order_recalculate_preview", "method": "POST", "path": "/api/ai/orders/{order_id}/recalculate/preview",
     "description": "ШАГ 1. Превью пересчёта себестоимости/маржи. Цена клиента (total) не меняется.",
     "inputSchema": _obj({"order_id": {"type": "string"}}, ["order_id"])},
    {"name": "order_recalculate_apply", "method": "POST", "path": "/api/ai/orders/{order_id}/recalculate/apply",
     "description": "ШАГ 2. Применить пересчёт (только totalCost и margin).",
     "inputSchema": _obj({"order_id": {"type": "string"}, "token": {"type": "string"}}, ["order_id", "token"]),
     "body": ["token"]},
    {"name": "component_price_preview", "method": "POST", "path": "/api/ai/components/{component_id}/purchase-price/preview",
     "description": "ШАГ 1. Превью смены закупочной цены (только вперёд). Вернёт diff, число техкарт и token.",
     "inputSchema": _obj({"component_id": {"type": "string"}, "unitPrice": {"type": "number"}},
                         ["component_id", "unitPrice"]),
     "body": ["unitPrice"]},
    {"name": "component_price_apply", "method": "POST", "path": "/api/ai/components/{component_id}/purchase-price/apply",
     "description": "ШАГ 2. Применить смену закупочной цены и пересчитать техкарты.",
     "inputSchema": _obj({"component_id": {"type": "string"}, "token": {"type": "string"}},
                         ["component_id", "token"]),
     "body": ["token"]},
    {"name": "techcard_update_preview", "method": "POST", "path": "/api/ai/tech-cards/{card_id}/update/preview",
     "description": "ШАГ 1. Превью правки техкарты (items и/или note). Только вперёд.",
     "inputSchema": _obj({"card_id": {"type": "string"}, "items": {"type": "array"}, "note": {"type": "string"}},
                         ["card_id"]),
     "body": ["items", "note"]},
    {"name": "techcard_update_apply", "method": "POST", "path": "/api/ai/tech-cards/{card_id}/update/apply",
     "description": "ШАГ 2. Применить правку техкарты и пересчитать её стоимость.",
     "inputSchema": _obj({"card_id": {"type": "string"}, "token": {"type": "string"}}, ["card_id", "token"]),
     "body": ["token"]},
]

_TOOLS_BY_NAME = {t["name"]: t for t in TOOLS}


def _public_tools() -> list[dict]:
    """Tool list without internal routing fields."""
    out = []
    for t in TOOLS:
        out.append({"name": t["name"], "description": t["description"],
                    "inputSchema": deepcopy(t["inputSchema"])})
    return out


def _rpc_result(rid, result):
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _rpc_error(rid, code, message):
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}}


def _authed(request: Request) -> bool:
    expected = _mcp_token()
    if not expected:
        return False
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return False
    return hmac.compare_digest(auth.split(" ", 1)[1].strip(), expected)


def _unauth_response(request: Request) -> JSONResponse:
    base = _public_base(request)
    meta = f'{base}/.well-known/oauth-protected-resource'
    return JSONResponse(
        _rpc_error(None, -32001, "Unauthorized"), status_code=401,
        headers={"WWW-Authenticate":
                 f'Bearer realm="mcp", resource_metadata="{meta}"'},
    )


async def _forward(tool: dict, args: dict) -> dict:
    """Call the existing /api/ai endpoint server-side with the hidden key."""
    path = tool["path"]
    for key in list(args.keys()):
        ph = "{" + key + "}"
        if ph in path:
            path = path.replace(ph, str(args[key]))
    url = _INTERNAL_BASE + path
    headers = {"X-AI-Agent-Key": _service_key(), "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=60) as c:
        if tool["method"] == "GET":
            params = {k: v for k, v in args.items() if "{" + k + "}" not in tool["path"]}
            r = await c.get(url, headers=headers, params=params)
        else:
            body = {k: args[k] for k in tool.get("body", []) if k in args and args[k] is not None}
            r = await c.post(url, headers=headers, json=body)
    try:
        data = r.json()
    except Exception:
        data = {"error": r.text}
    if r.status_code >= 400:
        return {"_http_error": r.status_code, "detail": data}
    return data


# ---- discovery (helps future OAuth upgrade; harmless now) -------------------
@router.get("/.well-known/oauth-protected-resource")
async def protected_resource_metadata(request: Request):
    base = _public_base(request)
    return {"resource": f"{base}/api/mcp", "authorization_servers": [base],
            "scopes_supported": ["mcp:use"]}


# ---- Streamable HTTP endpoint ----------------------------------------------
@router.post("/api/mcp")
async def mcp_post(request: Request):
    if not _authed(request):
        return _unauth_response(request)

    version = request.headers.get("mcp-protocol-version")
    if version and version not in SUPPORTED_PROTOCOLS:
        return JSONResponse(_rpc_error(None, -32602, "Unsupported protocol version"), status_code=400)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse(_rpc_error(None, -32700, "Parse error"), status_code=400)

    method = body.get("method")
    rid = body.get("id")
    params = body.get("params") or {}

    if method == "initialize":
        sid = str(uuid4())
        _sessions[sid] = {"initialized": False}
        result = {"protocolVersion": version if version in SUPPORTED_PROTOCOLS else PROTOCOL,
                  "capabilities": {"tools": {"listChanged": False}},
                  "serverInfo": {"name": "alicor-spa", "version": "1.0.0"}}
        return JSONResponse(_rpc_result(rid, result), headers={"Mcp-Session-Id": sid})

    sid = request.headers.get("mcp-session-id")
    if not sid or sid not in _sessions:
        # tolerate clients that skip session tracking: create one lazily
        if method in ("tools/list", "tools/call", "ping"):
            sid = sid or str(uuid4())
            _sessions.setdefault(sid, {"initialized": True})
        else:
            return JSONResponse(_rpc_error(rid, -32000, "Valid MCP session required"), status_code=400)

    if method == "notifications/initialized":
        _sessions[sid]["initialized"] = True
        return Response(status_code=202)

    if method == "ping":
        return JSONResponse(_rpc_result(rid, {}), headers={"Mcp-Session-Id": sid})

    if method == "tools/list":
        return JSONResponse(_rpc_result(rid, {"tools": _public_tools()}),
                            headers={"Mcp-Session-Id": sid})

    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        tool = _TOOLS_BY_NAME.get(name)
        if not tool:
            return JSONResponse(_rpc_error(rid, -32602, f"Unknown tool: {name}"), status_code=400)
        try:
            value = await _forward(tool, args)
            is_error = isinstance(value, dict) and "_http_error" in value
            import json as _json
            text = _json.dumps(value, ensure_ascii=False)[:150000]
            result = {"content": [{"type": "text", "text": text}], "isError": is_error}
        except Exception as exc:
            result = {"content": [{"type": "text", "text": f"Tool failed: {exc}"}], "isError": True}
        return JSONResponse(_rpc_result(rid, result), headers={"Mcp-Session-Id": sid})

    return JSONResponse(_rpc_error(rid, -32601, "Method not found"), status_code=404)


@router.delete("/api/mcp")
async def mcp_delete(request: Request):
    if not _authed(request):
        return _unauth_response(request)
    sid = request.headers.get("mcp-session-id")
    if sid:
        _sessions.pop(sid, None)
    return Response(status_code=204)
