"""Health check endpoints."""
from fastapi import APIRouter

router = APIRouter(tags=["Health"])

# Code version marker - change this to verify deployment
CODE_VERSION = "V12-range-2026-01-17"


@router.get("/health")
async def api_health_check():
    """Health check endpoint accessible via /api/health"""
    return {
        "status": "healthy", 
        "service": "wm-calculator-backend",
        "code_version": CODE_VERSION
    }
