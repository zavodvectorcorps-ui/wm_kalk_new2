# WM Kalkulator - PRD (Product Requirements Document)

## Original Problem Statement
A full-featured quoting and order management application for Saunas and Balias (hot tubs). The application allows employees and administrators to configure products, calculate prices, generate PDFs, manage orders, and handle technical specifications.

## Recent Updates (January 2026)

### Category/Option Reordering Feature (2026-01-02)
- **Feature**: Added up/down arrow buttons to reorder categories and options in admin panel
- **Location**: BaliaPricingPage.jsx - Kategorie tab
- **Functions**: `handleMoveCategory()`, `handleMoveOption()`
- **UI**: ChevronUp/ChevronDown buttons, position numbers (#1, #2...)
- **Status**: ✅ Tested and working

### Bug Fix: Bowl Material and Color Categories Not Displaying (2026-01-02)
- **Issue**: Categories `bowl_material`, `fiberglass_color`, `acrylic_color` were not appearing on production domain
- **Root Cause**: New categories in `balia_defaults.py` were not merged into existing database records
- **Solution**: Added auto-merge logic in `GET /api/prices` to add missing categories from defaults and save to DB
- **File**: `/app/backend/routes/balia.py` (lines 46-63)
- **Status**: ✅ Fixed and tested

## Core Features

### 1. Calculator Pages
- **Balia Calculator**: Configure hot tubs with models, options, and accessories
- **Sauna Calculator**: Configure saunas with models, benches, and equipment
- Both support customer info forms, pricing, discounts, and PDF generation

### 2. Admin Panel (Unified Administration)
- **Orders Tab**: Unified view of all Balia and Sauna orders with:
  - Type filtering (Balia/Sauna)
  - Search by order number, name, or phone
  - Date range filtering
  - Pagination (10 orders per page)
  - Edit, preview, download PDF, delete actions
- **Statistics Tab**: Analytics with filters by project type
- **Prices Tab**: Manage models, categories, and options pricing
- **TechSpec Tab**: Manage technical specifications with project type selector (Sauna/Balia)
- **Employees Tab**: User management with role-based access

### 3. Role-Based Access Control
- **Super-Admin** (`admin`): Can assign Administrator role to other users
- **Administrator**: Full access to all features except assigning admin role
- **Employee**: Access to assigned calculator (Balia or Sauna)
- **Observer**: Read-only access

### 4. Order Management
- Full order editing via calculator
- Quick edit modal for admins (discount, gifts)
- Discount request/approval workflow
- Admin gifts feature (price = 0 for items)
- PDF generation with optimized images

### 5. Technical Specifications
- Master categories management (separate for Sauna and Balia)
- Subcategories with various input types
- Options with images and hints
- Tech spec modal for orders
- Separate MongoDB collections: `tech_spec_config` (Sauna), `balia_tech_spec_config` (Balia)

## Tech Stack
- **Frontend**: React with Shadcn/UI, TailwindCSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Styling**: Custom components, responsive design

## Recent Updates (January 2025)

### Session 1 - Admin Panel & Role Management
- Created dedicated Admin Panel with 4 tabs
- Implemented super-admin system
- Added comprehensive orders filtering/pagination
- PDF filename format: `{TYPE}_{ClientName}_{OrderID}.pdf`
- Image lazy loading and PDF compression

### Session 2 - Refactoring & TechSpec Integration
- Added TechSpec tab to Admin Panel (5 tabs total)
- Added project type selector (Sauna/Balia) to TechSpec tab
- Created backend for Balia tech specs (`/api/balia-tech-spec`)
- Refactored OrdersPage and AdminOrdersPage with shared components:
  - `useOrdersFiltering` hook
  - `OrderFilters` component
  - `OrdersPagination` component
- Code reduction: ~1285 lines → reusable components

### Session 3 - Balia Model Structure Overhaul & Bug Fixes (2 Jan 2025)
- **Major**: Rearchitected Balia product selection in calculator and admin panel
  - Models now have "heater variants" (integrated/external), each with own price, image, and hint
  - Added `HeaterVariant` class to `/app/backend/models/balia.py`
  - Updated `ModelEditDialog` in `BaliaPricingPage.jsx` for variant editing
- **Feature**: Added bulk price editing for Balia models
  - Change all prices by percentage (+10%, -5%) or absolute amount (+100 EUR)
  - Apply to all variants, only integrated, or only external heaters
  - UI: Orange "Массовое изменение цен" button in Models tab header
- **Feature**: Added specifications editing for Balia models
  - Edit: outerDiameter, innerDiameter, dimensions, depth, volume, seats, totalHeight, heaterPower, weight
  - Specs displayed in model cards with emoji indicators (📐📏💧👥)
  - Blue "Спецификации" section in model edit dialog
- **Feature**: Added model specs to PDF generation
  - PDF now shows: Średnica zewnętrzna, Średnica wewnętrzna, Wymiary, Głębokość, Pojemność, Ilość miejsc, Wysokość, Moc pieca, Waga
  - Specs displayed in Polish language under model name
- **Feature**: Added hint/hintPl fields for options editing
  - OptionEditDialog now has "Подсказка (RU)" and "Podpowiedź (PL)" fields
  - Allows describing options to help customers understand features
- **Feature**: Changed currency from EUR to PLN (Polish złoty)
  - Currency symbol: zł
  - All prices now displayed in PLN
- **Feature**: Added EUR→PLN pricing calculation system
  - Settings: EUR exchange rate (eurRate), default markup percent (defaultMarkupPercent)
  - Model variants: purchasePriceEur, markupPercent per heater variant
  - **Options**: purchasePriceEur, markupPercent per option (same system)
  - Formula: Закупка (EUR) × Курс × (1 + Наценка%) = Розничная цена (PLN)
  - "Пересчитать все цены" button recalculates both models AND options
  - **NBP Rate Hint**: Shows current EUR/PLN rate from Narodowy Bank Polski with "применить" button
  - Example: 300 EUR × 4.30 × 1.30 = 1677 PLN
- **Feature**: Added bowl material category with dependent colors (2 Jan 2025)
  - bowl_material category with options: Глассфайбер (fiberglass) and Акрил (acrylic)
  - fiberglass_color: 15 colors (WHITE, IVORY, BLUE, GRAY, PEARL variants, GALAXY, SNOWFLAKE, EMERALD, BLACK GLITTER variants)
  - acrylic_color: 7 colors (White, Green/Brown/Blue/White/Coffee/Black Marble)
  - Dependent categories: dependsOn + dependsOnValue fields control visibility
  - Color selection resets when material changes; hidden categories excluded from price calculation
- **Feature**: Color preview system (2 Jan 2025)
  - colorPreview field (HEX) for options with visual preview
  - Color picker in OptionEditDialog for easy color selection
  - Special CSS effects in calculator: glitter gradients, marble texture, pearl shimmer, galaxy stars, snowflake frost
- **Bug Fix**: Fixed OptionEditDialog scroll (added max-h-[90vh] overflow-y-auto)
- **Feature**: Excel Export/Import for price list (2 Jan 2025)
  - Export: Downloads `cennik_balia_YYYY-MM-DD.xlsx` with 3 sheets
    - Modele: ID, names, heater type, purchase EUR, markup %, price PLN, color HEX
    - Opcje: category, option, names, purchase EUR, markup %, price PLN, color HEX
    - Ustawienia: currency, symbol, EUR rate, default markup %
  - Import: Uploads Excel, updates prices in DB, shows success counts
  - UI: Green section in Settings tab with Export/Import buttons
- **Feature**: Production Excel generator for Balia orders (2 Jan 2025)
  - POST /api/generate-production-excel - generates Excel from template
  - Template at /app/backend/templates/production_template.xlsx
  - Marks selected options with X in corresponding cells:
    - Heater type: B10 (external), C10 (integrated)
    - Fiberglass colors: D10-R10
    - Acrylic colors: V10-AB10
    - Models: Y16-AD16
    - Accessories: B16-V16
    - Customer data: B2 (name), B4 (address), B18 (notes)
  - "Pobierz techniczny" button in OrdersPage downloads Excel for Balia orders
  - "Excel" button in AdminOrdersPage for Balia orders
- **Bug Fix**: Fixed 422 Unprocessable Content error when saving Balia prices
  - Root cause: Pydantic models didn't support heaterVariants array and string specs
  - Fix: Added flexible types (Any) to ModelSpec, ConfigDict(extra="allow") to BaliaModel
- **Bug Fix**: Fixed order duplication when editing (was creating new instead of updating)
- **Bug Fix**: Fixed 404 error when saving edited Sauna orders from Admin Panel
- **Bug Fix**: Fixed "0" appearing in total price column on orders page
- **Bug Fix**: Fixed discount amount input stuck in calculation loop
- **Security**: Changed super-admin password from `159357` to `220066`

## File Structure

```
/app
├── backend/
│   ├── routes/
│   │   ├── auth.py              # User authentication & management
│   │   ├── balia.py             # Balia orders & PDF
│   │   ├── sauna.py             # Sauna orders & PDF
│   │   ├── tech_spec.py         # Sauna tech specs API
│   │   ├── balia_tech_spec.py   # Balia tech specs API (NEW)
│   │   └── statistics.py        # Analytics
│   └── models/
│       └── auth.py              # User models
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AdminPanel.jsx         # Main admin container
│       │   ├── AdminOrdersPage.jsx    # Unified orders (refactored)
│       │   ├── OrdersPage.jsx         # Single-type orders (refactored)
│       │   ├── TechSpecAdminPage.jsx  # Tech specs management
│       │   ├── orders/                # Shared components
│       │   │   ├── OrderFilters.jsx
│       │   │   └── OrdersPagination.jsx
│       │   └── ...
│       └── hooks/
│           └── useOrdersFiltering.js  # Shared filtering logic
└── memory/
    └── PRD.md
```

## Backlog

### P0 (High Priority)
- None currently

### P1 (Medium Priority)
- Refactor `SaunaCalculator.jsx` - break into smaller components (~1342 lines)

### P2 (Low Priority)
- Minor dropdown positioning in Balia calculator (not reproducible)

## Test Credentials
- Super-Admin: `admin` / `220066` (password changed 2 Jan 2025)
- Regular Admin: `NewAdmin` / `159357`
- Balia Employee: `balia` / `159357`
- Sauna Employee: `sauna` / `159357`
- Observer: `Наблюдатель` / `159357`

## Notes
- User's preferred language: Russian
- Default UI language: Polish (configurable)
- Currency: EUR for Balia, PLN for Sauna
