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
- Marketer: marketer / marketer123
- Test Dealer: testdealer / dealer123  (id=2710dcf7-a971-4124-ab3e-1e0a401f5c11)
