# WM Kalkulator - PRD (Product Requirements Document)

## Original Problem Statement
A full-featured quoting and order management application for Saunas and Balias (hot tubs). The application allows employees and administrators to configure products, calculate prices, generate PDFs, manage orders, and handle technical specifications.

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

### Session 2 - Refactoring & TechSpec Integration (Current)
- Added TechSpec tab to Admin Panel (5 tabs total)
- Refactored OrdersPage and AdminOrdersPage with shared components:
  - `useOrdersFiltering` hook
  - `OrderFilters` component
  - `OrdersPagination` component
- Code reduction: ~1285 lines → reusable components

## File Structure

```
/app
├── backend/
│   ├── routes/
│   │   ├── auth.py          # User authentication & management
│   │   ├── balia.py         # Balia orders & PDF
│   │   ├── sauna.py         # Sauna orders & PDF
│   │   ├── tech_spec.py     # Tech specs API
│   │   └── statistics.py    # Analytics
│   └── models/
│       └── auth.py          # User models
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
- Super-Admin: `admin` / `159357`
- Regular Admin: `NewAdmin` / `159357`
- Balia Employee: `balia` / `159357`
- Sauna Employee: `sauna` / `159357`
- Observer: `Наблюдатель` / `159357`

## Notes
- User's preferred language: Russian
- Default UI language: Polish (configurable)
- Currency: EUR for Balia, PLN for Sauna
