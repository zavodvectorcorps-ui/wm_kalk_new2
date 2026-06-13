# Test Credentials

## Preview environment (DB: `test_database`)
- Admin: `admin` / `admin123`
- Test Dealer: `testdealer` / `dealer123` (access via `/dealer` path)
  - Currency: EUR, eurRate: 4.35 (set Feb 2026 for EUR feature testing)

## Production / local-default (backend/.env ADMIN_PASSWORD)
- Admin (production, https://wm-kalkulator.pl): `admin` / `375296253180`
- Admin: `admin` / `159357` (recreated on first startup in fresh DB)

## Configurable super-admin (Jun 2026)
- New env var `ADMIN_USERNAME` (default "admin") controls the bootstrap
  super-admin username. On startup the system seeds a user named
  `ADMIN_USERNAME` with password `ADMIN_PASSWORD`, role=admin, access=all.
- To switch the super-admin to `maxim` on PRODUCTION, set in deploy env:
  `ADMIN_USERNAME=maxim`, `ADMIN_PASSWORD=375296253180`, and a NEW
  `JWT_SECRET` (any new random string — this force-logs-out all devices),
  then redeploy. After deploy the old `admin` user can be deleted from the
  «Работники» UI (no longer protected; won't be re-seeded).
- Planned production super-admin: `maxim` / `375296253180`.
- Storekeeper: `kladovshchik` / `kladovshchik123`
- Marketer: `marketer` / `marketer123`

## Dealer Portal access
- Preview: https://sauna-prod-suite.preview.emergentagent.com/dealer
- Production after deploy: https://wm-kalkulator.pl/dealer
  (or on separate domain when DNS configured: dealer.wm-kalkulator.pl, wm-dealers.pl, etc.)

Prod DB name: `wm_kalkulator`.
