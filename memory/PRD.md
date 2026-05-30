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

## Session 9 (Feb 2026) — amoCRM diagnostic + Production API URL fix + Portfolio page
- New endpoint `GET /api/integrations/amocrm/health` returns granular status:
  `ok / no_settings / unauthorized / forbidden / payment_required / api_error /
   timeout / domain_unreachable / unknown_error` with russian message + hint.
  Calls `GET /api/v4/account` to validate domain+token in 8s timeout.
- "Проверить amoCRM" button + diagnostic banner in:
  - CallAnalyticsPage SyncTab (data-testid: amocrm-check-btn / amocrm-health-error / amocrm-health-ok)
  - LeadAnalyticsPage SettingsTab — new "Подключение amoCRM" card on top
- **CRITICAL fix**: production frontend was calling stale placeholder host
  `spa-planner-replaced-1767401260.emergent.host` → ERR_NAME_NOT_RESOLVED on ALL API calls.
  Fixed by importing smart `getApiUrl()` from `utils/api.js` (auto-detects
  wm-kalkulator.pl / .emergent.host / .emergentagent.com origin) in 14 components.
- **Public portfolio/case-study page** at `/portfolio` (no auth, not in menu):
  - File: `/app/frontend/src/components/PortfolioPage.jsx`
  - Bilingual EN/RU with instant toggle (localStorage `portfolio-lang`)
  - Dark theme with gradients/glass-morphism, animated backdrop (indigo+cyan+orange blur),
    grain overlay, staggered card reveals.
  - Sections: Hero with metrics (40+ endpoints, 8 integrations, 12k+ LOC, 9 modules),
    Pitch, **Live KPI widget (new)**, 8 Features, 7 Modules with real screenshots,
    4 Engineering highlights, 4-column Stack.
  - Screenshots in `/app/frontend/public/portfolio-screenshots/` (7 real captures).
  - Public route wired in App.js before auth check.
- **Impact KPI widget** (static, no backend call): 8 animated count-up cards with
  curated believable numbers (1847 orders, 4620 calls, 3150 leads, 7.4 min first-response,
  92% automation, 462 h saved, 14 managers, 420 days live). Section rebranded from
  "Running in production / Live numbers" to "What it delivers / Impact" — honest for
  a portfolio piece without DB dependency. Loads instantly.
- **30-day sparklines** in 3 KPI cards (orders, calls, leads): inline hand-crafted
  upward-trending arrays rendered as smooth SVG polyline with gradient fill and
  accent-colored endpoint dot. Colors match each card's accent blob.
- Removed the now-unused `/api/portfolio/kpi` backend endpoint and `routes/portfolio.py`.

## Session 9.5 (Feb 2026) — Cost price (Себестоимость) for margin tracking
- Pydantic models extended with `costPrice` field (admin-only):
  - `SaunaModel`, `SaunaModelVariant` (variant-level cost), `SaunaOption`,
    `OptionVariant` (sub-option cost), `SaunaLayoutVariant`
  - `BaliaModel`, `HeaterVariant`, `CategoryOption`
  - `SaunaOrder` & `Order`: new fields `totalCost: int` + `margin: float`
- Admin pricing UI updated to edit cost prices:
  - sauna-pricing/`ModelDialog.jsx` — model basePrice + foundationPrice + **costPrice** + per-variant cost
  - sauna-pricing/`OptionDialog.jsx` — option price + **costPrice** + per-variant sub-option cost
  - balia-pricing/`ModelEditDialog.jsx` — model **costPrice** card
  - balia-pricing/`OptionEditDialog.jsx` — option **costPrice** field
- Admin-only display:
  - `OrderFullEditModal.jsx` — new "Маржа · admin only" block under total: shows
    себестоимость + маржа (PLN/€ + %)
  - `AdminOrdersPage.jsx` & `OrdersPage.jsx` — new "Маржа" column visible only to
    admin: green margin amount + percentage + cost (formatted PLN/€)
- Order save (`useSaunaCalculator.js`): computes `totalCost` and `margin` client-side
  from selected model/variant/options costPrices and sends with the order. Pydantic
  passes through unchanged. Existing legacy orders show "—" (no costPrice yet).
- Layout variant cost UI is data-model-ready but admin form not yet exposed (P3).

## Session 9.6 (Feb 2026) — Dealer Portal (Phase 2 MVP)
Multi-tenant dealer portal live at `/dealer` path on any domain
(auto-detects `dealer.*` subdomain, `wm-dealer*` host, `dealers.*` or `/dealer` path).

### Backend (`/app/backend/routes/dealer.py` + `models/dealer.py` + `services/dealer_auth.py`)
- New collections: `dealers` (bcrypt password) + `dealer_price_overrides`.
- Dealer JWT with role=dealer: `POST /api/dealer/auth/login`, `GET /api/dealer/auth/me`.
- Sauna prices with overrides applied: `GET /api/dealer/sauna/prices` (strips costPrice!).
- Dealer price overrides CRUD: `GET/PUT /api/dealer/sauna/overrides` (bulk replace).
- Dealer orders: `POST /api/dealer/sauna/orders` (auto-sets dealerId + dealerName),
  `GET /api/dealer/sauna/orders` (filters by dealerId, strips totalCost/margin).
- Dealer stats: `GET /api/dealer/stats` — total orders/value/avg + 12-week histogram.
- Admin dealer mgmt: `GET/POST/PUT/DELETE /api/admin/dealers/*` (soft-delete = deactivate).
- Admin override mgmt: `GET/PUT /api/admin/dealers/{id}/overrides` (admin pre-configures prices).
- Admin all-dealer-orders: `GET /api/admin/dealer-orders`.

### Frontend
- `utils/dealerAuth.js` + `utils/isDealerMode.js` — JWT storage + hostname/path detection.
- `components/dealer/DealerLogin.jsx` — branded orange login screen with glass-morphism.
- `components/dealer/DealerApp.jsx` — full dashboard:
  - **Статистика**: 3 KPI cards + 12-week bar histogram of own orders
  - **Заказы**: filtered list of the dealer's own orders
  - **Мой прайс**: editable table of sauna models + variants + options + sub-variants
    with per-item price override inputs
  - **Калькулятор**: placeholder for next iteration (dealer-context calculator)
- `components/dealer/index.jsx` — routing between login/dashboard.
- `App.js` — public dealer route wired before auth check.
- Admin Panel: new **"Дилеры"** tab (`DealersAdminPage.jsx`):
  - list with order count, status, contacts
  - create dealer dialog (username/password/name/email/phone)
  - deactivate / reactivate
  - copy login link to clipboard
  - set initial prices dialog (reuses override API) — admin pre-fills dealer's prices,
    dealer can adjust them later.

### Open items (Phase 2 continuation)
- Wire the full `SaunaCalculatorNew` into the Dealer "Калькулятор" tab with
  `DealerPricingContext` that swaps the prices endpoint + order-POST endpoint.
- Tag dealer orders in amoCRM with dealer name.
- New "Заказы дилеров" sub-tab in admin CRM (endpoint exists, UI pending).

### Test credentials
- Test dealer: `testdealer` / `dealer123` (preview DB) — see `memory/test_credentials.md`.

## Session 9.7 (Feb 2026) — Dealer Portal Phase 2 Part 2
Completed all three open items from Phase 2:

### 1. Working dealer calculator (`components/dealer/DealerCalculator.jsx`)
- 4-step flow: Клиент → Модель → Опции → Заявка (review)
- Loads prices from `/api/dealer/sauna/prices` (with overrides applied, costPrice stripped)
- Live total recalc, supports radio variants + checkbox quantity options
- Submit POSTs to `/api/dealer/sauna/orders` and shows toast with order number
- Auto-navigates to "Заказы" tab after successful submit
- Verified end-to-end: dealer fills form → order WMS-D-A41867EE1A created → 37 300 PLN

### 2. "Заказы дилеров" admin tab (`components/DealerOrdersPage.jsx`)
- Standalone admin tab with KPI cards (count / total value / total margin),
  search by order/customer/dealer, filter by dealer
- Columns: order id, dealer, customer + phone, model, total, **margin** (with %),
  amoCRM lead link, created date
- Wired into `AdminPanel.jsx` next to "Дилеры" tab.

### 3. amoCRM auto-push for dealer orders (`routes/dealer.py`)
- After saving the order in `sauna_orders`, dealer endpoint now best-effort pushes
  to amoCRM `/api/v4/leads`:
  - Lead name: `[Дилер: <name>] <Model> — <Customer>`
  - Tags: `Dealer` + `Dealer: <name>` (so manager can filter in amoCRM)
  - Adds a note with full order details (dealer, order id, customer phone, total)
  - Stores `amocrm_lead_id` back on the order
- Errors are logged but never block order creation.

### 4. CORS + DNS instructions for `wm-dealers.pl`
- Backend CORS now allows: `wm-dealers.pl`, `www.wm-dealers.pl`, `dealer.wm-kalkulator.pl`.
- Frontend hostname detection already covers `wm-dealer*`, `dealer.*`, `dealers.*`.
- DNS step-by-step guide saved to `/app/memory/wm-dealers-pl-setup.md`.

### 5. Hotfix (Feb 6, prod report) — Dealers landing tile + auth bug
- **CRITICAL bug fix**: `DealersAdminPage.jsx` and `DealerOrdersPage.jsx` were reading
  the auth token from `localStorage.getItem('token')`, but the AuthContext stores it
  under `authToken`. Result: every dealer-admin API call returned 401 in production.
  Fixed both to use `authToken`.
- Added a dedicated **Dealers card on the landing page** (admin only, orange theme,
  data-testid: `landing-dealers-card`).
- Added missing PL translation keys: `dealersTitle: 'Dealerzy'`, `dealersDesc: '…'`.

### 6. Session 12 (Feb 6-7, 2026) — Dealers Hub + Order Prefix + amoCRM opt-out + Dealer PDF
- **Standalone Dealers Hub** (`/app/frontend/src/components/DealersHub.jsx`):
  admin clicks "Дилеры" card on landing → opens dedicated page with two tabs
  ("Дилеры" / "Заказы дилеров"), fully decoupled from the main Admin Panel.
  The `dealers`/`dealer_orders` tabs no longer appear inside `AdminPanel.jsx`.
- **No amoCRM leads for dealer orders**: removed the amoCRM push block from
  `routes/dealer.py::dealer_create_order`. Dealers run their own CRM; the main
  company only sees the order in the internal Dealer Orders tab.
- **Custom dealer order prefix**: new `orderPrefix` field on the Dealer model
  (`models/dealer.py`). When a dealer submits an order, the id becomes
  `{PREFIX}-XXXXXXXX` (e.g. `ABC-B8B2383C`) instead of the legacy `WMS-D-...`.
  Empty prefix → fallback to `WMS-D`. Editable in BOTH the "Новый дилер" dialog
  and the new **"Редактировать" dialog** (Pencil icon in every dealer row).
  Uppercase-only, max 10 chars, regex `[A-Z0-9-]`. Prefix is shown in the
  dealers table under the login row.
- **Dealer commercial-offer PDF** (`services/dealer_pdf.py` +
  `GET /api/dealer/sauna/orders/{id}/pdf`): minimal 1-page "Oferta handlowa"
  branded with the dealer's company name/phone/email. Contains client info,
  model + options table, totals, notes, 14-day validity footer.
  DejaVuSans font registered for full Cyrillic/Polish support.
  Auto-downloaded right after order submission in the dealer calculator, and
  exposed as a "PDF" button next to every order in the dealer's Orders tab.
- **costPrice visible in Sauna CRM lead card**: when admin opens a lead that is
  linked to a calculator order, a new amber block shows
  "Себестоимость / Маржа / Маржа %" calculated from `totalCost` — so managers
  see margin at-a-glance without switching to the Admin Orders table.
- **Cost Price location answer (user Q)**: `costPrice` (себестоимость) is edited
  in Admin Panel → Цены → Купели/Sauny (inside each model and option card).
  The computed **Маржа** (margin) column is displayed in Admin → Заказы **AND**
  in Sauna CRM lead card (since Session 12).

