# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features.

## Core Modules
1. Sauna Calculator, 2. Balia Calculator, 3. Sauna Mini-CRM, 4. Sauna Production, 5. Warehouse, 6. Sales, 7. Logistics, 8. Training, 9. Admin Panel

## Tech Stack
Frontend: React + Shadcn/UI + Tailwind CSS | Backend: FastAPI + Python | DB: MongoDB
Integrations: amoCRM, Cloudinary, Telegram, Google Maps, Google Sheets, Nano Banana (Gemini AI)

## What's Been Implemented

### Session 5 (April 4, 2026)

**Contract/Tech Spec links to amoCRM:**
- After contract/tech spec generation, links are automatically pushed to amoCRM as notes

**amoCRM Widget Enhancements:**
- Widget shows "Сауна — CRM" section with dates, payment, documents, statuses
- "Создать/Пересоздать договор" button directly in widget
- Shows all 4 date types: Дата аванса, Дата производства, Дата готовности, Дата доставки
- Non-sauna orders show classic "Детали заказа" format

**CRM Stage "Заказ выполнен" (collapsed):**
- New stage added with `collapsed: true`, collapsible kanban columns

**amoCRM Stage Sync:**
- Moves amoCRM card to mapped pipeline stage (PATCH with pipeline_id + status_id)
- Settings UI with dropdown selectors for amoCRM pipeline/stage mapping

**Sync-from-amoCRM updates existing cards:**
- Updates stageId when lead moved in amoCRM (tracked as 'synced_from_amocrm')
- Updates totalAmount (budget), clientName, modelName, phone, manager, custom fields
- Updates amocrm_link

**Production dates auto-push to amoCRM:**
- When productionDate, readyDate, deliveryDate change in CRM-sauna → auto-push as note to amoCRM
- Also syncs via syncBackFields if custom field mappings configured
- Only pushes actually changed dates (not all dates on every save)

### Previous Sessions
- Session 4: amoCRM sync fixes, CRM linking, heater variants, logistics, sales/bonuses
- Session 3: Contract template system, Storekeeper role
- Session 2: Manager CRM access, date filters, contract generation
- Session 1: Tech spec PDF, production list, user access controls

## CRM Stages
1. invoice_sent: Выставлен счёт
2. prepayment_received: Предоплата получена
3. approved_by_production: Согласован производством
4. in_production: В производстве
5. ready: Готов
6. delivered: Доставлен
7. completed: Заказ выполнен (collapsed)

## Prioritized Backlog

### P1 - High Priority
- [ ] Fix automatic variant application bug in LayoutConfiguratorPage.jsx
- [ ] Complete Google Sheets integration (BLOCKED on user enabling APIs)

### P2 - Medium Priority
- [ ] Refactor amocrm.py and LayoutConfiguratorPage.jsx (monolithic files)
- [ ] UI for importing/restoring project backup
- [ ] Replace deprecated Google Maps Autocomplete
- [ ] Fix unstable login sessions

## Key API Endpoints
- POST /api/sauna-crm/generate-contract
- POST /api/sauna/generate-tech-spec-pdf
- GET /api/widget/embed/{lead_id}
- GET /api/sauna-crm/settings
- PUT /api/sauna-crm/settings/stages
- GET /api/integrations/amocrm/pipelines
- PUT /api/sauna-crm/leads/{id}/stage (triggers amoCRM sync)
- PUT /api/sauna-crm/leads/{id} (triggers production dates push)
- POST /api/sauna-crm/sync-from-amocrm (updates existing cards)

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
