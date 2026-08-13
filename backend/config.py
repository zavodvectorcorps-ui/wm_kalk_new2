"""Application configuration and constants."""
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security configuration
def _required_env(name: str) -> str:
    """Return a required env var or fail fast at startup (no insecure fallback)."""
    value = os.environ.get(name)
    if value is None or not value.strip():
        raise RuntimeError(f"{name} is not set")
    return value

JWT_SECRET = _required_env('JWT_SECRET')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168  # 7 days (was 24 hours)
ADMIN_PASSWORD = _required_env('ADMIN_PASSWORD')
# Configurable super-admin username (defaults to "admin" for backward compat).
# Set ADMIN_USERNAME in env to bootstrap a different super-admin (e.g. "maxim").
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
