# WM Kalkulator - PRD (Product Requirements Document)

## Original Problem Statement
A full-featured quoting and order management application for Saunas and Balias (hot tubs). The application allows employees and administrators to configure products, calculate prices, generate PDFs, manage orders, and handle technical specifications.

## Recent Updates (January 2026)

### Logistics Module Enhancements (2026-01-06)
- **Feature**: Enhanced trip management and amoCRM synchronization
- **New Trip Features**:
  - **Departure Date Field**: New date picker in TripDetailsCard to set trip departure date (`departureDate`)
  - **Trip-Order Status Sync**: When trip status changes, all orders in trip are automatically synced:
    - `planned` → `pending`
    - `in_transit` → `delivering`
    - `completed` → `delivered`
  - Status change text: "При изменении статуса рейса обновятся статусы всех заказов"
- **Add Orders to Existing Trips**:
  - **"В рейс" button**: Appears when orders selected AND active trips exist (planned/in_transit)
  - **AddToTripModal**: Shows list of available trips with status badges and order counts
  - Filters: Only shows trips with `planned` or `in_transit` status from current section
  - **Backend endpoint**: `POST /api/trips/{trip_id}/add-orders` - adds orders with trip data sync
- **Trip Data Stored in Orders** (for amoCRM sync):
  - Each order now stores: `tripId`, `tripName`, `tripDriverId`, `tripDriverName`, `tripDepartureDate`, `tripStatus`, `tripOrderStatus`
  - When trip is updated, all orders get updated data
  - amoCRM sync reads data directly from order, not trip
- **New Map Filter**: "Свободные + Рейс" mode showing unassigned orders + selected trip's orders
  - Green markers: Unassigned orders
  - Purple markers: Orders from selected trip
  - Dropdown to select trip in Orders tab
- **New amoCRM Trip Sync Fields** (Integrations → Синхронизация tab):
  - ID поля: Номер рейса (`trip_number_field_id`)
  - ID поля: Водитель (`trip_driver_field_id`)
  - ID поля: Дата отправки (`trip_departure_field_id`)
  - ID поля: Статус заказа в рейсе (`trip_order_status_field_id`)
- **Files Modified**:
  - `/app/frontend/src/components/LogisticsPage.jsx` - TripDetailsCard, OrdersMapCard, AddToTripModal
  - `/app/frontend/src/components/logistics/useLogistics.js` - updateTripStatus, addOrdersToTrip functions
  - `/app/frontend/src/components/IntegrationsPage.jsx` - New trip sync fields in Sync tab
  - `/app/backend/routes/trips.py` - sync_trip_data_to_orders, add_orders_to_trip, amoCRM sync
  - `/app/backend/routes/amocrm.py` - sync-trip endpoint, trip field settings
- **Test Files**: 
  - `/app/tests/test_logistics_enhancements.py` (13 tests)
  - `/app/tests/test_add_orders_to_trip.py` (12 tests)
- **Status**: ✅ Implemented and tested

### amoCRM Calculator Integration (2026-01-05)
- **Feature**: Open calculator from amoCRM lead card with pre-filled customer data
- **Implementation**:
  - URL parameter support: `?calc=balia&amocrm_id=123456` or `?calc=sauna&amocrm_id=123456`
  - New API endpoint: `GET /api/integrations/amocrm/lead/{lead_id}` - fetches lead data for pre-filling
  - New API endpoint: `POST /api/integrations/amocrm/mark-quote-created` - adds note to amoCRM when quote is created
  - Both calculators (Balia & Sauna) updated to accept `amocrmPrefill` prop
  - Orders linked to amoCRM leads with `amocrm_id`, `amocrm_link`, `amocrm_name` fields
- **Files Modified**:
  - `/app/backend/routes/amocrm.py` - New endpoints for lead data and quote marking
  - `/app/frontend/src/App.js` - URL parameter handling and amoCRM data fetching
  - `/app/frontend/src/components/CalculatorPage.jsx` - Balia calculator with amoCRM support
  - `/app/frontend/src/components/SaunaCalculator.jsx` - Sauna calculator with amoCRM support
  - `/app/frontend/src/components/sauna/useSaunaCalculator.js` - Hook updated for amoCRM
- **Documentation**: `/app/memory/AMOCRM_INTEGRATION.md`
- **Status**: ✅ Implemented - Ready for testing with real amoCRM credentials

### SaunaCalculator Refactoring (2026-01-05)
- **Problem**: `SaunaCalculator.jsx` had grown to ~1351 lines
- **Solution**: Extracted state management to custom hook and translations to constants
- **Changes**:
  - Created `useSaunaCalculator.js` hook (~494 lines) with all state and business logic
  - Created `constants.js` (~187 lines) with translations and helpers
  - Reduced `SaunaCalculator.jsx` to ~618 lines (54% reduction)
  - Split into reusable sub-components (CustomerInfoCard, ModelSelectionCard, CategoryCard, etc.)
