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
import time
import json as _json
import base64
import hashlib
import secrets
from copy import deepcopy
from uuid import uuid4
from datetime import datetime, timezone, timedelta

import jwt
import httpx
from fastapi import APIRouter, Request, Response, Form
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse

from config import JWT_SECRET, JWT_ALGORITHM
from database import db

router = APIRouter()

PROTOCOL = "2025-11-25"
SUPPORTED_PROTOCOLS = {"2025-03-26", "2025-06-18", "2025-11-25"}
_INTERNAL_BASE = "http://127.0.0.1:8001"

# in-memory sessions (single worker). Fine for a single-user connector.
_sessions: dict[str, dict] = {}


def _mcp_token() -> str:
    return os.environ.get("MCP_BEARER_TOKEN", "")


def _oauth_password() -> str:
    return os.environ.get("MCP_OAUTH_PASSWORD", "")


def _issuer(request: Request) -> str:
    return f"{_public_base(request)}/api/mcp"


def _resource(request: Request) -> str:
    return f"{_public_base(request)}/api/mcp"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _make_access_token(request: Request, subject: str = "maxim") -> dict:
    now = datetime.now(timezone.utc)
    payload = {
        "typ": "mcp_access", "sub": subject, "scope": "mcp:use",
        "aud": _resource(request), "iss": _public_base(request),
        "iat": now, "exp": now + timedelta(hours=8),
    }
    at = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    rp = {"typ": "mcp_refresh", "sub": subject, "iat": now, "exp": now + timedelta(days=30)}
    rt = jwt.encode(rp, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {"access_token": at, "refresh_token": rt, "token_type": "Bearer",
            "expires_in": 8 * 3600, "scope": "mcp:use"}


def _valid_oauth_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM],
                             options={"verify_aud": False})
    except jwt.InvalidTokenError:
        return False
    return payload.get("typ") == "mcp_access" and "mcp:use" in str(payload.get("scope", ""))


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
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return False
    token = auth.split(" ", 1)[1].strip()
    expected = _mcp_token()
    # 1) static connector token (beta header method), 2) OAuth access token
    if expected and hmac.compare_digest(token, expected):
        return True
    return _valid_oauth_token(token)


def _unauth_response(request: Request) -> JSONResponse:
    meta = f'{_public_base(request)}/api/mcp/.well-known/oauth-protected-resource'
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


# ---- OAuth 2.1 discovery + endpoints (all under /api so ingress routes here) ----
@router.get("/api/mcp/.well-known/oauth-protected-resource")
async def protected_resource_metadata(request: Request):
    base = _public_base(request)
    return {"resource": _resource(request), "authorization_servers": [f"{base}/api/mcp"],
            "scopes_supported": ["mcp:use"],
            "bearer_methods_supported": ["header"]}


@router.get("/api/mcp/.well-known/oauth-authorization-server")
async def authorization_server_metadata(request: Request):
    iss = _issuer(request)
    return {
        "issuer": iss,
        "authorization_endpoint": f"{iss}/oauth/authorize",
        "token_endpoint": f"{iss}/oauth/token",
        "registration_endpoint": f"{iss}/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["mcp:use"],
    }


@router.post("/api/mcp/oauth/register")
async def oauth_register(request: Request):
    """Dynamic Client Registration (RFC 7591) — public client, no secret."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    client_id = "mcp-" + secrets.token_urlsafe(16)
    redirect_uris = body.get("redirect_uris") or []
    await db.mcp_oauth_clients.insert_one({
        "client_id": client_id,
        "redirect_uris": redirect_uris,
        "client_name": body.get("client_name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    resp = {
        "client_id": client_id,
        "redirect_uris": redirect_uris,
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
    }
    return JSONResponse(resp, status_code=201)


def _authorize_form(request: Request, params: dict, error: str = "") -> HTMLResponse:
    iss = _issuer(request)
    hidden = "".join(
        f'<input type="hidden" name="{k}" value="{(v or "").replace(chr(34), "&quot;")}">'
        for k, v in params.items()
    )
    err = f'<p style="color:#dc2626;margin:0 0 12px">{error}</p>' if error else ""
    html = f"""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alicor SPA — доступ для Claude</title></head>
