# WM Kalkulator - Product Requirements Document

## Original Problem Statement
Comprehensive logistics and sales management system for sauna and hot tub business with calculators, order management, logistics, training modules, and CRM integrations.

## Latest Updates

### Jan 28, 2025 - Hidden Options Filtering & Model Capacity Field (COMPLETED)
- **NEW**: Hidden options (based on incompatibility rules) are now excluded from order summary and PDF
- **Feature**: `isOptionVisible` helper function checks `incompatibleModels` and `incompatibleWithOptions` rules
- **Feature**: `calculateOptionsTotal` now filters hidden options from price calculation
- **Feature**: `getSelectedOptions` excludes hidden options from PDF generation
- **Feature**: `SelectedOptionsList` hides incompatible options in order summary
- **NEW**: Added `capacity` field to SaunaModel for number of people (e.g., "4-6")
- **Feature**: Capacity displayed in model cards as "👥 X osób" when set
- **Feature**: Capacity editable in admin panel (AddModelDialog, EditModelDialog)
- **Feature**: Capacity included in PDF as "Orientacyjna liczba osób: X" (Polish)
- **NEW**: Added configurable `maxManagerDiscount` setting in admin panel
- **Feature**: Admin can set maximum discount % for managers (non-admin users)
- **Feature**: Default value is 10%, can be changed in Ceny > Sauny admin page
- **Feature**: Discount limit applied in calculator UI and validation
- **NEW**: Added bulk price change functionality in admin panel
- **Feature**: Separate % inputs for models and options prices
- **Feature**: Applies to basePrice, foundationPrice (models) and option/variant prices
- **Feature**: Supports both positive (increase) and negative (decrease) percentages
- **Backend**: Updated `SaunaModel`, `SaunaPDFRequest`, `SaunaPriceData` in `sauna.py`
- **Backend**: PDF generation includes capacity in WYMIARY POMIESZCZEŃ section
- **Frontend**: Updated `SaunaCalculator.jsx`, `useSaunaCalculator.js`, `SaunaPricingPage.jsx`
- **Admin UI**: Updated `ModelDialog.jsx` with capacity field, added maxManagerDiscount in pricing page
- **Tested**: All code correctly implemented (iteration 30, curl PDF test, UI screenshots)

### Jan 28, 2025 - Hot Tub Calculator & Pricing Improvements (COMPLETED)
- **FIX**: Model cards in calculator now show correct number of heater variants (based on availableHeaterTypes)
- **Feature**: Added material tags (Fiberglass/Akryl) to model cards in calculator
- **Feature**: Added heater type tag when model has only one type (Zintegr./Zewn.)
- **NEW**: Added "Calculate Price" button in option edit dialog
- **Feature**: Shows current EUR exchange rate in the pricing section
- **Feature**: Button applies formula: purchasePriceEur × eurRate × (1 + markup%) = retail price
- **Frontend**: Updated `CalculatorPage.jsx` with model card tags
- **Frontend**: Updated `balia-pricing/OptionEditDialog.jsx` with price calculation button
- **Frontend**: Updated `BaliaPricingPage.jsx` to pass eurRate to dialog
- **Frontend**: Updated `balia-pricing/ModelEditDialog.jsx` with price calculation for heater variants
- **Feature**: Each heater variant (integrated/external) has its own Apply button for price calculation

### Jan 29, 2025 - Sauna Model Variants (Sub-models) + Conditional Category Visibility (COMPLETED)
- **NEW**: Added model variants for saunas (like heater variants in hot tubs)
- **Feature**: Each model can have multiple variants with different prices, images, and descriptions
- **Feature**: Variant selector displayed as large cards after model selection
- **Feature**: Price taken from selected variant instead of base model price
- **NEW**: Conditional category visibility based on selected model variant
- **Feature**: Categories can be configured to show only for specific variants (e.g., "Plus" only)
- **Feature**: Admin UI for setting `visibleForModelVariants` in category edit dialog
- **Backend**: Added `SaunaModelVariant` class and `variants` field to `SaunaModel`
- **Backend**: Added `selectedModelVariant` to `SaunaOrder` and `SaunaPDFRequest`
- **Backend**: Added `visibleForModelVariants` field to `SaunaCategory` model
- **Frontend**: Added `ModelVariantsEditor` component in `ModelDialog.jsx` for admin UI
- **Frontend**: Added `ModelVariantSelector` component in `SaunaCalculator.jsx`
- **Frontend**: Updated `useSaunaCalculator.js` with `getSelectedModelVariant`, `getModelPrice`, `handleModelVariantChange`
- **Frontend**: Updated `SummaryCard` to show variant name and price
- **Frontend**: Added category filtering by `visibleForModelVariants` in `SaunaCalculator.jsx`
- **Frontend**: Added `selectedModelVariant` to `constants.js` initial form data
- **Admin UI**: Added "Видимость для вариантов модели" input in `CategoriesTab.jsx`
- **Tested**: All features working (iteration 31)

