# Test Results

## Features to Test

### 1. Order Edit Functionality
- [x] Edit button appears in orders list
- [x] Edit modal opens with order data
- [x] Can modify customer data (name, phone, address)
- [x] Can modify discount percentage
- [x] Admin can set discount > 20%
- [ ] Admin discount approval badge appears when discount > 20%
- [ ] Changes are saved to database
- [ ] Updated order reflects in list

### 2. Admin Discount Approval
- [ ] Non-admin users limited to 20% discount
- [ ] Admin users can set any discount
- [ ] adminDiscountApproved flag is set when admin sets > 20%
- [ ] Green badge shows "Скидка одобрена администратором"
- [ ] Shield icon appears in orders list for approved discounts

### 3. Model Image in PDF
- [ ] Balia PDF includes model image
- [ ] Sauna PDF includes model image
- [ ] Image loads from MongoDB storage

## Test Instructions
1. Login as admin (admin/159357)
2. Go to Balia calculator > Orders
3. Click edit (pencil icon) on any order
4. Try setting discount to 25%
5. Verify admin approval checkbox and badge appear
6. Save and verify changes persist
