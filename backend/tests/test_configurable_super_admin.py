"""Regression tests for configurable super-admin username (ADMIN_USERNAME).

Verifies:
- init_admin_user() seeds the user named by ADMIN_USERNAME (default "admin").
- The seeded password matches ADMIN_PASSWORD and role/access are admin/all.
- routes/auth.py privilege checks reference the configured username.
"""
import os
import importlib
import asyncio


def test_seed_custom_super_admin_username():
    os.environ["ADMIN_USERNAME"] = "maxim_unittest"
    os.environ["ADMIN_PASSWORD"] = "375296253180"

    import config
    importlib.reload(config)
    from services import auth_service
    importlib.reload(auth_service)
    from database import db

    async def _run():
        await db.users.delete_one({"username": "maxim_unittest"})
        auth_service._admin_initialized = False
        await auth_service.init_admin_user()
        user = await db.users.find_one({"username": "maxim_unittest"})
        try:
            assert user is not None, "custom super-admin was not seeded"
            assert user["role"] == "admin"
            assert user["access"] == "all"
            assert auth_service.verify_password("375296253180", user["password"])
        finally:
            await db.users.delete_one({"username": "maxim_unittest"})

    asyncio.run(_run())


def test_auth_routes_use_configured_username():
    """Static guard: no leftover hardcoded super-admin username checks."""
    src = open(os.path.join(os.path.dirname(__file__), "..", "routes", "auth.py")).read()
    # The username-gate checks must compare against ADMIN_USERNAME, not "admin".
    assert 'admin.get("username") != "admin"' not in src
    assert 'user.get("username") == "admin"' not in src
    assert "ADMIN_USERNAME" in src


def test_default_username_is_admin():
    os.environ.pop("ADMIN_USERNAME", None)
    import config
    importlib.reload(config)
    assert config.ADMIN_USERNAME == "admin"