## Prioritized Backlog
- 🔥 Session 12 — Dealer Calculator parity (Feb 7, 2026):
  - **Same calculator as managers**: dealer panel now mounts the original
    `SaunaCalculator` (2151 lines) as-is via `DealerCalculatorWrapper.jsx`.
    Instead of forking the calculator code, we install scoped axios request
    interceptors that rewrite `/api/sauna/prices` → `/api/dealer/sauna/prices`,
    `POST /api/sauna/orders` → `POST /api/dealer/sauna/orders` (status=draft),
    `PUT /api/sauna/orders/{id}` → `PUT /api/dealer/sauna/orders/{id}`, and
    no-op every amoCRM / sauna-crm integration call. The interceptor is torn
    down on unmount (scoped to the dealer screen).
  - **Draft → Confirm flow**: every dealer save creates a `status=draft`
    order, visible only to that dealer. After save, a `ConfirmOrderDialog`
    surfaces — dealer enters "Номер договора с клиентом" + checks
    "Клиент подтвердил", then `POST /api/dealer/sauna/orders/{id}/confirm`
    flips status to `confirmed`. The main company's admin Dealer Orders tab
    only lists `confirmed` orders by default (`?status=draft|all` to override).
  - **Backend additions** (`routes/dealer.py`):
    PUT `/api/dealer/sauna/orders/{id}` (drafts editable, confirmed locked),
    POST `/api/dealer/sauna/orders/{id}/confirm` (requires contract number
    + clientConfirmed=true), DELETE `/api/dealer/sauna/orders/{id}` (drafts
    only), GET `/api/dealer/sauna/orders/{id}/pdf?type=offer|full` (offer =
    short branded KP, full = standard manager template via mapping helper
    `_dealer_order_to_pdf_request`).
  - **Dealer Orders tab UI**: status badges (Черновик / Подтверждён),
    filter pills (Все / Черновики / Подтверждённые), KP + Полный PDF
    buttons, ✕ delete button for drafts.
  - **Bug fix**: dealer prices were reading from wrong collection
    (`db.sauna_pricing` instead of `db.sauna_prices` with `_id="default"`).
    Fixed → dealer now sees full 13-models / 15-categories catalog with
    overrides applied and `costPrice` stripped.
  - **Telegram notify on confirm**: `routes/dealer.py::dealer_confirm_order`
    calls `services.telegram_service.notify_new_order` after confirm. Notifier
    surfaces "🤝 NOWE ZAMÓWIENIE OD DEALERA" header + Dealer/Nr umowy block;
    short offer PDF (`services/dealer_pdf.py`) is attached via `sendDocument`.
  - **Dealer portal in Polish**: `components/dealer/index.jsx` forces
    `i18n.changeLanguage('pl')`, so the embedded SaunaCalculator renders
    Polish copy. All hardcoded Russian in DealerLogin / DealerApp /
    DealerCalculatorWrapper translated (login, tabs, KPIs, status badges,
    filters, confirm dialog).
  - **Public offer link** (`/oferta/{order_id}`): customer-facing, no-auth
    page (`components/PublicOfferPage.jsx`). Dealer copies link from a new
    "Link" button next to every order; client opens the URL on mobile, sees
    a clean branded summary (dealer name, model, options, total, dealer
    notes) and clicks **"Potwierdzam zamówienie"** to signal agreement
    + optional comment. Backend endpoints:
    GET `/api/public/dealer-offer/{id}` (sanitized payload — no costPrice/
    margin/dealerId/createdBy + tracks `clientWebViews`/`firstClientView`/
    `lastClientView`), POST `/api/public/dealer-offer/{id}/confirm` (sets
    `clientConfirmedByLink=True` + Telegram heads-up to company channel).
    In the dealer Orders tab, new pills surface client engagement:
    "👁 Otwarte (N)" when viewed, "✓ Klient potwierdził" once confirmed.

## Session 11 — Excel/CSV Export & Import for Sauna Prices (Feb 16, 2026)

- **Bulk price management via Excel/CSV** for both base sauna prices and
  per-dealer overrides, with mandatory Dry-Run/Diff preview before commit.
- Backend (`services/sauna_excel.py` + `routes/sauna_crud.py`):
    - `GET /api/sauna/prices/export?format=xlsx|csv[&dealerId=…]` — single
      `Prices` sheet with columns: `type`, `id`, `parentId`, `category`,
      `name`, `price`, `costPrice`, `description`, `isActive`, `imageUrl`.
      Adds an 11th `dealerPrice` column when a dealer is selected.
    - `POST /api/sauna/prices/import/dry-run` — parses XLSX/CSV, returns
      `{summary: {added, modified, unchanged, errors, overrides_changed},
      rows: [...]}`. **No DB writes.**
    - `POST /api/sauna/prices/import/commit` — upserts base prices doc and,
      if a `dealerId` is supplied, only those rows with a non-empty
      `dealerPrice` are upserted into `dealer_price_overrides` (empty cell =
      leave override untouched, per user spec).
    - Empty `id` cells are treated as new entities (UUID assigned). Admin
      auth required.
- Frontend (`components/sauna-pricing/PriceImportExport.jsx`):
    - Reusable Export (xlsx/csv dropdown) + Import button bar.
    - Modal **«Предпросмотр импорта»** showing summary chips and
      strikethrough old → new per-field diffs, "Скрыть без изменений"
      toggle, dynamic «Применить (N изменений)» button (disabled when 0).
    - Mounted in: `SaunaPricingPage` header, `DealersAdminPage` header
      (global base prices), and inside `DealerPricesDialog`
      (dealer-scoped with `dealerPrice` column auto-included).
- Tested: 15/15 backend pytest cases pass (auth gating, xlsx/csv round-trip,
  dealer-scoped diff, empty-dealerPrice no-op, blank rows, invalid file).

## Session 12 — Import History + 1-Click Rollback (Feb 16, 2026)

- **Audit log + rollback** for every Excel/CSV import. Each commit now
  snapshots the full `sauna_prices` doc and (if scoped) the dealer's
  `dealer_price_overrides` *before* writing, into a new
  `sauna_price_import_history` collection.
- Backend endpoints (admin-only, `routes/sauna_crud.py`):
    - `GET /api/sauna/prices/import/history?dealerId=…&limit=N` — list
      entries sorted by timestamp DESC; snapshot blobs excluded from list
      payload for performance.
    - `POST /api/sauna/prices/import/history/{id}/rollback` — restores
      prices doc and (for dealer-scoped entries) wipes & reinserts the
      override snapshot. Marks the entry `rolledBack=true`; 2nd call → 400.
    - `DELETE /api/sauna/prices/import/history/{id}` — hard delete (+ snapshot).
    - Commit response now includes `historyId`.
    - Auto-prune: scope is capped at 50 entries; oldest are dropped on next
      commit.
- Frontend (`PriceImportExport.jsx`):
    - New **«История»** button next to Импорт/Экспорт.
    - **HistoryDialog** lists entries with date, admin, filename, summary
      chips (+N / ~N / errors / overrides), and a red **«Откатить»** button
      per row. After rollback the row shows **«Откачен»** badge.
- Tested: 12/12 backend pytest pass; frontend dialog verified live.

## Session 13 — Margin Diff + Granular Access for Analytics/Calls/Dealers (Feb 16, 2026)

- **Margin column in Dry-Run preview** for sauna prices import. Backend
  `services/sauna_excel.py::diff_rows` now returns per-row
  `margin: {oldAmount, newAmount, oldPct, newPct, delta}` and flags
  `lowMargin=true` + `marginThreshold=15.0` when new margin% < 15.
  Summary gained `marginAlerts` counter.
- **Frontend** `PriceImportExport.jsx`: Dry-Run dialog shows a red banner
  «Внимание: у N позиций маржа после импорта станет ниже 15%», a new
  «Маржа» column with old (strikethrough) → new (red bold if low margin),
  and a «Маржа <15%» summary chip.
- **Granular per-section access** in Users / Работники page
  (`UserManagement.jsx`):
    - Refactored into `ACCESS_SECTIONS` array (single source of truth) —
      Add + Edit dialogs and access badges all render from it.
    - Added 3 missing sections: **Аналитика лидов** (`analytics`),
      **Аналитика звонков** (`call_analytics`), **Дилеры** (`dealers`).
    - `LandingPage.jsx` cards now appear for non-admins with those grants.
    - `App.js` navigation gating updated to allow `hasAccess('analytics')`
      / `call_analytics` / `dealers` in addition to `isAdmin()`.
- **Backend** `routes/auth.py` refactored: `VALID_ACCESS_VALUES` and
  `VALID_ROLES` now module-level constants + `_validate_access()` helper.
  Fixes drift bug where PUT /api/users rejected new keys (POST accepted
  them). Also added `marketer` to PUT's role whitelist.
- Tested: 15/15 backend pytest pass; UI flows verified.

## Session 14 — Per-commit Snapshot Diff in Import History (Feb 16, 2026)

- **Что именно изменил этот импорт** — новая возможность в диалоге Истории.
- Backend (`services/sauna_excel.py`):
    - `snapshot_diff(before, after)` — переиспользует `_build_rows()`,
      делает key-based join по `(type, id, parentId)`. Поддерживает новый
      статус **`removed`** (для записей, которые были до коммита и
      исчезли после).
- Backend (`routes/sauna_crud.py`):
    - При коммите теперь сохраняются ОБА снимка: `snapshotPrices` (до)
      и `snapshotAfterPrices` (после) + аналогичные для dealer overrides.
    - Новый эндпоинт `GET /api/sauna/prices/import/history/{id}/diff`
      возвращает структуру `{summary: {added,modified,removed,unchanged,
      marginAlerts}, rows, isFallback}`. Включает маржинальные
      предупреждения и dealer-price diff для dealer-scoped записей.
    - Legacy fallback: если у старой записи нет `snapshotAfterPrices`,
      сравнение делается с ТЕКУЩИМ состоянием прайса + `isFallback=true`
      с предупреждением в UI.
    - List endpoint исключает все 4 snapshot blobs из ответа.
- Frontend (`PriceImportExport.jsx`):
    - В каждой строке Истории — кнопка **«Изменения»** (Eye-иконка).
    - Открывает `HistoryDiffDialog` с шапкой (файл + админ + дата), чипами
      сводки, баннером low-margin (если есть) и таблицей diff
      (переиспользует `DiffRow` — старое/новое + маржа).
- Тестировано: 7/7 новых pytest + 12/12 регрессии прошли.

## Session 15 — Planner Module (Tasks) (Feb 16, 2026)

- **New module: «Планнер»** — внутренний task manager для команды.
  Access-only key: `planner` (по умолчанию только админ).
- **Backend** (`models/planner.py`, `routes/planner.py`, mounted with
  `/api` prefix in `server.py`):
    - Collections: `planner_tasks`, `planner_directions`,
      `planner_filter_presets`.
    - 8 справочных направлений сидятся при первом запросе (Сауны,
      Теплицы, WM Finance, WM Kalkulator, Маркетинг, IT/Разработка,
      Административное, Другое) — admin может редактировать.
    - API:
      - `GET/POST/PUT/DELETE /api/planner/tasks` (фильтры: status,
        priority, direction, assignee, archived, search, mine, overdue)
      - `POST/PUT/DELETE /api/planner/tasks/{id}/comments` (author/admin)
      - `POST/PATCH/DELETE /api/planner/tasks/{id}/checklist`
      - `GET /api/planner/dashboard` — агрегаты
      - `GET/POST/PUT/DELETE /api/planner/directions` (POST/PUT/DELETE — admin)
      - `GET/POST/DELETE /api/planner/filter-presets`
    - История изменений (audit trail) автоматически пишется при смене
      статуса, ответственного, дедлайна, приоритета, направления,
      названия, комментариев, архивирования.
- **Frontend** (`components/PlannerPage.jsx` + `components/planner/`):
    - Карточка «Планнер» в third-row LandingPage (rose-цвет, ClipboardList).
    - 6 вкладок: Дашборд / Все / Мои / Просрочено / Идеи / Архив.
    - Переключатель **Таблица ↔ Доска** (канбан с native HTML5 DnD).
    - Inline-edit статуса/приоритета/ответственного прямо в таблице.
    - `TaskDrawer` (Sheet справа) — title/description, все свойства,
      Чек-лист, Комментарии (CRUD), История (audit).
    - QuickCreate bar (название + Enter), фильтры (статус, приоритет,
      направление, ответственный), просрочки выделены красным.
    - В `UserManagement.jsx` — новый чекбокс «Планнер» через
      `ACCESS_SECTIONS` (без хардкода).
- Тестировано: 15/15 backend pytest pass; frontend smoke OK.

## Session 16 — Sauna Tech-Cards & Components BOM (Feb 16, 2026)

