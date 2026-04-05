# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features.

## Tech Stack
Frontend: React + Shadcn/UI + Tailwind CSS | Backend: FastAPI + Python | DB: MongoDB
Integrations: amoCRM, Cloudinary, Telegram, Google Maps

## Session 5 Features (April 4-5, 2026)

- Contract/Tech Spec links auto-push to amoCRM as notes
- amoCRM Widget: Sauna CRM section, dates, contract button, advance/remaining
- Collapsed stages (kanban), amoCRM stage sync (pipeline_id + status_id)
- Sync-from-amoCRM updates existing cards (stage, budget, fields, comment)
- Production dates auto-push to amoCRM
- Change History (changeLog), warning badge (!), amoComment from managers
- Per-lead sync button "Обновить из amoCRM"
- Standard amoCRM field mapping (_budget, _name, _responsible)
- KP auto-linking during sync
- **Advance/Remaining**: advanceFieldId/remainingFieldId settings, green/amber badges on kanban/list cards, widget shows correct advance+remaining from amoCRM

## CRM Stages
invoice_sent → prepayment_received → approved_by_production → in_production → ready → delivered → completed (collapsed)

## Prioritized Backlog
- P1: Fix automatic variant application in LayoutConfiguratorPage.jsx
- P2: Refactor amocrm.py/widget.py, UI backup import, Google Maps Autocomplete

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
