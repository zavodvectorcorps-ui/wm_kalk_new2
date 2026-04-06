# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features.

## Tech Stack
Frontend: React + Shadcn/UI + Tailwind CSS | Backend: FastAPI + Python | DB: MongoDB
Integrations: amoCRM, Cloudinary, Telegram, Google Maps

## Session 6 Fixes & Features (April 5-6, 2026)

### Bug Fixes
- 524 Timeout → BackgroundTasks + progress bar
- advanceFieldId/remainingFieldId not saving → added to Pydantic model
- New leads missing advance/comment → extract called for new leads
- KP not attaching → motor async + kpCloudinaryUrl fallback
- Date off-by-one → Europe/Warsaw timezone conversion
- Sales sync wrong dates & too many records → see below

### New Features
- Sync Progress UI with auto-detect on page load
- amoCRM Widget: KP status + warning before contract
- Webhook auto-sync for sauna section
- Periodic auto-sync scheduler (5-120 min configurable)
- "Заполняется производством" header in CRM lead card
- Calendar: manager name in badges and order cards
- PDF: layout variants moved to Page 1, no blank pages
- Debug KP endpoint: `GET /api/sauna-crm/debug-kp/{amocrm_id}`

### Sales Sync Overhaul
- **salesStageId**: Only leads from this stage onward go to Sales (e.g. "prepayment_received")
- **salesPrepaymentFlagFieldId**: amoCRM field ID for "Предоплата получена" flag — only flagged leads sync
- **salesDateFieldId**: CRM field for sale date (дата получения аванса)
- All three configurable in CRM Settings → amoCRM tab → "Синхронизация с Продажами"

## CRM Stages
invoice_sent → prepayment_received → approved_by_production → in_production → ready → delivered → completed

## CRM Settings Fields (Pydantic model)
fields, stages, syncBackFields, autoSyncEnabled, autoSyncIntervalMinutes, lastSyncAt,
clientNameFieldId, modelFieldId, calendarDateField, commentFieldId,
advanceFieldId, remainingFieldId, salesPrepaymentFlagFieldId, salesDateFieldId, salesStageId

## Prioritized Backlog
- P1: Fix automatic variant application in LayoutConfiguratorPage.jsx
- P2: Refactor monolithic files (amocrm.py, widget.py, sauna_crm.py, SaunaCRMPage.jsx)
- P2: UI for backup import/restore from file
- P2: Replace deprecated Google Maps Autocomplete component

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