<body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<form method="post" action="{iss}/oauth/authorize"
 style="background:#1e293b;padding:32px;border-radius:16px;max-width:360px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.4)">
<h2 style="margin:0 0 6px">Alicor SPA</h2>
<p style="margin:0 0 20px;color:#94a3b8;font-size:14px">Разрешить доступ Claude к производству/калькулятору</p>
{err}
<label style="font-size:13px;color:#cbd5e1">Пароль доступа</label>
<input name="password" type="password" autofocus required
 style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0 20px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0">
{hidden}
<button type="submit"
 style="width:100%;padding:12px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-size:15px;cursor:pointer">Разрешить</button>
</form></body></html>"""
    return HTMLResponse(html)


@router.get("/api/mcp/oauth/authorize")
async def oauth_authorize_get(request: Request):
    q = dict(request.query_params)
    if q.get("response_type") != "code":
        return JSONResponse({"error": "unsupported_response_type"}, status_code=400)
    if q.get("code_challenge_method") != "S256" or not q.get("code_challenge"):
        return JSONResponse({"error": "invalid_request", "error_description": "PKCE S256 required"}, status_code=400)
    keep = {k: q.get(k, "") for k in
            ["client_id", "redirect_uri", "state", "code_challenge",
             "code_challenge_method", "scope", "resource"]}
    return _authorize_form(request, keep)


@router.post("/api/mcp/oauth/authorize")
async def oauth_authorize_post(
    request: Request,
    password: str = Form(""),
    client_id: str = Form(""),
    redirect_uri: str = Form(""),
    state: str = Form(""),
    code_challenge: str = Form(""),
    code_challenge_method: str = Form(""),
    scope: str = Form(""),
    resource: str = Form(""),
):
    params = {"client_id": client_id, "redirect_uri": redirect_uri, "state": state,
              "code_challenge": code_challenge, "code_challenge_method": code_challenge_method,
              "scope": scope, "resource": resource}
    expected = _oauth_password()
    if not expected or not hmac.compare_digest(password, expected):
        return _authorize_form(request, params, error="Неверный пароль")
    if not redirect_uri.startswith("https://"):
        return JSONResponse({"error": "invalid_request", "error_description": "redirect_uri must be https"}, status_code=400)
    code = secrets.token_urlsafe(32)
    await db.mcp_oauth_codes.insert_one({
        "code": code, "redirect_uri": redirect_uri,
        "code_challenge": code_challenge, "resource": resource or _resource(request),
        "client_id": client_id, "used": False,
        "exp": time.time() + 300,
    })
    sep = "&" if "?" in redirect_uri else "?"
    url = f"{redirect_uri}{sep}code={code}"
    if state:
        url += f"&state={state}"
    return RedirectResponse(url, status_code=302)


@router.post("/api/mcp/oauth/token")
async def oauth_token(request: Request):
    form = await request.form()
    grant = form.get("grant_type")
    if grant == "refresh_token":
        rt = form.get("refresh_token", "")
        try:
            payload = jwt.decode(rt, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            assert payload.get("typ") == "mcp_refresh"
        except Exception:
            return JSONResponse({"error": "invalid_grant"}, status_code=400)
        return JSONResponse(_make_access_token(request, payload.get("sub", "maxim")))

    if grant != "authorization_code":
        return JSONResponse({"error": "unsupported_grant_type"}, status_code=400)

    code = form.get("code", "")
    verifier = form.get("code_verifier", "")
    redirect_uri = form.get("redirect_uri", "")
    doc = await db.mcp_oauth_codes.find_one({"code": code})
    if not doc or doc.get("used") or doc.get("exp", 0) < time.time():
        return JSONResponse({"error": "invalid_grant"}, status_code=400)
    if doc.get("redirect_uri") != redirect_uri:
        return JSONResponse({"error": "invalid_grant", "error_description": "redirect_uri mismatch"}, status_code=400)
    # PKCE S256 verification
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    if not hmac.compare_digest(challenge, doc.get("code_challenge", "")):
        return JSONResponse({"error": "invalid_grant", "error_description": "PKCE failed"}, status_code=400)
    await db.mcp_oauth_codes.update_one({"code": code}, {"$set": {"used": True}})
    return JSONResponse(_make_access_token(request))


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