### Jan 24, 2025 - Room Sizes for Sauna Models (COMPLETED)
- **NEW**: Added room size fields to sauna models: `relaxRoomSize`, `steamRoomSize`
- **Feature**: Alternative sizes for terrace option: `relaxRoomSizeWithTerrace`, `steamRoomSizeWithTerrace`
- **Feature**: Room sizes displayed in model cards in calculator
- **Feature**: Room sizes included in PDF with Polish labels (Przebieralnia, Łaźnia)
- **Tested**: All features working correctly

### Jan 24, 2025 - Sauna Option Variants System (COMPLETED)
- **NEW**: Implemented variant system for sauna options - mutually exclusive choices within an option
- **Feature**: Variants replace base option price (not add to it)
- **Feature**: Variant images are used in PDF generation (replaces parent option image)
- **Feature**: "Dodaj belki" option now uses `foundationPrice` from selected model (dynamic price)
- **Example**: "Ławki 2-poziomowe" option now has variants: "Bez zabudowy" (480 PLN) vs "Z zabudową" (1480 PLN)
- **Backend**: Added `OptionVariant` model in `sauna.py`, kept `SubOption` as alias for backward compatibility
- **Frontend**: Variants display as radio buttons under selected option in `SaunaCalculator.jsx`
- **Admin UI**: Updated `OptionDialog.jsx` with "🔄 Варианты исполнения" section
- **Calculator Logic**: `useSaunaCalculator.js` updated with `handleVariantChange` and `variantSelections` state
- **Tested**: All backend and frontend tests passed (iterations 26, 27)

### Jan 23, 2025 - P0 Blocker Fixed: PDF Generation & Upload to amoCRM from Widget
- **FIXED**: When gifts/discounts are edited via amoCRM widget, a new PDF is now automatically generated and uploaded to the amoCRM lead
- **NEW**: Added `generate_and_upload_pdf_to_amocrm()` function in `widget.py`
- **NEW**: Added `build_pdf_request_from_order()` helper function to construct PDFRequest from order data
- **NEW**: Added `currencySymbol` field to `PDFRequest` model for proper currency display
- **ENHANCED**: Save gifts endpoint now includes PDF upload status in response
- **ENHANCED**: amoCRM note now includes info about PDF update when successful
- **Note**: PDF upload requires amoCRM credentials (domain + token) to be configured in integration settings

### Jan 22, 2025 - P0 Blocker Fixed: amoCRM Widget Edit Order Flow
- **FIXED**: Order editing from amoCRM widget now preserves `amocrm_id` connection
- **FIXED**: Frontend now uses correct `/api/orders` endpoint (was `/api/balia/orders`)
- **FIXED**: `amocrmData` is restored from `editingOrder` in both CalculatorPage.jsx and useSaunaCalculator.js
- **NEW**: Widget now displays change history section (last 5 changes)
- **NEW**: Added `amocrm_name` field to Order model
- **Tested**: All 13 test cases passed for edit flow

### Jan 22, 2025 - Manager Orders Isolation & amoCRM Notifications
- **NEW**: Managers now see only their own orders (filtered by `createdBy`)
- **NEW**: Admins continue to see all orders
- **NEW**: Applies to both Balia (`/api/orders`) and Sauna (`/api/sauna/orders`) endpoints
- **NEW**: amoCRM note sent automatically when order is edited with changes
- **Note**: Note format: "✏️ Заказ изменён пользователем {user}\n\nИзменённые поля: {fields}"
- **Tested**: All 14 test cases passed for filtering and note sending

### Jan 21, 2025 - Content Library Enhancements
- **Fixed**: Public content page now uses absolute URLs for videos/images - videos should now play correctly
- **Fixed**: Added improved headers for PDF files in training module (Cache-Control, X-Frame-Options)
- **Fixed**: Streaming for large files (>1MB) in both training and content modules
- **Fixed**: Upload button now works correctly for individual folders (unique ID per folder)
- **NEW**: Hierarchical folders (subfolders) support in Content Library
- **NEW**: Tree view on public content page with expand/collapse functionality
- **Tested**: GridFS file storage working correctly for training and content files

## Core Features Implemented

### 1. Calculator Modules
- **Balia (Hot Tub)**: Configuration and pricing calculator
- **Sauna**: Configuration and pricing calculator
- PDF generation for orders

### 2. Logistics & Delivery
- Route planning with map integration
- Driver panel for delivery management
- Warehouse panel for order preparation

