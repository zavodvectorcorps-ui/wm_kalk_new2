"""amoCRM settings API token masking / preservation tests (P0 security).

Covers:
- GET /api/integrations/amocrm/settings must never leak the raw token
- POST /settings with empty token preserves the stored token
- POST /settings with a real token updates it
- POST /settings with a masked-looking token does not overwrite the real token
"""
import os

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")

base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
SETTINGS_URL = f"{BASE_URL}/api/integrations/amocrm/settings"

MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")

SEED_TOKEN = "SECRETTOKEN123456"
NEW_TOKEN = "NEWTOKEN9999"
SEED_DOMAIN = "wm-kalkulator.pl"


@pytest.fixture(scope="module")
def col():
    client = MongoClient(MONGO_URL.strip('"'))
    return client[DB_NAME.strip('"')]["integration_settings"]


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup(col):
    """Restore neutral preview state after tests (no test tokens left behind)."""
    yield
    col.update_one(
        {"type": "amocrm"},
        {"$unset": {"amocrm_token": "", "amocrm_domain": ""}},
    )


def seed(col, token=SEED_TOKEN):
    col.update_one(
        {"type": "amocrm"},
        {"$set": {"amocrm_token": token, "amocrm_domain": SEED_DOMAIN}},
        upsert=True,
    )


def db_token(col):
    doc = col.find_one({"type": "amocrm"}, {"_id": 0, "amocrm_token": 1}) or {}
    return doc.get("amocrm_token")


class TestAmocrmTokenMasking:
    def test_get_does_not_leak_token(self, api, col):
        seed(col)
        r = api.get(SETTINGS_URL)
        assert r.status_code == 200, r.text[:300]
        raw = r.text
        assert SEED_TOKEN not in raw, "RAW TOKEN LEAKED in GET response"
        data = r.json()
        assert data["amocrm_token"] == ""
        assert data["amocrm_token_masked"] == "••••3456"
        assert data["amocrm_token_set"] is True
        assert data["amocrm_domain"] == SEED_DOMAIN

    def test_save_without_token_preserves_it(self, api, col):
        seed(col)
        body = api.get(SETTINGS_URL).json()
        body.pop("webhook_urls", None)
        assert body["amocrm_token"] == ""
        r = api.post(SETTINGS_URL, json=body)
        assert r.status_code == 200, r.text[:300]
        assert db_token(col) == SEED_TOKEN, "Token was wiped/overwritten on empty save"
        # GET still reports it as set
        after = api.get(SETTINGS_URL).json()
        assert after["amocrm_token_set"] is True
        assert after["amocrm_token_masked"] == "••••3456"

    def test_save_with_new_token_updates_it(self, api, col):
        seed(col)
        body = api.get(SETTINGS_URL).json()
        body.pop("webhook_urls", None)
        body["amocrm_token"] = NEW_TOKEN
        body["enabled"] = True
        body["amocrm_domain"] = SEED_DOMAIN
        r = api.post(SETTINGS_URL, json=body)
        assert r.status_code == 200, r.text[:300]
        assert db_token(col) == NEW_TOKEN

        g = api.get(SETTINGS_URL)
        assert NEW_TOKEN not in g.text, "New token leaked in GET response"
        gd = g.json()
        assert gd["amocrm_token"] == ""
        assert gd["amocrm_token_masked"] == "••••9999"
        assert gd["amocrm_token_set"] is True
        assert gd["enabled"] is True
        assert gd["amocrm_domain"] == SEED_DOMAIN

    def test_masked_value_not_saved_as_token(self, api, col):
        seed(col, NEW_TOKEN)
        body = api.get(SETTINGS_URL).json()
        body.pop("webhook_urls", None)
        body["amocrm_token"] = "••••9999"
        r = api.post(SETTINGS_URL, json=body)
        assert r.status_code == 200, r.text[:300]
        assert db_token(col) == NEW_TOKEN, "Masked bullets were stored as the token"

    def test_asterisk_mask_not_saved_and_whitespace_ignored(self, api, col):
        seed(col, NEW_TOKEN)
        body = api.get(SETTINGS_URL).json()
        body.pop("webhook_urls", None)
        body["amocrm_token"] = "****"
        assert api.post(SETTINGS_URL, json=body).status_code == 200
        assert db_token(col) == NEW_TOKEN

        body["amocrm_token"] = "   "
        assert api.post(SETTINGS_URL, json=body).status_code == 200
        assert db_token(col) == NEW_TOKEN

    # --- iteration_120: explicit re-verification of the previously failing case ---
    @pytest.mark.parametrize("masked", ["••••3456", "••••", "•", "****", "*", ""])
    def test_masked_variants_preserve_real_token(self, api, col, masked):
        """Any bullet-containing / all-asterisk / empty token must keep the stored one."""
        seed(col, SEED_TOKEN)
        body = api.get(SETTINGS_URL).json()
        body.pop("webhook_urls", None)
        body["amocrm_token"] = masked
        r = api.post(SETTINGS_URL, json=body)
        assert r.status_code == 200, r.text[:300]
        assert db_token(col) == SEED_TOKEN, f"token destroyed by masked value {masked!r}"
        after = api.get(SETTINGS_URL).json()
        assert after["amocrm_token"] == ""
        assert after["amocrm_token_masked"] == "••••3456"
        assert after["amocrm_token_set"] is True
        assert after["amocrm_domain"] == SEED_DOMAIN

    def test_real_token_still_updates_after_mask_post(self, api, col):
        seed(col, SEED_TOKEN)
        body = api.get(SETTINGS_URL).json()
        body.pop("webhook_urls", None)
        body["amocrm_token"] = "REALNEW777"
        assert api.post(SETTINGS_URL, json=body).status_code == 200
        assert db_token(col) == "REALNEW777"
        g = api.get(SETTINGS_URL)
        assert "REALNEW777" not in g.text
        assert g.json()["amocrm_token_masked"] == "••••W777"
        assert g.json()["amocrm_domain"] == SEED_DOMAIN

    def test_debug_info_does_not_leak_token(self, api, col):
        seed(col)
        r = api.get(f"{BASE_URL}/api/integrations/amocrm/debug-info")
        assert r.status_code == 200, r.text[:300]
        assert SEED_TOKEN not in r.text, "Raw token leaked via /debug-info"
