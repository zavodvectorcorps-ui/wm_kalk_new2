"""AI-agent service authentication, per-scope authorization, audit log and
two-step (preview -> apply) diff tokens.

Design (see integration playbook):
  * A single high-entropy opaque service key (AI_AGENT_SERVICE_KEY, env only)
    authenticates the machine principal `ai_agent` (Claude / MCP connector,
    operated by Максим).
  * The same /api/ai endpoints also accept a human ADMIN JWT so Максим can test
    from the app. Non-admin humans are rejected.
  * Writes never happen in one blind call: an endpoint returns a signed diff
    token (what-was / what-will-be); a separate /apply call with that token
    performs the change and writes an audit record.
"""
from __future__ import annotations

import os
import hmac
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import jwt
from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials

from config import JWT_SECRET, JWT_ALGORITHM
from database import db

# ---- scopes -----------------------------------------------------------------
READ_ANY = "read:any"
AI_AGENT_SCOPES = {
    READ_ANY,
    "orders:write",            # status / comment / assignee
    "tech_cards:write",
    "procurement:write",       # components + purchase price
    "orders:recalculate",      # cost/margin only (never client price)
}

_bearer = HTTPBearer(auto_error=False)
_ai_header = APIKeyHeader(name="X-AI-Agent-Key", auto_error=False,
                          description="Internal service credential; never send from a browser.")


def _service_key() -> str:
    return os.environ.get("AI_AGENT_SERVICE_KEY", "")


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Not authenticated",
                         headers={"WWW-Authenticate": "Bearer"})


def _service_principal(candidate: Optional[str]) -> Optional[dict]:
    expected = _service_key()
    if not candidate or not expected:
        return None
    if hmac.compare_digest(candidate, expected):
        return {
            "role": "ai_agent",
            "initiator": "maxim_via_claude",
            "is_service": True,
            "scopes": set(AI_AGENT_SCOPES),
        }
    return None


def _human_admin_principal(token: str) -> Optional[dict]:
    """Accept an existing human ADMIN JWT (so Максим can call /api/ai from the app)."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    if payload.get("role") not in ("admin", "super-admin"):
        return None
    return {
        "role": payload.get("role"),
        "initiator": f"human:{payload.get('username', payload.get('sub'))}",
        "is_service": False,
        "scopes": set(AI_AGENT_SCOPES),  # admins get the same surface
        "user_id": payload.get("sub"),
    }


async def get_ai_principal(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    header_key: Optional[str] = Depends(_ai_header),
) -> dict:
    # 1) explicit service header
    p = _service_principal(header_key)
    if p:
        return p
    bearer_token = credentials.credentials if (credentials and credentials.scheme.lower() == "bearer") else None
    if bearer_token:
        # 2) Bearer service key (for connectors that only support Authorization)
        p = _service_principal(bearer_token)
        if p:
            return p
        # 3) human admin JWT
        p = _human_admin_principal(bearer_token)
        if p:
            return p
    raise _unauthorized()


def require_scope(*required: str):
    async def dep(principal: dict = Security(get_ai_principal)) -> dict:
        if not set(required).issubset(set(principal.get("scopes", ()))):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return principal
    return dep


# ---- audit ------------------------------------------------------------------
async def log_ai_action(principal: dict, action: str, target_type: str,
                        target_id: Optional[str], before: Any = None,
                        after: Any = None, extra: Optional[dict] = None) -> None:
    """Persist every ai_agent action: who / what / when / what was affected."""
    try:
        await db.ai_agent_audit.insert_one({
            "id": str(uuid.uuid4()),
            "at": datetime.now(timezone.utc).isoformat(),
            "initiator": principal.get("initiator"),
            "role": principal.get("role"),
            "is_service": principal.get("is_service", False),
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "before": before,
            "after": after,
            "extra": extra or {},
        })
    except Exception:
        # Audit must never break the operation, but we do want a trace in logs.
        import logging
        logging.getLogger(__name__).exception("ai_agent_audit write failed")


# ---- two-step diff tokens ---------------------------------------------------
_DIFF_TTL_MIN = 15


def make_diff_token(op: str, target_type: str, target_id: str, changes: dict,
                    meta: Optional[dict] = None) -> str:
    """Sign the previewed change so /apply can only apply what was shown."""
    payload = {
        "typ": "ai_diff",
        "op": op,
        "target_type": target_type,
        "target_id": target_id,
        "changes": changes,          # {field: {"before":..., "after":...}}
        "meta": meta or {},
        "nonce": uuid.uuid4().hex,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_DIFF_TTL_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_diff_token(token: str, expected_op: Optional[str] = None) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Diff token expired — request a fresh preview")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid diff token")
    if payload.get("typ") != "ai_diff":
        raise HTTPException(status_code=400, detail="Not a diff token")
    if expected_op and payload.get("op") != expected_op:
        raise HTTPException(status_code=400, detail="Diff token op mismatch")
    return payload
