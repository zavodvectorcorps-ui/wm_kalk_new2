# Test Results - Observer Role

## Test Objective
Verify that "Наблюдатель" (Observer) user role works correctly with view-only access to pricing pages.

## Test Cases

### 1. Observer Login
- Login with credentials: Наблюдатель / observer123
- Expected: Successful login with role=observer, access=all

### 2. Access to Calculators
- Observer should be able to access both Balia and Sauna calculators
- Observer should be able to create orders and generate PDFs

### 3. Access to Pricing Pages
- Observer should see "Цены" (Prices) tab in navigation
- Observer should see "Только просмотр" (View only) indicator
- Observer should NOT see Add/Edit/Delete buttons
- Price input fields should be disabled for observer

### 4. Access to Users Management
- Observer should NOT see "Сотрудники" (Users) tab - only admin

## Credentials
- Observer: Наблюдатель / observer123
- Admin: admin / 159357
