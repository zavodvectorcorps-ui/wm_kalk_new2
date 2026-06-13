"""Application configuration and constants."""
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'balia-calculator-secret-key-159357')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168  # 7 days (was 24 hours)
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '220066')
# Configurable super-admin username (defaults to "admin" for backward compat).
# Set ADMIN_USERNAME in env to bootstrap a different super-admin (e.g. "maxim").
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
