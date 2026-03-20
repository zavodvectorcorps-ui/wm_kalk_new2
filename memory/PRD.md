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

### Session (March 20, 2026) - 5-Point CRM & Sales Enhancement
1. **Manager-specific CRM access** - Non-admin users see only their own leads (filtered by manager name)
2. **Date filters on Production** - Added date range pickers to Production kanban & list views
3. **Custom lead title** - Lead cards display "ClientName — ModelName" format
4. **Calendar date source** - Production calendar now uses readyDate (дата готовности) instead of productionDate
5. **Sales sync logic** - Sync imports ALL CRM leads (not just calculatorOrderId), bonus uses prepaymentDate

### Previous Sessions
- Tech Spec PDF generation with Cloudinary upload
- Production List tab with editable table
- Google Sheets sync (partially - blocked on user API enablement)
- Sales module automation (sync from CRM)
- Expanded user access controls (Warehouse, Sauna Production, Training)
- Warehouse card enhancements (Products, Responsible User, Debt, etc.)
- Document deduplication for tech_spec and kp types
- Copy-to-clipboard buttons in Warehouse

## Prioritized Backlog

### P0 - Done
- [x] 5-point CRM & Sales Enhancement

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
- `GET /api/sauna-crm/leads?manager_username=X&date_from=Y&date_to=Z` - Filtered leads
- `GET /api/sauna-production/orders?date_from=X&date_to=Y` - Filtered production orders
- `GET /api/sauna-production/calendar?month=M&year=Y` - Calendar grouped by readyDate
- `POST /api/sales/sync-from-crm` - Sync ALL CRM leads to sales
- `GET /api/sales/bonus-calculation?start_date=X&end_date=Y&manager=Z` - Bonus by prepaymentDate

## Key DB Collections
- `sauna_crm_leads` - Main CRM leads/orders (source of truth for production)
- `sauna_crm_settings` - CRM configuration (stages, fields, sync)
- `sauna_production_settings` - Production stages, Google Sheets config
- `sales` - Sales records
- `sales_managers` - Manager bonus percentages
- `dovoz_orders` - Warehouse/shipping orders

## Credentials
- Admin: admin / admin123
