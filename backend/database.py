"""Database configuration and connection."""
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with optimized settings for Atlas
mongo_url = os.environ['MONGO_URL']

# Create client with connection pooling and timeout settings
# These settings help with Kubernetes deployments where connections may be slow initially
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=5000,  # 5 seconds to select server
    connectTimeoutMS=5000,           # 5 seconds to connect
    socketTimeoutMS=30000,           # 30 seconds for socket operations
    maxPoolSize=10,                  # Connection pool size
    minPoolSize=1,                   # Minimum connections to keep
    maxIdleTimeMS=30000,             # Close idle connections after 30s
    retryWrites=True,                # Retry failed writes
    retryReads=True,                 # Retry failed reads
)
db = client[os.environ['DB_NAME']]
