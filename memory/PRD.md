# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features for a sauna business.

## User Personas
- **Admin**: Full access to all modules, manages settings, users
- **Manager/Employee**: Limited to assigned modules (CRM, Production, Sales, etc.)
- **Observer**: Read-only access to pricing/reports
- **Driver**: Delivery panel only
- **Warehouse**: Warehouse management only

## Core Modules
1. **Sauna Calculator** - Configuration and pricing
2. **Balia Calculator** - Hot tub configuration
3. **Sauna Mini-CRM** - Lead management with amoCRM integration
4. **Sauna Production** - Kanban, Calendar, Production List
5. **Warehouse/Magazyn** - Order tracking with amoCRM sync
6. **Sales/Sprzedaz** - Sales tracking with bonus calculation
7. **Logistics** - Delivery route planning with Google Maps
8. **Training/Szkolenia** - Training courses for managers
9. **Admin Panel** - User management, settings

## Tech Stack
- Frontend: React + Shadcn/UI + Tailwind CSS
- Backend: FastAPI + Python
- Database: MongoDB
- Integrations: amoCRM, Cloudinary, Telegram, Google Maps, Google Sheets, Nano Banana (Gemini AI)

## What's Been Implemented

### Session 2 (March 20, 2026) - 5-Point CRM & Sales Enhancement + Backup Fix
1. **Manager-specific CRM access** - Non-admin users see only their own leads
2. **Date filters on Production** - Added date range pickers to Production kanban
3. **Custom lead title** - Lead cards show "ClientName — ModelName" format
4. **Calendar date source** - Production calendar uses readyDate instead of productionDate
5. **Sales sync logic** - Sync imports ALL CRM leads, bonus uses prepaymentDate
6. **Backup completeness fix** - Added 15 missing collections to backup:
   - sauna_crm_leads, sauna_crm_settings, sauna_production_settings
   - sales, sales_managers, dovoz_orders, dovoz_history
   - training_courses, training_files, training_objections, training_progress
   - pdf_templates, pdf_images, content_folders, sauna_wizard_steps
   - Fixed wrong collection name (sauna_leads → sauna_crm_leads) in Telegram backup
   - Unified download_backup to reuse export_backup logic

### Session 1 - Previous Work
- Tech Spec PDF generation with Cloudinary upload
- Production List tab with editable table
- Google Sheets sync (partially - blocked on user API enablement)
- Sales module automation (sync from CRM)
- Expanded user access controls
- Warehouse card enhancements
- Document deduplication for tech_spec and kp types
- Copy-to-clipboard buttons in Warehouse

## Prioritized Backlog

### P1 - High Priority
- [ ] Fix automatic variant application bug in LayoutConfiguratorPage.jsx (RECURRING)
- [ ] Complete Google Sheets integration (BLOCKED on user enabling APIs)
- [ ] Finalize "Save layout to order" feature end-to-end

### P2 - Medium Priority
- [ ] Refactor monolithic amocrm.py into smaller service files
- [ ] Refactor LayoutConfiguratorPage.jsx (technical debt)
- [ ] UI for importing/restoring project backup
- [ ] Replace deprecated Google Maps Autocomplete component
- [ ] Fix unstable user login sessions (RECURRING)
- [ ] Fix deployment timeouts (RECURRING)

## Key API Endpoints
- `GET /api/sauna-crm/leads?manager_username=X&date_from=Y&date_to=Z`
- `GET /api/sauna-production/orders?date_from=X&date_to=Y`
- `GET /api/sauna-production/calendar?month=M&year=Y` (uses readyDate)
- `POST /api/sales/sync-from-crm` - Sync ALL CRM leads to sales
- `GET /api/sales/bonus-calculation` - Bonus by prepaymentDate
- `POST /api/backup/export` - Full export (32+ collections)
- `POST /api/backup/auto` - Auto backup to Telegram

## Key DB Collections (all 32+ backed up)
See backup.py for complete list. Critical: sauna_crm_leads, sales, users, orders, sauna_orders

## Credentials
- Admin: admin / admin123
