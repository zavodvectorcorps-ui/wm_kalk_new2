"""WM Calculator API - Main Application Entry Point."""
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import os
import logging

from database import client
from routes.auth import router as auth_router
from routes.balia import router as balia_router
from routes.sauna import router as sauna_router
from routes.health import router as health_router
from routes.tech_spec import router as tech_spec_router
from routes.balia_tech_spec import router as balia_tech_spec_router
from routes.upload import router as upload_router
from routes.customer_fields import router as customer_fields_router
from routes.statistics import router as statistics_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(
    title="WM Calculator API",
    description="API for WM-Balia and WM-Sauna calculators",
    version="2.0.0"
)

# Include routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(balia_router, prefix="/api")
app.include_router(sauna_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(tech_spec_router, prefix="/api")
app.include_router(balia_tech_spec_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(customer_fields_router, prefix="/api")
app.include_router(statistics_router, prefix="/api")

# Health check endpoint for Kubernetes (without /api prefix)
@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    return {"status": "healthy", "service": "wm-calculator-backend"}

# CORS middleware - allow specific origins for credentials
# List all domains the app is accessed from
allowed_origins = [
    "https://wm-kalkulator.pl",
    "https://www.wm-kalkulator.pl",
    "https://spa-planner.emergent.host",
    "http://localhost:3000",
    "http://localhost:8001",
]
# Add any additional origins from environment
env_origins = os.environ.get('CORS_ORIGINS', '')
if env_origins:
    for origin in env_origins.split(','):
        origin = origin.strip()
        if origin and origin not in allowed_origins:
            allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
