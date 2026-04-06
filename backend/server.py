"""WM Calculator API - Main Application Entry Point."""
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import asyncio
from datetime import datetime, timezone

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
from routes.backup import router as backup_router, set_database as set_backup_db
from routes.greenhouse import router as greenhouse_router
from routes.amocrm import router as amocrm_router
from routes.trips import router as trips_router
from routes.drivers import router as drivers_router
from routes.driver_panel import router as driver_panel_router
from routes.widget import router as widget_router
from routes.notifications import router as notifications_router
from routes.warehouse import router as warehouse_router
from routes.dovoz import router as dovoz_router
from routes.sauna_crm import router as sauna_crm_router
from routes.sauna_production import router as sauna_production_router
from routes.faq import router as faq_router
from routes.sales import router as sales_router
from routes.sales_tracking import router as sales_tracking_router
from routes.pdf_templates import router as pdf_templates_router
from routes.training import router as training_router
from routes.content import router as content_router
from routes.content_generator import router as content_generator_router
from routes.layout_configurator import router as layout_configurator_router
from routes.contract_template import router as contract_template_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Background task control
backup_scheduler_task = None
crm_auto_sync_task = None

# Create the main app
app = FastAPI(
    title="WM Calculator API",
    description="API for WM-Balia and WM-Sauna calculators",
    version="2.0.0"
)

# Add GZip compression for responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

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
app.include_router(backup_router)
app.include_router(greenhouse_router)
app.include_router(amocrm_router)
app.include_router(trips_router)
app.include_router(drivers_router)
app.include_router(driver_panel_router)
app.include_router(widget_router)
app.include_router(notifications_router)
app.include_router(warehouse_router, prefix="/api")
app.include_router(dovoz_router, prefix="/api")
app.include_router(sauna_crm_router, prefix="/api")
app.include_router(contract_template_router, prefix="/api")

# Static files for contracts and uploads
import os as _os
_os.makedirs("/app/backend/static/contracts", exist_ok=True)
app.mount("/api/static/templates", StaticFiles(directory="/app/backend/templates"), name="templates")
app.mount("/api/static", StaticFiles(directory="/app/backend/static"), name="static")
app.include_router(sauna_production_router, prefix="/api")
app.include_router(faq_router, prefix="/api")
app.include_router(pdf_templates_router, prefix="/api")
app.include_router(training_router, prefix="/api")
app.include_router(content_router, prefix="/api")
app.include_router(content_generator_router)
app.include_router(layout_configurator_router)
app.include_router(sales_router)
app.include_router(sales_tracking_router)

# Initialize backup database reference
from database import db
set_backup_db(db)


async def crm_auto_sync_scheduler():
    """Background scheduler for periodic CRM-sauna sync from amoCRM."""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("CRM auto-sync scheduler waiting 2 minutes before first check...")
    await asyncio.sleep(120)  # Wait 2 min after startup

    while True:
        try:
            settings = await db["sauna_crm_settings"].find_one({}, {"_id": 0})
            if not settings:
                await asyncio.sleep(300)
                continue

            auto_enabled = settings.get("autoSyncEnabled", False)
            interval = max(5, settings.get("autoSyncIntervalMinutes", 15))

            if not auto_enabled:
                await asyncio.sleep(60)
                continue

            # Check if sync is already running
            running = await db["sauna_crm_sync_status"].find_one({"status": "running"}, {"_id": 0})
            if running:
                logger.info("CRM auto-sync: skipped, sync already running")
                await asyncio.sleep(60)
                continue

            logger.info(f"CRM auto-sync: starting periodic sync (interval={interval}min)")

            # Trigger sync using the same background logic
            from routes.sauna_crm import _run_sync_background, get_crm_settings, get_amo_settings_sync
            import uuid as _uuid
            crm_settings = await get_crm_settings()
            amo = get_amo_settings_sync()
            amo_domain = amo.get("amocrm_domain", "")
            amo_token = amo.get("amocrm_token", "")

            if not amo_domain or not amo_token:
                await asyncio.sleep(interval * 60)
                continue

            sync_id = f"auto-{_uuid.uuid4().hex[:8]}"
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            mapped_stages = [s for s in crm_settings.get("stages", []) if s.get("amoStageId") and s.get("amoPipelineId")]

            await db["sauna_crm_sync_status"].delete_many({})
            await db["sauna_crm_sync_status"].insert_one({
                "syncId": sync_id, "status": "running", "startedAt": now,
                "imported": 0, "updated": 0, "errors": 0,
                "totalStages": len(mapped_stages), "processedStages": 0,
                "currentStage": "", "message": "Автосинхронизация..."
            })

            await _run_sync_background(sync_id, crm_settings, amo_domain, amo_token)
            logger.info(f"CRM auto-sync completed: {sync_id}")

            await asyncio.sleep(interval * 60)

        except asyncio.CancelledError:
            logger.info("CRM auto-sync scheduler cancelled")
            break
        except Exception as e:
            logger.error(f"CRM auto-sync scheduler error: {e}")
            await asyncio.sleep(300)



