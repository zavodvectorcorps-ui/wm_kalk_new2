"""Dealer authentication helpers + dependency."""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
import jwt

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS
from services.auth_service import security, decode_token
from database import db


def create_dealer_token(dealer: dict) -> str:
    payload = {
        "sub": dealer["id"],
        "username": dealer["username"],
        "role": "dealer",
        "name": dealer.get("name", ""),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_dealer(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Returns the active dealer document.

    Raises 401 if token is missing/invalid, 403 if not a dealer or deactivated.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "dealer":
        raise HTTPException(status_code=403, detail="Dealer access required")
    dealer = await db.dealers.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not dealer:
        raise HTTPException(status_code=401, detail="Dealer not found")
    if not dealer.get("isActive", True):
        raise HTTPException(status_code=403, detail="Dealer deactivated")
    return dealer