### 3. Training Module (NEW - Jan 2025)
- Course management (admin)
- Video lessons with Synthesia embeds
- GIF thumbnails support
- Multiple-choice quizzes with passing scores
- Employee progress tracking
- Statistics dashboard

### 4. amoCRM Widget (Enhanced - Jan 2025)
- Enlarged design with more order details
- Debt calculation display
- Allegro order labels
- amoCRM tags display
- "Edit" button for order modification

### 5. Backup System (Fixed - Jan 2025)
- Manual and automatic backups unified
- Optimized backup size (~22MB)
- Excluded logs collection

### 6. Admin Panel
- User management
- Pricing configuration
- Order statistics
- FAQ management
- PDF template editor

## Technical Architecture

```
/app
├── backend (FastAPI)
│   ├── routes/
│   │   ├── amocrm.py      # CRM integration
│   │   ├── backup.py      # Backup system
│   │   ├── balia.py       # Balia orders
│   │   ├── sauna.py       # Sauna orders
│   │   ├── training.py    # Training module API
│   │   └── widget.py      # amoCRM widget
│   └── server.py
└── frontend (React)
    └── src/
        ├── components/
        │   ├── LandingPage.jsx
        │   ├── TrainingPage.jsx
        │   └── ...
        └── context/
            └── AuthContext.jsx
```

## Key API Endpoints
- `POST /api/auth/login` - Authentication
- `POST /api/backup/auto` - Automatic backup
- `GET /api/widget/embed/{theme}/{lead_id}` - amoCRM widget
- `POST /api/widget/save-gifts/{lead_id}` - Save gifts/discounts and regenerate PDF (NEW)
- `POST /api/training/courses` - Create course
- `POST /api/training/progress/{user_id}/{course_id}/lessons/{lesson_id}/complete` - Track progress

## Database Collections
- `users`, `sauna_orders`, `orders` (balia), `greenhouse_orders`
- `training_courses`, `training_lessons`, `training_progress`
- `backups`, `logs`

## User Roles
- `admin` - Full access
- `employee` - Calculator + Training access
- `driver` - Driver panel only
- `warehouse` - Warehouse panel only
- `observer` - View only

## 3rd Party Integrations
- **amoCRM/Kommo**: CRM integration with tags
- **Synthesia.io**: Training video embeds
- **Google Maps**: Route planning
- **Telegram**: Backup notifications

---

## Changelog

### January 19, 2025
- **ADDED**: Manual refresh from amoCRM feature:
  - Backend endpoint `POST /api/integrations/amocrm/refresh_lead/{section}/{amocrm_id}` - refresh single order
  - Backend endpoint `POST /api/integrations/amocrm/refresh_all/{section}` - refresh all orders
  - "Обновить" button in order card amoCRM block - updates single order
  - Global "Обновить" button in header - updates all orders from amoCRM
  - Shows "Обновлено из amoCRM: [date]" when order was last synced

### January 18, 2025
- **FIXED**: Training module visibility for `employee` role on landing page
- **ADDED**: Training card moved to first row on landing page
- **ADDED**: FAQ tab in Training module with categories (Products, Calculator, amoCRM, Objections)
- **ADDED**: Client Objections system:
  - Managers submit objections with question, context, category
  - Admins answer with response + handling script
  - Answered objections appear in FAQ automatically
  - API: `/api/training/objections`

### January 2025 (Previous Sessions)
- Implemented complete Training Module
- Enhanced amoCRM widget
- Fixed backup system
- Added PDF generation with `pdfGenerated` flag

---

## Backlog

### P1 (High Priority)
- [x] ~~Manual refresh from amoCRM~~ (DONE - Jan 19, 2025)
- [x] ~~Sauna option variants system~~ (DONE - Jan 24, 2025)
- [x] ~~Room sizes for sauna models~~ (DONE - Jan 24, 2025)
- [x] ~~Hidden options filtering from summary/PDF~~ (DONE - Jan 28, 2025)
- [x] ~~Model capacity field~~ (DONE - Jan 28, 2025)
- [ ] Verify automatic backup schedule works correctly

### P2 (Medium Priority)
- [ ] UI for backup import/restore
- [ ] Refactor shared components (CalculatorPage, LogisticsPage, SaunaCalculator)
- [ ] Replace deprecated Google Maps Autocomplete
- [ ] Widget height issue (limited by amoCRM iframe constraints)

### P3 (Low Priority)
- [ ] Sauna Lead Statistics feature
- [ ] Fix unstable login sessions
- [ ] Category hint editing dialog fix in sauna pricing admin
- [ ] Sauna hints not saving on user's hosting

---

## Test Credentials
- Admin: `testuser` / `test123`
- Employee: `sauna_employee` / `test123`