async def backup_scheduler():
    """Background task that runs automatic backups based on settings."""
    logger.info("Backup scheduler started")
    
    # Wait 5 minutes after startup before checking backups
    # This allows the application to fully start and prevents blocking on startup
    logger.info("Backup scheduler waiting 5 minutes before first check...")
    await asyncio.sleep(300)  # 5 minutes delay
    
    while True:
        try:
            # Check backup settings
            settings = await db.settings.find_one({"type": "backup_settings"})
            
            if settings and settings.get("enabled", False):
                interval_hours = settings.get("intervalHours", 24)
                last_backup_str = settings.get("lastBackup")
                
                should_backup = False
                
                if not last_backup_str:
                    # Never backed up, do it now
                    should_backup = True
                    logger.info("No previous backup found, triggering backup")
                else:
                    # Check if interval has passed
                    try:
                        last_backup = datetime.fromisoformat(last_backup_str.replace('Z', '+00:00'))
                        now = datetime.now(timezone.utc)
                        hours_since = (now - last_backup).total_seconds() / 3600
                        
                        if hours_since >= interval_hours:
                            should_backup = True
                            logger.info(f"Backup interval passed ({hours_since:.1f}h >= {interval_hours}h), triggering backup")
                    except Exception as e:
                        logger.warning(f"Could not parse last backup date: {e}")
                        should_backup = True
                
                if should_backup:
                    try:
                        # Import and call the backup function
                        from routes.backup import create_auto_backup
                        result = await create_auto_backup()
                        logger.info(f"Auto backup completed: {result}")
                    except Exception as e:
                        logger.error(f"Auto backup failed: {e}")
            
            # Check every hour
            await asyncio.sleep(3600)
            
        except asyncio.CancelledError:
            logger.info("Backup scheduler cancelled")
            break
        except Exception as e:
            logger.error(f"Backup scheduler error: {e}")
            # Wait before retrying
            await asyncio.sleep(300)


async def create_indexes():
    """Create MongoDB indexes for better query performance"""
    # Orders indexes
    await db.orders.create_index("createdAt")
    await db.orders.create_index("status")
    await db.orders.create_index([("createdAt", -1)])  # For sorting by date desc
    
    # Sauna orders indexes
    await db.sauna_orders.create_index("createdAt")
    await db.sauna_orders.create_index("status")
    await db.sauna_orders.create_index([("createdAt", -1)])
    
    # Users indexes
    await db.users.create_index("username", unique=True)
    await db.users.create_index("role")
    
    # Settings indexes
    await db.settings.create_index("type", unique=True)
    
    # Customer fields index
    await db.customer_fields.create_index("calculatorType")
    
    # Prices cache index (for quick lookups)
    await db.prices.create_index("updatedAt")
    await db.sauna_prices.create_index("updatedAt")
    
    # Leads/CRM indexes
    await db.sauna_leads.create_index("createdAt")
    await db.sauna_leads.create_index("status")
    await db.sauna_leads.create_index([("createdAt", -1)])


