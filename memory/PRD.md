# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features.

## Tech Stack
Frontend: React + Shadcn/UI + Tailwind CSS | Backend: FastAPI + Python | DB: MongoDB
Integrations: amoCRM, Cloudinary, Telegram, Google Maps

## What's Been Implemented

### Session 5 (April 4, 2026)

**Contract/Tech Spec links to amoCRM** — auto-push links as notes after generation

**amoCRM Widget** — Sauna CRM section, 4 date types, contract button, separate from greenhouse

**Collapsed stages** — "Заказ выполнен" (collapsed in kanban), collapsible columns

**amoCRM stage sync** — PATCH pipeline_id + status_id, dropdown mapping UI

**Sync-from-amoCRM** — updates existing cards (stage, budget, fields, comment)

**Production dates auto-push** — productionDate/readyDate/deliveryDate → amoCRM notes

**Change History & Notifications:**
- `changeLog[]` — records every field change from amoCRM sync
- `hasUnreviewedChanges` — amber warning badge (!) on kanban/list cards
- "Просмотрено" button clears flag, changeLog remains as collapsed history
- `amoComment` — manager's comment from amoCRM, displayed in blue on cards
- `commentFieldId` setting — configurable amoCRM field ID for comment sync

**Per-lead sync from amoCRM:**
- POST /api/sauna-crm/leads/{id}/sync-from-amocrm — fetches latest data for specific lead
- "Обновить из amoCRM" button in lead detail dialog
- Works independently of stage mapping (fixes budget sync issue)
- Detects changes, records changeLog, sets hasUnreviewedChanges

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
### P1
- [ ] Fix automatic variant application in LayoutConfiguratorPage.jsx
- [ ] Google Sheets integration (BLOCKED)

### P2
- [ ] Refactor amocrm.py, widget.py (monolithic)
- [ ] UI for project backup import
- [ ] Replace deprecated Google Maps Autocomplete
- [ ] Fix unstable login sessions

## Key API Endpoints
- POST /api/sauna-crm/leads/{id}/sync-from-amocrm (per-lead sync)
- PUT /api/sauna-crm/leads/{id}/acknowledge-changes
- POST /api/sauna-crm/sync-from-amocrm (bulk sync)
- PUT /api/sauna-crm/leads/{id} (triggers dates push)
- GET /api/widget/embed/{lead_id}
- POST /api/sauna-crm/generate-contract

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
