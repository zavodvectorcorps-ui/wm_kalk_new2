"""Alicor SPA — MCP server (connector for Claude).

Exposes the backend `/api/ai/*` surface as MCP tools. Runs as a local stdio
server (Claude Desktop) or can be adapted to HTTP transport.

Auth & config come from the environment (never hardcode):
  ALICOR_API_BASE   e.g. https://spa-planner-replaced-1767401260.emergent.host
  ALICOR_AI_KEY     the AI_AGENT_SERVICE_KEY value from the backend .env / secrets

Every WRITE is two-step: call the *_preview tool, show the returned diff to the
user for confirmation, then call the matching *_apply tool with the token.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from fastmcp import FastMCP

API_BASE = os.environ.get("ALICOR_API_BASE", "").rstrip("/")
API_KEY = os.environ.get("ALICOR_AI_KEY", "")

if not API_BASE or not API_KEY:
    raise SystemExit("Set ALICOR_API_BASE and ALICOR_AI_KEY environment variables.")

mcp = FastMCP("Alicor SPA")

_headers = {"X-AI-Agent-Key": API_KEY, "Content-Type": "application/json"}


async def _get(path: str, params: Optional[dict] = None) -> dict:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(f"{API_BASE}/api/ai{path}", headers=_headers, params=params)
        r.raise_for_status()
        return r.json()


async def _post(path: str, body: Optional[dict] = None) -> dict:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{API_BASE}/api/ai{path}", headers=_headers, json=body or {})
        r.raise_for_status()
        return r.json()


# ------------------------------- READ ---------------------------------------
@mcp.tool
async def get_context() -> dict:
    """Orientation: what the service is, capabilities, rules, and record counts.
    Call this first to understand the system."""
    return await _get("/context")


@mcp.tool
async def list_orders(status: str = "", manager: str = "", limit: int = 100) -> dict:
    """List production/calculator orders (light). Optional filters: status, manager."""
    params = {"limit": limit}
    if status:
        params["status"] = status
    if manager:
        params["manager"] = manager
    return await _get("/orders", params)


@mcp.tool
async def get_order(order_id: str) -> dict:
    """Get a single order by id, including cost/margin and selected options."""
    return await _get(f"/orders/{order_id}")


@mcp.tool
async def get_pricing() -> dict:
    """Read the calculator price/cost configuration (models, options, cost prices)."""
    return await _get("/pricing")


@mcp.tool
async def list_tech_cards() -> dict:
    """List tech cards (BOM per model/variant/option)."""
    return await _get("/tech-cards")


@mcp.tool
async def get_tech_card(card_id: str) -> dict:
    """Get one tech card by id."""
    return await _get(f"/tech-cards/{card_id}")


@mcp.tool
async def list_components() -> dict:
    """List components / materials (with purchase price `unitPrice`)."""
    return await _get("/components")


@mcp.tool
async def list_procurement() -> dict:
    """List procurement requests."""
    return await _get("/procurement/requests")


@mcp.tool
async def get_audit(limit: int = 100) -> dict:
    """Read the ai_agent audit log (who/what/when)."""
    return await _get("/audit", {"limit": limit})


# ------------------------------- WRITE: order (2-step) -----------------------
@mcp.tool
async def order_update_preview(order_id: str, field: str, value: str) -> dict:
    """STEP 1. Preview an order change. field = status | comment | assignee.
    Returns a diff and a token. Show the diff to the user before applying."""
    return await _post(f"/orders/{order_id}/update/preview", {"field": field, "value": value})


@mcp.tool
async def order_update_apply(order_id: str, token: str) -> dict:
    """STEP 2. Apply the previewed order change using the token from step 1."""
    return await _post(f"/orders/{order_id}/update/apply", {"token": token})


# ------------------------------- WRITE: recalculate (2-step) -----------------
@mcp.tool
async def order_recalculate_preview(order_id: str) -> dict:
    """STEP 1. Preview refreshed cost/margin from current tech cards & purchase
    prices. Does NOT change the client-agreed price. Returns diff + token."""
    return await _post(f"/orders/{order_id}/recalculate/preview")


@mcp.tool
async def order_recalculate_apply(order_id: str, token: str) -> dict:
    """STEP 2. Apply the recalculation (updates only totalCost & margin)."""
    return await _post(f"/orders/{order_id}/recalculate/apply", {"token": token})


# ------------------------------- WRITE: component price (2-step) -------------
@mcp.tool
async def component_price_preview(component_id: str, unit_price: float) -> dict:
    """STEP 1. Preview a component purchase-price change (forward-only).
    Returns diff, affected tech-card count and a token."""
    return await _post(f"/components/{component_id}/purchase-price/preview",
                       {"unitPrice": unit_price})


@mcp.tool
async def component_price_apply(component_id: str, token: str) -> dict:
    """STEP 2. Apply the purchase-price change and recompute affected tech cards."""
    return await _post(f"/components/{component_id}/purchase-price/apply", {"token": token})


# ------------------------------- WRITE: tech card (2-step) -------------------
@mcp.tool
async def techcard_update_preview(card_id: str, items: Optional[list] = None,
                                  note: Optional[str] = None) -> dict:
    """STEP 1. Preview a tech-card change (items = BOM lines, and/or note).
    Forward-only. Returns diff + token."""
    body: dict = {}
    if items is not None:
        body["items"] = items
    if note is not None:
        body["note"] = note
    return await _post(f"/tech-cards/{card_id}/update/preview", body)


@mcp.tool
async def techcard_update_apply(card_id: str, token: str) -> dict:
    """STEP 2. Apply the tech-card change and re-sync its cost."""
    return await _post(f"/tech-cards/{card_id}/update/apply", {"token": token})


if __name__ == "__main__":
    mcp.run()  # stdio by default
