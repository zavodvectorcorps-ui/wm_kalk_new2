# Test Results - Tech Spec Feature

## Testing Scope
Test the new Technical Specification (Тех.Задание) feature for sauna orders.

## Test Cases

### 1. Orders Page - Tech Spec Button
- Navigate to Sauna -> Zamówienia
- Verify "Тех.Задание" button is visible for each order
- Click on "Тех.Задание" button - should open modal

### 2. Tech Spec Modal
- Modal should display order info (client name, phone, model)
- Modal should have form fields for:
  - Comment (internal)
  - Color selections (base, doors, trim, roof)
  - Bench selection with images
  - Shelf size (text input)
  - Stove guard (yes/no)
  - Lighting options (checkbox)
  - Door options
  - Heater selection
  - Additional options
- "Сохранить" button should save the tech spec
- "Создать PDF" button should generate and download PDF

### 3. Tech Spec PDF Generation
- PDF should contain:
  - Title: "Zgłoszenie techniczne - sauna"
  - Client data (name, phone, order number)
  - Model info
  - Selected options from order (without prices, with quantities)
  - Technical selections
  - Comment
  - Date

### 4. Download Existing Tech Spec
- After saving, a download button should appear next to "Тех.Задание"
- Clicking download button should download the saved tech spec PDF

## Credentials
- Admin: admin / 159357
