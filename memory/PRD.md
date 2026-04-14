# WM Kalkulator - Modular Sauna Configurator PRD

## Original Problem Statement
Build a "Modular Sauna Configurator" with comprehensive CRM, production management, logistics, and sales features.

## Tech Stack
Frontend: React + Shadcn/UI + Tailwind CSS | Backend: FastAPI + Python | DB: MongoDB
Integrations: amoCRM, Cloudinary, Telegram, Google Maps, GPT-5.2 (emergentintegrations)

## Session 6 Fixes & Features (April 5-6, 2026)

### Bug Fixes
- 524 Timeout -> BackgroundTasks + progress bar
- advanceFieldId/remainingFieldId not saving -> added to Pydantic model
- New leads missing advance/comment -> extract called for new leads
- KP not attaching -> motor async + kpCloudinaryUrl fallback
- Date off-by-one -> Europe/Warsaw timezone conversion
- Sales sync wrong dates & too many records

### New Features
- Sync Progress UI with auto-detect on page load
- amoCRM Widget: KP status + warning before contract
- Webhook auto-sync for sauna section
- Periodic auto-sync scheduler (5-120 min configurable)
- Calendar: manager name in badges and order cards
- PDF: layout variants moved to Page 1, no blank pages
- Debug KP endpoint

### Sales Sync Overhaul
- salesStageId, salesPrepaymentFlagFieldId, salesDateFieldId configurable in CRM Settings

## CRM Stages
invoice_sent -> prepayment_received -> approved_by_production -> in_production -> ready -> delivered -> completed

## Session 7 Fixes (April 8-14, 2026)
- Fixed Marketer role access to FAQ Admin, Planowki editor, Layout Variants
- FAQ Layout Variants: Custom sizes, duplicate button, dynamic sorting
- Calculator: Certificate Discount logic (18% without showing %)
- PDF: Removed discount percentage, shows only amounts
- Certificate history: Auto-logging, history table in Statistics
- Model Grouping: Two-level model selection (Group -> Sub-models)
- Model Duplication: Copy button in model list
- Dynamic layout sizes: Model dialog pulls sizes from API
- Fixed "Back to groups" button in calculator
- Fixed balia calculator discount limit (uses settings instead of hardcoded 10%)
- Lead Analytics Phase 1 MVP: SLA tracking, manager ranking, problem leads
- Lead Analytics Phase 2 (AI): GPT-5.2 department summary, manager analysis, common errors, per-lead advice
- Lead Analytics Phase 3: Manager Events Analytics module (April 14, 2026)
  - Backend: amoCRM Events API sync, event normalization, per-manager stats, scoring system, AI deep analysis
  - Frontend: Integrated as "По событиям" tab in Lead Analytics page with manager table, detail view, event feed, settings
  - Tested: 100% pass rate (14/14 backend, all frontend tests)
- Closed/Lost Stage Exclusion (April 14, 2026)
  - amoCRM status 143 ("Закрыто и не реализовано") auto-excluded from main statistics (stalled, not processed, problem leads)
  - New "Закрытые" tab for monitoring closed/lost deals with per-manager breakdown
  - New /api/lead-analytics/closed-lost endpoint
  - Summary, Managers, Problem Leads — all exclude closed/lost; separate counter added
  - Settings: closedLostStageIds for custom closed stages (143 hardcoded as default)
  - AI-анализ причин закрытия: GPT-5.2 анализирует паттерны, менеджеров, рекомендации и чек-лист перед закрытием
  - Tested: 100% pass rate (20/20 + 15/15 backend, all frontend tests)
- Advanced Manager Analytics (April 14, 2026)
  - Расширенная аналитика 3 менеджеров (Vlada, Andrzej, Viyaleta) по pipeline 8969514
  - Метрики по этапам (Jeszcze nie wiem, Не дозвонились) с алертами
  - Флаг пустой суммы (>30% = предупреждение), анализ звонков (входящие/исходящие, длительность)
  - Концентрация нагрузки (>35% = алерт), дашборд "Срочные действия" (топ-10, цветовая маркировка)
  - AI сравнительный анализ менеджеров (GPT-5.2): рейтинг по 5 критериям
  - Специфические проверки: Vlada (смены этапов), Andrzej (post-КП follow-up), Viyaleta (звонки vs чаты, примечания)
  - Tested: 100% pass rate (15/15 backend, all frontend tests)

## Prioritized Backlog
- P1: Fix automatic variant application in LayoutConfiguratorPage.jsx (recurring, 5 reports)
- P2: Fix unstable login sessions / deployment timeouts
- P2: Refactor monolithic files (amocrm.py >3300 lines, widget.py, sauna_crm.py, SaunaCRMPage.jsx)
- P2: UI for backup import/restore from file
- P2: Replace deprecated Google Maps Autocomplete component

## Credentials
- Admin: admin / admin123
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
