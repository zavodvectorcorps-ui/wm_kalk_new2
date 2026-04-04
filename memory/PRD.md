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
- After contract generation, link is automatically pushed to amoCRM as a note
- After tech spec PDF generation, link is pushed to amoCRM as a note
- Both check for `amocrm_id` on the CRM lead and amoCRM credentials before sending

**amoCRM Widget Enhancements:**
- Widget shows "Сауна — CRM" section with dates, payment, documents, statuses
- "Создать/Пересоздать договор" button directly in widget
- Non-sauna orders continue to show classic "Детали заказа" format

**CRM Stage "Заказ выполнен" (collapsed):**
- New stage added as last stage with `collapsed: true`
- Kanban columns now support collapse/expand toggle
- Collapsed column shows as 48px narrow vertical bar, click to expand

**amoCRM Stage Sync improvements:**
- `sync_stage_to_amocrm` now sends both `pipeline_id` and `status_id` (moves card in amoCRM)
- Improved logging for debugging sync issues
- Settings UI for stages has dropdown selectors for amoCRM pipeline/stage mapping
- "Загрузить воронки amoCRM" button loads pipelines from amoCRM API
- Fallback to manual ID inputs when pipelines not loaded

**CRM Stages Updated:**
- invoice_sent: Выставлен счёт
- prepayment_received: Предоплата получена
- approved_by_production: Согласован производством
- in_production: В производстве
- ready: Готов
- delivered: Доставлен
- completed: Заказ выполнен (collapsed by default)

### Previous Sessions
- Session 4: amoCRM sync fixes, CRM linking, heater variants, logistics, sales/bonuses
- Session 3: Contract template system, Storekeeper role
- Session 2: Manager CRM access, date filters, contract generation
- Session 1: Tech spec PDF, production list, user access controls

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

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
