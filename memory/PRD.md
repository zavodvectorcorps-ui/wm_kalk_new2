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

## Session — Jul 2, 2026: order-id prefixes rebranded + PDF logo forced to text
- Order-id prefixes rebranded: sauna `WMS-` → **`ALS-`**, купели/balia `WMB-` →
  **`ALB-`**. Changed at generation (`models/sauna.py`, `models/balia.py`) and PDF
  offer-number logic (`routes/sauna.py`, `routes/balia.py` incl. web→main
  conversion). PDF offer-number `startswith` accepts BOTH old and new prefixes so
  existing `WMS-`/`WMB-` orders still render. Order lookups are exact-id (only
  `AMO-` uses prefix matching), so no lookup breakage. Verified new orders: sauna
  `ALS-…`, balia `ALB-…`; old-prefix PDFs still work.
- PDF header logo: removed the image-logo path entirely — header now ALWAYS
  renders the styled text «ALICOR SPA» (`companyName`), ignoring any uploaded
  `logoImageId`. Fixes the lingering old logo on production without editor edits.

## Session — Jun 26, 2026 (later): swatches merged into gallery page
- Moved the «Warianty malowania» + «Warianty gontu» swatch image OUT of its own
  flow position INTO the gallery block (after the photo rows, before the
  company slogan) so it shares the GALERIA REALIZACJI page instead of orphaning
  onto a separate page. Verified: gallery photos + both swatch sections render
  together on one page, nothing cut off.
- Old logo in PDF header = production template's uploaded `logoImageId` (DB data,
  not code). Code already ignores `logo7.png`; header = custom logo OR styled
  «ALICOR SPA» text. Fix = user removes the uploaded logo in PDF editor
  (Изображения → Логотип → ✕ → Сохранить) on production.

## Session — Jun 26, 2026: Sauna PDF rebranded to ALICOR + finish swatches
- Sauna PDF (`generate_sauna_pdf`) rebranded WM → **ALICOR**: header logo text
  (`companyName`), legal name/address/NIP/REGON in header-right block, ALICOR
  contacts in footer slogan. Brown-beige theme kept; all calculator data flow
  and interior-plan diagram preserved (unchanged).
- New configurable PDF text fields (editable in «Тексты» tab + PDFTexts model):
  `companyName`, `companyLegalName`, `companyAddress`, `companyNIP`,
  `companyRegon`. Header-right no longer shows Tel/Email/Website (moved to footer
  per ALICOR design). DB sauna templates updated with ALICOR values.
- Added **«Warianty malowania» + «Warianty gontu bitumicznego»** swatch section
  (static image `/app/assets/swatches_alicor.png`, cropped from client's КП at
  300 DPI, full width centered, aspect-preserved). Gated by new `swatches` block
  (default enabled). Rendered before the gallery page.
- Verified: 2-page PDF generates (HTTP 200), contains ALICOR/NIP/REGON/contacts,
  zero WM references, both swatch headings + all samples fully visible (no clip),
  editor renders the 5 new company fields with ALICOR values.
- NOTE: the web-app top-nav still shows "WM-Sauna" branding (UI only, not PDF) —
  not changed (out of scope of this request).

## Session — Jun 13, 2026: In-app super-admin management + force-logout-all
- Super-admin decoupled from username via DB flag `superAdmin:true`. JWTs now
  carry `iat` + `superAdmin` claims. Global token invalidation timestamp in
  `db.app_config` (`_id="auth_invalidation"`, 30s cache) → force-logout all.
- New endpoints: `POST /api/auth/logout-all-devices` (super-admin),
  `POST /api/auth/super-admin/credentials` (rename own login / change password,
  returns fresh token). All 6 super-admin gates in `routes/auth.py` now use the
  `superAdmin` flag instead of hardcoded `"admin"` username.
- `init_admin_user` reworked: seed only if no super-admin exists; promote a
  legacy `ADMIN_USERNAME` user (one-time migration); never resurrect after rename.
- Frontend: `SuperAdminCard` in «Работники» (rename login, change password,
  «Выйти на всех устройствах»). `AuthContext.isSuperAdmin` uses the flag (+legacy
  username fallback); added `applyAuth` to refresh session in-place.
- Why: production deploy Secrets panel only allows EDITING existing keys (can't
  add `ADMIN_USERNAME`/`JWT_SECRET`), so renaming admin→maxim + force-logout are
  done entirely in-app — no secret changes required.
- Tested: 5/5 pytest (`tests/test_configurable_super_admin.py`) + e2e curl
  (rename, logout-all invalidates old token, fresh login works) + UI screenshot.

## Session — Jun 10, 2026: PDF texts fully configurable in Admin
- `PDFTemplateEditor.jsx` («Тексты» tab) now exposes **«Срок реализации»**
  (`deliveryText`) and **«Аванс / предоплата»** (`paymentText`) input fields
  (data-testid `pdf-text-delivery` / `pdf-text-payment`), next to the existing
  warranty/footer fields. Admin can now edit all PDF terms without code.
- `routes/sauna.py::generate_sauna_pdf` total-section now reuses the
  already-loaded sauna `template_texts` (filtered by calculator_type) instead
  of re-fetching any `isDefault` doc — fixes a latent bug where the balia
  template's texts could leak into the sauna PDF.
- DB: both sauna `pdf_templates` docs updated — warranty 12→24 miesiące,
  delivery/payment seeded with standard defaults.
- Verified: PUT round-trip persists fields; generated PDF shows TERMIN
  REALIZACJI / ZALICZKA / 24 miesiące / footer; editor screenshot confirms
  fields render with values.
- ⚠️ DEPLOY TO PRODUCTION (wm-kalkulator.pl) required for user to see changes.

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


### ✨ Enhancement: гибридная атрибуция лидов (По ответственному / По активности)
- **Запрос:** «можно ли анализировать не по активному менеджеру,
  а по тому, от кого проходит действие? Чтобы менеджеры не были
  обязаны ставить себя ответственным».
- **Что сделано:**
  - **Backend (`lead_analytics.py`):** каждому лиду при синке
    сохраняется поле `firstManualActionBy` — `user_id` того, кто
    первым сделал ручное действие (звонок/заметка/смена этапа/задача;
    open/view исключены).
  - **Backend (`manager_events_analytics.py`):** endpoint
    `/manager-stats` принимает параметр `attribution_mode`:
      * `responsible` (по умолчанию) — старая логика.
      * `activity` — лиды с `responsibleUserId in ("","0")`
        перебакетятся к `firstManualActionBy`. Если действия так
        и не было — остаются в orphan-bucket.
  - **Frontend (`LeadAnalyticsPage.jsx`):** в шапке появился
    тоггл «По ответственному / По активности» (data-testid:
    `attribution-mode-responsible`/`activity`). Прокидывается в
    `ManagerKPIBar` и `ManagerEventsAnalytics` через props.
    При смене режима — авто-refetch (deps `useCallback`).
- **filterInfo:** в режиме activity возвращает
  `activityReattributedLeads: N` — сколько orphan-лидов перешло
  к реальному исполнителю.
- **Verified:** lint всё чистый, endpoint оба режима 200 OK.
- **Action:** деплой → запустить полную синхронизацию (чтобы
  заполнить `firstManualActionBy` для существующих лидов) →
  переключить тоггл в «По активности».


### ✨ Enhancement: actionable orphan-карточка в KPI-баре
- **Запрос:** «на orphan-карточке в режиме «По активности»
  показывать в tooltip — N лидов, которых никто не тронул».
- **Что сделано:** orphan-карточка теперь:
  - Оранжевая обводка + лёгкий ring для акцента.
  - Вместо балла — крупный «!» (нужно действие).
  - В режиме «По ответственному» бэдж: «нужно распределить».
  - В режиме «По активности» бэдж: «никто не тронул» —
    подсвечивает САМЫЕ проблемные лиды (в активности у них даже
    первого касания не было).
  - **Контекстный tooltip:** в каждом режиме объясняет, что значит
    эта цифра и что с ней делать (подсказывает переключить режим
    либо распределить вручную).
  - Стилизация защищена: scoreBg/scoreColor получили параметр
    `unassigned` — orphan не «красится» как менеджер с балл=0.
- **Verified:** lint чистый.
- **Action:** деплой → orphan-карточка автоматически приобретёт
  новый вид; контекст меняется при переключении тоггла.


### 🟡 P1: Сводка показывала 1326, а KPI-бар 1+1+0 (рассинхрон фильтров)
- **Симптом:** на проде Сводка показывает 1326 лидов, а KPI-бар —
  только 2 (1+1+0). Менеджеров с большим числом лидов не появляется.
- **Root cause:** в `LeadAnalyticsPage.jsx` Сводка ждала клика
  «Применить» (вызывая `fetchSummary` вручную), а KPI-бар и
  `ManagerEventsAnalytics` авто-рефрешились на каждое изменение
  `dateFrom`/`dateTo` через `useEffect`. Пользователь выбрал даты
  29.05–30.05 в полях, KPI-бар сразу подтянул только 2 лида,
  а Сводка осталась со старым (полным) диапазоном.
- **Fix:** введены `appliedDateFrom`/`appliedDateTo` —
  «применённые» даты. `dateFrom`/`dateTo` остались как draft для
  полей ввода. **Все** панели (Сводка, KPI-бар, ManagerEvents,
  ClosedLostTab, AIRecommendations, UnifiedSync, handleSync)
  читают только applied-версии. Кнопка «Применить» теперь
  копирует draft → applied (=> все панели рефрешатся в один такт).
  Quick-кнопки «Сегодня / Эта неделя / Этот месяц» применяют
  даты немедленно (без дополнительного клика). «Сбросить»
  обнуляет оба набора дат.
- **Verified:** lint чистый.
- **Action:** деплой → выбрать даты → нажать «Применить» → все
  числа на странице обновятся вместе.


### 🟡 P1: KPI-бар игнорировал тоггл «По созданию / По обработке»
- **Симптом:** Сводка с «По обработке» 29-30.05 показывает много
  лидов (с которыми менеджеры работали), а KPI-бар — только 1+1+0
  (лидов, СОЗДАННЫХ в эти 2 дня). Это другой срез.
- **Root cause:** endpoint `/manager-stats` всегда фильтровал по
  `createdAt`. Параметр `date_field` фронтом не передавался.
- **Fix:**
  - **Backend:** `/manager-stats` принимает `date_field` (`created` /
    `processed`). В режиме `processed` фильтрует по `firstActionAt`
    и исключает лиды без первого действия — точно как Сводка.
  - **Frontend:** `dateField` (из `LeadAnalyticsPage`) прокидывается
    в `ManagerKPIBar` и `ManagerEventsAnalytics`, добавлен в
    `useEffect`/`useCallback` deps — авто-refetch при переключении.
- **Verified:** lint чистый, endpoint c `date_field=processed`
  отдаёт 200 OK.
- **Action:** деплой → выбрать «По обработке» + 29-30.05 → нажать
  «Применить» → KPI-бар покажет реальную картину работы менеджеров
  в эти дни (а не «созданных» лидов).


### 🟡 P1: KPI-бар «По обработке» считал только глобально-новые лиды
- **Симптом:** в детальной карточке Viyaleta показано 328 лидов и
  1236 событий за период, а в KPI-баре на той же странице — 2 лида.
  Пользователь видит в логах amoCRM, что 29.05 Viyaleta работала с
  десятками лидов (responsible_changed + смены этапа + заметки +
  задачи), но эти лиды СОЗДАНЫ в марте-апреле.
- **Root cause:** в режиме `date_field=processed` использовался
  фильтр `firstActionAt` (глобальное «первое в мире» действие на
  лиде). Если лид был создан 1 марта и Andrzej сделал первую
  заметку 5 марта, то `firstActionAt = 5 марта` — даже если 29.05
  лидом начала заниматься Viyaleta и сделала на нём 10 действий.
  Лид НЕ попадал в её фильтр 29-30.05.
- **Fix:** в `manager_events_analytics.py:get_event_manager_stats`,
  при `date_field=processed`, теперь идёт прямой запрос к
  `amocrm_events`:
  ```
  Match: entity_id != null, created_at_ts in [from, to]
  Group: (created_by, entity_id) → uniq
  Group: created_by → set of distinct lead_ids
  ```
  Затем лиды гидратируются из `lead_analytics_leads` и бакетятся
  по `created_by`. Один лид может попасть к нескольким менеджерам —
  это правильная семантика для «кто работал с лидом в период».
- **Edge cases:** orphan-карточка в этом режиме не показывается
  (логика «без ответственного» бессмысленна — лиды бакетятся
  по реальной активности, и лид с действием от менеджера X
  автоматически приписан к X).
- **Verified:** lint OK (только pre-existing E741), endpoint
  отдаёт 200 OK, `filterInfo.activityQueryUsed = true` для
  диагностики.
- **Action:** деплой → «По обработке» + 29-30.05 + «По активности»
  → нажать «Применить» → KPI покажет 30+ лидов на Viyaleta,
  что соответствует её логу действий в amoCRM.


### ✨ Enhancement: разбивка действий в KPI-карточке менеджера
- **Запрос:** «показывать, ЧТО именно делал менеджер за период,
  не только сколько лидов».
- **Что сделано:**
  - **Backend:** в режиме `date_field=processed` добавлен второй
    aggregate-pipeline над `amocrm_events` (group by uid + type) —
    возвращает `eventBreakdown` для каждого менеджера:
    `stageChanges`, `notes`, `tasks`, `messages`, `total`.
  - **Frontend:** в KPI-карточке появилась вторая строка с
    компактными иконками: `📞 N` (звонки), `↗ N` (смены этапа),
    `📝 N` (заметки), `✓ N` (задачи), `💬 N` (сообщения).
    Каждая иконка с tooltip-расшифровкой.
  - **Hover-tooltip** карточки теперь полностью переписан:
    показывает все цифры построчно (лиды, звонки исх/вх, смены
    этапа, заметки, задачи, сообщения, всего событий).
  - Карточка стала шире (200px) чтобы разбор уместился.
- **Verified:** lint OK, endpoint 200 OK.
- **Action:** деплой → «По обработке» + «По активности» →
  KPI-карточки покажут не только балл и %, но и состав работы.

## Session — Jul 2, 2026 (cont.): Contract Modal + Balia "Update vs New KP"

### 1. Contract Generation Modal (Sauna CRM)
- `POST /api/sauna-crm/generate-contract` now accepts optional `selectedOrderIds`
  (list of calculator order ids to attach — only these are appended) and
  `clientData` (client field edits applied to the lead before generation).
  Legacy call `{leadId}` still auto-attaches ALL KPs (backward compatible).
- New `GET /api/sauna-crm/contract-template/available-kps/{lead_id}` — returns
  client data + every calculator KP for the client (Sauna ALS-…, Balia ALB-…)
  with `hasPdf` flag (checks calculator_pdfs.pdf_data / cloudinary_url /
  order.kpCloudinaryUrl). Backend helpers `_gather_kp_orders`,
  `_attach_kps_by_ids` in `routes/contract_template.py`.
- Frontend `components/ContractGenerationModal.jsx` (new): editable client
  fields (contract-client-name/phone/email/address/total/advance) + KP list
  with checkboxes (contract-kp-checkbox-{id}, disabled when no PDF). Wired into
  `SaunaCRMPage.jsx` — "Создать договор" (generate-contract-btn) now opens the
  modal instead of instant generation.

