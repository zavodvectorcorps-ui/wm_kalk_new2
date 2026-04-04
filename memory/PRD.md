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
- After contract generation (`generate_contract_with_kp`), link is automatically pushed to amoCRM as a note
- After tech spec PDF generation (`generate_tech_spec_pdf`), link is pushed to amoCRM as a note
- Both check for `amocrm_id` on the CRM lead and amoCRM credentials before sending
- Graceful fallback when amoCRM credentials not configured

**amoCRM Widget Enhancements (Sauna CRM):**
- Widget now shows separate "Сауна — CRM" section with data from `sauna_crm_leads` collection
- Displays: CRM ID, client name, model, total amount, payment (advance), dates (prepayment, ready, production)
- Shows document statuses: Contract (Yes/No), Tech Spec (Yes/No) with clickable links
- "Создать договор" / "Пересоздать договор" button directly in widget, calls `/api/sauna-crm/generate-contract`
- Proper CRM stage status displayed (from `sauna_crm_settings.stages` or local map)
- Non-sauna orders (balia/greenhouse) continue to show classic "Детали заказа" format
- Fixed HTML typo (extra `>` in widget div)

**CRM Stages Updated:**
- invoice_sent: Выставлен счёт
- prepayment_received: Предоплата получена
- approved_by_production: Согласован производством (NEW)
- in_production: В производстве
- ready: Готов
- delivered: Доставлен

### Session 4 (March 24, 2026)
- Fixed amoCRM Sync 500 Error
- Fixed CRM lead linking (crmLeadId loss on reload)
- Manual order relinking in CRM card
- Configurable date field for CRM filtering/calendar
- "Без печи" + "Электрическая печь" heater variants
- "Развернуть маршрут" button in Logistics
- Sales/bonuses from CRM leads by prepaymentDate
- Dynamic contact info in PDF templates

### Session 3 (March 21, 2026)
- Contract Template Management System (DOCX templates, placeholders, mappings)
- Storekeeper Role with granular permissions

### Session 2 (March 20, 2026)
- Manager-specific CRM access, Date filters, Custom lead titles
- Sales sync, Bonus calculations, Contract generation

### Session 1
- Tech Spec PDF, Production List, Google Sheets sync (blocked), User access controls

## Prioritized Backlog

### P1 - High Priority
- [ ] Fix automatic variant application bug in LayoutConfiguratorPage.jsx
- [ ] Complete Google Sheets integration (BLOCKED on user enabling APIs)
- [ ] Finalize "Save layout to order" feature end-to-end

### P2 - Medium Priority
- [ ] Refactor amocrm.py and LayoutConfiguratorPage.jsx (monolithic files)
- [ ] UI for importing/restoring project backup
- [ ] Replace deprecated Google Maps Autocomplete
- [ ] Fix unstable login sessions

## Key API Endpoints
- POST /api/sauna-crm/generate-contract
- POST /api/sauna/generate-tech-spec-pdf
- POST /api/integrations/amocrm/upload-calculator-pdf
- GET /api/widget/embed/{lead_id} (amoCRM widget)
- GET /api/sauna-crm/settings
- PUT /api/sauna-crm/settings/stages

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
