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

**Change History & Notifications** — changeLog, hasUnreviewedChanges badge, amoComment

**Per-lead sync from amoCRM** — button "Обновить из amoCRM" on each lead card

**Standard amoCRM field mapping:**
- CRM custom fields can now map to standard amoCRM fields (not just custom field IDs)
- Dropdown in settings: `Бюджет (price)`, `Название сделки`, `Ответственный`
- Example: "Wartość sauny" → `_budget` → reads from `amo_lead["price"]`
- Works in both bulk sync and per-lead sync

### Previous Sessions
- Session 4: amoCRM sync fixes, CRM linking, heater variants, logistics, sales/bonuses
- Session 3: Contract template system, Storekeeper role
- Session 2: Manager CRM access, date filters, contract generation
- Session 1: Tech spec PDF, production list, user access controls

## CRM Stages
1-7: invoice_sent → prepayment_received → approved_by_production → in_production → ready → delivered → completed (collapsed)

## Prioritized Backlog
### P1
- [ ] Fix automatic variant application in LayoutConfiguratorPage.jsx
- [ ] Google Sheets integration (BLOCKED)

### P2
- [ ] Refactor amocrm.py, widget.py (monolithic)
- [ ] UI for project backup import
- [ ] Replace deprecated Google Maps Autocomplete

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