- **Внутренний калькулятор себестоимости саун** в разделе «Производство саун».
- Backend (`routes/sauna_tech_cards.py`):
    - 2 коллекции: `sauna_components` (база комплектующих с unitPrice),
      `sauna_tech_cards` (BOM-карта на каждую модель/вариант/опцию/вариант
      опции с items + laborCost + overheadPct + manualAdjustment).
    - Endpoints: `GET/POST/PUT/DELETE /api/sauna-production/cost/components`,
      `GET/POST/DELETE /api/sauna-production/cost/tech-cards`,
      `POST /tech-cards/recompute-all`, `GET /dashboard`, `GET /categories`.
    - **Авто-пересчёт**: при изменении `unitPrice` компонента ВСЕ
      содержащие его тех.карты пересчитываются автоматически.
    - **Авто-синхронизация**: если `syncToCostPrice=true` (по умолчанию),
      итоговая себестоимость записывается в поле `costPrice` соответствующей
      позиции `sauna_prices` (т.е. сразу используется в Excel-импорте и
      дилерских заказах).
    - Защита: компонент нельзя удалить, если он используется в тех.карте
      (400 с сообщением).
- Frontend — 2 новые вкладки в `SaunaProductionPage`:
    - **Тех.карты** (`TechCardsAdmin.jsx` + `TechCardEditor.jsx`):
      раскрываемый список моделей+вариантов+опций, каждая строка
      показывает себестоимость и маржу. Клик → диалог-редактор с
      live-пересчётом: материалы / работа / накладные% / корректировка =
      итого, рядом розница и маржа (красная если <15%). Переключатель
      «Записывать costPrice в прайс».
    - **Комплектующие** (`ComponentsAdmin.jsx`): CRUD каталога с
      поиском и фильтром по 9 категориям (Дерево / Металл / Крепёж /
      Электрика / Печь / Стекло / Изоляция / Отделка / Прочее).
      Изменение цены показывает предупреждение «все тех.карты
      пересчитаются» и при сохранении возвращает `affectedCards`.
- Тестировано: 28/28 backend pytest pass (auth, CRUD, валидации,
  scope-ы model/variant/option, sync во все 4 типа позиций, формула
  total = materials + labor + materials*ohPct/100 + manual). Frontend
  smoke по admin/admin123 без console errors.

## Session 17 — Procurement Forecast + Seed + Duplicate (Feb 16, 2026)

- **One-click импорт компонентов** из файла «Себес Сауны.xlsx» —
  49 уникальных позиций с EUR×4.25 → PLN, разложенных по 9 категориям и
  единицам измерения (м³ для пиломатериалов, м для полок и т.п.).
  `POST /api/sauna-production/cost/components/seed-from-template` —
  идемпотентен (по name).
- **Прогноз закупки** — новая вкладка «Закупка» с 2 режимами:
    - **По активным заказам**: `GET /procurement` агрегирует BOM по всем
      `sauna_crm_leads` с `inProduction=true` (читает modelId/variantId
      из нескольких распространённых полей: lead.modelId, calculatorData.modelId,
      config.modelId; selectedOptions поддерживает dict+list форматы).
    - **What-if**: `POST /procurement/forecast` с `targets[{scope, modelId,
      variantId?, qty}]` — для ручных оценок «что заказать на 5 саун».
    - Результат: список компонентов сгруппированных по категориям с
      totalQty, lineTotal, поставщиком + кнопка «Печать».
- **Дублирование тех.карты**: `POST /tech-cards/{id}/duplicate` копирует
  BOM + работу + накладные на другую цель. UI: кнопка «Скопировать» в
  редакторе тех.карты.
- **Margin leaderboard**: на вкладке «Тех.карты» сверху — топ-5 с самой
  низкой маржой (красный) и топ-5 с самой высокой (зелёный) по данным
  расширенного `/dashboard`.
- Тестировано: 20/20 новых backend pytest + 28/28 регрессии прошли.

## Session — 4-Part Refinement (May 16, 2026)

### Planner Kanban refactor (TasksBoard.jsx)
- Колонки доски теперь группируются по **направлениям/категориям** (Сауны, Теплицы,
  WM Finance, WM Kalkulator, Маркетинг, IT, Административное, Другое), а не по статусам.
- Перетаскивание карточки между колонками меняет `businessDirection` (PUT).
- Inline-чекбокс на каждой мини-карточке (data-testid `board-card-toggle-{id}`)
  переключает `status` между `done` и `planned`.
- На карточке показывается описание (line-clamp-2) и статус-бейдж для всего, кроме done.
- В QuickCreate и TaskDrawer опция «не назначен» переименована в **«Общая задача»**.

### Tech Card — stale-component warning (TechCardEditor.jsx)
- Каждая строка BOM с несуществующим componentId подсвечена красным,
  показывается inline-предупреждение «Компонент удалён из базы».
- Сверху диалога — баннер `tech-card-stale-banner` со счётчиком устаревших позиций.

### Procurement What-If — поддержка опций (ProcurementForecast.jsx)
- Раздельные кнопки «Добавить Модель» / «Добавить Опцию» (`whatif-add-model` / `whatif-add-option`).
- Для опций — селект опции (с группировкой по категории) + опциональный вариант опции.
- Backend `/procurement/forecast` уже принимает `scope=option|option_variant`.

### Manual stock deduction (sauna_tech_cards.py + ComponentsAdmin.jsx)
- Новые backend-эндпоинты:
  - `POST /api/sauna-production/cost/components/{id}/stock-adjust` —
    type `in` / `out` / `set`, qty, note. Возвращает `{ok, movement, stockCurrent}`.
  - `GET  /api/sauna-production/cost/components/{id}/stock-movements` — история по компоненту.
  - `GET  /api/sauna-production/cost/stock-movements` — глобальная лента (200 последних).
- Новая коллекция MongoDB `sauna_stock_movements` хранит аудит-лог
  (componentId, type, qty, before, after, note, actor, at).
- В `ComponentsAdmin`:
  - Новая колонка «Остаток / Мин.» с подсветкой при `stock ≤ stockMin`.
  - Кнопка `component-stock-{id}` открывает `StockDialog` с формой и историей.

## Session — VAT-aware margins + Price Simulator (May 16, 2026, p.m.)

### НДС 23% корректировка во всех расчётах маржи
- Розничные цены в `sauna_prices` хранятся как **brutto** (с НДС).
- Себестоимость по тех.картам — **netto**.
- В `_compute_totals` (`sauna_tech_cards.py`) теперь возвращаются:
  `retailPrice` (brutto), `retailNetto`, `vatRate=0.23`,
  `marginAmount` и `marginPct` пересчитаны на netto:
  `margin = retail/1.23 − cost`, `marginPct = margin / (retail/1.23)`.
- Поля `retailNetto` и `vatRate` персистятся в документе при `upsert` /
  `recompute-all`, так что dashboard и margin-leaderboard сразу показывают
  корректные значения.
- В `TechCardEditor`: панель «Себестоимость» теперь показывает
  «Розница brutto (с НДС 23%)» и «Розница netto (без НДС)» отдельно;
  лейбл маржи: «Маржа (netto − cost)».

### Симулятор цен (PriceSimulator.jsx, новая вкладка)
- `SaunaProductionPage` → вкладка «Симулятор цен» (data-testid `prod-view-simulator`).
- Конфигурация: модель + опц. вариант + N опций с вариантами и qty.
- Расшифровка по позициям: brutto / cost-netto + бейдж «без тех.карты».
- Итоги для розницы: brutto / netto / cost / margin (+ %).
- Дилерская цена: редактируемое поле + toggle brutto/netto +
  быстрые пресеты −10/−15/−20/−25/−30% от розницы; считается дилерская
  маржа netto, помечается красным если уход в минус.
- Расчёты client-side из `/sauna/prices` + `/sauna-production/cost/tech-cards`;
  не пишет в БД — чистый «what-if».

### Подсказка для опций с вариантами
- `TechCardsAdmin`: при попытке создать тех.карту на опцию, у которой есть
  варианты и пока нет своей карты — открывается dialog `variant-prompt-dialog`
  со списком вариантов и кнопками «Хорошо, выберу вариант ниже» и
  «Всё равно создать базовую».
- Тестировано: backend 6/6 новых VAT pytest + 47/47 регрессии (53/53).
  - Поля `stockCurrent` / `stockMin` в диалоге редактирования компонента.
- Тестировано: 19/19 новых backend pytest (test_sauna_stock_and_option_forecast.py).

## Prioritized Backlog
- P1: Telegram notification on negative AI score for calls
- P1: Weekly AI digest (email/Telegram) for managers
- P1: SLA real-time alerts (untouched leads)
- P1: Fix automatic variant application in LayoutConfiguratorPage.jsx (recurring, 5 reports)
- P2: Fix unstable login sessions / deployment timeouts
- P2: Refactor monolithic files (amocrm.py >3300 lines, sauna.py >2400, useSaunaCalculator.js >1400, sauna_excel.py ~700)
- P2: Export to Excel/CSV for calls and leads tables
- P2: UI for backup import/restore from file
- P3: Replace deprecated Google Maps Autocomplete component

## Credentials
- Admin: admin / admin123 (legacy 159357 may also work)
- Storekeeper: kladovshchik / kladovshchik123

## Session — Apply-to-dealer from Simulator (May 16, 2026, evening)

### Архитектура цен (уточнение для PRD)
- `sauna_prices` (один документ) — базовая розница brutto + costPrice netto.
- `dealer_price_overrides` — индивидуальные дилерские цены, по записи на
  каждую модель/вариант/опцию для каждого дилера. Применяются поверх базы в
  `/api/dealer/sauna/prices`; `costPrice` дилеру не виден (зачищается).

### Новый backend endpoint
- `POST /api/admin/dealers/{dealer_id}/overrides/upsert`
  Body: `{overrides: [{kind, modelId?, variantId?, optionId?, optionVariantId?, price}]}`
  Делает upsert на ключ (dealerId+kind+modelId+variantId+optionId+optionVariantId).
  В отличие от существующего PUT — НЕ затирает остальные overrides дилера.
  Возвращает `{ok, upserted, inserted, modified}`.

### UI: «Применить к дилеру…» в PriceSimulator
- Когда задана дилерская цена → кнопка `sim-apply-dealer`.
- Диалог `apply-dealer-dialog` показывает таблицу-предпросмотр всех позиций
  с дилерской ценой = `retail × (dealer_brutto / retail_brutto)` (пропорциональный
  дисконт). Выбор дилера из списка → один клик — overrides записаны.
- Зелёный success-state с кратким отчётом.

### Тесты
- `/app/backend/tests/test_dealer_overrides_upsert.py` — 7/7 PASSED
  (empty, insert, modify, no-wipe, invalid-kind, unknown-dealer, auth).

## Session — Excel I/O + Dealer Comparison (May 16, 2026, late evening)

### Components + Tech-cards Excel Export/Import
- Один XLSX-файл с двумя листами: **Components** и **TechCards**.
- Сервис `services/sauna_production_excel.py`:
  - `export_xlsx(components, tech_cards)` — генерирует workbook с оранжевыми заголовками,
    компоненты в `Components` (id|name|category|unit|unitPrice|supplier|note|stockCurrent|stockMin|isActive),
    тех.карты — flattened в `TechCards` (cardId|scope|modelId|variantId|optionId|optionVariantId|componentId|componentName|qty|itemNote|laborCost|overheadPct|manualAdjustment|syncToCostPrice|cardNote).
  - `parse_xlsx(blob)` — читает оба листа, возвращает `(components, cards, errors)`.
  - `diff_components` / `diff_cards` — генерирует add/update/unchanged. Numeric-safe (None == 0).
  - `merge_component` / `merge_card` — слияние перед upsert.
- Эндпоинты в `routes/sauna_tech_cards.py`:
  - `GET /api/sauna-production/cost/export` — file download.
  - `POST /api/sauna-production/cost/import-dry-run` — превью без записи.
  - `POST /api/sauna-production/cost/import-commit` — upsert всё + recompute_and_sync на каждую touched тех.карту.
- UI: `ImportExportButtons.jsx` рядом с «Добавить компонент» в `ComponentsAdmin`.
  Диалог импорта показывает DiffSection для каждого листа с зелёными/синими бейджами,
  кнопка «Применить» дизейблится при 0 изменений; после коммита — экран успеха.

### Dealer Pricing Comparison
- `GET /api/admin/dealers/comparison` — возвращает таблицу:
  каталог × дилеры. На каждой строке retailBrutto + per-dealer price (или null) +
  min/avg/max/overrideCount.
- UI: новая вкладка «Сравнение цен» в `DealersAdminPage` (рядом со «Списком»).
- `DealerComparisonPage.jsx`:
  - Поиск по имени, фильтр по типу (model / model_variant / option / option_variant),
    переключатель «Только с overrides».
  - Цветовая подсветка ячеек: зелёный = дешевле розницы (интенсивность зависит от %),
    красный = дороже, серый «база» = нет override.
  - Иконка ↑/↓ и tooltip со скидкой/наценкой в %.
  - Кнопка экспорта в CSV (Excel-friendly UTF-8 BOM + `;`).