### 2. Balia (Купели) calculator — Update vs Create-New KP (parity with Sauna)
- `CalculatorPage.jsx handleSaveOrderAndGeneratePdf(forceNew=false)`:
  isUpdate = editMode && editOrderId && !forceNew → PUT existing; else POST new
  (fresh `ALB-…` id). Edit-mode shows two buttons:
  balia-save-generate-pdf-btn («Обновить КП и скачать PDF») +
  balia-create-new-kp-btn («Создать новое КП»). New balia ids now use ALB- prefix.

### Tested
- Backend 4/4 pytest (`tests/test_contract_gen_modal.py`): available-kps shape,
  selective attach, empty selection (no KP), legacy auto-attach. 100%.
- Frontend both flows verified 100% (modal open/edit/select/generate; Balia dual
  buttons in edit mode, single in new mode).
- Note: a transient GET /api/orders 500 during testing was caused by main-agent
  seed data missing required `phoneNumber` — seed removed, endpoint back to 200.
- ⚠️ DEPLOY TO PRODUCTION (wm-kalkulator.pl) required for user to see changes.

## Session — Jul 2, 2026 (3rd): Contract-modal totals + Balia PDF ALICOR rebrand
- **Улучшение модалки договора** (`ContractGenerationModal.jsx`): панель под списком КП
  показывает «Сумма выбранных КП (N)», поле «Задаток %» (по умолч. 30) с авто-расчётом
  суммы задатка и кнопку «Подставить в сумму и задаток» (заполняет totalAmount +
  advancePayment клиента). testids: contract-totals-panel / contract-selected-total /
  contract-deposit-pct / contract-deposit-amount / contract-apply-totals. Подтверждено
  скриншотом.
- **PDF Купелей (Balia) ребрендинг WM → ALICOR** (`routes/balia.py::generate_pdf`):
  логотип-хедер «ALICOR SPA», справа ALICOR Sp. z o.o. + адрес + NIP 7011250572 /
  REGON 541183349, футер со слоганом ALICOR (contacts + alicor.pl), ярлык подарка
  «Prezent od ALICOR SPA». Проверено: PDF HTTP 200, ALICOR/NIP/alicor.pl присутствуют,
  0 упоминаний WM.
- **Фикс латентного бага шрифтов**: balia `generate_pdf`/`generate_pdf_bytes` теперь
  вызывают `services.pdf_fonts.ensure_pdf_fonts()` (регистрирует шрифт-СЕМЕЙСТВО через
  registerFontFamily). Раньше balia PDF с markup в заголовке (`<font>`) падал ps2tt-
  ошибкой, если до этого в процессе не генерился sauna-PDF. Теперь работает автономно.
- ⚠️ DEPLOY TO PRODUCTION (wm-kalkulator.pl) — чтобы увидеть на проде.

## Session — Jul 2, 2026 (4th): Modal breakdown/warning + Balia PDF configurable requisites
- **Модалка договора**: помимо панели сумм добавлено предупреждение (amber banner,
  testid=contract-budget-warning) когда сумма выбранных КП ≠ сумме сделки лида
  (totalAmount) — показывает разницу. Разбивка по каждому КП (модель + сумма) уже
  видна в строках списка. Подтверждено скриншотом (50 000 vs 60 000, разница 10 000).
- **Конфигурируемые реквизиты PDF Купелей**: `routes/balia.py::generate_pdf` теперь
  читает companyName / companyLegalName / companyAddress / companyNIP / companyRegon /
  companySlogan / headerTitle из `pdf_templates{calculator_type:'balia',isDefault:true}`
  (fallback — дефолты ALICOR). Проверено curl: кастомные значения из шаблона попадают
  в PDF; при отсутствии шаблона — ALICOR по умолчанию, WM отсутствует.
- **Admin UI**: вкладка «Szablon PDF» (Konstruktor PDF) включена для купелей
  (Header.jsx desktop+mobile: calculatorType 'sauna'||'balia'; App.js монтирует
  `<PDFTemplateEditor calculatorType="balia"/>` на activeTab='pdf-template'). Вкладка
  «Тексты» даёт редактирование всех реквизитов. Подтверждено скриншотом.
- ⚠️ DEPLOY TO PRODUCTION (wm-kalkulator.pl).

## Session — Jul 3, 2026: FIX белой страницы в калькуляторе Саун (edit mode)
- **Баг (прод)**: при открытии заказа Саун на редактирование — белая страница.
  Консоль прода: `Uncaught ReferenceError: Plus is not defined at
  SaunaCalculator.jsx:1945`. Иконка `<Plus>` (кнопка «Создать новое КП» из прошлой
  сессии) использовалась, но НЕ была импортирована из lucide-react.
- **Фикс**: добавлен `Plus` в импорт lucide-react в `SaunaCalculator.jsx` (строка 15).
- **Почему не ловилось раньше**: блок с `<Plus>` рендерится только в edit mode КОГДА
  выбрана модель (карточка summary с кнопками). Прод-сборка компилируется без ошибок
  (bare identifier падает только в рантайме), поэтому проверка сборки не выявляла.
- **Проверено**: testing_agent 100% (iteration_110) — edit+модель рендерит 3 кнопки
  без крэша, консоль чистая; регрессий нет (Balia edit, новый заказ Саун — ОК).
- ⚠️ Нужно ПЕРЕДЕПЛОИТЬ на прод (Deploy to Production) — фикс во фронтенде.

## Session — Jul 3, 2026 (2): FIX модалка договора — «не подтягивает КП» + 504
- **Баг (прод)**: модалка договора показывала «КП не найдены», хотя у лида есть
  КП-документы; endpoint available-kps отдавал 504 (таймаут).
- **Причина**: поиск КП смотрел только на ORDER'ы по amocrm_id (не на lead.documents),
  и использовал медленный count_documents по бинарю pdf_data + сканы без индексов.
- **Фикс** (contract_template.py):
  * `_gather_kps` теперь включает документ-КП из `lead.documents` (первыми), плюс
    order-КП (calc order + amoCRM siblings) с max_time_ms/limit и try/except (не 504).
  * `_kp_has_pdf` — дешёвая проверка существования PDF (не читает бинарь).
  * У каждого КП стабильный `kpId` = `doc:<url>` | `order:<id>`. Attach
    (`_attach_selected_kps`) резолвит и документ-URL (direct download / proxy
    /calculator-pdf/{orderId}), и order-id.
  * `generate_contract_with_kp(selected_kp_ids=...)`; sauna_crm читает `selectedKpIds`.
  * server.py: индексы amocrm_id/id (orders/sauna_orders/balia_orders) + order_id
    (calculator_pdfs) — устраняют сканы/таймаут.
  * Frontend модалка: выбор по kpId, шлёт `selectedKpIds`.
- **Проверено**: testing_agent iteration_111 — backend 5/5, frontend 100%
  (модалка показывает 2 документ-КП, генерация с doc-КП прикрепляет, пустой выбор
  без вложений, legacy авто-attach, пустой лид => kps:[] без 504).
- ⚠️ ПЕРЕДЕПЛОИТЬ на прод: индексы создаются при старте бэкенда после деплоя.

## Session — Jul 3, 2026 (3): Улучшение — «Загрузить КП» в модалке договора
- Добавлена кнопка «Загрузить КП» прямо в ContractGenerationModal: менеджер грузит
  PDF/изображение, оно сохраняется (calculator_pdfs, order_id KPU-<uuid>, без
  зависимости от Cloudinary), регистрируется как 'kp'-документ лида, добавляется
  первым в список и авто-выбирается, затем прикрепляется к договору.
- Backend: `POST /api/sauna-crm/contract-template/upload-kp/{lead_id}` (multipart file).
  Валидация: только .pdf/.png/.jpg (400), несуществующий лид (404).
- Frontend: handleUploadKp + скрытый input (contract-upload-kp-input) + кнопка
  (contract-upload-kp-btn).
- Проверено: testing_agent iteration_112 — backend 4/4, frontend 100% (загрузка,
  авто-выбор, генерация с приложенным КП).
- ⚠️ ПЕРЕДЕПЛОИТЬ на прод.

## Session — Jul 3, 2026 (4): Убрано "od WM-Group" из PDF (только "Prezent")
- sauna.py: 4 ярлыка подарка «Prezent od WM-Group» → «Prezent»; дефолтный
  companySlogan «WM-Group — ...» → «ALICOR SPA — Producent saun i bali na wymiar».
- balia.py: ярлык подарка → «Prezent» (был «Prezent od ALICOR SPA»).
- Проверено: sauna generate-pdf HTTP 200, в PDF нет «WM-Group», есть ALICOR.
- Внутренние Cloudinary-папки «wm-calculator/...» НЕ трогали (не видны в PDF).
- ⚠️ ПЕРЕДЕПЛОИТЬ на прод.

## Session — Jul 3, 2026 (5): SECURITY Пункт 1 — fail-fast JWT_SECRET/ADMIN_PASSWORD
- backend/config.py: убраны захардкоженные фолбэки JWT_SECRET/ADMIN_PASSWORD.
  Добавлен `_required_env(name)` → RuntimeError "<NAME> is not set" при отсутствии.
  ROOT_DIR/load_dotenv и прочие строки НЕ трогали. Значение секрета НЕ менялось.
- Проверено testing_agent iteration_113: 14/14 auth-тестов (admin/marketer/
  kladovshchik + dealer portal + token reuse + 401 на неверный/битый токен +
  cross-token isolation + fail-fast import). 100% backend+frontend.
- ⚠️ ДЕПЛОЙ: JWT_SECRET и ADMIN_PASSWORD ДОЛЖНЫ быть заданы (одинаковый
  JWT_SECRET) на ВСЕХ прод-инстансах, иначе инстанс намеренно не стартует
  (это защита, а не баг). Секрет не менять — иначе разлогин всех.
- NB: в свежей БД админ больше НЕ создаётся с фолбэк-паролем; ADMIN_PASSWORD env обязателен.

## Session — Jul 3, 2026 (6): SECURITY Пункт 2 — удалён AdminLogin.jsx
- Удалён неиспользуемый frontend/src/components/AdminLogin.jsx (захардкоженный
  пароль '159357' + фейковая клиентская проверка через sessionStorage 'adminAuth').
- Проверено: 0 импортов компонента и 0 чтений ключа 'adminAuth' во всём frontend/src.
  Реальный доступ идёт через useAuth/canEdit. Фронтенд компилируется успешно,
  страница входа грузится (smoke-скрин). Ничего не сломано.

## Session — Jul 3, 2026 (7): SECURITY Пункт 3 — amoCRM update-fallback
- routes/amocrm.py receive_webhook_section: событие 'update' без существующего
  заказа больше не пропадает молча. Если у секции НАСТРОЕН pipeline (и он уже
  совпал с фильтром) → заказ восстанавливается через путь создания ('add'),
  лог update_fallback=True. Если pipeline НЕ настроен → строгий skip (защита от
  чужих воронок). Фильтр pipeline НЕ менялся.
- Guard: если update пришёл со статусом «слетел заказ» (CANCELLED_STATUS_ID
  73620210) и заказа нет → НЕ создаём (не воскрешаем отменённую сделку).
  Существующая ветка удаления отменённых (для существующих заказов) не тронута.
- Проверено testing_agent iterations 114 (6/6) + 115 (11/11): fallback-create,
  no-pipeline skip, pipeline-mismatch skip, cancelled-not-recreated, add->update
  без дублей, existing-cancelled-delete. Данные очищены, section_pipelines
  восстановлен (absent).

## Session — Jul 3, 2026 (8): SECURITY Пункт 4 — CANCELLED_STATUS_ID в настройки
- AmoCRMSettings.cancelled_status_id (default '73620210'); webhook читает
  settings.get('cancelled_status_id') or '73620210'. UI-поле в IntegrationsPage
  (data-testid amocrm-cancelled-status-id-input). GET /settings теперь возвращает
  cancelled_status_id.
- Проверено testing_agent 116/117: backend 6/6 логики + UI round-trip 100%.
- ⚠️⚠️ ОБНАРУЖЕН КРИТИЧНЫЙ ПРЕД-СУЩЕСТВУЮЩИЙ БАГ (НЕ мой, НЕ трогал без согласия):
  GET /api/integrations/amocrm/settings НЕ возвращает `section_pipelines` и
  `stage_sync`. Фронтенд при сохранении шлёт полное состояние → пустые значения
  → сохранение из вкладки «Синхронизация» ЗАТИРАЕТ section_pipelines/stage_sync
  в БД. Это ломает Пункт 3 (нужны section_pipelines) и теряет фильтры воронок.
  ТРЕБУЕТСЯ отдельное разрешение пользователя на фикс (добавить эти 2 поля в GET).

## Session — Jul 3, 2026 (9): FIX (одобрено) — GET /settings no-wipe
- GET /api/integrations/amocrm/settings теперь возвращает section_pipelines и
  stage_sync (сохранённые значения). Устранён пред-существующий баг потери данных:
  сохранение настроек из UI больше НЕ затирает section_pipelines/stage_sync.
  Логика POST /settings и фильтр pipeline не тронуты.
- Проверено testing_agent iteration_118: backend 4/4, frontend 100%
  (GET возвращает → POST обратно → значения целы; UI: pipeline 9999 +
  cancelled_status_id 55555 переживают перезагрузку). Превью восстановлено (neutral).
- Итог блока безопасности (пункты 1–4 + no-wipe): все подтверждены testing_agent
  (iterations 113–118).

## Session — Jul 3, 2026 (10): P0 — маскировка amocrm_token в GET /settings
- GET /settings больше НЕ отдаёт сырой токен: amocrm_token='' + amocrm_token_masked
  ('••••XXXX') + amocrm_token_set(bool). POST обновляет токен при реальном значении,
  но СОХРАНЯЕТ существующий, если пришёл пустой/маскированный ('•' в строке)/из '*'.
  Фронт: поле пустое, placeholder показывает маску; сохранение без ввода токена не
  затирает его.
- Проверено testing_agent 119 (frontend 100% + backend) и 120 (13/13 после
  ужесточения guard). Утечки нет, debug-info тоже не отдаёт токен. Превью очищено.
- Блок безопасности: пункты 1–5 + no-wipe + token-masking — все зелёные (113–120).
- НЕ задеплоено на прод — только код превью; ждёт ручной проверки и «ок, деплой».

## Session — Jul 3, 2026 (11): АУДИТ производства саун + фикс склада
- Аудит (iteration_121, 24/27): ЯДРО ВЕРНО — materials=Σ(unitPrice*qty), overhead,
  totalCost, retailNetto=brutto/1.23, marginAmount/pct, retailMargin; syncToCostPrice
  пишет costPrice в sauna_prices; маржа заказов берёт эту costPrice (проверено e2e);
  склад (adjust/deduct/revert/movements/forecast) ОК; фронт 100% без ошибок.
- FIX (iteration_122, 7/7): production-stock deduct больше не «залипает» флагом при
  applied=0 — снимает флаг, повтор возможен после добавления тех.карты.
- ⚠️ CRITICAL (вне scope, НЕ трогал): POST /api/sauna-crm/leads → 500 E11000
  amocrm_id_1 (unique+sparse не пропускает явный null; CRMLead всегда шлёт
  amocrm_id=None) → ручное создание лида в CRM сломано. Безопасный фикс: не писать
  amocrm_id при None (exclude_none) ИЛИ partialFilterExpression. Ждёт решения юзера.

## Session — Jul 3, 2026 (12): Отчёт «Нужно докупить» + разбор бага amoCRM-лида
- GET /api/sauna-production/cost/procurement обогащён: по каждому компоненту
  inStock, toBuy=max(0,required-inStock), buyCost; + totalToBuyCost, shortageCount.
