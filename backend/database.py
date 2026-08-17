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
import asyncio

_client = None
_db = None
_client_loop = None


def _current_loop():
    try:
        return asyncio.get_running_loop()
    except RuntimeError:
        return None


def get_client():
    """Get MongoDB client, rebinding it to the current running event loop.

    Motor's client is bound to the loop it was created on. Under some deploy
    runtimes (multi-worker / loop replaced after startup) the singleton ends up
    bound to a loop that no longer serves requests, causing
    'Task got Future attached to a different loop' on every DB call. We detect a
    loop change and transparently recreate the client for the active loop.
    """
    global _client, _db, _client_loop
    loop = _current_loop()
    if _client is None or (loop is not None and _client_loop is not loop):
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
        _client_loop = loop
        _db = None  # force db re-bind to the new client
    return _client


def get_db():
    """Get database instance bound to the current-loop client."""
    global _db
    client = get_client()
    if _db is None:
        _db = client[DB_NAME]
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
