# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features.

## Tech Stack
Frontend: React + Shadcn/UI + Tailwind CSS | Backend: FastAPI + Python | DB: MongoDB
Integrations: amoCRM, Cloudinary, Telegram, Google Maps

## Session 6 Fixes & Features (April 5-6, 2026)

### Bug Fixes
- **524 Timeout**: Refactored `sync_leads_from_amocrm` → BackgroundTasks + progress bar
- **advanceFieldId/remainingFieldId not saving**: Added to Pydantic CRMSettings model
- **New leads missing advance/comment**: `extract_advance_remaining()` now called for new leads
- **KP not attaching**: Rewrote `link_calculator_order` to motor async + `kpCloudinaryUrl` fallback on order
- **Date off-by-one**: amoCRM timestamps now converted using `Europe/Warsaw` timezone
- **Sales sync wrong dates**: `order_date` now uses calendarDateField from CRM settings, not `createdAt`
- **Sales sync too many records**: Now only imports leads past first stage (not "invoice_sent")

### New Features
- **Sync Progress UI**: Animated progress bar, stage counters, 15s persistent result
- **Auto-detect running sync**: On page load, resumes polling if sync is running
- **amoCRM Widget KP status**: Shows "Прикреплено" / "Не прикреплено" with warning before contract creation
- **Webhook auto-sync**: When amoCRM webhook fires for sauna section, auto-syncs CRM lead
- **Periodic auto-sync**: Configurable scheduler (5-120 min) in CRM Settings
- **Production header**: "Заполняется производством" label above date fields
- **Calendar manager display**: Manager name in calendar badges and order cards
- **PDF layout restructuring**: Layout variants moved to Page 1, no blank pages
- **Debug endpoint**: `GET /api/sauna-crm/debug-kp/{amocrm_id}` for KP diagnostics

## CRM Stages
invoice_sent → prepayment_received → approved_by_production → in_production → ready → delivered → completed

## Prioritized Backlog
- P1: Fix automatic variant application in LayoutConfiguratorPage.jsx
- P2: Refactor amocrm.py/widget.py/sauna_crm.py/SaunaCRMPage.jsx
- P2: UI for backup import/restore from file
- P2: Replace deprecated Google Maps Autocomplete component

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
