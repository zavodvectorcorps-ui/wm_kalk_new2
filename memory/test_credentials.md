# Test Credentials

## Preview environment (DB: `test_database`)
- Admin: `admin` / `admin123`
- Test Dealer: `testdealer` / `dealer123` (access via `/dealer` path)
  - Currency: EUR, eurRate: 4.35 (set Feb 2026 for EUR feature testing)

## Production / local-default (backend/.env ADMIN_PASSWORD)
- Admin (production, https://wm-kalkulator.pl): `admin` / `375296253180`
- Admin: `admin` / `159357` (recreated on first startup in fresh DB)

## Configurable super-admin (Jun 2026)
- Super-admin is now identified by a DB flag `superAdmin: true` on the user
  doc (decoupled from username) — so the account can be renamed freely.
- Env var `ADMIN_USERNAME` (default "admin") only controls the bootstrap
  name when seeding a fresh super-admin (no super-admin in DB).
- Startup seeding (`init_admin_user`): if a super-admin exists → no-op; else
  promote an existing user named `ADMIN_USERNAME`; else create one. Prevents
  the old "admin" from resurrecting after rename.
- In-app management (no env/secret changes needed): «Работники» page shows a
  **Super-administrator card** (only for super-admin):
    - rename own login + change own password → `POST /api/auth/super-admin/credentials`
    - **«Выйти на всех устройствах»** → `POST /api/auth/logout-all-devices`
      (sets a global invalidation timestamp; all JWTs with `iat` before it are
      rejected → every device logged out).
- JWTs now carry `iat` + `superAdmin` claims. Global invalidation timestamp
  stored in `db.app_config` doc `_id="auth_invalidation"` (30s in-memory cache).
- To switch super-admin to `maxim` on PRODUCTION (since deploy Secrets can't
  add new keys): redeploy → re-login as admin → in «Работники» rename to
  `maxim` + set password `375296253180` → click «Выйти на всех устройствах».
- Planned production super-admin: `maxim` / `375296253180`.
- Storekeeper: `kladovshchik` / `kladovshchik123`
- Marketer: `marketer` / `marketer123`

## Dealer Portal access
- Preview: https://sauna-prod-suite.preview.emergentagent.com/dealer
- Production after deploy: https://wm-kalkulator.pl/dealer
  (or on separate domain when DNS configured: dealer.wm-kalkulator.pl, wm-dealers.pl, etc.)

Prod DB name: `wm_kalkulator`.