- Frontend ProcurementForecast «По активным заказам»: блок «Нужно докупить»
  (только дефицит) с итогом + экспорт CSV. Фикс: категория читалась как .label,
  а поле — .name (исправлено).
- Проверено testing_agent iteration_123: backend 3/3 (toBuy=2, buyCost=200), frontend 100%.
- CRITICAL (подтверждён повторно, ждёт решения): POST /api/sauna-crm/leads 500 —
  индекс amocrm_id_1 (unique+sparse) не пропускает явный null; CRMLead шлёт
  amocrm_id=None. Ручное создание лида в CRM сломано. Безопасный фикс: exclude_none
  при вставке (не писать amocrm_id=None) — индексы не трогать.


## Session — Aug 14, 2026: Telegram Forum Topics для производства (Шаги 2–6 + иконки/этапы)
Отдельный бот/группа для производства — канал коммуникации + файлы, статус живёт
только в CRM. НЕ трогает существующий нотификатор заказов/бэкапов.

### Переменные окружения (backend/.env) — НОВЫЕ, отдельные
- `TELEGRAM_PRODUCTION_BOT_TOKEN`, `TELEGRAM_PRODUCTION_CHAT_ID`.
- ⚠️ Сейчас указывают на ТЕСТОВУЮ группу («Сауна Контроль», chat=-1004462186584,
  бот @Sauna_Production_Bot). Для ПРОДА заменить на боевые значения.

### Backend
- `services/telegram_service.py`:
  - `get_production_telegram_config()` — читает новые env.
  - `create_forum_topic(name, chat_id, bot_token, icon_color)` → createForumTopic.
  - `edit_forum_topic` / `close_forum_topic` / `reopen_forum_topic` (+ `_forum_topic_action`).
  - `send_telegram_message` / `send_telegram_file` — добавлен опциональный
    `message_thread_id` (обратная совместимость сохранена).
- `models` CRMLead (в routes/sauna_crm.py): новые поля `telegram_topic_id: Optional[int]`,
  плюс служебный `telegram_topic_closed` (пишется напрямую $set).
- `routes/telegram_production.py` (NEW, prefix `/api/integrations/telegram`):
  - `POST /send-to-production/{order_id}`: 1-й вызов — создаёт тему
    `{emoji} #<id> <клиент> — <модель>` + icon_color по этапу, стартовое сообщение
    (модель, ПОЛНЫЙ список опций-спецификация, пожелания из notes/amoComment,
    срок готовности, ссылка на amoCRM — БЕЗ аванса/остатка), прикрепляет все
    документы КРОМЕ `type=contract`. Повтор — «🔄 ОБНОВЛЕНИЕ» в ту же тему.
    Ошибки не проглатываются (`documentsFailed`, понятные detail).
  - `sync_topic_for_stage(order_id, stage_id, stage_name)` — best-effort:
    обновляет префикс+цвет темы по этапу, закрывает на финальном, переоткрывает
    при возврате (по флагу telegram_topic_closed). No-op если темы нет.
  - Маппинг: accepted/очередь→⏳ синий, in_production→🏭 оранж, ready→📦 жёлт,
    shipped→✅ зелёный (+ закрытие темы).
- `routes/sauna_production.py::change_production_stage` — вызывает
  `sync_topic_for_stage` после смены этапа.
- `server.py` — подключён telegram_production_router (без доп. префикса).

### Frontend
- Кнопка «Отправить в Telegram» (data-testid `send-to-telegram-btn`) в обеих
  одинаковых карточках: `SaunaCRMPage.jsx` и `SaunaProductionPage.jsx`.
  Меняет текст на «Обновить в Telegram» + бейдж-статус, если тема создана.
  Тосты успех/ошибка/непрошедшие файлы.

### Ограничение Telegram (ответ на вопрос про подгруппы)
- Вложенных подгрупп/папок в темах НЕТ (плоская структура). Эмуляция этапов —
  через emoji-префикс в названии + цвет иконки (реализовано).

### Проверено вживую (curl → реальный Telegram)
- Создание темы, повтор=обновление (та же тема, id сохранён), исключение договора,
  битые URL → documentsFailed. Смена этапов: editForumTopic 200, close на shipped,
  reopen при возврате 200. Кнопка рендерится (скриншот).

### Осталось (для юзера)
- Заменить TELEGRAM_PRODUCTION_* на боевые значения + задеплоить на прод.

## Session — Aug 14, 2026 (cont.): кастомные иконки + кнопка в списке + DB-конфиг
- **Кастомные emoji-иконки этапов** (вместо цвета): 📝 accepted / ⚡️ in_production /
  🛍 ready / ✅ shipped (custom_emoji_id из getForumTopicIconStickers). `create_forum_topic`
  и `edit_forum_topic` получили `icon_custom_emoji_id`. Текстовый emoji-префикс в
  названии темы (⏳🏭📦✅) сохранён для читаемости/сортировки. Проверено live (200 OK).
- **Кнопка «Отправить в Telegram» во вкладке «Список»** производства (иконка-самолётик
  в строке, data-testid `prod-list-telegram-{id}`; голубая=тема есть, серая=нет).
  Смена этапа из списка (PUT /orders/{id} с productionStageId) теперь тоже вызывает
  `sync_topic_for_stage`.
- **DB-конфиг вместо env** (чтобы не добавлять секреты на проде):
  - Коллекция `telegram_production_settings` (_id="config": bot_token, chat_id, enabled).
  - `_resolve_prod_config()` — DB → env fallback. Все вызовы create/edit/close/reopen/
    send теперь получают bot_token+chat_id явно.
  - Эндпоинты: `GET /api/integrations/telegram/settings` (токен маскирован),
    `POST /settings` (маска = не менять токен), `POST /test` (getMe + тест-сообщение).
  - UI: блок «Telegram производства» в диалоге «Настройки» производства
    (`ProdTelegramSettings` в SaunaProductionPage.jsx): токен(password)/chat_id/
    Сохранить/Проверить связь + статус «настроен (db/env)».
    data-testid: prod-telegram-settings, prod-tg-token, prod-tg-chatid, prod-tg-save, prod-tg-test.
  - Проверено live: env→db переключение, маскирование, тест @Sauna_Production_Bot OK.

### Запрошено юзером (НЕ сделано, план на следующие итерации)
- (A) Закреплённое сообщение-сводка в группе: сколько в очереди/в работе/готово — авто-обновление.
- (B) Отправка сообщения из карточки CRM в тему заказа + фиксация текста в карточке (changeLog/messages).
- (C) Двусторонняя связь из Telegram: inline-кнопки «Планируемая дата старта»,
  «Дата производства», «Комментарий производства» → запись обратно в карточку.
  ТРЕБУЕТ webhook/polling для production-бота (сейчас бот только исходящий).

## Session — Aug 14, 2026 (3): сообщения из карточки (B) + сводка (A) + webhook/кнопки (C) + приёмка
Реализовано и протестировано live (curl → реальный Telegram + симуляция webhook-апдейтов):
- **(B) Сообщения из карточки** → `POST /api/integrations/telegram/send-message/{order_id}`
  (text, author). Пишет в тему + логирует в `lead.productionMessages`
  (direction out/in). UI: секция «Сообщения производству» в CRM-карточке
  (data-testid prod-messages-section / prod-message-input / prod-message-send).
- **(A) Закреплённая сводка** → `refresh_production_summary()` + `POST /refresh-summary`.
  Считает по этапам (⏳ очередь / 🏭 в работе / 🛍 готово), всего, и «⚠️ Не подтверждено
  производством: N». Отправляет+пинит сообщение (summary_message_id в settings),
  далее editMessageText. Авто-вызов при send-to-production и смене этапа.
- **(C) Webhook + кнопки** (двусторонняя связь):
  - Кнопки в стартовом сообщении темы: [✅ Принял в работу] [📅 Дата старта]
    [🏭 Дата производства] [💬 Комментарий] (`_order_keyboard`).
  - `POST /webhook/{secret}` — обрабатывает callback_query и reply-сообщения.
    - ack:{id} → пишет productionAckedBy/productionAckedAt, отвечает в тему, refresh summary.
    - set:{field}:{id} → бот шлёт force_reply-подсказку, pending в
      `telegram_pending_inputs`; ответ парсится (_parse_date ДД.ММ.ГГГГ→ISO) и пишется
      в lead: plannedStartDate / productionDate / productionComment (+лог в productionMessages).
  - `POST /enable-webhook` (setWebhook на API_BASE_URL + secret, allowed_updates),
    `POST /disable-webhook`, `GET /webhook-status`.
  - send_telegram_message получил параметр `reply_markup`.
- **Настройки UI** (ProdTelegramSettings в SaunaProductionPage): кнопка
  «Включить/Выключить приём из Telegram (webhook)» + статус (data-testid prod-tg-webhook).
- **CRM-карточка**: бейдж приёмки «✅ Производство приняло: X · дата» либо
  «⏳ Ожидает подтверждения производства» + плановый старт/дата производства/комментарий
  (data-testid prod-ack-status).
- Новые поля лида: productionAckedBy, productionAckedAt, plannedStartDate,
  productionComment, productionMessages[]. Коллекции: telegram_pending_inputs,
  telegram_production_settings (+ webhook_secret/webhook_enabled/summary_message_id).
- ⚠️ Webhook сейчас указывает на PREVIEW-URL. После деплоя на прод нажать
  «Включить приём из Telegram» ещё раз (перепропишет на боевой адрес).

## Session — Aug 14, 2026 (4): кнопка в канбане + напоминание о приёмке + фото из темы
- **Кнопка «В Telegram» в CRM-канбане** (SaunaCRMPage): на каждой карточке лида
  (data-testid `kanban-telegram-{id}`) + бейджи «⏳ не принят» / «✅ принят».
  Handler `sendLeadToTelegram(lead)`.
- **Напоминание о приёмке**: планировщик `ack_reminder_scheduler` (старт в server.py,
  каждые 30 мин). `_ack_reminder_tick`: для лидов inProduction с темой, без
  productionAckedAt, чья тема старше N часов (settings `ack_reminder_hours`, деф. 3) и
  последнее напоминание старше N часов → пинг «⏰ Напоминание…» в тему +
  `telegram_ack_reminder_at`. Плюс счётчик «не подтверждено» в закреплённой сводке.
  Поле `telegram_topic_created_at` ставится при создании темы.
- **Фото из темы → карточка**: webhook ловит `message.photo` в теме заказа
  (`_handle_photo`): getFile → download → Cloudinary (folder production-photos) →
  документ `type=production_photo` в lead.documents + запись в productionMessages
  (direction in). Fallback на Telegram file-URL если Cloudinary недоступен.
- Проверено live: reminder tick (пинг+флаг), фото (реальный file_id → Cloudinary URL
  в карточке), кнопка канбана (скриншот).

## Session — Aug 14, 2026 (5): часы напоминания в UI + галерея фото + подсветка новинок
- **Часы напоминания в UI**: поле «Напоминать о приёмке через (часов)» в настройках
  (data-testid prod-tg-reminder-hours). Backend: `ack_reminder_hours` в GET/POST /settings
  (валидация >0), планировщик читает из settings (деф. 3).
- **Галерея фото в карточке**: в CRM-карточке блок «📷 Фото от производства»
  (data-testid production-photo-gallery / production-photo-{i}) — миниатюры из
  documents[type=production_photo], клик открывает оригинал. Проверено скриншотом.
- **Подсветка новинок от производства**: webhook на входящем фото/комментарии ставит
  `lastProductionUpdateAt`. Канбан CRM показывает «🔔 новое»
  (data-testid prod-update-badge-{id}) если lastProductionUpdateAt > productionUpdatesSeenAt.
  При открытии карточки — `POST /api/integrations/telegram/mark-seen/{order_id}` ставит
  productionUpdatesSeenAt (бейдж гаснет). `hasUnseenProdUpdate(lead)` в SaunaCRMPage.
- Проверено live: сохранение часов (6), mark-seen; галерея и лента в карточке (скриншот).

## Session — Aug 14, 2026 (6): бейдж новинок в шапке + лайтбокс фото + фильтр «ждут приёмки»
- **Бейдж новинок в шапке CRM**: рядом с «Производство» показывается
  «🔔 N новых от производства» (data-testid prod-updates-header-badge), N =
  число лидов с непросмотренными апдейтами (`unseenProdCount`).
- **Лайтбокс фото**: клик по миниатюре в галерее открывает полноэкранный
  просмотрщик (data-testid photo-lightbox) со стрелками ◄►
  (lightbox-prev/next/close), счётчик N/M. Заменил открытие в новой вкладке.
- **Фильтр «ждут приёмки»**: кнопка в тулбаре канбана
  (data-testid filter-awaiting-ack-btn) — показывает только заказы с темой и
  без productionAckedAt (`showOnlyUnacked` → kanbanLeads).
- Проверено скриншотом: бейдж «🔔 1 новых», кнопка фильтра, бейджи на карточке
  «⏳ не принят / 🔔 новое». Компиляция чистая.

## Session — Aug 14, 2026 (7): фильтр «ждут приёмки» в списке + сигнал в реальном времени
- **Фильтр «Ждут приёмки» во вкладке «Список»**: кнопка
  (data-testid list-filter-awaiting-ack-btn), общий стейт `showOnlyUnacked` →
  список рендерит `kanbanLeads` (тот же ack-фильтр). Проверено скриншотом.
- **Сигнал в реальном времени**: SaunaCRMPage опрашивает лиды каждые 45с
  (setInterval → fetchLeads, без спиннера). При росте `unseenProdCount`
  (`prevUnseenRef`): короткий WebAudio-бип + мигание title вкладки
  «🔔 Новое от производства (N)» на 4с + toast. Первый рендер не пищит (guard null).
  Компиляция чистая (звук/таб не проверяемы скриншотом, логика стандартная).

## Session — Aug 14, 2026 (8): живые обновления (SSE) + настройка звука
- **SSE вместо опроса**: `GET /api/integrations/telegram/events` (StreamingResponse,
  text/event-stream). In-memory pub/sub `_sse_subscribers` + `_publish_update()`
  вызывается в webhook на photo/comment/ack. Важно: ingress буферизует SSE —
  добавлен паддинг-прелюдия ~2КБ + заголовки no-transform/identity/X-Accel-Buffering,
  после чего поток флашится сразу (проверено через внешний URL и из браузера — 200 OK).
  Фронтенд: EventSource (авто-реконнект) вместо setInterval(45s); onmessage → fetchLeads.
- **Настройка звука**: тумблер «🔊 Звук: вкл/выкл» в шапке CRM
  (data-testid prod-sound-toggle), хранится в localStorage `prodSoundEnabled`.
  Бип при новом апдейте играет только если включён.
- Проверено: SSE-событие ack доходит вживую, тумблер звука переключается/сохраняется.

## Session — Aug 14, 2026 (9): окно переписки с поиском + живой бейдж на вкладке CRM
- **Окно полной переписки**: в CRM-карточке кнопка «Вся переписка (N)»
  (data-testid open-chat-history-btn) открывает Dialog (chat-history-dialog) со
  всеми productionMessages и поиском по тексту/автору (chat-history-search),
  входящие из Telegram подсвечены. Проверено (фильтр «орех» → 1 сообщение).
- **Живой бейдж на вкладке CRM в шапке**: `GET /api/integrations/telegram/unseen-count`.
  Header.jsx сам фетчит счётчик + слушает SSE `/events` (рефетч на событие) +
  safety-poll 60с + слушает window-event `prod-updates-seen` (диспатчится из
  SaunaCRMPage при mark-seen). Красный бейдж на кнопке CRM (desktop
  crm-tab-prod-badge + mobile) виден из любого раздела sauna. Проверено скриншотом
  (CRM ① на вкладке Калькулятор).

