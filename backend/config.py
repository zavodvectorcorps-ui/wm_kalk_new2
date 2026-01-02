"""Application configuration and constants."""
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'balia-calculator-secret-key-159357')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '220066')