- **Files Created/Modified**:
  - `/app/frontend/src/components/SaunaCalculator.jsx` - Main component (refactored)
  - `/app/frontend/src/components/sauna/useSaunaCalculator.js` (NEW) - Custom hook
  - `/app/frontend/src/components/sauna/constants.js` (NEW) - Constants and translations
  - `/app/frontend/src/components/sauna/index.js` (NEW) - Exports
- **Status**: ✅ Verified - Calculator working after refactor

### LogisticsPage Refactoring (2026-01-05)
- **Problem**: `LogisticsPage.jsx` had grown to ~2956 lines, making it difficult to maintain
- **Solution**: Extracted state management and business logic to a custom hook
- **Changes**:
  - Created `useLogistics.js` hook (~1300 lines) containing all state and API logic
  - Updated `constants.js` with shared constants and helper functions
  - Reduced `LogisticsPage.jsx` to ~1165 lines (60% reduction)
  - All existing sub-components in `/logistics/` folder now properly utilized
- **Files Modified**:
  - `/app/frontend/src/components/LogisticsPage.jsx` - Main component (refactored)
  - `/app/frontend/src/components/logistics/useLogistics.js` (NEW) - Custom hook
  - `/app/frontend/src/components/logistics/constants.js` - Updated constants
  - `/app/frontend/src/components/logistics/index.js` - Updated exports
- **Status**: ✅ Verified - All features working after refactor (tested with testing agent)

### Google Maps Autocomplete Improvements (2026-01-05)
- **Problem**: Legacy `google.maps.places.Autocomplete` API deprecated for new customers (March 2025)
- **Solution**: 
  - Created shared `initAutocomplete` helper function in `useLogistics.js`
  - Extended country restrictions to include 9 countries (PL, DE, CZ, SK, LT, LV, EE, UA, BY)
  - Improved error handling and cleanup
  - Updated `AddressAutocomplete.jsx` with better loading states
- **Note**: Full migration to `PlaceAutocompleteElement` web component deferred - requires significant UI architecture changes. Current legacy API continues to work for existing customers.
- **Files Modified**:
  - `/app/frontend/src/components/logistics/useLogistics.js` - Added `initAutocomplete` helper
  - `/app/frontend/src/components/AddressAutocomplete.jsx` - Improved component
- **Status**: ✅ Partially complete - Autocomplete working with improved code quality

### Backup System Fix (2026-01-05)
- **Problem**: Backup was missing critical data:
  - Drivers were stored in localStorage (not backed up)
  - amoCRM settings in `integration_settings` collection not exported
  - `webhook_logs` not exported
  - Trips collection not showing when empty (normal behavior)
- **Solution**:
  - Created new Drivers API (`/api/drivers`) for CRUD operations
  - Drivers now stored in MongoDB (`drivers` collection)
  - Updated `LogisticsPage.jsx` to use API instead of localStorage
  - Updated ALL backup functions (export, auto, telegram) to include:
    - `integration_settings` - настройки интеграций
    - `webhook_logs` - логи вебхуков amoCRM
  - Updated import to restore both collections
- **Files Modified**:
  - `/app/backend/routes/drivers.py` (NEW) - Drivers API
  - `/app/backend/routes/backup.py` - Added missing collections to all export functions
  - `/app/backend/server.py` - Added drivers router
  - `/app/frontend/src/components/LogisticsPage.jsx` - Use API for drivers
- **Backup now includes 18 data types**:
  - Заказы: `balia_orders`, `sauna_orders`, `greenhouse_orders`, `web_orders`
  - Логистика: `trips`, `drivers`
  - Цены: `balia_prices`, `sauna_prices`, `tech_spec_config`, `balia_tech_spec_config`, `customer_fields`
  - Пользователи: `users`, `settings`, `integration_settings`, `amocrm_settings`
  - Медиа/логи: `images_collection`, `uploaded_files`, `webhook_logs`, `telegram_config`
- **Status**: ✅ Verified - ALL data backed up for full system restore

### Рейсы (Trips) Feature (2026-01-05)
- **Feature**: Trip management for organizing deliveries - group orders into trips for batch delivery
- **Structure**: Each category (Теплицы, Купели, Сауны) has nested tabs:
  - **Заказы** - Orders without assigned trip
  - **Рейсы** - List of trips with their orders
- **New 3-Column Layout** (2026-01-05):
  - **Left column**: List of trips for current category
  - **Middle column**: Trip details (driver, status, orders with reordering)
  - **Right column**: Interactive map with route visualization
