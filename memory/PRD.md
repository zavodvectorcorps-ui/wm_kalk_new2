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
- Call Analytics Module (April 23, 2026)
  - Backend: amoCRM call sync (by pipeline/stage), Whisper transcription, GPT-5.2 analysis, rules CRUD
  - Frontend: Standalone "Анализ звонков" page (4 tabs: Sync, Managers, Calls, Rules), call detail with audio/transcript/scores
  - 7-point AI checklist: greeting, needs, presentation, objections, next_step, politeness, compliance
  - Pipeline/stage selection, language detection (pl/ru), translation, background processing
- Call Analytics improvements (April 24-25, 2026)
  - Live processing progress with auto-polling (3s during work, 15s idle) + progress bar
  - Stricter sync filter: notes are imported as calls only if they have call-type OR real audio link OR duration>0 (phone alone no longer enough)
  - /calls endpoint: `only_with_audio=true` by default — removes empty notes from list
  - POST /call-analytics/calls/purge-empty — clean already-imported garbage
  - Smart rule selection: auto-match by direction (inbound→"incoming", outbound→"cold_call") or `configJson.appliesTo`
  - Each analyzed call now stores `rule_id_used` / `rule_name_used`
  - Manager Dashboard (GET /managers/{id}/dashboard): period stats, score distribution, avg per check-list category, top recurring issues, rule breakdown, last 50 call samples
  - AI verdict (POST /managers/{id}/summary): GPT-5.2 produces verdict/strengths/weaknesses/prioritised recommendations/trainingFocus/riskFlags from aggregated stats (cached 10 min)
  - Stale-call auto-reset: any call stuck in transcribing/analyzing for >10 min → status=error. Triggered automatically on /process-all, /process-pending, plus manual /reset-stale endpoint and "Сбросить зависшие" button
  - Quality filter on /calls: `category=good|problem|critical` (≥8 / 5–7 / <5 or has_strong_negative)
  - NEW Heatmap: GET /heatmap returns matrix [manager][checklist-category]=avg score with global column averages → frontend Heatmap tab with colored cells
  - Concurrency limit: Whisper Semaphore(4), GPT analysis Semaphore(8) — prevents 429s
  - Analysis cache: hash(transcript+rule_id) → reuse previous AI verdict (re-analysis is free)
- Lead Analytics: data integrity (April 24-25, 2026)
  - Defensive client-side filter on `created_at` (amoCRM sometimes returns out-of-window leads)
  - Auto-purge of legacy leads (createdAtTs < analyticsStartDate) on every sync
  - All endpoints (`/summary`, `/managers`, `/problem-leads`, `/closed-lost`, `/leads`) default to analyticsStartDate as lower bound
  - POST /purge-before-start-date (with optional start_date param) — manual cleanup button in UI
  - GET /diagnose-sync — shows amoCRM raw count vs filtered vs would-sync-without-closed
  - "Не загружать сделки на этапах Закрыто/Потеряно" setting (default: ON)
  - Quick-period buttons (Сегодня, Эта неделя, Этот месяц, Сбросить)
  - Date-field toggle: "По созданию" / "По обработке" (firstActionAt) — filter analytics by when manager actually touched the lead
  - amoCRM GET helper now retries on 429/502/503/504/timeout with exponential backoff
- Sauna CRM: stuck-sync recovery (April 25, 2026)
  - Heartbeat field updated on every progress tick
  - Auto-reset on /sync-from-amocrm if previous sync's heartbeat is older than 5 min
  - GET /sync-status flags `status="stale"` for stuck syncs with clear hint
  - Frontend handles `stale` status: stops spinner, red toast "Нажмите Сбросить"
  - asyncio.wait_for(timeout=90) on each batch — single hung lead can't freeze the entire job
  - NEW: Duplicate detection (GET /duplicates) by phone or amocrm_id; GET groups returned with all leads
  - NEW: Smart merge (POST /merge-duplicates) — picks "winner" lead, copies non-empty fields from losers, concatenates documents/history/changeLog, deletes losers
  - Frontend: "Дубликаты" button in CRM header opens DuplicatesModal with two tabs (по телефону / по amoCRM ID), each row has "Оставить эту"
- Dark Theme (April 25, 2026)
  - ThemeToggle component (Sun/Moon icon) integrated into Header
  - Persisted in localStorage; respects prefers-color-scheme on first visit
  - initTheme() called in index.js before render to prevent FOUC

## Prioritized Backlog
- P1: Fix automatic variant application in LayoutConfiguratorPage.jsx (recurring, 5 reports)
- P2: Fix unstable login sessions / deployment timeouts
- P2: Refactor monolithic files (amocrm.py >3300 lines, widget.py, sauna_crm.py, SaunaCRMPage.jsx)
- P2: UI for backup import/restore from file
- P2: Replace deprecated Google Maps Autocomplete component

## Credentials
- Admin: admin / 159357
- Storekeeper: kladovshchik / kladovshchik123
- Marketer: marketer / marketer123