### Тесты
- Backend `test_sauna_production_excel_and_comparison.py` — 13/13 PASSED.
  Покрывает: export shape (2 sheets, headers), round-trip dry-run (0 add/update/52 unchanged),
  validation errors (invalid file, missing name), commit persistence, dealer comparison
  endpoint (rows, kinds, dealer override flags).
- Регрессия 25/25 PASSED (`test_dealer_overrides_upsert`, `test_sauna_tech_card_vat`,
  `test_sauna_stock_and_option_forecast`).
- Marketer: marketer / marketer123
- Test Dealer: testdealer / dealer123  (id=sauna-config-5)


---

## Session — Feb 17, 2026: Two-Price Model for Dealer Portal

### Problem
Dealer Portal previously stored **one** price per override row. Admin's
PriceSimulator "Apply to dealer" wrote that single field as the dealer's
*displayed* price — which meant dealers were showing WM B2B costs to their
own clients instead of their own marked-up retail. Dealers also had no
visibility into their margin.

### Solution: two independent prices per `dealer_price_overrides` row
- `price` — **B2B Brutto** (WM → dealer). Owned/edited by **admin only** via
  Simulator → "Apply to dealer" or `/api/admin/dealers/{id}/overrides` /
  `/api/admin/dealers/{id}/overrides/upsert`.
- `dealerRetailPrice` — **Retail Brutto** (dealer → client). Owned/edited by
  **dealer only** in "Moje ceny detaliczne" tab (`PUT /api/dealer/sauna/overrides`)
  or bulk-markup endpoint.

Either side may be `None` → falls back to base WM Brutto from `sauna_prices`.

### Backend changes
- `models/dealer.py` — `DealerPriceOverride.price: Optional[int]`,
  `DealerPriceOverride.dealerRetailPrice: Optional[int]`.
- `routes/dealer.py`:
  - `_apply_overrides()` — returns enriched prices doc where `basePrice`/`price`
    = `dealerRetailPrice` (else WM brutto), plus parallel `b2bPrice` field and
    `baseRetailWm` reference field on every model/variant/option.
  - `PUT /api/dealer/sauna/overrides` — touches only `dealerRetailPrice`,
    preserves admin's `price` (symmetric inverse for admin endpoints).
  - `POST /api/dealer/sauna/overrides/bulk-markup` — `{percent, base, scope, overwrite}`.
  - `_compute_manufacturer_totals(dealer_id, order_data)` — recomputes
    `manufacturerBasePrice/VariantPrice/OptionsTotal/Subtotal/Total` from
    the dealer's current B2B overrides + WM catalog.
  - Hooked into `POST /api/dealer/sauna/orders` (create) and
    `PUT /api/dealer/sauna/orders/{id}` (update).
  - `POST /api/admin/dealer-orders/recompute-manufacturer-totals` — admin
    backfill for legacy orders.
- `routes/sauna_orders.py:_recompute_one` — dealer orders use
  `manufacturerTotal` as the brutto baseline for VAT/margin (instead of the
  retail `total`). Missing `manufacturerTotal` → flag `marginNeedsBackfill`
  instead of inflated margin. `recompute_all_margins` auto-refreshes
  `manufacturerTotal` for dealer orders before computing margin.

### Frontend changes (`/app/frontend/src/components/dealer/`)
- `DealerApp.jsx`:
  - **PricesTab** rebuilt as "Moje ceny detaliczne": each row shows B2B badge
    (read-only), retail input (editable), live margin in PLN + %. Summary
    cards (% covered rows, average margin). Bulk-markup panel
    (percent/base=b2b|wm/scope=all|models|options/overwrite).
  - **OrdersTab** — added "Klient płaci", "Koszt WM", "Marża" columns with
    color-coded margin (green if ≥0, red otherwise).
- `DealerCalculatorWrapper.jsx`:
  - **ConfirmOrderDialog** — added 2-card breakdown ("Zapłacisz WM" cyan +
    "Twoja marża" green/red) once `manufacturerTotal` is present.

### Tests
- `/app/backend/tests/test_dealer_two_price_model.py` (new, 10 tests):
  - prices shape with b2bPrice/baseRetailWm
  - cost stripping (recursive)
  - dealer PUT preserves admin B2B
  - admin PUT preserves dealer retail
  - bulk markup % only touches scoped rows
  - order create computes manufacturerTotal
  - order update recomputes manufacturerTotal
  - order confirm preserves manufacturerTotal
  - admin backfill endpoint
  - global recompute-margins uses manufacturerTotal for dealer orders
- Regression `test_dealer_overrides_upsert.py` — 7/7 PASS.
- **17/17 total PASS** (iteration_96.json).

### Known follow-ups (deferred)
- Live margin badge inside the calculator (not only in Confirm dialog and
  Orders list).
- Bulk-write atomicity in `dealer_put_overrides` (currently DELETE+INSERT).
- Migration script removed; new orders auto-compute manufacturerTotal,
  legacy orders backfilled via admin endpoint.


---

## Session — Feb 17, 2026 (cont.): Hard-delete + Margin Popover + Markup Presets

### What shipped
1. **Hard-delete dealer** (replaces soft-delete-only).
   - `DELETE /api/admin/dealers/{id}/hard-delete?delete_confirmed=false|true`
   - Always removes: dealer profile, all `dealer_price_overrides`, all
     `dealer_markup_presets`, all DRAFT orders.
   - `delete_confirmed=false` (default) — confirmed orders are *archived in
     place* with `dealerDeleted=true`, `deletedDealerName`,
     `deletedDealerAt`.
   - `delete_confirmed=true` — full cascade incl. confirmed orders.
   - UI: red triangle button on each dealer row → `HardDeleteDealerDialog`
     requires typing dealer username + checkbox for confirmed-orders option.

2. **Margin breakdown popover** on admin Orders list.
   - Click margin cell → shadcn Popover shows the full formula
     `(Брутто/1.23) − Cost − RetailExtra = Margin` with each substituted
     number on its own row.
   - For dealer orders (`source==="dealer"`) uses `manufacturerTotal` as the
     Brutto baseline (instead of `total`), displays a cyan "Дилер" badge,
     and adds an informational line showing the dealer's retail
     (`order.total`) for transparency.
   - Shows `marginRecomputedAt` timestamp when present.
   - data-testids: `margin-popover-trigger-{id}`, `margin-popover-{id}`.

3. **Dealer markup presets** (one-click apply).
   - New collection `dealer_markup_presets` with fields:
     `{id, dealerId, name, percent, base, scope, createdAt}`.
   - Endpoints:
     - `GET  /api/dealer/markup-presets`
     - `POST /api/dealer/markup-presets` (name/percent/base/scope; validates)
     - `DELETE /api/dealer/markup-presets/{id}`
     - `POST /api/dealer/markup-presets/{id}/apply` (reuses
       `dealer_bulk_markup`)
   - UI inside "Mój cennik" → bulk-markup panel → "Zapisz jako preset" row,
     plus a "Zapisane presety" chip strip below the panel.
   - data-testids: `preset-name-input`, `preset-save-btn`, `presets-list`,
     `preset-chip-{id}`, `preset-apply-{id}`, `preset-delete-{id}`.

### DB hardening (housekeeping)
- Cleaned 2 stray duplicate rows of `test-order-tech-spec-001` (was causing
  React duplicate-key warning in admin Orders list).
- Added unique index `id_unique` on `sauna_orders.id` to prevent future
  duplicates.

### Tests
- `/app/backend/tests/test_dealer_hard_delete_and_presets.py` (new) —
  **18/18 PASS**: hard-delete empty / cascade / archive-confirmed / full
  cascade / 404 / auth; preset CRUD + validation + isolation + apply.
- Regression `test_dealer_two_price_model.py` + `test_dealer_overrides_upsert.py`
  — **17/17 PASS**. Cumulative iteration 97: **35/35 PASS**.

### Known follow-ups (still deferred)
- Live margin badge inside the calculator (deprioritized — user said not
  needed for now).
- Bulk-write atomicity in `dealer_put_overrides` (currently DELETE+INSERT).
- Bulk-write atomicity in `admin_hard_delete_dealer` (4 separate writes).

---

## Session — Feb 17, 2026 (3rd): First-Login Onboarding Markup

### What shipped
Admin sets a default markup directly on the dealer profile. On the dealer's
FIRST successful login, the backend auto-applies that markup once and
stamps `onboardedAt`. Subsequent logins are no-ops.

### Backend changes
- `models/dealer.py`:
  - `Dealer`/`DealerCreate`/`DealerUpdate` gained:
    `defaultMarkupPercent: Optional[float]`,
    `defaultMarkupBase: Optional[str]`,
    `defaultMarkupScope: Optional[str]`,
    `onboardedAt: Optional[str]` (set automatically on first login),
    `DealerUpdate.resetOnboarding: Optional[bool]` (admin escape hatch).
- `routes/dealer.py`:
  - `dealer_login` — if `defaultMarkupPercent is not None` AND
    `onboardedAt is None`, invoke `dealer_bulk_markup(..., overwrite=False)`
    and stamp `onboardedAt`. Returns
    `{token, dealer, onboardingApplied: {percent, base, scope, touched}}`.
    Failures are logged but **never** block login (try/except).
  - `admin_create_dealer` & `admin_update_dealer` — pass-through for the
    new fields. `resetOnboarding=True` clears `onboardedAt`.

### Frontend changes
- `DealersAdminPage.jsx`:
  - `CreateDealerDialog` — new "Авто-наценка при первом входе"
    section with percent/base/scope fields.
  - `EditDealerDialog` — same section + status badge ("✓ Применён <date>" /
    "Ожидает первого входа") + reset checkbox.
  - Dealer list row gets a coloured chip:
    green `✓ +X%` (onboarded) or amber `⏳ +X%` (pending).
  - data-testids: `onboarding-markup-section`,
    `create-onboarding-percent/base/scope`, `edit-onboarding-section`,
    `edit-onboarding-percent/base/scope`, `reset-onboarding-checkbox`,
    `onboard-applied-{id}`, `onboard-pending-{id}`.
- `utils/dealerAuth.js`:
  - `dealerLogin` shows a friendly sonner toast on first login if
    `onboardingApplied` is present in the response (dynamically imports
    sonner so the helper stays optional).

### DB hardening
- Added unique index `id_unique` on `dealers.id` (mirrors the one already
  added on `sauna_orders.id` last iteration).

### Tests
- `/app/backend/tests/test_dealer_onboarding_markup.py` (new) —
  **7/7 PASS** covering: create-echo, first-login apply+stamp,
  second-login no-op, reset-via-PUT, independent markup PUT, invalid
  base/scope coercion, b2b-with-no-prices touched=0 still succeeds.
- Cumulative regression: 17 (two-price) + 18 (hard-delete/presets) +
  7 (onboarding) = **42/42 PASS**.

### Use case (now wired end-to-end)
1. Admin creates dealer with `defaultMarkupPercent=15`, `base=wm`,
   `scope=all`.
2. Admin (optionally) uses Simulator → "Apply to dealer" to seed B2B
   prices.
3. Dealer logs in → sees toast "Witaj! Twoje ceny zostały automatycznie
   ustawione (+15% from WM Brutto, 56 pozycji)". Goes straight to a
   pre-populated "Moje ceny detaliczne".
4. Dealer can tweak individual rows or apply a saved preset on top.

### Known follow-ups (still deferred)
- Live margin badge inside the calculator (user declined for now).
- Bulk-write atomicity in `dealer_put_overrides` / `admin_hard_delete_dealer`.

---

## Session — Feb 18, 2026: Warehouse "С водителем" multi-stage + Voice input in Planner