- **Warehouse Settings** (2026-01-05):
  - New "Настройки" (Settings) button in header
  - Configure warehouse address (starting/ending point for all routes)
  - Warehouse shown as **orange marker "С"** on all maps
  - Used as origin and destination when optimizing routes
- **Route Optimization & Reordering**:
  - **Оптимизировать button** - Uses Google Maps Directions API with `optimizeWaypoints: true` to automatically reorder stops for shortest driving route from warehouse
  - **Route info display** - Shows total distance (km) and duration (min)
  - **Arrow buttons (↑↓)** - Move orders up/down in the list one position at a time
  - **Drag & drop** - Drag orders by the grip handle (⋮⋮) to reorder manually
  - **Order numbers** - Show current position (1, 2, 3...) in the delivery sequence
  - **Coordinate indicator** - Shows ✓ (green) for geocoded orders, ? (gray) for orders without map coordinates
- **Trip Creation**:
  - Select orders from the list using checkboxes
  - Click "Создать рейс" button
  - Fill trip name and optionally assign driver
  - Orders disappear from general list and appear in trip
- **Trip Management**:
  - View trip details: driver, status, list of orders
  - Change driver assignment
  - Change status (Активен, Доставлен, Отменён)
  - Remove individual orders from trip (return to general list)
  - Delete entire trip (all orders return to general list)
- **Files**:
  - `/app/frontend/src/components/LogisticsPage.jsx` - UI with nested tabs, 3-column layout, route visualization
  - `/app/backend/routes/trips.py` - Trips API (CRUD operations)
- **API Endpoints**:
  - `GET /api/trips?section=balia` - Get trips by category
  - `POST /api/trips` - Create new trip
  - `PUT /api/trips/{trip_id}` - Update trip (driver, status, orderIds for reordering)
  - `DELETE /api/trips/{trip_id}` - Delete trip
  - `POST /api/trips/{trip_id}/remove-orders` - Remove orders from trip
- **Status**: ✅ Implemented and tested

### Simplified amoCRM Integration (2026-01-05)
- **Feature**: Simplified webhook URLs — one per section, no complex configuration
- **3 Separate URLs**:
  - `/api/integrations/amocrm/webhook/greenhouse` — для Теплиц
  - `/api/integrations/amocrm/webhook/balia` — для Купелей
  - `/api/integrations/amocrm/webhook/sauna` — для Саун
- **Removed**: Secret key, Pipeline ID, Status ID settings (not needed)
- **How it works**: Copy URL, paste into amoCRM Digital Pipeline on desired stage
- **Files updated**:
  - `/app/backend/routes/amocrm.py` - New section-specific endpoints
  - `/app/frontend/src/components/IntegrationsPage.jsx` - Simplified UI with 3 URL cards
- **Status**: ✅ Implemented

### Sauna Pricing - Specyfikacja Tab (2026-01-05)
- **Feature**: Moved "Specyfikacja" from bottom of page to separate tab
- **Tabs now**: Modele saun, Kategorie opcji, Opcje, Specyfikacja, Klient
- **Files**: `/app/frontend/src/components/SaunaPricingPage.jsx`
- **Status**: ✅ Implemented

### Two-Way amoCRM Sync Backend (2026-01-04)
- **Feature**: Backend logic for syncing delivery status back to amoCRM
- **Endpoint**: `POST /api/integrations/amocrm/sync-status` - updates lead in amoCRM
- **Improvements**:
  - Graceful handling when credentials not configured (returns `skipped` status instead of error)
  - All sync attempts logged to `webhook_logs` collection for debugging
  - Frontend handles sync response properly
- **How it works**: When delivery status changes in Logistics, the system automatically sends the new status to amoCRM custom field if API credentials are configured
- **Files updated**:
  - `/app/backend/routes/amocrm.py` - Improved sync-status endpoint
  - `/app/frontend/src/components/LogisticsPage.jsx` - Better sync response handling
- **Status**: ✅ Implemented (requires user to configure amoCRM credentials)

### Delivery Status in Logistics (2026-01-04)
- **Visual Status Badge**: Each order card shows delivery status (Ожидает, Готовится, В пути, Доставлено)
- **Status Change**: Dropdown in expanded card to change status
- **Date/Comment Field**: Input for delivery date or notes
- **amoCRM Sync**: Auto-sync status to amoCRM when changed (if configured)
- **Address Field Fix**: AddressAutocomplete now always shows input even without Google Maps API key
- **Files**: `/app/frontend/src/components/LogisticsPage.jsx`, `/app/frontend/src/components/AddressAutocomplete.jsx`
- **Status**: ✅ Implemented and tested

