# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features.

## Core Modules
1. Sauna Calculator, 2. Balia Calculator, 3. Sauna Mini-CRM, 4. Sauna Production, 5. Warehouse, 6. Sales, 7. Logistics, 8. Training, 9. Admin Panel

## Tech Stack
Frontend: React + Shadcn/UI + Tailwind CSS | Backend: FastAPI + Python | DB: MongoDB
Integrations: amoCRM, Cloudinary, Telegram, Google Maps, Google Sheets, Nano Banana (Gemini AI)

## What's Been Implemented

### Session 2 (March 20, 2026)

**CRM/Sales Enhancements:**
- Manager-specific CRM access (amoCRM name mapping in user settings)
- Date filters on CRM & Production kanban
- Custom lead title: bold client name + model below
- Per-column date sorting (↕ button in each kanban column header)
- Calendar uses readyDate
- Sales sync imports ALL CRM leads, bonus by prepaymentDate
- Custom amoCRM field IDs in CRM Settings (clientNameFieldId, modelFieldId)

**Contract Generation (UMOWA):**
- DOCX template with auto-substitution: client name, model, amounts, dates, offer number
- Backend: POST /api/sauna-crm/generate-contract → Cloudinary upload
- Client name priority: custom amoCRM field → contact → deal name  
- Deposit amount from CRM advance payment field
- Old contracts auto-replaced (document deduplication)
- Button visible on ALL kanban stages
- КП PDF and calculator PDF URLs returned for attachment

**Backup Fix:** 15 missing collections added to export/import/telegram backup

### Session 1 — Previous Work
Tech Spec PDF, Production List, Google Sheets sync (blocked), Sales automation, User access controls, Warehouse enhancements, Document deduplication

## Prioritized Backlog

### P1 - High Priority
- [ ] Fix automatic variant application bug in LayoutConfiguratorPage.jsx
- [ ] Complete Google Sheets integration (BLOCKED on user enabling APIs)
- [ ] Finalize "Save layout to order" feature end-to-end

### P2 - Medium Priority
- [ ] Refactor amocrm.py and LayoutConfiguratorPage.jsx
- [ ] UI for importing/restoring project backup
- [ ] Replace deprecated Google Maps Autocomplete
- [ ] Fix unstable login sessions

## Key API Endpoints
- POST /api/sauna-crm/generate-contract — Generate DOCX contract with dynamic mappings + KP attachment
- GET /api/sauna-crm/contract-template/settings — Template settings with mappings and available sources
- POST /api/sauna-crm/contract-template/settings — Save template mappings and attachKp flag
- POST /api/sauna-crm/contract-template/upload — Upload custom DOCX template
- GET /api/sauna-crm/contract-template/placeholders — Extract placeholders from current template
- GET /api/sauna-crm/leads?manager_username=X&date_from=Y&date_to=Z
- GET /api/sauna-crm/settings — includes clientNameFieldId, modelFieldId
- POST /api/sales/sync-from-crm — ALL CRM leads
- POST /api/backup/export — 32+ collections

**Contract Template Management System — Session 3 (March 21, 2026):**
- Custom DOCX template upload via UI (drag & drop)
- Automatic placeholder extraction from uploaded templates (regex `{{VARIABLE_NAME}}`)
- Configurable field mappings: each placeholder → CRM lead field / calculator field / computed value / static text
- 33 available source fields across 7 categories (client, payment, production, CRM fields, computed, calculator, other)
- Custom variable creation: add new `{{CUSTOM_...}}` placeholders with labels and default values
- Toggle to attach KP PDF as images at the end of the contract (Załącznik nr 1)
- KP PDF conversion to images via PyMuPDF for embedding in DOCX
- Fixed placeholder replacement: handles run-splitting in python-docx (merged runs approach)
- Old static KP image removal from template before inserting dynamic KP
- Backend: 4 new endpoints under /api/sauna-crm/contract-template/ (settings GET/POST, upload, placeholders)
- Frontend: New `ContractTemplateSettings.jsx` component integrated as "Шаблон договора" tab in CRM Settings
- Settings stored in MongoDB `contract_template_settings` collection

**Storekeeper Role (Кладовщик) — Session 3 (March 20, 2026):**
- New role 'storekeeper' with granular permissions
- Full access to Warehouse (Magazyn) — view, status changes — NO delete
- Read-only access to Logistics (Logistyka) — view trips/orders, no create/edit/delete
- canDelete = !isStorekeeper() in WarehousePage.jsx
- readOnly = isStorekeeper() in LogisticsPage.jsx
- Backend: 'storekeeper' in valid roles for create & update user endpoints
- AuthContext: isStorekeeper(), hasAccess() returns true for warehouse+logistics
- Bug fixed: update_user was missing 'storekeeper' in valid roles validation
- Bug fixed: canDelete used function reference instead of function call

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123

### Session 4 (March 24, 2026)

**Bug Fix: amoCRM Sync 500 Error (`'NoneType' object is not iterable`)**
- Fixed 7 places in `sync_leads_from_amocrm` where amoCRM API could return `null` instead of arrays
- Replaced `.get("key", [])` with `or []` pattern to handle both missing keys and `null` values
- Affected: leads list, custom_fields_values, contacts, users cache, field values
