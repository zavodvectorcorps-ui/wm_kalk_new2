"""Authentication service - password hashing, JWT handling, dependencies."""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
import jwt
import uuid
import asyncio
import logging

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, ADMIN_PASSWORD, ADMIN_USERNAME
from database import db

logger = logging.getLogger(__name__)

# Password hashing - with explicit bcrypt backend
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Flag to track if admin was initialized (per-instance)
_admin_initialized = False
_init_lock = asyncio.Lock()

# In-memory cache for the global "logout all devices" timestamp (unix seconds).
# Read from db.app_config doc {_id: "auth_invalidation"} with a short TTL so a
# per-request lookup doesn't hammer Mongo. A value of 0 means "never".
_invalidate_before_cache = None
_invalidate_cache_at = 0.0
_INVALIDATE_CACHE_TTL = 30.0  # seconds


async def get_tokens_invalid_before() -> int:
    """Return the unix-seconds timestamp before which all tokens are invalid."""
    global _invalidate_before_cache, _invalidate_cache_at
    import time
    now = time.time()
    if _invalidate_before_cache is not None and (now - _invalidate_cache_at) < _INVALIDATE_CACHE_TTL:
        return _invalidate_before_cache
    try:
        doc = await db.app_config.find_one({"_id": "auth_invalidation"})
        _invalidate_before_cache = int((doc or {}).get("invalidateBefore", 0) or 0)
    except Exception as e:
        logger.warning(f"Could not read token invalidation config: {e}")
        _invalidate_before_cache = _invalidate_before_cache or 0
    _invalidate_cache_at = now
    return _invalidate_before_cache


async def set_tokens_invalid_before(ts: int):
    """Persist the global invalidation timestamp and bust the local cache."""
    global _invalidate_before_cache, _invalidate_cache_at
    import time
    await db.app_config.update_one(
        {"_id": "auth_invalidation"},
        {"$set": {"invalidateBefore": int(ts)}},
        upsert=True,
    )
    _invalidate_before_cache = int(ts)
    _invalidate_cache_at = time.time()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password with retry on bcrypt errors"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        # Log the error but try one more time
        logger.warning(f"Password verification error (retrying): {e}")
        try:
            # Small delay before retry
            import time
            time.sleep(0.1)
            return pwd_context.verify(plain_password, hashed_password)
        except Exception as e2:
            logger.error(f"Password verification failed after retry: {e2}")
            return False


def create_token(user_data: dict) -> str:
    payload = {
        "sub": user_data["id"],
        "username": user_data["username"],
        "role": user_data["role"],
        "access": user_data["access"],
        "superAdmin": bool(user_data.get("superAdmin", False)),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    import logging
    import hashlib
    logger = logging.getLogger(__name__)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning(f"Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        # Log first 8 chars of token hash and secret hash for debugging
        token_hash = hashlib.md5(token[:20].encode()).hexdigest()[:8] if token else "none"
        secret_hash = hashlib.md5(JWT_SECRET.encode()).hexdigest()[:8]
        logger.warning(f"Invalid token (token_hash={token_hash}, secret_hash={secret_hash}): {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    # Global "logout all devices": reject tokens issued before the stored
    # invalidation timestamp (set by the super-admin from the admin panel).
    invalidate_before = await get_tokens_invalid_before()
    if invalidate_before:
        token_iat = payload.get("iat", 0) or 0
        if int(token_iat) < invalidate_before:
            raise HTTPException(status_code=401, detail="Session expired, please log in again")
    return payload


async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "super-admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def init_admin_user():
    """Initialize admin user if not exists - safe for multi-instance deployment"""
    global _admin_initialized
    
    # Skip if already initialized in this instance
    if _admin_initialized:
        return
    
    async with _init_lock:
        # Double-check after acquiring lock
        if _admin_initialized:
            return
            
        try:
            # Super-admin identity is tracked by the `superAdmin` flag (NOT the
            # username) so the account can be freely renamed without losing
            # privileges. Seeding rules:
            #   1. If a super-admin already exists -> nothing to do.
            #   2. Else if a user named ADMIN_USERNAME exists -> promote it
            #      (one-time migration for existing deployments).
            #   3. Else -> create a fresh super-admin.
            super_admin = await db.users.find_one({"superAdmin": True})
            if super_admin:
                _admin_initialized = True
                return

            legacy = await db.users.find_one({"username": ADMIN_USERNAME})
            if legacy:
                await db.users.update_one(
                    {"id": legacy.get("id", legacy.get("_id"))},
                    {"$set": {"superAdmin": True, "role": "admin"}},
                )
                _admin_initialized = True
                return

            # No super-admin anywhere -> create the default one.
            import asyncio
            await asyncio.sleep(0.1)
            if await db.users.find_one({"superAdmin": True}):
                _admin_initialized = True
                return
            admin_user = {
                "id": str(uuid.uuid4()),
                "username": ADMIN_USERNAME,
                "password": hash_password(ADMIN_PASSWORD),
                "role": "admin",
                "access": "all",
                "superAdmin": True,
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            try:
                await db.users.insert_one(admin_user)
            except Exception as e:
                # Duplicate key error is OK - another instance created it
                if "duplicate key" not in str(e).lower() and "E11000" not in str(e):
                    raise
            _admin_initialized = True
        except Exception as e:
            # Log but don't fail - admin might already exist from another instance
            import logging
            logging.getLogger(__name__).warning(f"init_admin_user warning: {e}")
            _admin_initialized = True  # Mark as done anyway to prevent repeated attempts
