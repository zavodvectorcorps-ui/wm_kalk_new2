# Test Credentials

## Preview environment (DB: `test_database`)
- Admin: `admin` / `admin123`
- Test Dealer: `testdealer` / `dealer123` (access via `/dealer` path)

## Production / local-default (backend/.env ADMIN_PASSWORD)
- Admin: `admin` / `159357` (recreated on first startup in fresh DB)
- Storekeeper: `kladovshchik` / `kladovshchik123`
- Marketer: `marketer` / `marketer123`

## Dealer Portal access
- Preview: https://sauna-price-export.preview.emergentagent.com/dealer
- Production after deploy: https://wm-kalkulator.pl/dealer
  (or on separate domain when DNS configured: dealer.wm-kalkulator.pl, wm-dealers.pl, etc.)

Prod DB name: `wm_kalkulator`.
