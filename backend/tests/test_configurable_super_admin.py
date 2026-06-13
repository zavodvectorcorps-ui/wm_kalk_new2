"""Regression tests for configurable super-admin username (ADMIN_USERNAME).

Verifies:
- init_admin_user() seeds the user named by ADMIN_USERNAME (default "admin").
- The seeded password matches ADMIN_PASSWORD and role/access are admin/all.
- routes/auth.py privilege checks reference the configured username.
"""
import os
import importlib
import asyncio

# Motor's db client binds to the first event loop it runs on. Using a single
# persistent loop for the whole module avoids "Event loop is closed" errors
# that occur when each test calls asyncio.run() (which closes its own loop).
_LOOP = asyncio.new_event_loop()


def _run(coro):
    return _LOOP.run_until_complete(coro)


def test_seed_creates_fresh_super_admin_when_none_exists():
    """When NO super-admin exists, init creates one named ADMIN_USERNAME."""
    os.environ["ADMIN_USERNAME"] = "maxim_unittest"
    os.environ["ADMIN_PASSWORD"] = "375296253180"

    import config
    importlib.reload(config)
    from services import auth_service
    importlib.reload(auth_service)
    from database import db

    async def _run_coro():
        # Snapshot & temporarily clear all super-admin flags so init has to seed.
        existing = await db.users.find({"superAdmin": True}, {"id": 1}).to_list(50)
        existing_ids = [u["id"] for u in existing]
        await db.users.update_many({"superAdmin": True}, {"$set": {"superAdmin": False}})
        await db.users.delete_one({"username": "maxim_unittest"})
        auth_service._admin_initialized = False
        try:
            await auth_service.init_admin_user()
            user = await db.users.find_one({"username": "maxim_unittest"})
            assert user is not None, "fresh super-admin was not seeded"
            assert user["role"] == "admin"
            assert user["access"] == "all"
            assert user.get("superAdmin") is True
            assert auth_service.verify_password("375296253180", user["password"])
        finally:
            await db.users.delete_one({"username": "maxim_unittest"})
            # Restore the real super-admin flag(s)
            if existing_ids:
                await db.users.update_many({"id": {"$in": existing_ids}}, {"$set": {"superAdmin": True}})

    _run(_run_coro())


def test_auth_routes_use_super_admin_flag():
    """Static guard: super-admin gating uses the DB flag, not a hardcoded name."""
    src = open(os.path.join(os.path.dirname(__file__), "..", "routes", "auth.py")).read()
    assert 'admin.get("username") != "admin"' not in src
    assert 'user.get("username") == "admin"' not in src
    assert 'admin.get("username") != ADMIN_USERNAME' not in src
    assert 'not admin.get("superAdmin")' in src
    assert "logout-all-devices" in src


def test_default_username_is_admin():
    os.environ.pop("ADMIN_USERNAME", None)
    import config
    importlib.reload(config)
    assert config.ADMIN_USERNAME == "admin"


def test_seed_promotes_legacy_admin_and_token_claims():
    """When no super-admin exists, a legacy ADMIN_USERNAME user is promoted;
    issued tokens carry superAdmin + iat claims."""
    os.environ["ADMIN_USERNAME"] = "legacy_admin_ut"
    os.environ["ADMIN_PASSWORD"] = "pw12345"
    import config
    importlib.reload(config)
    from services import auth_service
    importlib.reload(auth_service)
    from database import db

    async def _run_coro():
        existing = await db.users.find({"superAdmin": True}, {"id": 1}).to_list(50)
        existing_ids = [u["id"] for u in existing]
        await db.users.update_many({"superAdmin": True}, {"$set": {"superAdmin": False}})
        await db.users.delete_many({"username": "legacy_admin_ut"})
        await db.users.insert_one({
            "id": "legacy-ut-id", "username": "legacy_admin_ut",
            "password": auth_service.hash_password("pw12345"),
            "role": "admin", "access": "all",
            "createdAt": "2026-01-01T00:00:00+00:00",
        })
        auth_service._admin_initialized = False
        try:
            await auth_service.init_admin_user()
            promoted = await db.users.find_one({"id": "legacy-ut-id"})
            assert promoted.get("superAdmin") is True, "legacy admin not promoted"
            tok = auth_service.create_token(promoted)
            payload = auth_service.decode_token(tok)
            assert payload.get("superAdmin") is True
            assert "iat" in payload
        finally:
            await db.users.delete_one({"id": "legacy-ut-id"})
            if existing_ids:
                await db.users.update_many({"id": {"$in": existing_ids}}, {"$set": {"superAdmin": True}})

    _run(_run_coro())


def test_global_token_invalidation_roundtrip():
    import config
    importlib.reload(config)
    from services import auth_service
    importlib.reload(auth_service)

    async def _run_coro():
        import time
        before = await auth_service.get_tokens_invalid_before()
        assert isinstance(before, int)
        ts = int(time.time()) + 5
        await auth_service.set_tokens_invalid_before(ts)
        assert await auth_service.get_tokens_invalid_before() == ts
        # reset to 0 so preview sessions are not left invalidated by the test
        await auth_service.set_tokens_invalid_before(0)
        assert await auth_service.get_tokens_invalid_before() == 0

    _run(_run_coro())
