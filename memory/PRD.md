# WM Kalkulator - PRD (Product Requirements Document)

## Original Problem Statement
A full-featured quoting and order management application for Saunas and Balias (hot tubs). The application allows employees and administrators to configure products, calculate prices, generate PDFs, manage orders, and handle technical specifications.

## Recent Updates (January 2026)

### Logistics Page - Create Order Form (2026-01-04)
- **Feature**: Added "Create Order" form directly in the Logistics page
- **Fields**: Customer name*, Phone, Address* (with Google Places autocomplete), Order composition, Order type (Balia/Sauna)
- **File**: `/app/frontend/src/components/LogisticsPage.jsx`
- **Status**: ✅ Implemented and tested

### Google Maps API Loader Fix (2026-01-04)
- **Issue**: `AddressAutocomplete` component conflicted with `LogisticsPage` due to different library arrays
- **Fix**: Unified Google Maps libraries to `['places', 'geometry']` in both components
- **File**: `/app/frontend/src/components/AddressAutocomplete.jsx`
- **Status**: ✅ Fixed

### Address Field in Balia Calculator (2026-01-04)
- **Verification**: Confirmed that `fullAddress` field with Google Places autocomplete is working in Balia calculator
- **Database**: Field exists with `fieldType: "address"` and `active: true`
- **Status**: ✅ Working

### BaliaPricingPage Refactoring Complete (2026-01-03)
- **Refactored**: `BaliaPricingPage.jsx` reduced from **2200 lines to 1086 lines** (~51% reduction)
- **New Components** in `/app/frontend/src/components/balia-pricing/`:
  - `ModelCard.jsx` (104 lines) - displays model with image, prices, specs
  - `CategoryCard.jsx` (99 lines) - displays category with nested options list
  - `OptionItem.jsx` (47 lines) - displays single option with price and edit buttons
  - `ModelEditDialog.jsx` (431 lines) - full model editor with heater variants and specs
  - `CategoryEditDialog.jsx` (110 lines) - category editor with "Bez" labels support
  - `OptionEditDialog.jsx` (214 lines) - option editor with pricing calculator
  - `BulkPriceEditDialog.jsx` (162 lines) - bulk price change dialog
  - `index.js` - exports all components
- **Benefits**: Better code organization, easier maintenance, improved performance through memoization
- **Status**: ✅ Tested and working

### Code Optimization & Lazy Loading (2026-01-03)
- **Lazy Loading**: Implemented React.lazy() and Suspense for all heavy components
- **Code Splitting**: Main pages are now loaded on demand, reducing initial bundle size
- **Backend Caching**: Added 60-second in-memory cache for `/api/public/prices` endpoint
- **LazyImage**: Created `/app/frontend/src/components/ui/lazy-image.jsx` with image preloading
- **Status**: ✅ Tested and working

### "Bez [category]" Feature for Unselected Options (2026-01-03)
- **Feature**: Unselected options now show "Bez [category name]" instead of "Nie wybrano"
- **Database**: Added `withoutLabelPl` and `withoutLabelRu` fields to category schema
- **Admin UI**: CategoryEditDialog includes editable "Bez..." fields
- **Display**: Price shows "-" for unselected categories
- **Status**: ✅ Implemented

### Category Images in Iframe Calculator (2026-01-03)
- **Feature**: Category images now display in the header of each option section
- **Location**: `/app/frontend/src/components/EmbedBaliaCalculator.jsx`
- **Status**: ✅ Implemented

### PDF Image Handling Improvements (2026-01-03)
- **Base64 Support**: PDF generator now handles Base64-encoded images from web orders
- **Fallback Logic**: If an option has no image, uses the category's image instead
- **File**: `/app/backend/routes/balia.py` - `load_option_image()` function
- **Status**: ⏳ Awaiting user verification

### Critical Bug Fixes (2026-01-03)
- **403 Forbidden on Admin Delete**: Super-admins can now delete other admin users
- **Observer Auto-Recreation**: Removed automatic creation of observer user on init
- **405 Method Not Allowed**: Fixed `/api/auth/verify` by changing frontend to use POST
- **Status**: ✅ All fixed

## Core Features

### 1. Calculator Pages
- **Balia Calculator**: Configure hot tubs with models, options, and accessories
- **Sauna Calculator**: Configure saunas with models, benches, and equipment
- Both support customer info forms, pricing, discounts, and PDF generation

### 2. Admin Panel (Unified Administration)
- **Orders Tab**: Unified view of all Balia and Sauna orders
- **Statistics Tab**: Analytics with filters by project type
- **Prices Tab**: Manage models, categories, and options pricing
- **TechSpec Tab**: Manage technical specifications
- **Employees Tab**: User management with role-based access

### 3. Role-Based Access Control
- **Super-Admin** (`admin`): Can assign Administrator role to other users
- **Administrator**: Full access to all features except assigning admin role
- **Employee**: Access to assigned calculator (Balia or Sauna)
- **Observer**: Read-only access

### 4. Order Management
- Full order editing via calculator
- PDF generation with images
- Excel export for production
- Web orders from iframe widget

## Code Architecture

```
/app/frontend/src/components/
├── balia-pricing/           # Refactored components
│   ├── ModelCard.jsx
│   ├── CategoryCard.jsx
│   ├── OptionItem.jsx
│   ├── ModelEditDialog.jsx
│   ├── CategoryEditDialog.jsx
│   ├── OptionEditDialog.jsx
│   ├── BulkPriceEditDialog.jsx
│   └── index.js
├── BaliaPricingPage.jsx     # Main page (1086 lines)
├── SaunaCalculator.jsx      # Sauna calculator (1342 lines)
├── CalculatorPage.jsx       # Balia calculator
├── EmbedBaliaCalculator.jsx # Iframe widget
└── ui/                      # UI components
```

## Upcoming Tasks (Prioritized)

### P1 - High Priority
1. **Migrate Google Autocomplete**: Update `AddressAutocomplete.jsx` to use `PlaceAutocompleteElement` (deprecated warning)

### P2 - Medium Priority
1. **Refactor SaunaCalculator.jsx**: Break down into smaller components (similar to BaliaPricingPage)
   - CustomerInfoCard, ModelSelectionCard, CategoryOptionCard, OrderSummaryCard
2. **Finalize Sauna Lead Statistics Strategy**: Track leads from Telegram group where adding bot is not allowed

### P3 - Low Priority
1. Fix minor dropdown positioning glitch in Balia calculator

## Test Credentials
- **Super-Admin**: `admin` / `220066`
- **Employee (Balia)**: `balia` / `159357`

## Key API Endpoints
- `GET /api/prices` - Balia prices with models and categories
- `POST /api/prices` - Save Balia prices
- `GET /api/sauna/prices` - Sauna prices
- `POST /api/auth/verify` - Token verification (POST method)
- `DELETE /api/auth/users/{user_id}` - Delete user (super-admin only for admins)
