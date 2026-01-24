# WM Kalkulator - Product Requirements Document

## Original Problem Statement
Comprehensive logistics and sales management system for sauna and hot tub business with calculators, order management, logistics, training modules, and CRM integrations.

## Latest Updates

### Jan 24, 2025 - Sauna Option Variants System (COMPLETED)
- **NEW**: Implemented variant system for sauna options - mutually exclusive choices within an option
- **Feature**: Variants replace base option price (not add to it)
- **Example**: "Ławki 2-poziomowe" option now has variants: "Bez zabudowy" (480 PLN) vs "Z zabudową" (1480 PLN)
- **Backend**: Added `OptionVariant` model in `sauna.py`, kept `SubOption` as alias for backward compatibility
- **Frontend**: Variants display as radio buttons under selected option in `SaunaCalculator.jsx`
- **Admin UI**: Updated `OptionDialog.jsx` with "🔄 Варианты исполнения" section
- **Calculator Logic**: `useSaunaCalculator.js` updated with `handleVariantChange` and `variantSelections` state
- **Tested**: All 6 backend tests passed, frontend flows verified

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
- [ ] Verify automatic backup schedule works correctly

### P2 (Medium Priority)
- [ ] UI for backup import/restore
- [ ] Refactor shared components (CalculatorPage, LogisticsPage)
- [ ] Replace deprecated Google Maps Autocomplete

### P3 (Low Priority)
- [ ] Sauna Lead Statistics feature
- [ ] Fix unstable login sessions
- [ ] Category hint editing dialog fix in sauna pricing admin
- [ ] Sauna hints not saving on user's hosting

---

## Test Credentials
- Admin: `testuser` / `test123`
- Employee: `sauna_employee` / `test123`