## Session — Aug 14, 2026 (10): экспорт переписки (PDF/TXT) + быстрый ответ из окна
- **Экспорт переписки**: `GET /api/integrations/telegram/export-chat/{order_id}?format=pdf|txt`.
  TXT — PlainTextResponse (UTF-8, attachment). PDF — ReportLab (SimpleDocTemplate,
  шрифт DejaVuSans через ensure_pdf_fonts, кириллица ок), входящие/исходящие
  подписаны автором/временем/направлением. UI: кнопки «PDF»/«TXT» в шапке окна
  переписки (export-chat-pdf-btn / export-chat-txt-btn), window.open → download.
  Проверено curl (TXT кириллица, PDF 47КБ application/pdf).
- **Быстрый ответ из окна переписки**: composer внизу chat-history-dialog
  (chat-history-reply-input / chat-history-reply-send), переиспользует
  sendProdMessage (prodMsgText) — сообщение уходит в тему и добавляется в ленту
  без закрытия окна. Показывается только при наличии telegram_topic_id.
  Проверено скриншотом.

## Session — Aug 14, 2026 (11): фото в PDF-экспорт
- В `export-chat` (format=pdf) после ленты сообщений добавлена секция «Фото от
  производства»: скачивает каждое фото (documents[type=production_photo], Cloudinary)
  через httpx и встраивает миниатюрой (ReportLab Image, ширина 60мм, сохранение
  пропорций через ImageReader.getSize). Ошибки скачивания — пропуск.
  Проверено: PDF содержит image XObject, размер 47КБ→69КБ. Только бэкенд, кнопка
  «PDF» уже использует эндпоинт.

## Session — Aug 14, 2026 (12): паритет Telegram-панели CRM ↔ Производство
- Проблема юзера: карточка CRM (SaunaCRMPage) и карточка Производства
  (SaunaProductionPage) — РАЗНЫЕ компоненты одного заказа; Telegram-инфо была
  только в CRM.
- Фикс: создан общий компонент `ProductionTelegramPanel.jsx` (приёмка/даты/
  галерея фото+лайтбокс/лента сообщений/композер/окно 'Вся переписка' с поиском +
  экспорт PDF/TXT + быстрый ответ; mark-seen при открытии). Вставлен в карточку
  Производства (после telegram-topic-status). Панель рендерится только если есть
  telegram_topic_id. Обновляется при смене id/кол-ва сообщений/приёмки.
- Тест testing_agent (iteration_124): 100% (5/5) — паритет подтверждён, экспорт
  PDF/TXT, лайтбокс, поиск в переписке, быстрый ответ работают в карточке
  Производства; сообщения из Производства видны в CRM.
- Осталось (не блокеры): (1) CRM-карточка всё ещё содержит СВОЮ инлайн-копию
  панели с теми же data-testid (не переведена на общий компонент) — правки надо
  делать в двух местах; (2) LOW: предсуществующий React-warning про key в
  SaunaProductionPage (без функционального影响).

## Session — Aug 16, 2026: единый Telegram-компонент в обеих карточках
- Отличие карточек: CRM (SaunaCRMPage) = продажи (воронка, amoCRM, договор,
  клиент, привязка расчёта); Производство (SaunaProductionPage) = цех (произв.
  этап, тех.задание/PDF, даты). Их назначение разное → карточки НЕ сливаем целиком,
  но Telegram-панель сделали общей.
- CRM-карточка переведена на общий `ProductionTelegramPanel` (инлайн-копия
  Telegram-блоков + отдельные chat-history dialog и lightbox УДАЛЕНЫ). Теперь одна
  реализация панели используется и в CRM, и в Производстве.
- Тест testing_agent (iteration_125): 100% (5/5) в ОБЕИХ карточках — единственный
  экземпляр панели, без дублей/белого экрана; экспорт PDF/TXT, лайтбокс, поиск,
  быстрый ответ, композер работают; сообщения из CRM видны в Производстве и наоборот.
- Остаток (LOW, не блокер): предсуществующий React-warning 'unique key' в
  .map() SaunaCRMPage/SaunaProductionPage (только консоль). Тест-агент добавил
  data-testid="crm-list-search".

## Session — Aug 16, 2026 (2): фикс дублей КП — привязка самого свежего
- Причина: выбор заказа/PDF по amocrm_id через find_one БЕЗ сортировки → при
  дублях КП на одну сделку возвращался произвольный (обычно старый) КП.
- Фикс: добавлена сортировка по самому свежему во ВСЕХ местах чтения заказа по
  amocrm_id (orders: sort createdAt desc; calculator_pdfs: created_at desc):
  sauna_crm.py (get_linked_calculator_order fallback, link_calculator_order,
  debug-kp), amocrm.py (5 мест update/read), widget.py (карточка сделки amoCRM),
  telegram_production.py (_get_calc_order), warehouse.py, driver_panel.py (4).
- Итог: в CRM и в виджете amoCRM теперь всегда показывается/привязывается САМЫЙ
  свежий расчёт (КП) и его новейший PDF. Дубли КП не удаляются (их создаёт кнопка
  «Создать новое КП» намеренно) — просто всегда берётся последний.
- Тест testing_agent iteration_126 (CRM path) + iteration_127 (widget+регресс):
  100%. Seed для регресса: amocrm_id=KPDUP_TEST_1 (ORD-OLD/ORD-NEW), лид LEAD-KPDUP;
  тест-файл tests/test_latest_kp_duplicate_orders_iteration127.py.
- На будущее (не сделано): compound index (amocrm_id, createdAt) для перф;
  dovoz.py:592 та же схема (низкий риск).


## Session — Aug 16, 2026 (3): compound index (amocrm_id, createdAt) + бейдж версии КП
- **Составной индекс** для ускорения выбора «самого свежего КП» добавлен в
  `create_indexes()` (server.py): `calculator_pdfs (amocrm_id, created_at desc)`,
  `sauna_orders / balia_orders / orders (amocrm_id, createdAt desc)`. Индексы
  создались без ошибок при старте.
- **Бейдж «Версия и дата КП»** на карточке CRM (Канбан): показывает
  `КП v{N}/{всего} · {дата} · {имя файла}`. Реализация:
  - Backend `routes/sauna_crm.py`: новый хелпер `_enrich_leads_with_kp_info()` —
    ОДНА агрегация по `calculator_pdfs` для всех amocrm_id доски, считает сколько
    КП было сгенерировано на сделку и ранг привязанного КП (по совпадению
    cloudinary_url/order_id, иначе = самый свежий). Кладёт поле `kpInfo`
    {versionNumber, versionCount, date, filename} в каждый лид с KP-документом.
    Вызывается в `get_all_leads`. Дёшево для всей доски (1 запрос).
  - Frontend `SaunaCRMPage.jsx`: голубой бейдж (иконка FileText) под бейджами
    документов, data-testid `kp-info-{leadId}`, с tooltip. Дата опускается, если
    её нет; имя файла в truncate.
- Проверено curl (kpInfo возвращается) + скриншот Канбана: бейдж
  «КП v1/1 · КП Test Direct» рендерится корректно, без ошибок.
- P0 «amocrm_id: null sparse index» — по решению пользователя НЕ трогаем.

## Session — Aug 16, 2026 (4): чистка дублей КП + бейдж дефицита
### 1. Чистка дублей КП (calculator_pdfs по одной сделке amoCRM)
- Backend `routes/sauna_crm.py` (+ `from bson import ObjectId`):
  - `GET /api/sauna-crm/kp-duplicates?include_obsolete=` — глобально: группы
    amoCRM с >1 КП, каждый КП с version/isLatest/isLinked/obsolete.
  - `GET /api/sauna-crm/leads/{lead_id}/kp-duplicates` — по одному лиду.
  - `POST /api/sauna-crm/kp-duplicates/action` body `{pdfIds, mode}` где
    mode = obsolete | restore | delete. Мягкая пометка `obsolete=true`
    (+obsoleteAt) или физическое удаление.
  - Enrichment бейджа КП (`_enrich_leads_with_kp_info`) теперь исключает
    `obsolete=true` из подсчёта версий.
- Frontend: новый компонент `components/KpDuplicatesModal.jsx` (работает и
  глобально, и для одного лида через prop `leadId`). Показывает группы,
  версии с бейджами «Привязан/Актуальный/Устаревший», per-row действия
  (Устаревший/Вернуть/Удалить + открыть PDF) и групповое «Старые →
  устаревшие (N)». Кнопки: в шапке CRM `crm-kp-duplicates-btn`, в карточке
  лида (секция Документы, если есть amocrm_id) `lead-kp-duplicates-btn`.
- Проверено: curl все режимы (obsolete/restore/delete + include_obsolete=false)
  + скриншот модалки (2 группы, версии, бейджи, действия рендерятся).

### 2. Бейдж «Дефицит» + фильтр + счётчик (ComponentsAdmin.jsx)
- Красный бейдж «ДЕФИЦИТ» в колонке «Остаток / Мин.» когда
  `stockMin>0 && stockCurrent<=stockMin` (`component-deficit-badge-{id}`).
- Кнопка-тоггл «Дефицит N» со счётчиком (`components-deficit-filter` /
  `components-deficit-count`) — фильтрует список только по дефицитным.
- Проверено скриншотом: фильтр активен (красный), «0/10 м³» + бейдж ДЕФИЦИТ.

### 3. Списание со склада при переводе в производство — БЕЗ изменений
- Уже реализовано ранее: `POST /leads/{id}/to-production` (идемпотентно,
  лог `sauna_stock_movements`). По решению пользователя авто-триггер на
  перетаскивание в колонку «В производстве» НЕ добавляем.


## Session — Aug 16, 2026 (5): себестоимость/маржа admin-only + история списаний + автозакупка по дефициту + TG-алерт
### 1. Себестоимость/маржа — только для роли admin
- CRM (SaunaCRMPage.jsx): блок `crm-order-cost-block` теперь под `isAdminUser`
  (role==="admin" из localStorage authUser). Менеджеры/кладовщик не видят.
- Производство (SaunaProductionPage.jsx): добавлен блок `prod-cost-block`
  (Себестоимость/Маржа netto/Маржа %) — только admin. Данные тянутся из
  связанного calc-order через `/api/sauna-crm/leads/{id}/calculator-order`
  (useEffect по selectedOrder, только для admin).
### 2. История списаний материалов в карточке
- В CRM (`crm-stock-summary`) и Производстве (`prod-stock-summary`) показывается
  `productionStockSummary.items` (материал −qty · before→after), кол-во позиций
  и дата. Строка «Себестоимость (totalValue) PLN» — только admin.
### 3. Автозакупка по дефициту
- Backend `POST /api/procurement/requests/from-deficit` — собирает все
  компоненты с stockMin>0 & stockCurrent<=stockMin, qty = stockMin−stockCurrent,
  создаёт черновик заявки (status=draft, priority=high, tags=[deficit,auto],
  notifyTelegram=false). Проверено curl (qty 10−2=8, total верный).
- Frontend: кнопка `components-deficit-draft` рядом с фильтром «Дефицит» в
  ComponentsAdmin (дизейбл при 0 дефицита) → toast с числом позиций.
### 4. Telegram-алерт о дефиците в реальном времени
- sauna_tech_cards.py: хелпер `_send_deficit_alert` + `_crossed_below_min`
  (before>min & after<=min — без спама). Вызывается в `deduct_production_stock`
  (списание в производство) и в `adjust_stock` (ручная корректировка out/set).
  Проверено: списание 15→7 (мин 10) реально отправило сообщение в Telegram (200).
- Канал: `services/telegram_service.send_telegram_message` (тот же бот).

## Session — Aug 16, 2026 (6): маржа-светофор + единый календарь + разделение Telegram
### Шаг 1. Маржа-светофор в списке производства (admin only)
- Backend `sauna_production.py`: `/orders` теперь требует auth и добавляет
  `marginInfo` (totalCost, marginNetto, marginPct, level) ТОЛЬКО для role
  admin/super-admin (helper `_enrich_orders_with_margin`, из связанного
  calc-order). Пороги: green ≥25% · amber 15–25% · red <15%.
- Frontend `SaunaProductionPage.jsx`: колонка «Маржа» в списке (ProductionListTab)
  с цветным бейджем, видна только админу. Проверено: админ видит, маркетолог нет.
### Шаг 2. Единый календарь с переключателем дат + канбан по умолчанию
- Backend: оба календаря (`sauna_crm.py /calendar`, `sauna_production.py /calendar`)
  принимают `dateField` ∈ {advancePaymentDate, productionDate, readyDate,
  deliveryDate}. advancePaymentDate → settings.calendarDateField. Разница
  CRM/Производство только в фильтре inProduction. Дефолт = advancePaymentDate (единый).
- Frontend: переключатель-пилюли (Аванс/Начало произв./Готовность/Доставка) в
  календаре CRM и Производства. Дефолтная вкладка теперь Канбан (порядок:
  Канбан → Календарь → Список) в обоих разделах. Канбан/список/amoCRM-синк не тронуты.
- Проверено: тестовый лид с 4 датами — одинаковые дни в CRM и Производстве.
### Шаг 3. Разделение Telegram на два чата + ежедневная сводка (закреп)
- Настройки CRM: новые поля `alertsChatId`, `ordersSummaryEnabled`,
  `ordersSummaryHour` (модель CRMSettings + UI-блок в Настройки → Поля).
- Маршрутизация в чат алертов: дефицит (`sauna_tech_cards._send_deficit_alert`),
  закупки (`procurement._send_telegram`), аналитика-дайджест (server.py Job 2)
  → alertsChatId. Заказы менеджеров остаются в основном TELEGRAM_CHAT_ID.
- Ежедневная сводка: `services/daily_orders_summary.py` (заказы калькулятора по
  createdBy + новые лиды CRM + обработанные amoCRM), отправка+закреп через
  `telegram_service.send_and_pin_message`. Планировщик server.py Job 4
  (ordersSummaryHour, дедуп lastOrdersSummaryDate).
- Ручной тест: `POST /api/sauna-crm/telegram/send-orders-summary` + кнопка
  «Отправить сводку сейчас». Проверено: send 200 + unpin 200 + pin 200.
- Тестовое значение alertsChatId очищено (пользователь задаёт реальный чат на проде).

## Session — Aug 16, 2026 (7): маржа-точка канбан + тест дефицита + закупка по поставщикам + недельная сводка
### A. Маржа-точка на канбане производства (admin only)
- `SaunaProductionPage.jsx`: цветная точка (green/amber/red) перед именем клиента на
  карточке канбана из `order.marginInfo.level`, только для admin, tooltip с % и суммой.
### B. Кнопка «Тест: сигнал о дефиците»
- `POST /api/sauna-crm/telegram/test-deficit` → шлёт тестовый deficit-alert в чат алертов
  (через `_send_deficit_alert`). Кнопка в Настройки CRM → Telegram (`test-deficit-btn`).
### C. Черновики закупки по поставщикам
- `POST /api/procurement/requests/from-deficit-by-supplier` — группирует дефицитные
  компоненты по `supplier` (пустой → «Без поставщика»), создаёт по одному черновику на
  поставщика (qty = stockMin−stockCurrent). Проверено: 2 группы → 2 заявки.
- `ComponentsAdmin.jsx`: вторая кнопка «По поставщикам» рядом с «Черновик закупки»
  (`components-deficit-draft-by-supplier`). Общая кнопка сохранена.