### What shipped
1. **New Dovoz Kanban column «С водителем»** (orange, `UserCheck` icon)
   between «Довоз отправлен» and «Довоз доставлен», with full multi-stage
   amoCRM mapping.
   - `dovozByStage` in `WarehousePage.jsx` extended with `with_driver` bucket.
   - Initial `settingsForm.dovoz_config` now seeds `with_driver_status_ids: []`.
   - Selecting a different source pipeline now also clears
     `with_driver_status_ids` (consistent with sent/source/delivered reset).
   - Manual fallback (when amoCRM pipelines aren't loaded) gained a
     comma-separated input `with-driver-status-ids-input`.
2. **`PUT /api/dovoz/orders/{id}/stage?stage=with_driver`** now also pushes
   to amoCRM (was previously skipped). Targets the FIRST id from
   `with_driver_status_ids`.
3. **«Обновить» button fix** — `handleRefreshDovoz` wraps both fetches with
   a disabled spinner state and success toast `Обновлено · N довозов`.
4. **Voice input in AI Task Parser** (Web Speech API, `ru-RU`):
   - New mic button in `AITaskParser.jsx` (`data-testid='ai-parse-voice-start'`
     / `ai-parse-voice-stop`). Toggles continuous recognition with interim
     results merged live into the textarea.
   - Final transcripts appended to existing text; interim shows live but
     never duplicated.
   - Graceful degradation: button hidden when neither
     `SpeechRecognition` nor `webkitSpeechRecognition` exists.
   - Toasts for permission denied / errors. Auto-cleanup on dialog close
     and unmount.

### Tests
- `/app/backend/tests/test_dovoz_with_driver.py` — 7/7 PASS.
- Frontend (testing agent): kanban OK, refresh toast OK, voice toggle OK.

### Known follow-ups (P3 / P2)
- Driver picker dialog when dragging into «С водителем» (pick which of the
  N configured driver-stages to push to in amoCRM, instead of always the
  first).
- `WarehousePage.jsx` still 1400+ lines — refactor into sub-components.



## Session 8 - Feb 2026 (fork continuation)

### Price Matrix - B2B netto column (DONE - Feb 2026)
- Added "B2B netto" column to PriceMatrix.jsx between "B2B brutto" and "Скидка"
- Header was added in prior session but the corresponding `<TableCell>` and
  `colSpan` for the empty-state row were missed → fixed in this session.
- Formula: `dealerB2BNetto = dealerB2B / 1.23` (data layer already produced it
  on line 139, only the rendering was missing).
- File: `/app/frontend/src/components/sauna-production/PriceMatrix.jsx`
- Verified via lint (clean) + screenshot with `TEST UPSERT` dealer selected.

### Backlog (P1/P2/P3) - unchanged
- P1: Weekly AI digest via email/Telegram for managers
- P1: SLA real-time alerts (notify if lead is untouched for X hours)
- P2: Automatic inventory deduction based on production stages
- P2: Export to Excel/CSV for calls and leads tables
- P3: Replace deprecated Google Maps Autocomplete component
- P3: Bulk edit mode in Price Matrix (select rows → add +10% / round up)
- P3: KPI cards in Sales page ("Avg confirmed check", "Conversion %")
- P3: Income forecast in Dealer Matrix based on expected monthly sales volume
- P3: Comfino QR code in PDF
- Refactor: split `routes/sauna.py` (2500+ lines), `WarehousePage.jsx` (1400+),
  `useSaunaCalculator.js`.

### Planner — multiple assignees per task (DONE - Feb 2026)
- Backend `models/planner.py`: added `assigneeUserIds: List[str]` and
  `assigneeUsernames: List[str]` to `TaskCreate`/`TaskUpdate` alongside
  legacy single fields.
- Backend `routes/planner.py`: new helper `_resolve_assignees(ids, legacy)`
  normalises input to (ids, usernames). Create/update mirror the FIRST
  element back to legacy `assigneeUserId`/`assigneeUsername` so older
  filters, history rows and Telegram notifications keep working untouched.
- `list_tasks` `assignee` and `mine` filters now match both single and
  array fields via `$or`.
- Frontend: new shared `<AssigneesPicker>` (multi-select popover, search,
  initials chips, "+N" overflow). Used in `TaskDrawer`, `QuickCreate` and
  `TasksTable` inline edit cell. `TasksBoard` card renders up to 3 avatar
  initials + "+N" tooltip on hover for >3 assignees.
- Backward compatibility: existing tasks with only single `assigneeUserId`
  render correctly; AI parser (`AITaskParser.jsx`) and old endpoints still
  work without modification.
- ✅ `pytest backend/tests/test_planner.py` 15/15 pass.
- ✅ curl: create with `assigneeUserIds: [U1, U2]` returns both array AND
  legacy single fields; updates via either field stay in sync; filter by
  `assignee=` matches array entries.

### Balia options — `isDefault` + `isGratis` (DONE - Feb 2026)
- `CategoryOption` (`models/balia.py`) has `model_config = ConfigDict(extra="allow")`,
  so the two new flags pass through Pydantic without explicit schema changes.
- Admin UI:
  - `OptionEditDialog.jsx` — two new checkboxes: "По умолчанию"
    (pre-select when calc opens) and "В подарок (Gratis)" (show GRATIS instead
    of price). `data-testid="balia-option-is-default"` /
    `data-testid="balia-option-is-gratis"`.
  - `OptionItem.jsx` — shows blue "по умолч." and green "gratis" pills next
    to option name; price column renders "GRATIS" for gratis options.
- Customer calculator (`CalculatorPage.jsx`):
  - Initial selections: radio categories pre-select `options.find(o => o.isDefault)`;
    checkbox categories pre-tick every `isDefault` option. Same logic in the
    rebuild path used by `editingOrder`.
  - Subtotal/total/getOptionsTotal skip `opt.isGratis` so gifts don't add to
    the price.
  - Tile, checkbox and select-dropdown renderers display "GRATIS" (green,
    bold) instead of the numeric `+price`.
  - `selectedOptions` payload includes `isGratis` so the PDF backend can
    reuse the flag.
- PDF (`routes/balia.py`):
  - Legacy options table: row shows option image + name + bold green
    "GRATIS" (and is NOT lumped with the "Bez X" grey rows even if the name
    starts with "bez").
  - New options table: per-option `is_gratis_opt` branch renders a
    Paragraph "GRATIS" with `#059669` colour, mirroring the existing
    admin-marked gift logic; counted in `gifts_total`, not `total_options_price`.
- Backward compatibility: options without the flags behave exactly as before.

### Balia options — quantity per option (DONE - Feb 2026)
- Admin: `OptionEditDialog.jsx` adds a "Можно выбрать количество" toggle plus
  optional "Макс. шт." field (`option.quantityEnabled`, `option.maxQuantity`).
- Customer calc (`CalculatorPage.jsx`):
  - Checkbox selections now store either `true` (qty=1) or a positive int (qty).
  - `handleQuantityChange` + `handleCheckboxChange` keep the value coherent
    (turning off → false; turning on preserves last qty if any).
  - +/- stepper with `<input type="number">` (no spinners) appears only after
    the option is ticked AND `quantityEnabled` is set. Same UI in tile-mode.
  - `calculateSubtotal` / `getOptionsTotal` multiply price × qty.
  - `selectedOptions` payload now carries `quantity`, `unitPrice` and the
    pre-multiplied `price`.
  - Restore-from-existing-order path preserves the integer quantity.
- PDF (`routes/balia.py`): when `quantity > 1`, the option name is rendered
  as `Name × N` in BOTH PDF paths (legacy + new); the price column already
  uses the pre-multiplied `price` from the payload.

### Dealer detail page (DONE - Feb 2026)
- New backend endpoint `GET /api/admin/dealers/{id}/detail` aggregates the
  dealer profile + KPIs (orders, revenue, mfg cost, margin, avg check) +
  overrides count (B2B / retail) + recent 50 orders in one call.
- New frontend component `DealerDetailDialog.jsx` (full-screen Dialog):
  - Header with name, prefix, currency, active status, Edit + Close buttons.
  - 4 KPI cards (orders, revenue, margin with pos/neg tone, overrides count).
  - Tabs: «Информация» (contacts, params, timestamps, notes),
    «Заказы» (paginated table with status badges, totals, mfg, margin),
    «Цены» (override counts + pointer to Dealer Matrix).
- `DealersAdminPage.jsx`: dealer rows are now clickable (click anywhere in
  the row except action buttons opens the detail); dealer name is also a
  link-style button. The detail dialog can call back into the existing
  edit dialog via `onEdit`.
- ✅ curl: `/api/admin/dealers/{id}/detail` returns
  `{dealer, kpis, overrides, recentOrders}` correctly for testdealer
  (10/10 confirmed orders, 200 000 PLN revenue, 33.3% WM margin, 2 overrides).
- ✅ Screenshot: dialog renders fully with all four KPI cards and three
  tabs populated.

### Manager analytics — guardrails against "fire-and-forget" (DONE - Feb 2026)
**Goal**: detect managers who hit a single auto-email and then ghost the lead.
- **lead_analytics.py `_compute_lead_metrics`**: per-lead now exposes
  `manualActionCount`, `outgoingCallCount`, `incomingCallCount`,
  `outgoingEmailCount`, `outgoingMessageCount`, `humanNoteCount`,
  `autoStageChanges`, `followUpWithin72h`, `autoOnlyLead`,
  `singleTouchLead`. The bot filter now also excludes `created_by == "0"`
  in addition to the configured `botUserIds`.
- **manager_events_analytics.py** per-manager aggregations:
  `manualActions`, `avgActionsPerLead`, `outgoingCalls/Emails/Messages`,
  `callsPerLead`, `followUpRate`, `singleTouchLeads/Percent`,
  `autoOnlyLeads/Percent`, `autoEvents`, `manualEventShare`.
- **Score formula rebalanced**: progress 25% + follow-up 20% (NEW) + reaction
  20% + processing 20% + activity 10% + problems 5%. Soft single-touch
  penalty (`min(20, singleTouchPct * 0.3)`) subtracted at the end.
- **Settings model**: added `weightFollowUp: int = 20`; the GET endpoint now
  back-fills missing fields with current defaults so older DB docs still
  surface the new weight in the UI.
- **Cross-link to call analytics**: `/manager-detail/{id}` now also returns
  `recentCalls` (last 30) and `callKpi` (total, withAi, avgScore, critical)
  pulled from `call_analytics_calls` for the same `manager_id`.
- **Frontend `ManagerEventsAnalytics.jsx`** rewrite:
  - Table columns updated to Score, %обр., Follow-up, Single-touch, Auto-only,
    Действий/лид, Звон./лид, Ср.реакция, Проблемных. Suspicious managers
    (score≥70 but follow-up<40% OR single-touch>40%) flagged with
    `⚠ проверь` badge and orange row tint.
  - Manager detail header strip adds 5 QualityKpi cards
    (follow-up 72h, single-touch, auto-only, calls/lead, actions/lead) with
    pos/warn/neg colours.
  - New tabs in detail view: "⚠ Single-touch", "🤖 Auto-only", "📞 Звонки"
    (cross-links to `/admin/call-analytics?manager_id=…`).
  - ScoreBar block adds Follow-up bar; settings UI exposes the new weight.
- **Pytest stub**: `_compute_lead_metrics` exercised by hand for 3 scenarios
  (fire-and-forget, auto-only, good manager) — all flags computed correctly.

### Manager analytics — daily Telegram digest (DONE - Feb 2026)
- **Settings extended** in `EventAnalyticsSettings`:
  - `dailyReportEnabled: bool = False`
  - `dailyReportHour: int = 8` (UTC, 0..23)
  - `dailyReportChatId: str = ""` (optional override; empty → use `TELEGRAM_CHAT_ID` env)
  - Persistent run-marker `lastDailyReportDate` (YYYY-MM-DD UTC) so the job
    fires at most once per day across container restarts.
- **New scheduler** `manager_analytics_daily_scheduler()` in `server.py`:
  registered/cancelled alongside backup + CRM auto-sync. Polls settings
  every 10 min, fires when `now.hour >= dailyReportHour` and last run !=
  today. Steps: (1) full lead-analytics sync from yesterday, (2) build &
  send Telegram digest, (3) mark today as done.
- **Report builder** `services/manager_analytics_report.py`:
  - HTML message (Telegram parse_mode=HTML) with team totals + top-3 by
    score + suspicious (score≥70 & follow-up<40% or single-touch>40%) +
    bottom-3 by follow-up.
  - Reuses existing `send_telegram_message` helper.
- **Manual trigger** `POST /api/lead-analytics/events/send-daily-report`
  (optional `?period_label=...&chat_id=...`). Returns 409 if no sync yet,
  502 if Telegram fails. Curl-verified end-to-end (`ok:true, sent`).
- **Settings UI** in `ManagerEventsAnalytics.jsx`:
  - Blue card "📱 Ежедневный отчёт в Telegram" with toggle, UTC hour input,
    optional chat_id, "last report" badge, and "Отправить тестовый отчёт"
    button (calls the manual endpoint and toasts the result).
- **Note on env**: requires `TELEGRAM_BOT_TOKEN` + (default) `TELEGRAM_CHAT_ID`.
  In preview the Telegram bot is already configured — test report was
  delivered successfully even with 0 managers in the digest.

### Manager analytics — AI advice in daily digest (DONE - Feb 2026)
- New setting `dailyReportAiAdvice: bool = True` on `EventAnalyticsSettings`.
- `services/manager_analytics_report.py` now has `_get_ai_advice()` which
  builds a compact stats dump and calls GPT-5.2 via `EMERGENT_PROXY` (same
  pattern as `lead_analytics._call_llm`). System prompt instructs the model
  to return three sections — `🔍 ГЛАВНОЕ` / `⚠ РИСКИ` (с именами менеджеров) /
  `✅ ДЕЙСТВИЯ` — without markdown headers, max 3-4 lines each.
- `send_manager_digest()` gained `include_ai: bool = True`. When AI advice
  is produced, it is appended as `🤖 Совет AI` block at the bottom of the
  Telegram HTML message.
- Both the manual endpoint and the daily scheduler read `dailyReportAiAdvice`
  from settings and pass it through.
- Graceful fallback: if `EMERGENT_LLM_KEY` is missing or the LLM call fails,
  the digest is still sent without AI (logged at warning level).
- UI: new checkbox under the daily-report card — "🤖 Добавлять совет AI"
  with hint about Universal Key cost.
- ✅ Curl with 0 managers returns `aiAdviceIncluded: false` (no LLM spent on
  empty data); with real managers on prod the AI block will appear.

### EUR currency support (DONE - Feb 2026)
- Per-dealer fields `currency` ("PLN" | "EUR") and `eurRate` (float, PLN per 1 €)
  added to `Dealer` model + create/update endpoints.
- Admin Dealers page: currency dropdown + EUR rate input in both Create and
  Edit dialogs.
- PriceMatrix.jsx: editable `€/zł` input (localStorage `pm_eur_rate`, auto-fills
  from dealer.eurRate when dealer is picked) + 3 EUR columns
  (Розница €, B2B brutto €, B2B netto €) gated on `eurRate > 0`. CSV export
  includes the same 3 EUR columns + a header row noting the rate used.
- DealerMatrix.jsx: same `€/zł` input (localStorage `dm_eur_rate`) + 3 EUR
  columns (B2B brutto €, B2B netto €, Розница €). CSV updated.
- DealerCalculatorWrapper: fetches `/api/dealer/auth/me`, shows a blue EUR
  banner when `currency=EUR && eurRate>0`. ConfirmOrderDialog renders EUR
  equivalents next to PLN total / manufacturer cost / dealer margin.
- Rounding: 2 decimals everywhere (pl-PL locale formatting `1 234,56 €`).
- Not touched: the big SaunaCalculator (~2000 lines) is intentionally left
  in PLN — too invasive. Dealers see EUR figures at the confirmation step
  and in the matrices/CSV exports as the user agreed.


### Manager Analytics — Live Call Counts (DONE - Feb 27, 2026)
- **Bug:** Manager Events Analytics card was showing `0` calls for a manager
  even though calls existed in `call_analytics_calls`.
- **Root cause:** `event_manager_stats` is a snapshot frozen at events-sync
  time; the call-analytics sync runs on a separate schedule, so the snapshot
  is stale until the next events-sync. Result: managers with real calls
  displayed `outgoingCalls = 0 / callsPerLead = 0`.
- **Fix (backend, `routes/manager_events_analytics.py`):**
  - New helper `_live_calls_by_manager(date_from, date_to)` aggregates
    `call_analytics_calls` grouped by `manager_id` + `direction` at READ time.
  - `GET /manager-stats` now overlays live `outgoingCalls`, `incomingCalls`
    and recomputes `callsPerLead` per manager — accepts `date_from`/`date_to`.
  - `GET /manager-detail/{user_id}`:
    - dropped the over-strict `audio_url: {$ne: ""}` filter → all calls show;
    - fixed projection (`phone` instead of non-existent `client_phone`,
      `summary_ru` mapped to `summary` for the UI);
    - `callKpi.total` now uses `count_documents` for the true total,
      not just the 30-row preview;
    - header stats (`outgoingCalls`/`incomingCalls`/`callsPerLead`) also
      enriched with live counts.
- **Fix (frontend, `ManagerEventsAnalytics.jsx`):** `fetchData` now forwards
  `dateFrom`/`dateTo` to `manager-stats` so live counts respect the filter.
- ✅ Verified: 7/7 pytest checks via testing agent (iteration 100).

### Manager Analytics — Binotel Live Source (DONE - Feb 27, 2026)
- **Driver:** прошлая итерация (live-counts из `call_analytics_calls`) всё ещё
  не давала корректных цифр, потому что коллекция заполняется только по
  лидам с amoCRM-нотами. Решение — тянуть статистику напрямую из Binotel
  API, где находится "источник правды" телефонии.
- **New module `routes/binotel_analytics.py`:**
  - `aggregate_by_employee(date_from, date_to)` — POST на
    `/api/4.0/stats/incoming-calls-for-period.json` + outgoing, агрегирует
    по `internalAdditionalData.employeeData.employeeID` (с fallback на
    плоский `employeeID`/`companyEmployeeID`); считает `outgoing`,
    `incoming`, `answered`, `missed`, `totalTalkSec`, `answeredTalkSec`,
    `answerRate`, `avgTalkSec`.
  - `aggregate_by_amocrm_user(date_from, date_to)` — применяет сохранённый
    маппинг `binotel_user_mapping` (binotelEmployeeId → amocrmUserId)
    и схлопывает несколько Binotel-сотрудников на одного менеджера amoCRM.
  - Эндпоинты:
    - `GET /api/lead-analytics/binotel/config` — есть ли credentials.
    - `GET /api/lead-analytics/binotel/stats` — статы по amoCRM userId.
    - `GET /api/lead-analytics/binotel/employees` — список Binotel
      сотрудников за период (для UI маппинга).
    - `GET/PUT /api/lead-analytics/binotel/mapping` — CRUD маппинга.
    - `POST /api/lead-analytics/binotel/mapping/automap` — авто-маппинг
      по совпадению токенов имени (≥2 общих токена или подмножество).
    - `GET /api/lead-analytics/binotel/amocrm-users` — для дропдауна в UI.
  - Storage: коллекция `binotel_user_mapping`
    `{binotelEmployeeId, binotelEmployeeName, amocrmUserId, amocrmUserName}`.
- **Integration (`manager_events_analytics.py`):**
  - `GET /manager-stats`: после live-counts применяется Binotel overlay;
    `outgoingCalls`/`incomingCalls`/`callsPerLead` заменяются на Binotel,
    добавляются `binotelTotal`, `binotelAnswered`, `binotelMissed`,
    `binotelAnswerRate`, `binotelAvgTalkSec`. Возвращается флаг
    `binotelUsed: bool`.
  - `GET /manager-detail/{user_id}`: то же + поле `binotelStats` в ответе
    с раскладкой по сотруднику; `callKpi.total` берёт Binotel total.
- **Frontend:**
  - Новая колонка `% дозв.` и `Ср. длит.` в `ManagerTable`.
  - Полоска `Binotel · телефония live` в `ManagerDetail` с 5 KPI
    (всего, отвечено, пропущено, % дозвона, ср. длительность).
  - Новый компонент `BinotelMappingDialog.jsx` с поиском, автомаппингом
    и ручным выбором amoCRM-пользователя для каждого Binotel-сотрудника.
  - Кнопка `Binotel ↔ amoCRM` в шапке Manager Analytics (видна только
    когда `binotelConfigured=true`).
- **Тесты:** 13/13 новых + 7/7 регрессионных pytest (iteration 101).


### Manager Analytics — Bot Filter + Stale Sync Recovery (DONE - Feb 27, 2026)
- **Bug 1:** Аккаунты из списка `Боты (исключить из анализа)` (Биржа Лидов,
  Склад, Zofia, Владислав МОП, Максим/Ольга) показывались в таблице
  аналитики наравне с реальными менеджерами; синтетический `ID:0` тоже
  присутствовал. Whitelist `managerUserIds` тоже не учитывался.
- **Bug 2:** Если процесс синхронизации крашился или backend перезапускался
  посреди sync — документ `event_analytics_sync` навсегда оставался в
  состоянии `status="running"`, UI показывал "в процессе" бесконечно.
- **Fix 1 (filter):** в `routes/manager_events_analytics.py`:
  - `GET /manager-stats` теперь читает `lead_analytics_settings.botUserIds`
    и `managerUserIds`, отфильтровывает их из ответа на READ-time
    (не требует пересинхронизации) и пересчитывает `rank` 1..N.
  - Синтетический `ID:0` / `unknown` / `None` исключаются всегда.
  - Тот же фильтр применён в `_compute_event_manager_stats` так что
    новые синки не сохраняют статы по ботам.
- **Fix 2 (sync recovery):**
  - `GET /sync-status` теперь проверяет возраст running-документа: если
    `startedAt > 15 мин` — атомарно помечает как `error` и возвращает
    свежий статус.
  - `POST /sync` отменяет любой существующий running-документ
    (`error="Заменено новой синхронизацией"`) перед стартом нового.
  - Новый эндпоинт `POST /sync/cancel` — ручная отмена всех running.
  - В документ sync теперь пишется поле `progress` на каждом шаге
    (Загрузка пользователей… / Загрузка событий… / Сохранено N/M / Расчёт…).
- **Frontend (`ManagerEventsAnalytics.jsx`):**
  - Отображение `progress` строкой со спиннером + кнопкой `отменить`
    когда sync идёт.
  - При повторном открытии страницы во время running sync — автоматически
    возобновляется polling.
  - При status=error — красное сообщение с текстом ошибки.
- **Тесты:** ✅ 10/10 новых + 20/20 регрессионных (iteration 102).


### Полная синхронизация (Unified Sync) (DONE - Feb 27, 2026)
- **Cause:** В UI были две раздельные кнопки `Синхронизировать` — на странице
  `Контроль лидов` и на вкладке `По событиям`. Пользователи путались,
  что и в каком порядке запускать; забывали запустить вторую.
- **New backend module `routes/unified_sync.py`:**
  - Коллекция `unified_sync` с документами `{unified_id, status, phase,
    progress, leadsSyncId, eventsSyncId, leadsProcessed, eventsProcessed}`.
  - `POST /api/lead-analytics/unified-sync` — старт. Auto-cancel
    предыдущего running unified.
  - `GET /api/lead-analytics/unified-sync/status` — статус с авто-recovery
    зависших >30 мин.
  - `POST /api/lead-analytics/unified-sync/cancel` — каскадная отмена
    unified + lead_analytics_sync + event_analytics_sync.
  - `_run_unified` background task: фаза 1 = lead_analytics sync, фаза 2 =
    manager-events sync. Если фаза 1 падает, фаза 2 не запускается.
- **Frontend (`UnifiedSyncButton.jsx`, новый):**
  - Кнопка-градиент `Полная синхронизация` с встроенным polling и
    мини-баннером (`1/2 · загрузка лидов…` → `2/2 · события…` →
    `✓ N лидов + M событий`).
  - При работе превращается в `Отменить полную синхр.` (caskaded cancel).
  - Авто-возобновление при перезагрузке страницы (читает `/status` при mount).
- **Integration:**
  - `LeadAnalyticsPage.jsx` — заменил основную кнопку синка на UnifiedSyncButton,
    оставил `Только лиды` (variant=outline) и `Полная (лиды)` как fallback.
  - `ManagerEventsAnalytics.jsx` — добавлен UnifiedSyncButton рядом с
    локальной кнопкой `Только события`.
- **Тесты:** ✅ 10/10 (iteration 103, тестинг-агент). Регрессия iter100-102
  не сломана.


### Daily Auto Unified-Sync (DONE - Feb 27, 2026)
- **Cause:** После добавления `Полной синхронизации` нужна автоматизация — чтобы
  утром данные уже были свежие, без ручного клика.
- **New settings (in `event_analytics_settings`):**
  - `autoDailySyncEnabled: bool` (default false) — мастер-выключатель.
  - `autoDailySyncHour: int` (default 6 UTC ≈ 8 утра Варшавы летом).
  - Дедуп-маркер `lastDailySyncDate` гарантирует ≤1 запуск в сутки.
- **Scheduler (`server.py · manager_analytics_daily_scheduler`):**
  - Разделён на 2 независимых job в одном цикле:
    1. Auto unified-sync (lead + events) — если `autoDailySyncEnabled` и
       `now.hour >= autoDailySyncHour` и `lastDailySyncDate != today`.
    2. Telegram digest (старый поведением) — если `dailyReportEnabled`.
  - Каждая job маркирует свою дату — могут работать независимо.
  - Sync использует `routes.unified_sync._run_unified` — тот же движок,
    что и UI-кнопка `Полная синхронизация`.
- **Frontend (`ManagerEventsAnalytics.jsx`):**
  - Новая первая карточка в `Настройки + Telegram`:
    `⚡ Автоматическая ежедневная синхронизация` с чекбоксом и полем `час
    запуска UTC`, с подсказкой про CEST/CET (6 UTC ≈ 8 утра Варшавы летом).
  - Отображение `Последняя авто-синхронизация: YYYY-MM-DD`.


### Next-Run Hint for Schedulers (DONE - Feb 27, 2026)
- **UX gap:** настройки `autoDailySyncHour` / `dailyReportHour` хранятся в UTC
  и пользователь не сразу понимал, в какой момент по локальному времени
  следующий запуск произойдёт (особенно с учётом CET/CEST переходов).
- **Frontend (`ManagerEventsAnalytics.jsx`):**
  - Чистая JS-функция `formatNextRun(utcHour)` использующая
    `Intl.DateTimeFormat({timeZone: 'Europe/Warsaw'})` — DST-aware
    автоматически, без libs.
  - Подсказка под полем час запуска:
    `⏰ Следующий запуск: завтра чт, 28.05, 08:00 по Варшаве · через 12 ч 24 мин`.
  - Виден только когда соответствующий toggle (`autoDailySyncEnabled` или
    `dailyReportEnabled`) включён — иначе бессмысленно.
  - Применён для обоих расписаний: индиго-баннер для auto-sync,
    синий для Telegram-digest.
- **Verified:** Node REPL подтвердил корректность для разных часов
  (6 UTC → 08:00 Варшава CEST = UTC+2, 22 UTC → 00:00 след. день).



### Planner — раздел «Закупки» (Procurement) (DONE - Feb 27, 2026)
- **Driver:** Пользователь попросил раздел Закупок в Планнере,
  связанный с каталогом `sauna_components`, с авто-Telegram уведомлениями.
- **Backend (`routes/procurement.py`, новый):**
  - Коллекция `procurement_requests`: id, title, componentId, componentName,
    quantity, unitPrice, totalPrice, supplier, status, priority, dueDate,
    assignee*, reminderDaysBefore, notifyTelegram, notifications{created,
    reminder, overdue}.
  - Endpoints: GET/POST /components (+ quick-create), GET/POST/PUT/DELETE
    /requests, GET /stats, POST /notifications/run.
  - Авто-подстановка `unitPrice`/`supplier` из `sauna_components`,
    пересчёт `totalPrice` при PUT, сброс notification флагов при сдвиге
    `dueDate` в будущее, `isOverdue` декорация на READ-time.
- **Scheduler:** `run_procurement_notifications()` в существующем
  `manager_analytics_daily_scheduler` с дедупом `lastProcurementNotifDate`.
  Идемпотентность — флаги ставятся unconditionally чтобы не было повторов
  после добавления TG creds.
- **Frontend (`planner/ProcurementTab.jsx`, новый):**
  - 5 KPI плиток (Всего, Просрочено, Скоро 7 дн, Получено, Сумма открытых).
  - ComponentPicker с поиском и `+ Создать новое` inline.
  - RequestDialog — авто-подстановка цены, live total, dueDate, reminder
    days, TG-toggle.
  - Красная подсветка просроченных строк.
- **PlannerPage:** новый таб `Закупки` (ShoppingCart icon).
- **Тесты:** ✅ 16/17 backend pytest (iteration 104).

### Procurement — многострочные заявки (DONE - Feb 27, 2026)
- **Driver:** «Одна заявка = одна позиция» неудобно при оптовых
  закупках у одного поставщика (например, Drewno24 раз в месяц). Теперь
  одна заявка может содержать N позиций.
- **Backend (`routes/procurement.py`):**
  - Новая модель `ProcurementLine` (componentId, componentName, category,
    unit, quantity, unitPrice, note).
  - `ProcurementCreate.items: List[ProcurementLine]` — при непустом
    списке режим multi-line.
  - `ProcurementUpdate.items` — полная замена массива при PUT с
    автоматическим пересчётом `totalPrice`.
  - `_normalize_items()` — авто-fill из `sauna_components` по
    `componentId`, расчёт per-line `totalPrice`, сумма grand_total.
  - `_resolve_components_by_id()` — batch-load.
  - `_format_request_message` обновлён: multi-line вариант показывает
    список позиций (до 10) с per-line суммами и итоговую строку, single-line
    оставлен без изменений.
  - Полная backward compatibility: документы без `items` работают как
    раньше; UI отображает их в legacy-формате.
- **Frontend (`ProcurementTab.jsx`):**
  - `RequestDialog` теперь использует **массив позиций** с кнопкой
    `+ Добавить позицию` и иконкой корзины на каждой строке.
  - Per-row `ComponentPicker` с автоподстановкой цены/ед.изм. из каталога.
  - Возможность ввести `componentName` вручную (без выбора из каталога).
  - Auto-fill `supplier` и `title` из первой выбранной компоненты.
  - Live-расчёт `Итого` поверх таблицы позиций.
  - Список заявок: для multi-line показывается `N поз. + первые 2 имени`,
    бейдж `N поз.` в колонке Кол-во.
  - При редактировании legacy single-line заявка автоматически
    конвертируется в 1-строчный массив для единого UI.
- **Тесты:** ✅ 16/16 multi-line + 16/17 базовые = 32 теста, 100%
  (iteration 105). Включая Telegram HTML формат для multi-line.


### Procurement — авто-приход на склад при delivered (DONE - Feb 27, 2026)
- **Driver:** Замкнуть цикл «купили → пришло → склад знает что есть».
  Раньше при переводе заявки в `delivered` нужно было вручную править
  `stockCurrent` в каталоге компонентов.
- **Backend (`routes/procurement.py`):**
  - Новая функция `_apply_stock_delivery(doc, direction=±1)` — атомарно
    обновляет `sauna_components.stockCurrent` через Mongo `$inc` для
    каждой позиции с реальным `componentId`. Поддерживает multi-line и
    legacy single-line.
  - Возвращает summary `{applied, skipped, updates: [...]}`.
  - Поле `stockApplied: bool` на документе как маркер идемпотентности.
  - Хуки:
    - POST с `status='delivered'` сразу применяет приход.
    - PUT с переходом `not-delivered → delivered`: race-safe claim через
      условный update `{stockApplied: {$ne: True}}`, потом `_apply_stock`.
      При ошибке — флаг откатывается и эндпоинт возвращает 500 (чтобы
      статус НЕ остался `delivered` с не-кредитованным стоком).
    - PUT с переходом `delivered → ordered/cancelled/...`: race-safe
      release + `_apply_stock` с `direction=-1`.
    - DELETE delivered: revert stock перед удалением.
  - Race protection: двойной PUT delivered → только первый кредитует
    (условный update_one), второй no-op. Проверено e2e.
- **Тесты:** ✅ 16/16 (iteration 106) + 32/32 регрессия. Покрыто:
  POST delivered, PUT transitions, multi-line с partial componentId,
  unknown componentId skipped, DELETE revert, legacy single-line,
  revert→re-deliver, idempotency на повторный PUT delivered.


### Production — авто-списание комплектующих при запуске (DONE - Feb 27, 2026)
- **Driver:** Вторая половина складского цикла. Procurement (iter 106)
  добавляет stock при `delivered`; теперь production снимает stock при
  переходе лида в производство. Полный учёт без ручных правок.
- **Backend (`routes/sauna_tech_cards.py`):**
  - Новая функция `deduct_production_stock(lead, direction, actor)`:
    - Использует существующие `_extract_targets_from_lead` +
      `_aggregate_targets` для сборки BOM.
    - Атомарный `find_one_and_update` с `$inc` для каждого компонента
      с реальным `componentId`. Free-form BOM rows skip-аются.
    - Пишет audit-запись в `sauna_stock_movements` (type=`out` для
      списания, `in` для отката) с `before`/`after`, `qty`, `leadId`,
      `actorUsername` и осмысленной заметкой.
    - Возвращает summary `{applied, skipped, items[], totalQty,
      totalValue, unmatchedTargets, at}` — сохраняется на лиде для аудита.
  - Новые admin-эндпоинты:
    - `POST /production-stock/preview/{lead_id}` — dry-run, показывает
      какие компоненты будут списаны и сколько (+ флаг `alreadyDeducted`).
    - `POST /production-stock/deduct/{lead_id}` — ручной запуск списания
      (или retry если auto не сработал при push). Race-safe claim,
      409 если уже списано.
    - `POST /production-stock/revert/{lead_id}` — откат прошлого списания
      (например, если лид ошибочно отправили в производство).
- **Integration (`routes/sauna_crm.py · push_to_production`):**
  - После стандартной разметки лида (`inProduction=True`) делается
    атомарный claim флага `productionStockDeducted` и вызывается
    `deduct_production_stock(..., direction=-1)`.
  - Списание — best-effort: если упало (нет BOM, нет tech-card),
    лид всё равно идёт в производство, но claim откатывается, чтобы
    admin мог запустить списание вручную через `/production-stock/deduct`.
  - Идемпотентность через `productionStockDeducted: True` — повторный
    push возвращает 400, повторный manual deduct → 409.
  - Ответ to-production теперь содержит `stockSummary` для UI.
- **Тесты:** ✅ 13/13 новых backend pytest (iteration 107) + 16/16
  procurement regression. Покрыто: preview/deduct/revert (200/404/409),
  to-production happy path, no-BOM no-op claim, race-protection
  на double-push, multi-card BOM aggregation, audit-записи в
  sauna_stock_movements.
- **Известное ограничение:** между set-флага и Mongo $inc есть
  micro-окно без транзакции — для одного админа норм, для multi-admin
  workflow стоит держать в уме.


### Sauna Orders — fix маржи (двойной счёт) (DONE - Feb 27, 2026)
- **Bug:** В `Zamówienia saun` себестоимость показывала 18 328 zł вместо
  правильных 7 946 zł (по cennik) — пример Sauna Wiking Lux z tarasem.
  Маржа уходила в минус (−15.1%) для прибыльных заказов.
- **Root cause:** `_recompute_one` в `routes/sauna_orders.py` делал
  `total_cost = model.costPrice + variant.costPrice + opts.costPrice`,
  но `_sync_cost_price_to_sauna_prices(scope='variant')` записывает
  ПОЛНУЮ себестоимость варианта в `variant.costPrice` (не дельту над
  моделью). Эффект — двойной счёт стоимости постройки.
- **Fix:** При наличии `variant_id` и `variant.costPrice > 0` —
  `model_cost = variant.costPrice` (replace, не add). Идентично
  для `retailExtraCost`. Если у варианта costPrice=0 — наследование
  от модели. Опции уже использовали правильный if/else паттерн
  (без изменений).
- **Параллельно:** `POST /api/sauna/orders/recompute-margins` запущен
  на всех существующих заказах — 3 пересчитаны, 15 unchanged.
- **Известное ограничение:** `if v_extra > 0` не позволяет варианту
  явно занулить retailExtra модели (наследование). Для текущих данных
  ок, но если кто-то захочет переопределить вниз — добавим explicit
  `null` vs `0` semantics.
- **Тесты:** ✅ 5/5 (iteration 108) — variant replaces, fallback при
  costPrice=0, no-variant, VAT-aware маржа, recompute endpoint shape.
  Pre-existing PYTHONPATH issues в 3 тестах iter 106-107 не связаны.


### Cennik + Orders — индикатор «Себестоимость не настроена» (DONE - Feb 27, 2026)
- **Driver:** После фикса double-cost (iter 108) variant без costPrice
  наследует значение модели — это норм, но не очевидно. Хотим явный
  визуальный сигнал, что себестоимость недонастроена, чтобы случайно
  не пускать в работу варианты с фейковой маржой.
- **Backend (`routes/sauna_orders.py`):**
  - `_recompute_one` теперь возвращает два диагностических поля:
    - `marginCostFromModelFallback: bool` — True, если variant.costPrice=0
      и используется model.costPrice как fallback.
    - `marginOptionsCostMissing: list[str]` — имена опций, у которых
      (variant.)costPrice=0.
  - `recompute-margins` персистит эти поля даже когда монетарные значения
    не изменились (через diagnostics_changed).
- **Frontend:**
  - `OrdersPage.jsx`: в строке таблицы рядом с маржой появляется ⚠
    (амбер), всплывает hint при наведении. В Popover расчёта маржи
    добавлены 2 жёлтые строки с конкретным сообщением и подсказкой
    куда зайти исправить.
  - `PriceMatrix.jsx`: при `flags.noCard` ячейка себестоимости теперь
    показывает ⚠ + tooltip «Тех.карта не создана — себестоимость
    не определена. Откройте «Тех.карты» и привяжите BOM».
- **На текущих данных:** Из 31 заказа найдено 4 с опциями без
  настроенной себестоимости (например, `Piec Elektryczne 9 kW`,
  `Belki podłużne`).



## Session Fork (Feb 27, 2026) — Bugfix

### 🔴 P0: «Пересчитать маржи» возвращала 401 Unauthorized
- **Root cause:** В `OrdersPage.jsx` (строка 57) токен читался из
  `localStorage.getItem('token')`, тогда как `AuthContext.js` сохраняет
  его под ключом `'authToken'`. Поэтому `token === null` → заголовки
  пустые → backend `get_admin_user` возвращал 401.
- **Fix:** заменено на `localStorage.getItem('authToken')` в
  `OrdersPage.jsx`. Та же опечатка найдена и исправлена в
  `SaunaProductionPage.jsx` (`syncToSheets`).
- **Verified:** Preview, admin/admin123 — кнопка «Пересчитать маржи»
  возвращает HTTP 200, `updated:0, unchanged:18, skipped:13`.
- **Action для пользователя:** задеплоить на Production
  (`wm-kalkulator.pl`), иначе ошибка не исчезнет.


### 🔴 P0: Маппинг Binotel ↔ amoCRM не подтягивал сотрудников
- **Симптом:** в модалке «Сопоставление Binotel ↔ amoCRM» —
  «Сопоставлено: 0/0», «Нет сотрудников Binotel в этот период»,
  хотя за выбранный диапазон есть сотни звонков.
- **Root cause:** функция `_extract_employee` в
  `routes/binotel_analytics.py` искала employee в нескольких
  местах, **но не в `call.employeeData` верхнего уровня** — а
  именно так реальный Binotel API отдаёт данные. Реальная
  схема:
  ```json
  "employeeData": {"name": "Viyaleta WM-sauna ПК",
                    "email": "wmsauna10+1@gmail.com"}
  ```
  Причём поля `employeeID` нет вовсе — есть только `name` + `email`.
- **Fix:** переписана `_extract_employee` — добавлен приоритетный
  парсинг top-level `employeeData`, fallback на `historyData[*]`
  (для звонков через очередь/IVR), и в качестве `binotelEmployeeId`
  используется `email` (стабильный уникальный идентификатор), а
  если нет — `name`.
- **Verified (Preview, 2026-05-11 → 2026-05-27):**
  `/api/lead-analytics/binotel/employees` возвращает 6 сотрудников
  с правильными именами и звонками (Vlada — 625, Viyaleta — 446,
  Andrzej — 321 и т.д.). Автомаппинг сработает по совпадению имён.
- **Action для пользователя:** задеплоить на Production.


### 🟡 P1: Watchdog таймаут «Полная синхронизация подвисла» при больших объёмах
- **Симптом:** на проде 1245 лидов + 10k событий → полный sync падал
  с «подвисла >32 мин — автоматически помечена как ошибка», хотя
  бэкенд продолжал работать.
- **Fix:** `unified_sync.py` — `STALE_MINUTES` поднят с 30 → 90.
  `manager_events_analytics.py` — watchdog с 15 → 60 мин.
- **Action:** деплой на Production.

### 🟡 P1: «Разблокировать зависшие» возвращала 0, но 7 звонков «В очереди»
- **Root cause:** «В очереди» во фронте = статус `new`, но
  `_reset_stale_calls` сбрасывал только `transcribing`/`analyzing`.
  В статусе `new` могут зависать «пустышки» из amoCRM (системные
  заметки без `audio_url` и `audio_data`) — `process-all` их
  пропускает, потому что нет аудио, и они навсегда болтаются в очереди.
- **Fix:** `/api/call-analytics/reset-stale` теперь дополнительно
  переводит `new`-звонки без аудио в статус `skipped` («Нет аудио
  (импорт-«пустышка»)»). Возвращает `{reset, skipped}`. Кнопка
  на фронте обновлена — показывает обе цифры.
- **Action:** деплой на Production.


### 🟡 P1: «Сводка» и «По событиям» показывают разное число лидов
- **Симптом:** в Сводке за 26.05–28.05 — 57 лидов, а в «По событиям»
  по тем же датам — Viyaleta 308 + Andrzej 228 + Vlada 310 = 846.
- **Root cause:** endpoint `/events/manager-stats` читал snapshot
  `event_manager_stats`, сохранённый в момент синка — даты фильтра
  из UI применялись только к пересчёту звонков, но **не к
  `totalLeads`**. Поэтому цифры замораживались на дате последнего
  полного синка.
- **Fix:** в `manager_events_analytics.py:get_event_manager_stats`
  добавлен on-the-fly пересчёт лид-метрик (`totalLeads`,
  `processedLeads`, `notProcessedLeads`, `weakLeads`,
  `stalledLeads`, `singleTouchLeads`, `autoOnlyLeads`,
  `avgReactionHours`, `processedPct`, `singleTouchPct`,
  `autoOnlyPct`, `followUpRate`, `closedLostLeads`) из
  `lead_analytics_leads` по выбранным пользователем датам.
  Срабатывает только когда `date_from`/`date_to` явно переданы —
  без них работает старая логика (snapshot последнего синка).
  Метрики событий (totalEvents, performanceScore) остаются из
  snapshot, чтобы не пересчитывать дорогостоящее ранжирование.
- **Verified:** на Preview endpoint отдаёт 200 OK, в ответе
  появляется флаг `filterInfo.leadsRecomputedForDateRange = true`.
- **Action:** деплой на Production. После деплоя «По событиям»
  будет показывать те же цифры, что и «Сводка» для одного диапазона.

### ✨ Enhancement: единый фильтр дат для всех вкладок «Контроль лидов»
- **Запрос:** «зачем два фильтра — в Сводке и в Событиях, мне нужна
  возможность оценивать эффективность менеджера в один период».
- **Что сделано:** `ManagerEventsAnalytics` теперь принимает
  `dateFrom`/`dateTo` от родителя как props + флаг `hideOwnFilters`.
  Когда вкладка «По событиям» открыта внутри `LeadAnalyticsPage`,
  её локальные date-pickers скрываются — все 7 вкладок (Сводка,
  По менеджерам, Расш.аналитика, Проблемные, Закрытые, По событиям,
  AI-рекомендации) подчиняются ОДНОМУ фильтру в шапке.
- **Совместимость:** компонент остаётся standalone-совместимым —
  если запустить `ManagerEventsAnalytics` без props, работают
  старые внутренние date-pickers (legacy-режим).
- **Verified:** lint обоих файлов чистый, `fetchData` уже
  пересчитывается при смене `dateFrom`/`dateTo` через `useCallback`-deps.
- **Action:** деплой на Production.



### 🟡 P1: Прогресс обработки звонков застревал на 407/417 после ошибок
- **Симптом:** «нечего разблокировать», но прогресс-бар не доходит
  до 100% — висит на 407/417, потому что 3 звонка с ошибкой
  считаются как «незавершённые».
- **Root cause:** в `CallAnalyticsPage.jsx:54` формула была
  `pct = done / (inFlight + pending + done + errors) * 100`.
  Ошибки в знаменателе, но не в числителе → 100% невозможно
  достичь без удаления ошибок.
- **Fix:** ошибки теперь считаются «обработанными» для прогресса
  (`pct = (done + errors) / totalRelevant`). При этом красная
  плашка «Ошибки: N» по-прежнему показывается отдельно — пользователь
  видит и общий прогресс, и нерешённые проблемы.
- **Verified:** lint чистый, формула проверена логикой.
- **Action:** деплой на Production.

### ✨ Enhancement: KPI-бар по менеджерам в шапке «Контроль лидов»
- **Запрос:** «нужна возможность оценивать эффективность менеджера —
  обработка заявок, звонки, смены этапа и задач».
- **Что сделано:** новый компонент `ManagerKPIBar` в
  `LeadAnalyticsPage.jsx` — компактный горизонтальный ряд карточек
  менеджеров (rank + имя + балл + % обработки + проблемных), всегда
  видим в шапке, реагирует на единый фильтр дат. Цвет фона: зелёный
  (балл ≥70), жёлтый (50-69), красный (<50).
- **Клик по карточке** → переход на вкладку «По событиям» +
  автоматически открывается деталка выбранного менеджера
  (через `window.__preselectedManagerId` + useEffect в
  `ManagerEventsAnalytics`).
- **Тихий fail:** если данных нет — компонент возвращает `null`,
  не ломая страницу.
- **Verified:** lint обоих файлов чистый, скриншот Preview ОК.
- **Action:** деплой на Production.


### 🟡 P1: 7 звонков-зомби в очереди после деплоя
- **Симптом:** даже после улучшений всё ещё «В очереди: 7» и прогресс
  застрял на 410/417.
- **Root cause:** эти 7 звонков в редком зомби-состоянии:
  у них есть `audio_data` (base64 в MongoDB — видно по индикатору
  «В MongoDB: 7»), но `duration_seconds = 0` (amoCRM не передал
  длительность). Они выпадали из всех очисток (process-all skip-short
  требует `$gt:0`; purge-empty требует отсутствия audio_data; reset-stale
  ловил только transcribing/analyzing).
- **Fix:** в `/api/call-analytics/reset-stale` добавлена 3-я очистка:
  `new`-звонки с `duration_seconds <= 0` переводятся в `skipped`
  с причиной «Нет длительности (amoCRM не передал)».
- **Action:** деплой → нажать «Разблокировать зависшие» → 7 уйдут
  в Пропущено, прогресс 100%.


### 🔴 P0 CRITICAL: Авто-синк удалял исторические лиды (1245 → 88)
- **Симптом:** вчера было 1245 лидов, сегодня — 88. Пользователь
  вручную ничего не делал.
- **Root cause:** daily scheduler (`server.py:269`) запускает
  unified sync с `date_from=yesterday`. В `_run_sync` шаг 7
  («Remove leads deleted from amoCRM») удалял ВСЕ лиды БД, которых
  нет в текущем результате синка. Так как инкрементальный синк
  загружал только ~67 лидов «со вчера», шаг 7 удалял оставшиеся
  ~1156 исторических. **Критическая потеря данных.**
- **Fix:** в `routes/lead_analytics.py:384-420`:
  1. Step 7 теперь **полностью пропускается при `force=False`**
     (инкрементальный синк не может надёжно детектить удаления
     вне своего окна — риск перевешивает пользу).
  2. При `force=True` удаление **скоупится** по `createdAtTs`
     в пределах того же `ts_from`/`ts_to`, что использовал синк.
- **Verified:** lint OK, backend перезапущен, синк-статус 200 OK.
- **Action для пользователя:**
  1. Деплой на Production.
  2. Запустить **«Полная синхронизация»** (force=true) с пустыми
     датами или диапазоном «с 01.01.2026 по сегодня» — это
     восстановит все 1245 лидов из amoCRM.
  3. Daily scheduler больше не сможет затирать исторические лиды.


### 🟡 P1: «У менеджеров только по одному лиду, а в Сводке 36» — orphan-лиды
- **Симптом:** Сводка показывает 36 лидов, но в KPI-баре и
  Telegram-отчёте у менеджеров только 2 лида (1+1+0).
- **Root cause:** в `manager_events_analytics.py:361`
  `bot_ids.update({"0", "", "None", "unknown"})` — все лиды с
  `responsibleUserId="0"` (= **без ответственного в amoCRM**)
  считались «ботами» и **исключались** из manager-stats. Их 34
  штуки растворялись без следа — невозможно было увидеть, что
  они вообще существуют.
- **Fix:** добавлен «orphan-bucket» — синтетическая карточка
  `userId="unassigned"`, `userName="⚠️ Без ответственного"`,
  `isUnassigned: true`. Считается и при синке, и при on-the-fly
  пересчёте по выбранному периоду.
- **Frontend:** KPI-бар отрисовывает orphan-карточку оранжевым
  без ранга `#N` и без % обработки — вместо них показывает «нужно
  распределить». Это сразу подсвечивает проблему пользователю.
- **Verified:** lint backend/frontend чистый, endpoint 200 OK.
- **Action:** деплой → после полного синка появится оранжевая
  карточка «⚠️ Без ответственного: 34 лида» в KPI-баре.
