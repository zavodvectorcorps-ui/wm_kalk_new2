# Test Results

## Features to Test

### 1. Order Full Edit Functionality
- [x] Edit button appears in orders list
- [x] Edit modal opens with order data
- [x] Can modify customer data (name, phone, address)
- [x] Can modify discount percentage
- [ ] Admin can set discount > 10% (changed from 20%)
- [ ] Admin discount approval badge appears when discount > 10%
- [ ] Changes are saved to database
- [ ] Updated order reflects in list

### 2. Admin Discount Approval (Threshold = 10%)
- [ ] Non-admin users limited to 10% discount
- [ ] Admin users can set any discount
- [ ] adminDiscountApproved flag is set when admin sets > 10%
- [ ] Green badge shows "Скидка одобрена администратором"
- [ ] Shield icon appears in orders list for approved discounts

### 3. Admin Gifts Feature
- [ ] Admin can mark options as "gift" in edit modal
- [ ] Gift options display with green highlight and 🎁 badge
- [ ] Gift prices show as 0 but display original crossed out
- [ ] Gift status is saved to database (adminGifts array)
- [ ] Gifts appear in order preview with special styling
- [ ] Gifts appear in PDF with "Prezent" label

### 4. Model Image in PDF
- [ ] Balia PDF includes model image from MongoDB
- [ ] Sauna PDF includes model image from MongoDB
- [ ] Image loads correctly and displays in PDF

### 5. Balia Calculator Discount Limit (max 10%)
- [ ] Calculator limits discount to 10% for regular users
- [ ] Input shows "(max 10)" hint

## Test Instructions
1. Login as admin (admin/159357)
2. Create a test order in Balia calculator with some options
3. Go to Balia > Orders
4. Click edit (pencil icon) on the order
5. Try setting discount to 15% - verify admin approval checkbox appears
6. Mark an option as gift using the 🎁 button
7. Save and verify:
   - Order list shows shield icon for admin discount
   - Preview shows gift with green badge
   - PDF download includes gift with special formatting

## Test Credentials
- Admin: admin / 159357
- Observer: Наблюдатель / 123456