### D. Недельная сводка (понедельники) в чат алертов
- `services/daily_orders_summary.py`: `build_weekly_summary_text` / `send_weekly_summary`
  за прошлую неделю Пн–Вс: заказы калькулятора, лиды CRM (+amoCRM), средняя маржа %,
  топ-3 менеджера по числу заказов (без закрепа).
- server.py Job 5: по понедельникам в ordersSummaryHour (gate: ordersSummaryEnabled +
  alertsChatId), дедуп `lastWeeklySummaryWeek` (ISO %G-W%V).
- `POST /api/sauna-crm/telegram/send-weekly-summary` + кнопка «Недельная сводка сейчас».
- Проверено: from-deficit-by-supplier (2 заявки), test-deficit (200), weekly (200).
  Все тестовые данные очищены, alertsChatId сброшен.

## Session — Aug 17, 2026: FIX — пропали карточки на канбане CRM (prod)
- Симптом: после синхронизации amoCRM («обновлено: 82») канбан CRM показывал 0 во
  всех колонках, хотя лиды есть (в «Списке» они оставались).
- Причина: канбан CRM (`SaunaCRMPage.jsx`, было ~строка 768) раскладывал лиды по
  `leadsByStage[l.stageId]` БЕЗ fallback — лид с stageId, которого нет в настроенных
  стадиях (амо-синк проставил незамапленный статус), молча исчезал. В Производстве
  (`SaunaProductionPage.jsx`) fallback есть → туда падают в первую стадию.
- Фикс: добавил такой же fallback в канбан CRM — незамапленные лиды идут в первую
  стадию (stages[0]), остаются видимыми и переставляемыми. stageId в БД не меняется.
- Проверено в preview: 2 лида со stageId="new" теперь видны в первой колонке (3 карточки).
- Прим.: побочно ранее в этой же сессии сделал auth на /api/sauna-production/orders
  НЕОБЯЗАТЕЛЬНОЙ (Request+decode_token, без 401), чтобы доска не пустела без токена.
- ⚠️ Оба фикса в preview — на прод нужен РЕДЕПЛОЙ.

## Session — Aug 17, 2026 (2): ROOT CAUSE — пустой канбан CRM = KP-обогащение падало (500)
- Первопричина: `_enrich_leads_with_kp_info` (добавлена в session 6 для бейджа версии КП)
  падала на некоторых лидах (нестандартный `documents`) → `/api/sauna-crm/leads` 500 →
  фронт получал пустой список → канбан CRM показывал 0 во всех колонках. Маппинг стадий цел.
- Фикс: (1) вызов обогащения в get_all_leads обёрнут в try/except (лиды грузятся всегда);
  (2) `_find_kp_doc` безопасно пропускает не-dict/не-list documents.
- Проверено: лид с битым documents → /leads 200 (раньше 500). 
- Оставлен fallback канбана CRM (незамапленный stageId → первая колонка) как страховка.
- ⚠️ Требуется РЕДЕПЛОЙ на прод.

## Session — Aug 17, 2026 (3): массовое удаление лидов CRM + оптимизация /leads
- Bulk delete: `POST /api/sauna-crm/leads/bulk-delete` {ids:[...]} (delete_many). 400 если ids пуст.
- UI (SaunaCRMPage канбан): кнопка «Выбрать / удалить» (crm-select-mode-btn) → на карточках
  чекбоксы (lead-select-{id}), подсветка выбранных, в шапке «Удалить выбранные (N)»
  (crm-bulk-delete-btn) + «Отмена». В режиме выбора клик по карточке = выбор, drag выключен.
- Оптимизация: `_enrich_leads_with_kp_info` теперь запрашивает calculator_pdfs ТОЛЬКО для
  лидов, у которых есть документ КП (раньше — по всем amocrm_id доски). Меньше нагрузка на /leads.
- ⚠️ Всё в preview — нужен РЕДЕПЛОЙ на прод.
- Прим.: страница «Заказы» (/api/sauna/orders, to_list(5000) целиком) тормозит на проде —
  это существовавший ранее код, не мои правки. Предложена оптимизация (исключить changeHistory
  из списка / пагинация) — ждёт подтверждения пользователя.

## Session — Aug 17, 2026 (4): ПЕРФОРМАНС (замерено на проде через curl)
- Прод-замеры: /api/sauna/orders = 18.5 МБ / 11.8с (2230 заказов; selectedOptions=13.4МБ,
  selections=1.4МБ); /api/sauna-crm/leads = 436 КБ / 11.4с.
- FIX orders: `GET /api/sauna/orders?light=1` — projection исключает selectedOptions,
  selections, changeHistory, stageHistory, modelImageUrl, layoutImageUrl (в списке не нужны;
  _recompute_totals_bulk использует только subtotal/discountPercent/certificateDiscount).
  OrdersPage.jsx: fetchOrders?light=1; новый ensureFullOrder(order) догружает полный заказ
  через GET /orders/{id} в preview/edit/edit-in-calc/PDF/techspec. Проверено: предпросмотр ок.
- FIX leads: KP-запрос к calculator_pdfs без obsolete-фильтра (в памяти) → индекс
  (amocrm_id, created_at); только для лидов с KP-документом.
- ⚠️ РЕДЕПЛОЙ обязателен.

## Session — Aug 17, 2026 (5): корень 10с /leads + фикс дублей КП/телефонов
- ДИАГНОЗ (замерено на ПРОДЕ через curl): /leads = 10.36с при ответе всего 371 КБ (75 лидов) —
  дело НЕ в объёме. /settings и /calendar по той же базе = 0.13с. debug-kp по calculator_pdfs
  падает через ~10с с "The read operation timed out". Корень: любой запрос к calculator_pdfs
  упирается в socketTimeout (коллекция огромная, base64-PDF внутри, рабочего индекса нет).
  `_enrich_leads_with_kp_info` в /leads делает такой запрос → 10с (потом ловится try/except).
- FIX 1 `_enrich_leads_with_kp_info`: убран DB-sort (сортировка в Python), добавлен
  `.max_time_ms(4000)` → худший случай доски 4с вместо 10с даже без индекса.
- FIX 2 `/kp-duplicates`: переписан — вместо полного скана calculator_pdfs берём amocrm_id из
  sauna_crm_leads (маленькая коллекция) и делаем ОДИН индексируемый `$in` по calculator_pdfs
  (pdf_data исключён, max_time_ms=8000), группируем в Python с нормализацией amocrm_id к строке
  (ловит смешанные int/str). Это чинило toast "Ошибка загрузки дублей КП" (был таймаут).
- FIX 3 `/leads/{id}/kp-duplicates`: поиск по amocrm_id ИЛИ order_id из документов лида +
  calculatorOrderId (ловит КП без amocrm_id), дедуп по _id, max_time_ms=6000.
- FIX 4 `/duplicates`: телефоны нормализуются (только цифры, последние 9) и группируются в
  Python → разное форматирование одного номера теперь схлопывается; amocrm_id к строке.
- FIX 5 server.py: добавлен индекс `calculator_pdfs.created_at` (плюс существующий compound
  (amocrm_id, created_at)).
- Проверено на PREVIEW: /leads 0.13с, /kp-duplicates 2 группы (без ошибки), per-lead 2 КП,
  /duplicates без ошибок. Прод-проверка — ПОСЛЕ РЕДЕПЛОЯ.
- ⚠️ РЕДЕПЛОЙ ОБЯЗАТЕЛЕН. После деплоя индексы соберутся в фоне (Atlas), запросы станут <1с;
  max_time_ms гарантирует отсутствие 10с-зависания даже во время построения индекса.

## Session — Aug 17, 2026 (6): устранение КОРНЯ — pdf_data дублируется при живом Cloudinary
- Находка: при генерации КП сырой PDF (`pdf_data`) писался в calculator_pdfs (1/заказ) И в
  calculator_pdf_versions (до 10/заказ), ПРИ ТОМ что PDF уже заливается в Cloudinary
  (cloudinary_url). Именно pdf_data в базе раздувал calculator_pdfs → таймауты чтения.
- FIX A: `GET /api/integrations/amocrm/calculator-pdf/{order_id}` — если pdf_data нет, делает
  RedirectResponse на cloudinary_url (иначе fallback на pdf_data). Импортирован RedirectResponse.
- FIX B: после успешной заливки в Cloudinary calculator_pdfs теперь `$unset pdf_data` (храним
  только ссылку). Если Cloudinary недоступен — pdf_data остаётся как fallback.
- FIX C (разовая чистка): `POST /api/integrations/amocrm/kp-cleanup-pdf-data` — dry-run по
  умолчанию (возвращает counts), `?apply=true` обнуляет pdf_data ТОЛЬКО у записей с
  cloudinary_url. Записи без cloudinary_url не трогаются (качаются из базы как раньше).
- calculator_pdf_versions НЕ трогаем (по умолчанию пользователя) — там нет per-версия
  cloudinary_url; download версии по-прежнему из pdf_data.
- Редактирование заказа не затронуто (берёт данные из sauna_orders, а не pdf_data).
- Проверено на PREVIEW: dry-run отвечает корректно (total/with_pdf/cleanable).
- ⚠️ ПОСЛЕ РЕДЕПЛОЯ: 1) прогнать dry-run на проде; 2) выполнить `?apply=true` для чистки.

## Session — Aug 17, 2026 (7): история версий КП → 2 копии + UI просмотра/отката
- Новый прод-URL (после деплоя пользователя): https://spa-planner-replaced-1767401260.emergent.host
  (preview = рабочая среда; wm-kalkulator.pl — прежний прод).
- Проверено, что чистка pdf_data не ломает 4 флоу: редактирование заказа (из sauna_orders),
  скачивание КП (redirect на cloudinary_url), договор (fallback pdf_data→cloudinary_url→
  order.kpCloudinaryUrl уже есть), передача в амо (берёт байты из тела запроса, не из БД).
- calculator_pdf_versions: обрезка истории 10→2 (amocrm.py ~2410). При редактировании КП
  обновляется (новая версия), хранятся 2 последние.
