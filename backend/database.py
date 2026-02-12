"""Database configuration and connection with lazy initialization."""
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection settings optimized for Atlas + Kubernetes
MONGO_URL = os.environ.get('MONGO_URL', '')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Lazy initialization - client created on first use
_client = None
_db = None


def get_client():
    """Get MongoDB client with lazy initialization."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            MONGO_URL,
            serverSelectionTimeoutMS=5000,  # 5 seconds to select server
            connectTimeoutMS=5000,           # 5 seconds to connect
            socketTimeoutMS=30000,           # 30 seconds for socket operations
            maxPoolSize=10,                  # Connection pool size
            minPoolSize=0,                   # Start with no connections (lazy)
            maxIdleTimeMS=30000,             # Close idle connections after 30s
            retryWrites=True,                # Retry failed writes
            retryReads=True,                 # Retry failed reads
            appname="wm-calculator",         # App name for monitoring
        )
    return _client


def get_db():
    """Get database instance with lazy initialization."""
    global _db
    if _db is None:
        _db = get_client()[DB_NAME]
    return _db


# For backward compatibility - these are now properties that lazily initialize
class LazyClient:
    """Wrapper for lazy client access."""
    def __getattr__(self, name):
        return getattr(get_client(), name)
    
    def __getitem__(self, name):
        return get_client()[name]
    
    def close(self):
        global _client
        if _client:
            _client.close()
            _client = None


class LazyDB:
    """Wrapper for lazy database access."""
    def __getattr__(self, name):
        return getattr(get_db(), name)
    
    def __getitem__(self, name):
        return get_db()[name]


# Export lazy wrappers for backward compatibility
client = LazyClient()
db = LazyDB()
