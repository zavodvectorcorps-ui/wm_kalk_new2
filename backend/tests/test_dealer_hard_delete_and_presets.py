"""Tests for iteration 97 features:
  1. Hard-delete dealer with cascade options
  2. Dealer markup presets CRUD + apply
  3. Auth/edge cases for hard-delete

Run with REACT_APP_BACKEND_URL set to the preview URL.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
pytestmark = pytest.mark.skipif(not BASE, reason="REACT_APP_BACKEND_URL not set")


# -------- helpers --------

def _admin_token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"username": "admin", "password": "admin123"},
                      timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _dealer_token(username: str, password: str):
    r = requests.post(f"{BASE}/api/dealer/auth/login",
                      json={"username": username, "password": password},
                      timeout=15)
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_admin_token()}"}


@pytest.fixture(scope="module")
def testdealer_headers():
    return {"Authorization": f"Bearer {_dealer_token('testdealer', 'dealer123')}"}


def _make_dealer(admin_headers, suffix="hd"):
    username = f"test_{suffix}_{uuid.uuid4().hex[:6]}"
    pw = "x12345678"
    r = requests.post(f"{BASE}/api/admin/dealers", headers=admin_headers,
                      json={"username": username, "password": pw,
                            "name": f"TEST {suffix.upper()}"}, timeout=15)
    r.raise_for_status()
    did = r.json()["id"]
    return did, username, pw


# =====================================================================
# Hard-delete dealer
# =====================================================================
class TestHardDeleteDealer:

    def test_hard_delete_empty_dealer(self, admin_headers):
        did, _, _ = _make_dealer(admin_headers, "hd1")
        r = requests.delete(
            f"{BASE}/api/admin/dealers/{did}/hard-delete",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["dealerDeleted"] is True
        assert body["overridesDeleted"] == 0
        assert body["presetsDeleted"] == 0
        assert body["ordersDeleted"] == 0
        assert body["confirmedOrdersArchived"] == 0
        # GET again -> 404 from soft delete endpoint (dealer is gone)
        r2 = requests.delete(
            f"{BASE}/api/admin/dealers/{did}/hard-delete",
            headers=admin_headers, timeout=15,
        )
        assert r2.status_code == 404

    def test_hard_delete_cascades_overrides_and_presets(self, admin_headers):
        did, uname, pw = _make_dealer(admin_headers, "hd2")
        dtoken = _dealer_token(uname, pw)
        dhdr = {"Authorization": f"Bearer {dtoken}"}

        # Add an override (admin-side)
        rput = requests.put(
            f"{BASE}/api/admin/dealers/{did}/overrides",
            headers=admin_headers,
            json={"overrides": [{
                "dealerId": did, "kind": "model",
                "modelId": "sauna_kwadro_beczka_235x200_cm", "price": 12345,
            }]}, timeout=15,
        )
        assert rput.status_code == 200, rput.text
        # Add a preset (dealer-side)
        requests.post(
            f"{BASE}/api/dealer/markup-presets", headers=dhdr,
            json={"name": "TEST preset", "percent": 10, "base": "b2b", "scope": "all"},
            timeout=15,
        )

        r = requests.delete(
            f"{BASE}/api/admin/dealers/{did}/hard-delete",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["dealerDeleted"] is True
        assert body["overridesDeleted"] >= 1
        assert body["presetsDeleted"] >= 1

    def test_hard_delete_archives_confirmed_orders_by_default(self, admin_headers):
        did, uname, pw = _make_dealer(admin_headers, "hd3")
        dtoken = _dealer_token(uname, pw)
        dhdr = {"Authorization": f"Bearer {dtoken}"}

        # Create a confirmed dealer order
        order_payload = {
            "client": "TEST_HD3_Client", "phone": "+48000000000", "email": "",
            "model": "sauna_kwadro_beczka_235x200_cm", "modelVariant": "",
            "configuration": {}, "options": [], "total": 1000,
        }
        ro = requests.post(f"{BASE}/api/dealer/sauna/orders",
                           headers=dhdr, json=order_payload, timeout=15)
        assert ro.status_code == 200, ro.text
        oid = ro.json().get("id") or ro.json().get("order", {}).get("id")
        assert oid
        rc = requests.post(f"{BASE}/api/dealer/sauna/orders/{oid}/confirm",
                           headers=dhdr,
                           json={"clientConfirmed": True,
                                 "dealerContractNumber": f"TEST-{uuid.uuid4().hex[:6]}"},
                           timeout=15)
        assert rc.status_code == 200, rc.text

        # Hard-delete WITHOUT delete_confirmed
        r = requests.delete(
            f"{BASE}/api/admin/dealers/{did}/hard-delete",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["confirmedOrdersArchived"] >= 1
        assert body["ordersDeleted"] == 0  # confirmed not counted as deleted

        # Order should still exist with dealerDeleted=true (via admin orders list)
        rg = requests.get(f"{BASE}/api/sauna/orders/{oid}",
                          headers=admin_headers, timeout=15)
        if rg.status_code == 200:
            d = rg.json()
            assert d.get("dealerDeleted") is True
            assert d.get("deletedDealerName")

    def test_hard_delete_full_cascade_with_delete_confirmed(self, admin_headers):
        did, uname, pw = _make_dealer(admin_headers, "hd4")
        dtoken = _dealer_token(uname, pw)
        dhdr = {"Authorization": f"Bearer {dtoken}"}

        order_payload = {
            "client": "TEST_HD4_Client", "phone": "+48000000000", "email": "",
            "model": "sauna_kwadro_beczka_235x200_cm", "modelVariant": "",
            "configuration": {}, "options": [], "total": 1500,
        }
        ro = requests.post(f"{BASE}/api/dealer/sauna/orders",
                           headers=dhdr, json=order_payload, timeout=15)
        oid = ro.json().get("id") or ro.json().get("order", {}).get("id")
        rc = requests.post(f"{BASE}/api/dealer/sauna/orders/{oid}/confirm",
                           headers=dhdr,
                           json={"clientConfirmed": True,
                                 "dealerContractNumber": f"TEST-{uuid.uuid4().hex[:6]}"},
                           timeout=15)
        assert rc.status_code == 200

        r = requests.delete(
            f"{BASE}/api/admin/dealers/{did}/hard-delete?delete_confirmed=true",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ordersDeleted"] >= 1
        assert body["confirmedOrdersArchived"] == 0

        # Order should now be gone
        rg = requests.get(f"{BASE}/api/sauna/orders/{oid}",
                          headers=admin_headers, timeout=15)
        assert rg.status_code in (404, 400)

    def test_hard_delete_404_for_unknown_dealer(self, admin_headers):
        r = requests.delete(
            f"{BASE}/api/admin/dealers/nonexistent-id-{uuid.uuid4()}/hard-delete",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 404

    def test_hard_delete_requires_admin_auth(self):
        r = requests.delete(
            f"{BASE}/api/admin/dealers/some-id/hard-delete", timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_hard_delete_rejects_dealer_token(self, testdealer_headers):
        r = requests.delete(
            f"{BASE}/api/admin/dealers/some-id/hard-delete",
            headers=testdealer_headers, timeout=15,
        )
        assert r.status_code in (401, 403)


# =====================================================================
# Dealer markup presets
# =====================================================================
class TestMarkupPresets:

    @pytest.fixture(scope="class")
    def ephemeral_dealer(self, admin_headers):
        did, uname, pw = _make_dealer(admin_headers, "pre")
        dtoken = _dealer_token(uname, pw)
        yield {"id": did, "token": dtoken,
               "hdr": {"Authorization": f"Bearer {dtoken}"}}
        # cleanup
        requests.delete(
            f"{BASE}/api/admin/dealers/{did}/hard-delete?delete_confirmed=true",
            headers=admin_headers, timeout=15,
        )

    def test_list_empty(self, ephemeral_dealer):
        r = requests.get(f"{BASE}/api/dealer/markup-presets",
                         headers=ephemeral_dealer["hdr"], timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json().get("presets", None), list)

    def test_create_preset_ok(self, ephemeral_dealer):
        r = requests.post(f"{BASE}/api/dealer/markup-presets",
                          headers=ephemeral_dealer["hdr"],
                          json={"name": "+15% ekonom", "percent": 15,
                                "base": "b2b", "scope": "all"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "+15% ekonom"
        assert d["percent"] == 15
        assert d["base"] == "b2b"
        assert d["scope"] == "all"
        assert d["dealerId"] == ephemeral_dealer["id"]
        assert "id" in d
        # Verify via list
        rl = requests.get(f"{BASE}/api/dealer/markup-presets",
                          headers=ephemeral_dealer["hdr"], timeout=15)
        ids = [p["id"] for p in rl.json()["presets"]]
        assert d["id"] in ids

    def test_create_validation_empty_name(self, ephemeral_dealer):
        r = requests.post(f"{BASE}/api/dealer/markup-presets",
                          headers=ephemeral_dealer["hdr"],
                          json={"name": "  ", "percent": 5,
                                "base": "b2b", "scope": "all"}, timeout=15)
        assert r.status_code == 400

    def test_create_validation_invalid_percent(self, ephemeral_dealer):
        r = requests.post(f"{BASE}/api/dealer/markup-presets",
                          headers=ephemeral_dealer["hdr"],
                          json={"name": "bad", "percent": "abc",
                                "base": "b2b", "scope": "all"}, timeout=15)
        assert r.status_code == 400

    def test_create_validation_invalid_base(self, ephemeral_dealer):
        r = requests.post(f"{BASE}/api/dealer/markup-presets",
                          headers=ephemeral_dealer["hdr"],
                          json={"name": "bad", "percent": 5,
                                "base": "xx", "scope": "all"}, timeout=15)
        assert r.status_code == 400

    def test_create_validation_invalid_scope(self, ephemeral_dealer):
        r = requests.post(f"{BASE}/api/dealer/markup-presets",
                          headers=ephemeral_dealer["hdr"],
                          json={"name": "bad", "percent": 5,
                                "base": "b2b", "scope": "yy"}, timeout=15)
        assert r.status_code == 400

    def test_delete_preset_ok(self, ephemeral_dealer):
        r = requests.post(f"{BASE}/api/dealer/markup-presets",
                          headers=ephemeral_dealer["hdr"],
                          json={"name": "to-delete", "percent": 5,
                                "base": "wm", "scope": "models"}, timeout=15)
        pid = r.json()["id"]
        rd = requests.delete(f"{BASE}/api/dealer/markup-presets/{pid}",
                             headers=ephemeral_dealer["hdr"], timeout=15)
        assert rd.status_code == 200
        # second delete -> 404
        rd2 = requests.delete(f"{BASE}/api/dealer/markup-presets/{pid}",
                              headers=ephemeral_dealer["hdr"], timeout=15)
        assert rd2.status_code == 404

    def test_delete_preset_of_other_dealer_404(self, admin_headers, ephemeral_dealer, testdealer_headers):
        # Create preset on ephemeral dealer
        r = requests.post(f"{BASE}/api/dealer/markup-presets",
                          headers=ephemeral_dealer["hdr"],
                          json={"name": "isolation", "percent": 5,
                                "base": "b2b", "scope": "all"}, timeout=15)
        pid = r.json()["id"]
        # Try to delete from testdealer's token
        rd = requests.delete(f"{BASE}/api/dealer/markup-presets/{pid}",
                             headers=testdealer_headers, timeout=15)
        assert rd.status_code == 404, "preset must not be deletable by foreign dealer"

    def test_apply_preset_invokes_bulk_markup(self, ephemeral_dealer, admin_headers):
        # Seed B2B override so bulk-markup has something to multiply
        requests.put(
            f"{BASE}/api/admin/dealers/{ephemeral_dealer['id']}/overrides",
            headers=admin_headers,
            json={"overrides": [{
                "dealerId": ephemeral_dealer["id"], "kind": "model",
                "modelId": "sauna_kwadro_beczka_235x200_cm", "price": 10000,
            }]}, timeout=15,
        )
        # Create preset
        rp = requests.post(f"{BASE}/api/dealer/markup-presets",
                           headers=ephemeral_dealer["hdr"],
                           json={"name": "apply-test", "percent": 20,
                                 "base": "b2b", "scope": "models"}, timeout=15)
        pid = rp.json()["id"]
        # Apply
        ra = requests.post(f"{BASE}/api/dealer/markup-presets/{pid}/apply",
                           headers=ephemeral_dealer["hdr"], json={}, timeout=30)
        assert ra.status_code == 200, ra.text
        # bulk-markup returns ok/upserted-like structure; check non-error
        body = ra.json()
        assert body.get("ok", True) is not False

    def test_apply_unknown_preset_404(self, ephemeral_dealer):
        ra = requests.post(
            f"{BASE}/api/dealer/markup-presets/nope-{uuid.uuid4()}/apply",
            headers=ephemeral_dealer["hdr"], json={}, timeout=15)
        assert ra.status_code == 404

    def test_presets_require_dealer_auth(self):
        r = requests.get(f"{BASE}/api/dealer/markup-presets", timeout=15)
        assert r.status_code in (401, 403)