- Новый UI: `KpVersionsModal.jsx` (кнопка «Версии КП» в карточке лида, показывается при
  наличии calculatorOrderId; data-testid lead-kp-versions-btn / kp-versions-modal). Список
  версий (v#, дата, менеджер, сумма, бейдж «Текущая»), скачать (GET .../version/{v}),
  откатить (POST .../rollback/{v}). Использует существующие эндпоинты amocrm.
- Проверено на PREVIEW: список версий, модалка, откат v2→v1 (currentVersion меняется). E2E скрин ок.
- ⚠️ Изменения бэкенда+фронта в preview → нужен РЕДЕПЛОЙ на новый прод-URL.

## Session — Aug 17, 2026 (8): чистка pdf_data сделана БАТЧЕВОЙ
- Проблема: на проде даже count_documents по calculator_pdfs = таймаут (коллекция огромна).
- FIX: `POST /api/integrations/amocrm/kp-cleanup-pdf-data?apply=&batch=150` переписан на
  батчевый режим: берёт порцию из `batch` документов с pdf_data (projection _id+cloudinary_url,
  max_time_ms=25000), unset pdf_data только у тех, где есть cloudinary_url; выполняется через
  asyncio.to_thread (не блокирует loop). Возвращает `more` — звать повторно пока more=false.
- Проверено на preview: batch=50 → found 2, cleanable 0 (нет cloudinary в тестовых), more=false.
- ⚠️ Нужен РЕДЕПЛОЙ (эта правка + версии КП из сессии 7 ещё не на проде).

## Session — Aug 17, 2026 (9): корень медленного прода = ОТСУТСТВИЕ индекса на calculator_pdfs
- Замеры на новом проде (после деплоя): /leads=11.2с, /kp-duplicates=таймаут(10.2с),
  cleanup dry-run: первые 50 записей БЕЗ cloudinary_url. Вывод: на проде НЕТ индекса
  (amocrm_id, created_at) → запросы сканируют раздутую коллекцию → таймаут. В preview
  индекс есть → там быстро.
- РЕШЕНИЕ (главное): поднять индекс на проде. Новые эндпоинты (amocrm.py):
  - GET `/api/integrations/amocrm/kp-index-status` — список индексов (быстро, без скана).
  - POST `/api/integrations/amocrm/kp-ensure-index` — строит (amocrm_id,created_at)+created_at
    в фоновом потоке (Atlas hybrid build, не блокирует). Идемпотентно.
  - GET `/api/integrations/amocrm/kp-ensure-index/status` — прогресс сборки.
  Как только индекс есть → /leads и /kp-duplicates достают только нужные записи → быстро,
  ДАЖЕ без чистки коллекции.
- Доп. эндпоинт POST `/api/integrations/amocrm/kp-migrate-pdf-data?apply=&batch=20` — для
  старых записей БЕЗ cloudinary_url: заливает pdf_data в Cloudinary, ставит url, удаляет
  pdf_data (батчами). Для уменьшения размера БД (после того как скорость починена индексом).
- Проверено на preview: index-status, ensure-index (done, идемпотентно), migrate dry-run.
- ⚠️ Нужен РЕДЕПЛОЙ. После: ensure-index на проде → подтвердить индекс → замерить /leads.

## Session — Aug 17, 2026 (10): чистка pdf_data у ВСЕХ (старые — просто удаляем)
- Диагностика прода подтвердила: calculator_pdfs имеет ТОЛЬКО индекс _id (ничего больше).
  Построение индекса напрямую падает по socket-таймауту (коллекция огромна).
- Решение пользователя: старые КП без cloudinary_url можно просто удалять pdf_data (не
  переносить в Cloudinary).
- FIX: cleanup эндпоинт получил параметр `?all=true` — удаляет pdf_data у ВСЕХ записей
  батча (не только с cloudinary_url). Батчи + max_time_ms, off event loop.
  Полный вызов: POST /api/integrations/amocrm/kp-cleanup-pdf-data?apply=true&all=true&batch=150
  звать пока more=false.
- ⚠️ Необратимо: у старых КП без cloudinary скачивание перестанет работать (согласовано).
- ⚠️ Нужен РЕДЕПЛОЙ, затем прогнать чистку до конца и замерить /leads.

## Session — Aug 17, 2026 (11): ГОТОВО — прод ускорен
- Чистка pdf_data по всей коллекции: 119 записей очищено (batch=30, 4 итерации). Остаток 0.
- Индекс построен на очищенной (маленькой) коллекции: _id, amocrm_id_1_created_at_-1, created_at_1.
- РЕЗУЛЬТАТ на проде:
  - /sauna-crm/leads: 11.2с → 0.37с
  - /sauna-crm/kp-duplicates: таймаут → 0.12с (нашёл 3 группы дублей КП)
  - /sauna-crm/duplicates: таймаут/0 → 0.13с (по телефону 2 группы)
- Будущий рост предотвращён: генерация КП больше не пишет pdf_data при успешном Cloudinary
  (сессия 6), история версий обрезается до 2 (сессия 7).
- Проблема пользователя «не видит дубли ни по телефону, ни по КП» — решена (был таймаут).
- Данные/индекс правились на прод-БД напрямую через maintenance-эндпоинты — сохраняются,
  повторный редеплой для этого не нужен.

## Session — Aug 17, 2026 (12): роль ai_agent (Claude) + MCP-коннектор
- Авторизация: сервисный Bearer-ключ `AI_AGENT_SERVICE_KEY` (в backend/.env, вне репо).
  Реализовано по integration-плейбуку: combined-auth (сервисный ключ ЛИБО admin-JWT),
  hmac.compare_digest, fail-closed. Файл services/ai_agent_auth.py (принципал, require_scope,
  log_ai_action -> ai_agent_audit, make/verify_diff_token — JWT, TTL 15 мин).
- Роутер routes/ai_agent.py, префикс /api/ai (зарегистрирован в server.py):
  READ (все разделы): /context, /orders, /orders/{id}, /pricing, /tech-cards[/{id}],
  /components, /procurement/requests, /audit.
  WRITE двухшагово (preview->apply, token): /orders/{id}/update (status|comment|assignee),
  /orders/{id}/recalculate (только totalCost+margin, НЕ total клиента),
  /components/{id}/purchase-price (forward-only, recompute affected cards),
  /tech-cards/{id}/update (items|note, recompute-and-sync). Всё пишет в ai_agent_audit.
- Переиспользованы: sauna_orders._recompute_one/_flatten_options; sauna_tech_cards._recompute_and_sync.
- MCP-сервер (Этап 4): /app/mcp/alicor_mcp_server.py (fastmcp, stdio) + requirements.txt +
  README.md (подключение к Claude Desktop) + AGENT_GUIDE.md (инструкция агенту о сервисе/правилах).
  ВАЖНО: fastmcp НЕ ставить в backend venv (конфликт starlette с FastAPI) — MCP запускается
  отдельным процессом у пользователя. В backend venv fastmcp/mcp/sse-starlette удалены, starlette
  возвращён к 0.37.2.
- Тесты (preview): 401 без/с неверным ключом; сервисный ключ (header и Bearer) ok; admin-JWT ok;
  non-admin JWT 401; order update preview->apply; bad token 400; component price preview->apply;
  recalc preview->apply (total не меняется); audit пишется (initiator maxim_via_claude).
- ⚠️ Для ПРОДА: нужен РЕДЕПЛОЙ + переменная AI_AGENT_SERVICE_KEY должна быть в prod-окружении
  (если деплой не подхватит из backend/.env — задать через секреты деплоя/поддержку). Иначе
  /api/ai fail-closed (401).
- Ключ AI_AGENT_SERVICE_KEY хранится в /app/backend/.env (не печатать в чат/логи/фронт).

## Session — Aug 17, 2026 (13): P0 — прод лёг после деплоя ("different loop")
- Симптом: на проде ВСЕ db-эндпоинты (prices, /sauna/orders, /api/ai/*) → 500
  "Task got Future attached to a different loop"; калькулятор пустой (prices 500).
  Логин работал (попадал на здоровый воркер) → проблема per-worker привязки motor к loop.
  На preview тот же код работал (200).
- FIX (database.py): get_client() теперь отслеживает event loop и ПЕРЕСОЗДАЁТ motor-клиент
  при смене loop (_client_loop; при смене — _db=None для ре-бинда). Внутри одного воркера loop
  стабилен → лишних пересозданий нет; при рассинхроне loop клиент восстанавливается.
- Проверено на preview: prices/orders/ai/leads = 200 после фикса.
- ⚠️ НУЖЕН РЕДЕПЛОЙ — чтобы фикс попал на прод и калькулятор поднялся.
- AI-фича: на проде код /api/ai задеплоен, ключ AI_AGENT_SERVICE_KEY подхватился (context=200),
  но чтение падало из-за той же loop-проблемы; после редеплоя с фиксом заработает.

## Session — Aug 17, 2026 (14): remote MCP (Streamable HTTP) в бэкенде для claude.ai
- Требование: захостить MCP по HTTPS рядом с бэкендом, OAuth/авторизация на эндпоинте,
  внутренний AI_AGENT_SERVICE_KEY наружу не светить.
- Ограничение: fastmcp несовместим со starlette<0.38 (ломает FastAPI) → реализовано НАТИВНО.
- routes/mcp_http.py (mounted, no fastmcp): Streamable HTTP на POST /api/mcp
  (initialize→Mcp-Session-Id, notifications/initialized→202, ping, tools/list, tools/call),
  DELETE /api/mcp, discovery /.well-known/oauth-protected-resource. Протоколы 2025-03-26/06-18/11-25.
- Auth: публичный bearer MCP_BEARER_TOKEN (env, отдельный от AI_AGENT_SERVICE_KEY). 401 отдаёт
  WWW-Authenticate с resource_metadata. tools/call форвардит на /api/ai/* по loopback
  127.0.0.1:8001 с X-AI-Agent-Key (внутренний ключ только на сервере, наружу не уходит).
- 17 инструментов = зеркало /api/ai (read + двухшаговые preview/apply). Логика preview→apply,
  total неизменен, forward-only, diff-token 15 мин — без изменений (в слое /api/ai).
- Проверено на preview: 401 без токена; initialize/tools-list/tools-call get_context;
  двухшаговый order_update preview→apply через MCP — ок.
- URL коннектора (prod): https://spa-planner-replaced-1767401260.emergent.host/api/mcp
  Авторизация в claude.ai: Request headers → Authorization: Bearer <MCP_BEARER_TOKEN>.
- MCP_BEARER_TOKEN и AI_AGENT_SERVICE_KEY — в backend/.env (не печатать в лог/фронт).
- Полноценный OAuth (authorize/token/register/PKCE/DCR) НЕ делали (большой, непроверяем против
  claude.ai здесь). Discovery-метаданные уже есть → апгрейд возможен без переделки инструментов.
- ⚠️ Нужен РЕДЕПЛОЙ; MCP_BEARER_TOKEN должен быть в prod-env (как AI_AGENT_SERVICE_KEY подхватился).

## Session — Aug 17, 2026 (15): OAuth 2.1 для remote MCP (claude.ai нет «Request headers»)
- У пользователя в claude.ai нет beta-опции заголовков → реализован полноценный OAuth 2.1 AS
  прямо в бэкенде (routes/mcp_http.py), всё под /api (корневой /.well-known уходит на фронт!).
- Эндпоинты: GET /api/mcp/.well-known/oauth-protected-resource,
  GET /api/mcp/.well-known/oauth-authorization-server, POST /api/mcp/oauth/register (DCR, public
  client, no secret), GET/POST /api/mcp/oauth/authorize (HTML-форма входа, пароль=MCP_OAUTH_PASSWORD),
  POST /api/mcp/oauth/token (form-urlencoded, PKCE S256, authorization_code+refresh_token).
- Токены: access/refresh — JWT (JWT_SECRET), access typ=mcp_access scope=mcp:use aud=resource 8ч,
  refresh 30д. Коды — mcp_oauth_codes (TTL 5 мин, single-use), клиенты — mcp_oauth_clients.
- /api/mcp принимает Bearer: статический MCP_BEARER_TOKEN ИЛИ валидный OAuth access. Внутренний
  AI_AGENT_SERVICE_KEY наружу не уходит (форвард на /api/ai по loopback).
- Проверено на preview e2e: PRM/AS metadata, DCR, authorize(GET форма/POST 302+code), неверный
  пароль→форма, token(PKCE), reuse-code→400, MCP initialize по OAuth-токену→200, garbage→401, refresh→200.
- claude.ai: Add custom connector → URL .../api/mcp, Client ID/Secret пусто (DCR) → Connect →
  ввести MCP_OAUTH_PASSWORD на странице входа.
- env: MCP_OAUTH_PASSWORD добавлен в backend/.env.
- ⚠️ РЕДЕПЛОЙ: нужны MCP_OAUTH_PASSWORD (+ ранее MCP_BEARER_TOKEN, AI_AGENT_SERVICE_KEY) в prod-env.
- Возможный риск: если Claude ищет AS-metadata по root-insertion (/.well-known/...-server/api/mcp),
  путь уйдёт на фронт. Мы отдаём по path-append ({issuer}/.well-known/...), как в MCP-спеке. Если
  discovery не сработает — смотреть, какой URL дёргает Claude, и добавить.

## Session — Aug 18, 2026 (16): фикс OAuth discovery (Claude открывал калькулятор)
- Причина: корневые /.well-known/oauth-* на проде отдавали HTML фронтенда (калькулятор),
  а не JSON. Claude при discovery получал калькулятор → авторизация ломалась/открывался калькулятор.
- Фикс: добавлены статические файлы frontend/public/.well-known/oauth-authorization-server и
  oauth-protected-resource (issuer=origin, endpoints=/api/mcp/oauth/*) — резервная корневая цепочка.
  ВНИМАНИЕ: фронтенд отдаёт их с Content-Type application/octet-stream (не json) — риск, если Claude
  строг к content-type.
- Основная цепочка — на бэкенде (RFC 9728): 401 → resource_metadata (/api/mcp/.well-known/
  oauth-protected-resource, application/json) → authorization_servers=[{base}/api/mcp] → append
  AS metadata (/api/mcp/.well-known/oauth-authorization-server, application/json) → DCR/authorize/token.
  Проверено на preview e2e (append): DCR→authorize(пароль)→token→MCP initialize 200.
- Также усилён DCR (полный RFC7591 ответ + логирование входящего запроса) и добавлены claude.ai/
  claude.com в CORS.
- Бэкенд: uvicorn --workers 1 (in-memory сессии MCP ок; "different loop" был деплой-транзиент).
- Дальше: РЕДЕПЛОЙ (нужны и фронт-файлы, и бэк). Пользователю — переподключить коннектор БЕЗ ручного
  Client ID (авто-DCR). Если снова калькулятор/ошибка — снять логи прода через deployment_agent
  (в /oauth/register логируется входящий запрос Claude).

## Session — Aug 18, 2026 (17): Option B — внешний хост OAuth-метаданных на al-spa.pl
- Подтверждено support: платформа не роутит корневой /.well-known на бэкенд и не даёт задать
  content-type статики. Решение — вынести 2 JSON-метаданных на внешний HTTPS-хост (hostido, al-spa.pl).
- Backend: 401 resource_metadata теперь берётся из env MCP_OAUTH_METADATA_URL
  (=https://al-spa.pl/.well-known/oauth-protected-resource). OAuth endpoints (register/authorize/
  token) остаются на Emergent. issuer в метаданных = https://al-spa.pl (без пути → well-known строго
  в корне, снимает RFC8414 неоднозначность insertion/append, которая, вероятно, ломала DCR у Claude).
- Файлы для загрузки: /app/mcp/hostido/.well-known/{oauth-authorization-server,oauth-protected-resource,.htaccess}
  (.htaccess форсит application/json + CORS). README: /app/mcp/hostido/README.md.
- ВНИМАНИЕ: al-spa.pl сейчас НЕ отвечает по HTTPS (http=000) — пользователю нужно поднять сайт+SSL.
- env добавлен: MCP_OAUTH_METADATA_URL. Нужен РЕДЕПЛОЙ.
- Коннектор claude.ai: URL https://spa-planner-replaced-1767401260.emergent.host/api/mcp, Client ID/Secret пусто,
  пароль страницы = MCP_OAUTH_PASSWORD (MQwRuzGxBYqF).

## Session — Aug 18, 2026 (18): remote OAuth заработал через al-spa.pl (готово)
- Причина всех прошлых сбоев: платформа отдаёт корневой /.well-known фронтендом без корректного
  content-type. Решение (Option B): метаданные вынесены на al-spa.pl (LiteSpeed).
- LiteSpeed: .htaccess во вложенной .well-known игнорировался; сработал КОРНЕВОЙ .htaccess с
  RewriteRule extensionless -> .json. Теперь ВСЕ 4 URL (extensionless + .json) отдают application/json.
- Итоговые файлы у пользователя: /app/mcp/hostido/.well-known/{oauth-authorization-server[.json],
  oauth-protected-resource[.json]} + КОРНЕВОЙ .htaccess (mcp/hostido/root-htaccess.txt).
- Backend env MCP_OAUTH_METADATA_URL -> al-spa.pl protected-resource. issuer=https://al-spa.pl,
  endpoints -> Emergent /api/mcp/oauth/*.
- ПРОВЕРЕНО НА ПРОДЕ e2e (имитация Claude): 401->al-spa metadata->DCR 201->authorize(пароль)->
  token->MCP initialize 200->tools/list 17. РАБОТАЕТ.
- Коннектор claude.ai: URL https://spa-planner-...emergent.host/api/mcp, Client ID/Secret пусто,
  пароль MCP_OAUTH_PASSWORD=MQwRuzGxBYqF.

## Session — Aug 23, 2026 (fork): visibility toggle для Моделей и Вариантов (готово)
- Опции уже имели hidden-toggle + clone (прошлая сессия). Добавлено то же для моделей и вариантов.
- ModelsTab.jsx: чекбокс «Скрыть» + бейдж «Скрыта» + opacity-50 на строке модели.
  Prop handleToggleModelHidden прокинут из SaunaPricingPage.
- useSaunaPricing.js: handleToggleModelHidden(modelId, hidden) — обновляет state + PUT /api/sauna/models/{id}.
- ModelDialog.jsx (ModelVariantsEditor): чекбокс «Скрыть» на каждом варианте (variant.hidden), badge «Скрыт», opacity.
- SaunaCalculator.jsx: models = prices.models.filter(!hidden); variants filter !hidden в ModelVariantSelector;
  условие показа селектора вариантов проверяет наличие видимых вариантов. Пустые группы скрываются авто (map строится из видимых моделей).
- ПРОВЕРЕНО скриншотом: toggle на модели виден, при клике появляется бейдж «Скрыта», авто-сохранение.
- Только фронтенд-изменения → нужен РЕДЕПЛОЙ для появления на PROD.

## Session — Aug 23, 2026 (fork, bugfix): пропали картинки на PROD (исправлено)
- СИМПТОМ: часть картинок опций/вариантов не грузилась в калькуляторе на PROD (битые img).
- КОРЕНЬ: в sauna_prices у части imageUrl сохранён АБСОЛЮТНЫЙ URL на мёртвый preview-домен
  (sauna-catalog.preview.emergentagent.com, sauna-variant...). Сами файлы лежат в БД (коллекция
  images, отдаются с /api/uploads/), но старый хост недоступен → 404.
- ФИКС (host-agnostic):
  - Backend GET /api/sauna/prices (sauna_crud.py): _normalize_media_urls рекурсивно переписывает
    любой абсолютный http(s)://<host>/api/uploads|static/ → относительный /api/uploads|static/.
    Работает в любом окружении, чинит и UI, и PDF. Self-healing (POST может сохранить абсолютный —
    на следующем GET снова станет относительным).
  - Frontend: constants.js getImageUrl теперь чинит устаревшие абсолютные URL; добавлен
    normalizeMediaUrls (deep) и применён в useSaunaCalculator.js после fetch. utils/api.js:
    добавлен resolveMediaUrl (на будущее).
- ПРОВЕРЕНО curl: stale-хостов в ответе 0; ранее битые id (1f6c..., 0277..., 0576...) отдают 200 image/jpeg.
- ВНИМАНИЕ: фикс переписывает хост на ТЕКУЩИЙ. Сработает на PROD только если blob этого id есть в
  PROD-коллекции images (обычно есть). Требуется РЕДЕПЛОЙ.

## Session — Aug 23, 2026 (fork, bugfix): hidden не сохранялся (исправлено)
- СИМПТОМ: скрываешь опцию/модель — после перезагрузки калькулятора скрытие пропадает.
- КОРЕНЬ: models/sauna.py — SaunaModel и SaunaOption НЕ имели поля hidden и без extra="allow",
  поэтому FastAPI выбрасывал флаг при model_dump() на сохранении (PUT /models/{id} и POST /prices).
- ФИКС: добавлено hidden: bool = False в SaunaModel и SaunaOption. (Варианты — SaunaModelVariant/
  OptionVariant уже с extra="allow", их hidden сохранялся.)
- ПРОВЕРЕНО curl: PUT модели с hidden=true → persisted True; POST /prices с option.hidden=true →
  persisted True; затем возвращено в False.
- BACKEND изменение → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 23, 2026 (fork, feature): «Найти битые изображения» в админке (готово)
- Backend: GET /api/sauna/check-images?scope=sauna|balia|all (sauna_crud.py). Собирает все image-ссылки
  (модели/варианты/опции/галереи/подсказки) из sauna_prices И db.prices (Бали) с человекочитаемым контекстом.
  Проверка: /api/uploads/<id> → наличие в db.images; внешние URL → httpx GET с браузерным User-Agent + ретрай на 429.
  Классификация: broken (404/410/conn-fail/нет-в-базе) vs uncertain (401/403/429/5xx — хост блокирует ботов).
- Frontend: components/sauna-pricing/ImageIntegrityChecker.jsx — кнопка «Найти битые изображения» в шапке
  SaunaPricingPage (рядом с Экспорт/Импорт). Модал: сводка (Всего/Битых/Не проверено), список битых по группам
  (Калькулятор·Секция → Название, поле, причина, ссылка + иконка открыть), сворачиваемый блок «не проверено».
- ПРОВЕРЕНО: пустое состояние (Всего 32, Битых 0); подстановка несуществующего /api/uploads → «Битых: 1, нет
  файла в базе» отображается в модале; затем возвращено. imgur больше не даёт ложных 429 (браузерный UA).
- Backend+Frontend → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (fork, feature): «Оставить только эту опцию для выбранных моделей»
- КОНТЕКСТ: несовместимость опций работает, но задаётся у каждой опции отдельно. Пользователю нужно
  для модели Żagel Mini оставить в категории «Ławki» ТОЛЬКО одну лавку, остальные скрыть.
- РЕШЕНИЕ: в окне редактирования опции (той, что должна остаться) — зелёный блок с чекбоксами моделей/
  вариантов + кнопка «Применить». Проставляет выбранные модели в incompatibleModels у ВСЕХ ОСТАЛЬНЫХ
  опций категории и убирает их у текущей. Персистит через PUT каждую опцию категории.
- Файлы: useSaunaPricing.js (handleRestrictCategoryToOption), SaunaPricingPage.jsx (проброс),
  OptionsTab.jsx (проброс + data-testid option-edit-btn-*), OptionDialog.jsx (UI блок restrict-to-option-block,
  restrict-model-*, restrict-variant-*, apply-restrict-btn).
- ПРОВЕРЕНО e2e на preview: применил для модели Beczka 235x200 → в БД у KEEP опции target нет, у 4 остальных
  есть; в калькуляторе при выборе модели в «Ławki» осталась только одна опция. Тестовые данные возвращены.
- Также ранее в сессии: диагностика — сама несовместимость работает корректно (не баг, а конфиг per-option).
- Frontend изменения → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (fork, bugfix): несовместимость model+option — логика AND → OR
- СИМПТОМ: пользователь задал у опций incompatibleModels=[Żagel Mini] И ALSO отметил опцию в другой
  категории (Piec wprost в incompatibleWithOptions). Фильтр по модели «игнорировался».
- КОРЕНЬ: в filterCompatibleOptions (SaunaCalculator.jsx) и isOptionVisible (useOptionVisibility.js)
  при наличии И model-rules, И option-rules применялась логика AND: скрыть только если модель совпала
  И выбрана несовместимая опция. Т.е. пока Piec wprost не выбран — фильтр по модели не срабатывал.
- ФИКС: заменено на независимое OR — скрывать, если срабатывает ЛЮБОЕ условие
  (modelOrVariantMatches || optionMatches). В обоих файлах.
- ПРОВЕРЕНО e2e: у опции заданы обе rules (model=beczka200 + option=dostawa_251_400km); при выборе
  ТОЛЬКО модели (без второго условия) опция теперь скрывается. Тестовые данные возвращены.
- Frontend изменения → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (feature): «Комплект по умолчанию» для модели/варианта
- ЗАДАЧА: при выборе модели (напр. Żagel Mini) авто-подставлять набор опций (печь, лавка, освещение),
  менеджер видит их выбранными и может менять; в PDF пометить «w zestawie».
- ДАННЫЕ: SaunaModel.defaultPackage и SaunaModelVariant.defaultPackage = {categoryId: [optionIds]}
  (radio → 1 элемент; checkbox → несколько). Вариант переопределяет модель по категории.
- АДМИНКА: DefaultPackageEditor.jsx (select для radio, чекбоксы для checkbox). Встроен в ModelDialog:
  секция «Комплект по умолчанию» на уровне модели (Add/Edit) + на уровне каждого варианта.
  categories прокинуты из ModelsTab (prices.categories).
- КАЛЬКУЛЯТОР (useSaunaCalculator.js): computeEffectivePackage + applyPackage. Применяется в
  handleModelChange и handleModelVariantChange (перезапись категорий комплекта). packageMap хранится
  в formData; getSelectedOptions добавляет inPackage к каждой позиции.
- PDF (routes/sauna.py, ветка selected_options): при opt.inPackage к имени добавляется
  <font color=#0EA5E9>(w zestawie)</font>.
- ПРОВЕРЕНО e2e: PUT модели с defaultPackage персистит; выбор модели авто-выбирает лавку(radio)+
  окно(checkbox, qty1)+LED RGB(checkbox); generate-pdf → 200, обе позиции с «(w zestawie)», обычная без.
  Тестовые данные возвращены.
- ПРИМЕЧАНИЕ: handleAddModel всё ещё не сохраняет variants при создании (предсуществующее поведение) —
  комплект варианта задаётся после создания через редактирование. Комплект модели при add сохраняется.
- Backend+Frontend → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (feature): бейдж «w zestawie» в калькуляторе + копирование комплекта
- Бейдж: в SaunaCalculator.jsx (CategoryCard, checkbox+radio ветки) синяя пилюля «w zestawie» рядом с
  названием опции, если option.id в formData.packageMap[category.id]. data-testid=pkg-badge-{optId}.
- Копирование: в ModelDialog (Add+Edit) над DefaultPackageEditor — select «Скопировать из» со списком
  моделей, у которых непустой defaultPackage; копирует deep-clone defaultPackage в текущую модель.
  data-testid=pkg-copy-from-editmodel / pkg-copy-from-newmodel. Добавлен data-testid=model-edit-btn-{id}.
- ПРОВЕРЕНО: бейдж виден на выбранной опции (2 бейджа); копирование из beczka200 → «Задано категорий: 2»,
  select lawki = lawki_2_poziomy_zamkniete. Тестовые данные возвращены.
- Frontend изменения → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (feature #4 + bugfix): RU-названия опций + Telegram производства на русском
- BUGFIX (важно): services/telegram_service.py — функция format_order_notification ПОТЕРЯЛА строку def,
  её тело было заперто внутри send_and_pin_message после return. notify_new_order падал на NameError
  (ловился try/except → уведомления о заказах молча не отправлялись). Восстановлена строка def.
- SaunaOption.nameRu добавлено (models/sauna.py). Админка: OptionDialog Add/Edit — поле «Название (RU)»
  (data-testid new-option-nameru / edit-option-nameru).
- getSelectedOptions (useSaunaCalculator.js): добавлено optionNameRu (option.nameRu + variant.nameRu),
  попадает в сохранённый заказ.
- format_order_notification: список опций теперь берёт optionNameRu||nameRu||optionName. Клиентский PDF
  остаётся на польском (не трогали).
- ПРОВЕРЕНО: format_order_notification рендерит RU-названия; nameRu персистит через POST /prices.
- ОСТАЛОСЬ (следующий шаг): #1 фото выбранного цвета в шапке PDF; #2 кастомная загрузка фото модели в КП;
  #3 галерея в КП (до 6 фото + комментарии, раздел в конце PDF).
- Backend+Frontend → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (features #1,#2,#3): цвет в PDF, кастом-фото модели, галерея КП
- #1 Цвет в шапке PDF (routes/sauna.py, generate_sauna_pdf): извлекается опция categoryId=='kolor'
  (имя+фото+цена), добавляется карточка KOLOR в strip MODEL/ŁAWKI/PIEC/KOLOR. col_widths и размеры
  картинок адаптированы под 4 карточки.
- #2 Кастомное фото модели: KpMediaPanel.jsx (calculator) — загрузка через POST /api/upload/image;
  formData.customModelImageUrl; в orderData modelImageUrl = customModelImageUrl||modelImage → шапка PDF.
- #3 Галерея КП: KpMediaPanel — до 6 фото + комментарий к каждому; formData.galleryImages=[{url,comment}];
  orderData.galleryImages; в PDF раздел «GALERIA / REFERENCJE» (PageBreak + сетка 2 кол.) перед doc.build.
  SaunaPDFRequest extra=allow → galleryImages проходит.
- Хук useSaunaCalculator: setCustomModelImage/addGalleryImage/updateGalleryComment/removeGalleryImage.
  Панель отрисована в SaunaCalculator между CustomerInfoCard и ModelSelectionCard.
- ПРОВЕРЕНО: generate-pdf 200, в PDF есть KOLOR+имя цвета, GALERIA+RU-комментарий, custom modelImage, 4 стр;
  KpMediaPanel виден в калькуляторе; POST /api/upload/image → 200 (Cloudinary URL).
- ПРИМЕЧАНИЕ: при РЕДАКТИРОВАНИИ существующего заказа галерея/кастом-фото в панель не подгружаются обратно
  (не критично для создания КП). Можно добавить позже.
- Backend+Frontend → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (features): restore-on-edit + палитра цветов (свотчи)
- RESTORE ON EDIT: orderData теперь сохраняет customModelImageUrl (в доп. к modelImageUrl) + galleryImages.
  useSaunaCalculator editingOrder-загрузка выставляет formData.customModelImageUrl и galleryImages.
  SaunaOrder extra="allow" → model_dump включает поля → в БД; GET /orders/{id} отдаёт raw dict (без
  response_model фильтра) → панель «Медиа для КП» подгружается при открытии сохранённого заказа.
- ПАЛИТРА ЦВЕТОВ (свотчи): флаг категории category.displayAsSwatches (SaunaCategory extra=allow).
  Админка CategoriesTab (edit dialog): чекбокс «Отображать как палитру цветов (свотчи)»
  (data-testid category-swatches-toggle). Калькулятор SaunaCalculator: новый SwatchOptions — сетка
  плиток с фото (option.imageUrl), выбор кликом (handleRadioChange), выбранная с рамкой+галочкой+ценой.
  Ветка в CategoryCard: checkbox → swatches (если displayAsSwatches) → dropdown → radio.
- ПРОВЕРЕНО: свотчи рендерятся для 'lawki' (5 плиток, выбор работает) — скриншот; restore — проверен путь
  данных (model_dump включает extras, GET отдаёт raw). Тестовые данные возвращены.
- Frontend изменения (+ данные категории) → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (polish): цвет в сводке + tooltip свотчей
- Сводка (OrderSummary в SaunaCalculator): colorCat = категория с displayAsSwatches||id 'kolor' (radio) с
  выбором; selectedColorOpt показывается отдельной строкой (миниатюра+название категории+название опции),
  data-testid summary-color-line. Вставлено перед SelectedOptionsList.
- Свотчи: добавлен стилизованный tooltip (group-hover, чёрная плашка сверху) с полным названием;
  у кнопки убран overflow-hidden (клипал tooltip), клиппинг перенесён на контейнер фото (rounded-t-md).
  data-testid swatch-tooltip-{optId}.
- ПРОВЕРЕНО скриншотом: строка цвета в Podsumowanie видна с миниатюрой; tooltip присутствует. Данные возвращены.
- Frontend → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (UI): расширено модальное окно редактирования опции
- OptionDialog.jsx: DialogContent max-w-lg → max-w-3xl w-[95vw] overflow-x-hidden (Add+Edit).
- Убран горизонтальный скролл; PL/RU и цена/себестоимость теперь в 2 колонки.
- ПРОВЕРЕНО скриншотом. Frontend → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (BUGFIX): displayAsSwatches не сохранялся при сохранении категории
- СИМПТОМ: включил свотчи в админке, но в калькуляторе категория осталась обычным списком.
- КОРЕНЬ: models/sauna.py SaunaCategory НЕ имел поля displayAsSwatches и без extra="allow" →
  PUT /categories/{id} делает category.model_dump() → флаг отбрасывался (не сохранялся в БД).
  (Прямая запись в БД в тестах работала, поэтому баг не заметили ранее.)
- ФИКС: добавлено displayAsSwatches: bool = False в SaunaCategory.
- ПРОВЕРЕНО: PUT категории с displayAsSwatches=true → GET возвращает True (раньше None). options не теряются.
- Backend → нужен РЕДЕПЛОЙ. После деплоя на PROD нужно ЗАНОВО включить галочку у категории «Kolor» и сохранить
  (прежнее сохранение потеряло флаг).

## Session — Aug 24, 2026 (features): цвет в итогах PDF + ИИ-перевод опций на русский
- PDF: в блок «WARTOŚĆ CAŁKOWITA OFERTY» (routes/sauna.py, left_html) добавлена строка «Wybrany kolor: <name>»
  когда выбран цвет (color_name). Проверено: в PDF есть «Wybrany kolor: Kolor Orzech».
- ИИ-ПЕРЕВОД (Emergent LLM key, openai gpt-5.4 — gpt-5.6 недоступна в плейбуке):
  - Backend: POST /api/sauna/translate-options {texts:[...]} → {translations:[...]} через emergentintegrations
    LlmChat.send_message, system prompt переводчика, парсит JSON-массив, fallback на оригинал.
  - Per-option: OptionDialog Add/Edit — кнопка «🌐 Перевести ИИ» рядом с полем RU (translateName,
    data-testid new/edit-option-translate-btn). Заполняет nameRu.
  - Bulk: useSaunaPricing.handleTranslateAllOptions — собирает все имена опций, 1 вызов LLM, перезаписывает
    ВСЕ nameRu, POST /prices. Кнопка TranslateAllButton.jsx в шапке SaunaPricingPage (translate-all-btn,
    с confirm+loading).
- ПРОВЕРЕНО: endpoint переводит (3 примера корректно); per-option кнопка заполнила RU в диалоге; bulk-кнопка
  и per-option кнопки отрисованы. Backend не менял модели заказа.
- Backend+Frontend → нужен РЕДЕПЛОЙ для PROD.

## Session — Aug 24, 2026 (feature): ИИ-перевод под-вариантов опций (namePl → RU)
- OptionDialog (Edit): кнопка «🌐 Перевести PL→RU» под каждым вариантом (data-testid variant-translate-btn-{idx});
  translateVariant(idx) переводит variant.namePl → устанавливает variant.name и variant.nameRu.
- Bulk handleTranslateAllOptions (useSaunaPricing): теперь собирает И названия опций (name), И названия
  вариантов (namePl) в один LLM-вызов; маппит обратно (kind option/variant, optIdx/varIdx), опциям пишет nameRu,
  вариантам name+nameRu; сохраняет через POST /prices.
- ПРОВЕРЕНО скриншотом: клик по кнопке варианта перевёл «Bez zabudowy» → «Без облицовки». Диалог не сохранял.
- Frontend → нужен РЕДЕПЛОЙ для PROD.

## Session — Jun 2026 (fix): Graceful fallback для ИИ-перевода на PROD
- Проблема: POST /api/sauna/translate-options падал 500 (`No module named 'litellm'`) на PROD, т.к.
  продакшн-сборка не устанавливает emergentintegrations/litellm из requirements.txt (Preview работает).
- Сделано: в routes/sauna_crud.py импорт emergentintegrations обёрнут в try/except ImportError → HTTP 503
  с понятным RU-сообщением. Отсутствие EMERGENT_LLM_KEY и ошибка вызова LLM тоже → 503 (вместо 500 краша).
  Теперь фронтенд получает управляемую ошибку, а не жёсткий краш.
- ПРОВЕРЕНО curl на Preview: перевод по-прежнему работает корректно.
- ДЕПЛОЙ PROD: корневая причина непоставки пакета — на стороне платформенного билд-пайплайна.
  support_agent рекомендует написать support@emergent.sh с job ID и скриншотом ошибки.

## Session — Jun 2026 (fix v2): ИИ-перевод переведён на прямой HTTP-прокси (РЕШЕНИЕ PROD-бага)
- КОРЕНЬ: translate-options использовал emergentintegrations/litellm, которую PROD-сборка не ставит →
  `No module named 'litellm'` → 500. Анализ менеджеров/планировщик работали, т.к. вызывают LLM напрямую
  по HTTP через прокси Emergent (integrations.emergentagent.com/llm), без litellm.
- ФИКС: переписал POST /api/sauna/translate-options на прямой httpx-вызов
  integrations.emergentagent.com/llm/chat/completions (model gpt-4o-mini, temperature 0.2),
  как в lead_analytics.py / planner.py. Зависимости от litellm больше НЕТ.
- Ошибки: нет ключа / не 200 / исключение → HTTP 503 с RU-сообщением (не 500-краш).
- ПРОВЕРЕНО curl на Preview: Piec elektryczny→Электрическая печь, Bez zabudowy→Без обшивки.
- Требуется РЕДЕПЛОЙ PROD — должно заработать без установки библиотеки.

## Session — Jun 2026 (fix): Карточки MODEL/ŁAWKI/PIEC/KOLOR в 2 ряда (2x2)
- Проблема: после добавления карточки KOLOR (4-я) все 4 блока встали в один ряд → узкие колонки,
  длинное имя PIEC переносилось по 1 слову.
- Фикс в routes/sauna.py (генерация PDF, секция MODEL I ŁAWKI): при n_cards>=4 раскладка стала сеткой
  2 карточки в ряд (2x2), per_card_w=265, image_col_w=95, info_col_w=170; картинки клампятся до 85pt ширины
  (model_img мог быть до 130 и налезал на текст); добавлены разделители между колонками и рядами.
  При 1-3 карточках — прежний одиночный ряд.
- ПРОВЕРЕНО рендером PDF (fitz): 2x2 корректно, текст не рвётся, картинки в колонках.
- Backend → нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (fix): amoCRM-заказ, Telegram-производство, тех.задание
Четыре проблемы при открытии amoCRM-заказа в калькуляторе:
1) Смена модели не обновляла название:
   - Backend sauna_orders.py PUT /orders/{id}: при изменении modelName синхронизируем связанный
     sauna_crm_leads (по calculatorOrderId или amocrm_id) → modelName + field_1. ПРОВЕРЕНО curl+DB.
   - telegram_production.py _build_message: приоритет модели теперь (order.modelName) → lead.modelName → field_1
     (раньше stale lead.modelName перекрывал свежий заказ).
2) Авто-комментарий «Из amoCRM (...). Сделка: ...» в notes:
   - amocrm.py (2 места): notes собираются ТОЛЬКО из orderContents/orderComment, без служебных строк
     (источник хранится в amocrm_link/amocrm_name/source). Для старых заказов Telegram чистит их regex-ом.
3) Польские названия опций в Telegram «ЗАКАЗ В ПРОИЗВОДСТВО»:
   - telegram_production.py _build_spec_lines: приоритет optionNameRu/nameRu → optionName/name/namePl. ПРОВЕРЕНО.
4) Тех.задание не в документах карточки и не в Telegram:
   - Frontend SaunaCRMPage handleTechSpecSaved: после создания перечитывает лид и обновляет documents.
   - Backend sauna.py generate_tech_spec_pdf: после привязки документа, если у лида есть telegram_topic_id —
     сразу шлёт PDF в топик (send_telegram_file). Линковка работала при переданном leadId (поток из карточки CRM).
- Все правки backend+frontend → нужен РЕДЕПЛОЙ PROD.
- Не удалось e2e проверить Telegram-отправку тех.задания (нужен реальный топик) — логика повторяет
  существующий рабочий attach документов в send_to_production.

## Session — Jun 2026 (feature): Производственное КП (урезанное) + анализ маппинга тех.задания
ЗАДАЧА 1 — Производственное КП (готово, протестировано рендером+e2e helper):
- routes/sauna.py generate_sauna_pdf: флаг productionMode (SaunaPDFRequest extra=allow).
  При True скрываются: промо, ВСЕ цены (карточки MODEL/ŁAWKI/PIEC/KOLOR, WYBRANE OPCJE, ИТОГО,
  доставка, Comfino-рассрочка), стр.2 (варианты+доп.опции), маркетинговые галереи (gallery_promo/gallery).
  Остаётся: стр.1 (модель+лавки+печь+цвет без цен), список опций без цен, KOMENTARZ,
  WYMIARY (схема-планировка), кастомная галерея менеджера (galleryImages).
- telegram_production.py: _generate_and_attach_production_kp() — при «Отправить в производство»
  генерит урезанное КП (POST localhost:8001/api/sauna/generate-pdf productionMode:true),
  грузит в Cloudinary (folder wm-calculator/production-kp), кладёт в lead.documents type=production_kp
  «Производственное КП» (перезапись старого). Attach-loop в топик теперь ПРОПУСКАЕТ type kp (клиентское
  с ценами) и contract — в производство уходит только урезанное КП. Документ качается из карточки.
- Frontend SaunaCRMPage: DOC_TYPES.production_kp (оранжевый бейдж); после send-to-production
  перечитываются documents.
- Нужен РЕДЕПЛОЙ PROD.

ЗАДАЧА 2 — Маппинг опций ↔ тех.задание (АНАЛИЗ, ждёт решения пользователя):
- НАЙДЕНА корневая проблема: ДВЕ несвязанные системы категорий тех.задания.
  (1) Жёстко зашитый список techSpecData.js (id: model_size, execution, sauna_color, benches...) —
      его использует TechSpecModal для рендера и авто-подстановки.
  (2) БД-список /api/tech-spec/config (id: base_color, door_color, benches, roof_color... 25 шт) —
      на него ссылается маппинг в редакторе опций калькулятора (OptionDialog: techSpecCategoryId/techSpecId).
  => Маппинг, настроенный в админке, в основном НЕ срабатывает в модалке (id не совпадают).
     Работают только calcCategoryMapping (kolor/lawki/podspinniki) и сопоставление по названиям.
- ПРЕДЛОЖЕНИЕ: перевести TechSpecModal на БД-категории (/api/tech-spec) — тогда единая настраиваемая
  система и маппинг из редактора опций заработает. Это средний рефактор рендера модалки (секции по
  masterCategory вместо hardcoded sections). Ждём подтверждения пользователя.

## Session — Jun 2026 (feature): Задача 2 — единая DB-driven система тех.задания
- РЕШЕНО: TechSpecModal переписан на БД-категории (/api/tech-spec/config) вместо hardcoded techSpecData.js.
  Теперь модалка и ручной маппинг опций (techSpecCategoryId/techSpecId в редакторе опций калькулятора,
  вкладка «Спецификация» админки) используют ОДИН источник → маппинг реально срабатывает.
- Модалка: грузит masterCategories+categories, рендерит секции по masterCategoryId, поля по inputType
  (radio/checkbox/text/textarea/mixed); авто-подстановка: (1) явный маппинг option.techSpecCategoryId/
  techSpecId, (2) фолбэк по совпадению названий. Комментарий, планировка, данные сауны, лавки — сохранены.
- Payload в generate-tech-spec-pdf маппит section=masterCategoryId, textarea/mixed→text, для text без опций
  добавляет синтетическую опцию 'value'. Бэкенд-рендер не менялся (уже группирует по section).
- ПРОВЕРЕНО рендером: PDF сгруппирован по мастер-категориям, маппинг base_color→palisander дал
  «Цвет базы: Палисандр». Frontend компилируется.
- Нужен РЕДЕПЛОЙ PROD.
- techSpecData.js больше не используется модалкой (index.js ре-экспорт оставлен, безвреден).

## Session — Jun 2026 (feature): Производственное КП на русском
- В generate_sauna_pdf добавлены хелперы _plru(pl,ru) и _opt_ru_name(opt) — активны только при productionMode.
- Переведены на русский (только в производственном режиме): header ('ЗАКАЗ В ПРОИЗВОДСТВО'),
  DANE KLIENTA/Imię/Telefon, INFORMACJE O OFERCIE/Data/Ważność/Nr, MODEL I ŁAWKI, карточки MODEL/ŁAWKI/PIEC/KOLOR,
  disclaimer, WYMIARY POMIESZCZEŃ, KOMENTARZ, WYBRANE OPCJE, OPCJA-заголовок, GALERIA, футер, 'Koszt fundamentu'.
- Названия опций/карточек берут optionNameRu/nameRu (фолбэк на польские, если перевода нет).
- Клиентское КП без изменений (польский). ПРОВЕРЕНО рендером (обе страницы на русском). Нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (feature): Свободные сообщения из Telegram-топика → CRM карточка
- Раньше в карточку попадал только комментарий через кнопку/reply на подсказку бота; обычный текст в топике игнорировался.
- telegram_production.py: _handle_reply теперь возвращает bool; добавлен _handle_topic_message — любое
  текстовое сообщение в топике заказа сохраняется в lead.productionMessages (direction=in, channel=telegram),
  игнорируются: сообщения бота (is_bot), команды (/...), сообщения вне топика. webhook: photo → text(reply→topic).
- Карточка (ProductionTelegramPanel) уже рендерит productionMessages; live-обновление через _publish_update SSE.
- ВАЖНО: работает только если webhook бота включён (/enable-webhook) — он уже используется для кнопок/фото.
- ПРОВЕРЕНО unit-тестом (сохраняется только валидный текст). Нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (feature): Реакция 👍 на сообщения из топика
- В _handle_topic_message после сохранения бот ставит 👍 через Telegram setMessageReaction
  (chat_id+message_id из апдейта, bot из cfg). Ошибка реакции не мешает сохранению (try/except).
- Нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (feature): Встроенная страница-справка для менеджера
- Новый компонент frontend/src/components/ManagerGuideDialog.jsx — красиво оформленное окно-справка
  (градиентная шапка, карточки-шаги с иконками lucide, цветные чипы кнопок, блок логики производства).
- Кнопка «Инструкция» (BookOpen) добавлена в тулбар канбана SaunaCRMPage (data-testid=open-guide-btn),
  состояние guideOpen. Содержимое: 7 шагов работы + подробная логика связи с производством
  (что происходит при «Отправить в производство», как формируется/обновляется Производственное КП,
  двусторонняя связь: кнопки ack/даты/комментарий, свободный текст в теме → карточка, 👍, фото) + чек-лист.
- Также текстовая версия в /app/memory/manager_instruction.md.
- ПРОВЕРЕНО скриншотом (вход admin/admin123 → CRM → Инструкция). Нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (feature): Скриншоты в справке менеджера
- В ManagerGuideDialog.jsx добавлены 3 реальных скриншота (залиты в Cloudinary через /api/upload/image):
  доска заказов (канбан), карточка заказа (диалог), Производственное КП стр.1 (рендер PDF).
- Компонент Figure (рамка+подпись). Скриншоты снимались через screenshot_tool + page.request.post upload.
- ПРОВЕРЕНО скриншотом: изображения отображаются в справке. Нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (feature): Встроенная справка конфигуратора планировок
- Новый компонент frontend/src/components/LayoutGuideDialog.jsx — красивое окно-справка
  (градиент, скриншот интерфейса Cloudinary, карточки понятий, разделы, порядок работы,
  Опции+Варианты/calculatorMapping, чек-лист).
- Кнопка «Инструкция» (BookOpen) добавлена в шапку «Настройки» LayoutConfiguratorPage
  (data-testid=open-layout-guide-btn), состояние guideOpen.
- Текстовая версия: /app/memory/layout_configurator_instruction.md.
- ПРОВЕРЕНО скриншотом. Нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (fixes): планировка в проде-КП, RU для старых заказов, Binotel-ключи
1) generate_sauna_pdf: в productionMode добавлен раздел «ПЛАНИРОВКА» из request.layoutImageUrl.
   telegram_production _generate_and_attach_production_kp резолвит layoutImageUrl из order или
   configurator_layouts (selectedLayoutId → exportedImageUrl/backgroundUrl). ПРОВЕРЕНО рендером.
2) telegram_production: _build_pl_ru_map() из sauna_prices (namePl/name→nameRu, +варианты);
   _build_spec_lines для опций без nameRu берёт перевод из прайса. Старые заказы теперь на русском.
   ПРОВЕРЕНО (59 позиций, пример перевода ок).
3) backend/.env BINOTEL_API_KEY=b1dbd2-8dd72e9 / BINOTEL_API_SECRET=5933a9-... (новый аккаунт).
   ПРОВЕРЕНО: 242 входящих + 1004 исходящих. WS-ключи/CompanyID(95086) в коде не используются.
ВСЁ → нужен РЕДЕПЛОЙ PROD. Для Binotel на PROD переменные окружения задаются отдельно —
возможно, потребуется прописать ключи в настройках окружения продакшена.

## Session — Jun 2026 (enhancement): Подпись под планировкой в производственном КП
- generate_sauna_pdf (productionMode): под изображением «ПЛАНИРОВКА» добавлена подпись —
  modelName + размеры + вариант (selectedModelVariantName) + сторона двери (опция drzwi/lokalizacja, RU).
  ПРОВЕРЕНО рендером: «Sauna Żagel Mini 2*2m · Drzwi po prawej stronie · Дверь прямо». Нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (fix): PDF скачивался без расширения .pdf
- Причина: в cloudinary_service.upload_pdf public_id формировался БЕЗ .pdf (resource_type=raw),
  поэтому secure_url оканчивался без расширения → браузер сохранял файл без .pdf.
- Фикс: public_id теперь оканчивается на .pdf (f"{folder}/{base}_{uid}.pdf").
  ПРОВЕРЕНО: url = .../raw/upload/.../TechSpec_TEST_xxxx.pdf. Касается тех.задания, производственного КП,
  и всех PDF через upload_pdf. Старые документы не меняются, новые — с .pdf. Нужен РЕДЕПЛОЙ PROD.

## Session — Jun 2026 (feature): Маппинг категории на тех.задание + справка «Спецификация»
1) Маппинг на уровне КАТЕГОРИИ калькулятора:
   - SaunaCategory.techSpecCategoryId уже был в модели. Добавлен select в CategoriesTab (edit dialog):
     «Маппинг категории на Тех.Задание».
   - TechSpecModal: грузит /api/sauna/prices → calcCatMap (categoryId→techSpecCategoryId); авто-подстановка
     теперь: маппинг опции → маппинг категории → совпадение по названию.
2) Справка «Спецификация»: новый SpecGuideDialog.jsx (градиент, скриншот вкладки, иерархия
   Главные категории→Подкатегории→Опции, типы полей, шаги, 2 уровня маппинга). Кнопка «Инструкция»
   в шапке TechSpecAdminPage (data-testid=open-spec-guide-btn). ПРОВЕРЕНО скриншотом.
Нужен РЕДЕПЛОЙ PROD.
