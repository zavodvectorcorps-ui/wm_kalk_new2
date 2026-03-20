# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features for a sauna business.

## Core Modules
1. Sauna Calculator, 2. Balia Calculator, 3. Sauna Mini-CRM, 4. Sauna Production, 5. Warehouse, 6. Sales, 7. Logistics, 8. Training, 9. Admin Panel

## Tech Stack
Frontend: React + Shadcn/UI + Tailwind CSS | Backend: FastAPI + Python | DB: MongoDB
Integrations: amoCRM, Cloudinary, Telegram, Google Maps, Google Sheets, Nano Banana (Gemini AI)

## What's Been Implemented

### Session 2 (March 20, 2026) — CRM/Sales Enhancements + Backup Fix

**5-Point CRM & Sales Enhancement (initial):**
1. Manager-specific CRM access (filter by manager_username)
2. Date filters on Production kanban
3. Custom lead title (ClientName bold + Model below)
4. Calendar uses readyDate
5. Sales sync imports ALL leads, bonus by prepaymentDate

**4-Point Refinement (detailed user requirements):**
1. **amoCRM name mapping** — Users table has `amocrm_name` field for mapping to amoCRM manager names. CRM filters leads by looking up the user's amoCRM name.
2. **Custom amoCRM field IDs** — CRM Settings > Sync tab has inputs for "ID поля Имя клиента" and "ID поля Модель сауны"
3. **Sales sync** — Imports ALL CRM leads (not just calculatorOrderId), bonus based on prepayment_date
4. **Date sorting in kanban** — Sort buttons (↕ Дата) toggle asc/desc/none by readyDate in both CRM and Production kanban

**Backup Fix:**
- Added 15 missing collections to export/import/telegram backup
- Fixed wrong collection name (sauna_leads → sauna_crm_leads)
- Unified download_backup to reuse export_backup logic

### Session 1 — Previous Work
Tech Spec PDF, Production List, Google Sheets sync (blocked), Sales automation, User access controls, Warehouse enhancements, Document deduplication

## Prioritized Backlog

### P1 - High Priority
- [ ] Fix automatic variant application bug in LayoutConfiguratorPage.jsx (RECURRING)
- [ ] Complete Google Sheets integration (BLOCKED on user enabling APIs)
- [ ] Finalize "Save layout to order" feature end-to-end

### P2 - Medium Priority
- [ ] Refactor monolithic amocrm.py
- [ ] Refactor LayoutConfiguratorPage.jsx
- [ ] UI for importing/restoring project backup
- [ ] Replace deprecated Google Maps Autocomplete
- [ ] Fix unstable login sessions (RECURRING)
- [ ] Fix deployment timeouts (RECURRING)

## Key API Endpoints
- `GET /api/sauna-crm/leads?manager_username=X&date_from=Y&date_to=Z`
- `GET /api/sauna-crm/settings` — includes clientNameFieldId, modelFieldId
- `GET /api/sauna-production/orders?date_from=X&date_to=Y`
- `GET /api/sauna-production/calendar?month=M&year=Y` (readyDate)
- `POST /api/sales/sync-from-crm` — ALL CRM leads
- `GET /api/sales/bonus-calculation` — by prepayment_date
- `POST /api/users` — includes amocrm_name
- `PUT /api/users/{id}` — includes amocrm_name
- `POST /api/backup/export` — 32+ collections

## Credentials
- Admin: admin / admin123
