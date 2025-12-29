"""Health check endpoints."""
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def api_health_check():
    """Health check endpoint accessible via /api/health"""
    return {"status": "healthy", "service": "wm-calculator-backend"}
