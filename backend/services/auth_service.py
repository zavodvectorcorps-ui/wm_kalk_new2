"""Authentication service - password hashing, JWT handling, dependencies."""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
import jwt
import uuid
import asyncio

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, ADMIN_PASSWORD
from database import db

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Flag to track if admin was initialized (per-instance)
_admin_initialized = False
_init_lock = asyncio.Lock()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_token(user_data: dict) -> str:
    payload = {
        "sub": user_data["id"],
        "username": user_data["username"],
        "role": user_data["role"],
        "access": user_data["access"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return decode_token(credentials.credentials)


async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "super-admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def init_admin_user():
    """Initialize admin user if not exists - with locking to prevent race conditions"""
    global _admin_initialized
    
    # Skip if already initialized in this instance
    if _admin_initialized:
        return
    
    async with _init_lock:
        # Double-check after acquiring lock
        if _admin_initialized:
            return
            
        try:
            admin = await db.users.find_one({"username": "admin"})
            if not admin:
                admin_user = {
                    "id": str(uuid.uuid4()),
                    "username": "admin",
                    "password": hash_password(ADMIN_PASSWORD),
                    "role": "admin",
                    "access": "all",
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(admin_user)
            _admin_initialized = True
        except Exception:
            # Don't fail login if init fails, just try again next time
            pass