async def deferred_startup_tasks():
    """
    Heavy startup tasks that run in background after the server is ready.
    This ensures health checks pass quickly while these tasks complete.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Small delay to ensure server is fully ready
    await asyncio.sleep(2)
    
    # Initialize admin user
    from services.auth_service import init_admin_user
    try:
        await init_admin_user()
        logger.info("Admin user initialized/verified")
    except Exception as e:
        logger.warning(f"Could not initialize admin user: {e}")
    
    # Create MongoDB indexes for better performance
    try:
        await create_indexes()
        logger.info("MongoDB indexes created/verified")
    except Exception as e:
        logger.warning(f"Could not create indexes: {e}")
    
    try:
        # Check and add phone field for balia
        balia_fields = await db.customer_fields.find_one({"calculatorType": "balia"})
        if balia_fields:
            fields_list = balia_fields.get('fields', [])
            field_ids = [f.get('id') for f in fields_list]
            if 'phoneNumber' not in field_ids:
                phone_field = {
                    "id": "phoneNumber",
                    "name": "Phone",
                    "nameRu": "Телефон",
                    "namePl": "Telefon",
                    "fieldType": "phone",
                    "placeholder": "",
                    "placeholderRu": "",
                    "placeholderPl": "",
                    "required": True,
                    "sortOrder": 2,
                    "active": True
                }
                # Insert after fullName
                insert_pos = 1
                for i, f in enumerate(fields_list):
                    if f.get('id') == 'fullName':
                        insert_pos = i + 1
                        break
                fields_list.insert(insert_pos, phone_field)
                # Update sortOrder
                for i, f in enumerate(fields_list):
                    f['sortOrder'] = i + 1
                await db.customer_fields.update_one(
                    {"calculatorType": "balia"},
                    {"$set": {"fields": fields_list}}
                )
                logger.info("Added phoneNumber field to balia customer fields")
        else:
            # Create default balia customer fields
            default_fields = {
                "calculatorType": "balia",
                "fields": [
                    {"id": "fullName", "name": "Full Name", "nameRu": "ФИО", "namePl": "Imię i nazwisko", "fieldType": "text", "required": True, "sortOrder": 1, "active": True, "placeholder": "", "placeholderRu": "", "placeholderPl": ""},
                    {"id": "phoneNumber", "name": "Phone", "nameRu": "Телефон", "namePl": "Telefon", "fieldType": "phone", "required": True, "sortOrder": 2, "active": True, "placeholder": "", "placeholderRu": "", "placeholderPl": ""},
                    {"id": "email", "name": "Email", "nameRu": "Email", "namePl": "Email", "fieldType": "email", "required": False, "sortOrder": 3, "active": True, "placeholder": "", "placeholderRu": "", "placeholderPl": ""}
                ]
            }
            await db.customer_fields.insert_one(default_fields)
            logger.info("Created default balia customer fields with phoneNumber")
    except Exception as e:
        logger.error(f"Error in deferred startup tasks: {e}")


# Background task reference for deferred startup
deferred_startup_task = None


# Startup event - FAST, only essential operations
@app.on_event("startup")
async def startup_event():
    """
    Fast startup - only logs and schedules background tasks.
    Heavy operations are deferred to allow health checks to pass quickly.
    """
    import logging
    import hashlib
    from config import JWT_SECRET
    
    logger = logging.getLogger(__name__)
    
    # Log JWT_SECRET hash for debugging multi-instance issues
    secret_hash = hashlib.md5(JWT_SECRET.encode()).hexdigest()[:8]
    logger.info(f"Instance started with JWT_SECRET hash: {secret_hash}")
    
    # Schedule heavy tasks to run in background (non-blocking)
    global deferred_startup_task, backup_scheduler_task, crm_auto_sync_task
    deferred_startup_task = asyncio.create_task(deferred_startup_tasks())
    logger.info("Deferred startup tasks scheduled")
    
    # Start backup scheduler in background
    backup_scheduler_task = asyncio.create_task(backup_scheduler())
    logger.info("Backup scheduler task started")
    
    # Start CRM auto-sync scheduler
    crm_auto_sync_task = asyncio.create_task(crm_auto_sync_scheduler())
    logger.info("CRM auto-sync scheduler started")


@app.on_event("shutdown")
async def shutdown_event():
    """Cancel background tasks on shutdown"""
    global backup_scheduler_task, deferred_startup_task
    
    # Cancel deferred startup task if still running
    if deferred_startup_task and not deferred_startup_task.done():
        deferred_startup_task.cancel()
        try:
            await deferred_startup_task
        except asyncio.CancelledError:
            pass
        logger.info("Deferred startup task stopped")
    
    # Cancel backup scheduler
    if backup_scheduler_task:
        backup_scheduler_task.cancel()
        try:
            await backup_scheduler_task
        except asyncio.CancelledError:
            pass
        logger.info("Backup scheduler stopped")
    
    # Cancel CRM auto-sync scheduler
    if crm_auto_sync_task:
        crm_auto_sync_task.cancel()
        try:
            await crm_auto_sync_task
        except asyncio.CancelledError:
            pass
        logger.info("CRM auto-sync scheduler stopped")


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
    "https://excel-mapping.emergent.host",
    "https://spa-planner-replaced-1767401260.emergent.host",
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
