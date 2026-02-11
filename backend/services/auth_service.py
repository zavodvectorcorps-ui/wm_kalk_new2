"""Authentication service - password hashing, JWT handling, dependencies."""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
import jwt
import uuid
import asyncio
import logging

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, ADMIN_PASSWORD
from database import db

logger = logging.getLogger(__name__)

# Password hashing - with explicit bcrypt backend
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Flag to track if admin was initialized (per-instance)
_admin_initialized = False
_init_lock = asyncio.Lock()


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
    return decode_token(credentials.credentials)


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
            # Use findOneAndUpdate with upsert to prevent race conditions
            # This is atomic and safe for multiple instances
            admin = await db.users.find_one({"username": "admin"})
            if not admin:
                # Only create if truly doesn't exist
                # Check again with a slight delay to handle race conditions
                import asyncio
                await asyncio.sleep(0.1)
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