### amoCRM Integration Enhanced (2026-01-04)
- **Multiple Pipelines**: Separate webhook configs for Теплицы, Купели, Сауны
- **Each section**: Own Pipeline ID, Status ID, Enable/Disable toggle, Test button
- **Sync to amoCRM**: Settings for domain, API token, field IDs for status & comments
- **Moved TechSpec**: Спецификация moved from main menu to Prices→Sauna section
- **Files updated**:
  - `/app/backend/routes/amocrm.py` - Multi-pipeline support, sync API
  - `/app/frontend/src/components/IntegrationsPage.jsx` - 3 tabs: Settings, Sync, Logs
  - `/app/frontend/src/components/AdminPanel.jsx` - 7 tabs, TechSpec inside Prices
- **Status**: ✅ Implemented and tested

### amoCRM Integration (2026-01-04)
- **Feature**: Webhook integration with amoCRM for automatic order creation
- **Endpoint**: `POST /api/integrations/amocrm/webhook` - receives webhooks from amoCRM
- **Settings UI**: New "Интеграции" tab in Admin Panel with:
  - Enable/disable toggle
  - Webhook URL (copy to amoCRM)
  - Secret key for security
  - Pipeline ID and Status ID filters
  - Step-by-step instructions
  - Webhook logs viewer
  - Test order creation button
- **How it works**: When a deal moves to the configured stage in amoCRM, it automatically creates an order in Greenhouse section of Logistics
- **Files**:
  - `/app/backend/routes/amocrm.py` - API endpoints
  - `/app/frontend/src/components/IntegrationsPage.jsx` - Settings UI
  - `/app/frontend/src/components/AdminPanel.jsx` - Added Integrations tab
- **Status**: ✅ Implemented and tested

### Logistics with Three Sections (2026-01-04)
- **Feature**: Split Logistics into three independent sections: Теплицы (Greenhouses), Купели (Balia), Сауны (Sauna)
- **Each section has**: Own orders list, own map markers, own routes
- **Backend**: Created `/api/greenhouse/orders` endpoint for greenhouse orders
- **Files**:
  - `/app/frontend/src/components/LogisticsPage.jsx` - Complete rewrite with tabs
  - `/app/backend/routes/greenhouse.py` - New API for greenhouse orders
  - `/app/backend/server.py` - Registered greenhouse router
- **Google Autocomplete**: Using legacy Autocomplete (still supported, works reliably)
- **Status**: ✅ Implemented and tested

### Logistics as Standalone Section (2026-01-04)
- **Feature**: Moved Logistics from Admin Panel tab to a standalone section on the landing page
- **Access Control**: Added `logistics` as a new access type alongside `balia` and `sauna`
- **User Management**: Updated UI to use checkboxes for granular access control (Balia, Sauna, Logistics)
- **Backend Model**: Updated `UserCreate`/`UserUpdate` to support array of access types
- **Files Modified**:
  - `/app/frontend/src/components/LandingPage.jsx` - Added Logistics card
  - `/app/frontend/src/App.js` - Added Logistics route
  - `/app/frontend/src/components/AdminPanel.jsx` - Removed Logistics tab
  - `/app/frontend/src/components/UserManagement.jsx` - Checkboxes for access control
  - `/app/frontend/src/context/AuthContext.jsx` - Support array access in `hasAccess`
  - `/app/backend/models/auth.py` - Union[str, List[str]] for access field
- **Status**: ✅ Implemented and tested

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
1. **PlaceAutocompleteElement Migration (Optional)**: The new Google API is available but requires `Places API (New)` enabled in Google Cloud. Current legacy Autocomplete still works and is supported. Migration can be done when user enables the new API.

### P2 - Medium Priority
1. **Refactor SaunaCalculator.jsx**: Break down into smaller components (similar to BaliaPricingPage)
   - CustomerInfoCard, ModelSelectionCard, CategoryOptionCard, OrderSummaryCard
2. **Finalize Sauna Lead Statistics Strategy**: Track leads from Telegram group where adding bot is not allowed

### P3 - Low Priority
1. Fix minor dropdown positioning glitch in Balia calculator

## Completed Features (Summary)
- ✅ Two-way amoCRM integration (webhook receive + status sync back)
- ✅ Logistics as standalone section with 3 tabs (Greenhouses, Tubs, Saunas)
- ✅ Advanced order management (status badges, drivers, route numbers, bulk actions)
- ✅ Role-based access control with array permissions
- ✅ BaliaPricingPage refactored (2200→1086 lines)
- ✅ Code optimization with lazy loading

## Test Credentials
- **Super-Admin**: `admin` / `220066`
- **Employee (Balia)**: `balia` / `159357`

## Key API Endpoints
- `GET /api/prices` - Balia prices with models and categories
- `POST /api/prices` - Save Balia prices
- `GET /api/sauna/prices` - Sauna prices
- `POST /api/auth/verify` - Token verification (POST method)
- `DELETE /api/auth/users/{user_id}` - Delete user (super-admin only for admins)
