"""Tests for POST /api/sauna/translate-options (AI PL->RU translation of option names)."""
import os
import re
import json
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

CYR = re.compile(r"[А-Яа-яЁё]")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestTranslateOptions:
    def test_basic_two_texts(self, client):
        r = client.post(f"{BASE_URL}/api/sauna/translate-options",
                        json={"texts": ["Piec Elektryczne 9 kW", "Okno 42x42"]}, timeout=180)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert isinstance(data.get("translations"), list)
        assert len(data["translations"]) == 2
        assert all(isinstance(t, str) and t.strip() for t in data["translations"])
        assert CYR.search(data["translations"][0]), data["translations"]

    def test_empty_texts(self, client):
        r = client.post(f"{BASE_URL}/api/sauna/translate-options", json={"texts": []}, timeout=60)
        assert r.status_code == 200
        assert r.json()["translations"] == []

    def test_blank_strings_returned_as_blank(self, client):
        r = client.post(f"{BASE_URL}/api/sauna/translate-options", json={"texts": ["", "  "]}, timeout=60)
        assert r.status_code == 200
        assert r.json()["translations"] == ["", ""]

    def test_missing_key_field(self, client):
        r = client.post(f"{BASE_URL}/api/sauna/translate-options", json={}, timeout=60)
        assert r.status_code == 200
        assert r.json()["translations"] == []

    def test_bulk_all_current_option_names(self, client):
        """Simulate the 'Авто-перевод RU' bulk flow payload size (all option + variant names)."""
        pr = client.get(f"{BASE_URL}/api/sauna/prices", timeout=60)
        assert pr.status_code == 200
        cats = pr.json().get("categories", [])
        names = []
        for c in cats:
            for o in (c.get("options") or []):
                if (o.get("name") or "").strip():
                    names.append(o["name"])
                for v in (o.get("variants") or o.get("subOptions") or []):
                    n = (v.get("namePl") or v.get("name") or "").strip()
                    if n:
                        names.append(n)
        assert len(names) > 10, f"unexpectedly few names: {len(names)}"
        r = client.post(f"{BASE_URL}/api/sauna/translate-options", json={"texts": names}, timeout=240)
        assert r.status_code == 200, r.text[:400]
        tr = r.json()["translations"]
        assert len(tr) == len(names), f"length mismatch {len(tr)} vs {len(names)}"
        translated = sum(1 for a, b in zip(names, tr) if a != b and CYR.search(b or ""))
        ratio = translated / len(names)
        print(f"bulk: {len(names)} names, translated={translated} ratio={ratio:.2f}")
        assert ratio > 0.8, f"only {ratio:.0%} of names actually translated: " + json.dumps(
            [[a, b] for a, b in zip(names, tr) if a == b][:10], ensure_ascii=False)

    def test_prices_post_roundtrip_preserves_nameru(self, client):
        """POST /api/sauna/prices must persist nameRu (used by bulk translate save)."""
        pr = client.get(f"{BASE_URL}/api/sauna/prices", timeout=60)
        prices = pr.json()
        cats = prices.get("categories", [])
        target = None
        for c in cats:
            for o in (c.get("options") or []):
                if o.get("id"):
                    target = (c["id"], o["id"])
                    break
            if target:
                break
        assert target
        marker = "TEST_RU_MARKER"
        for c in cats:
            if c["id"] == target[0]:
                for o in c["options"]:
                    if o["id"] == target[1]:
                        original = o.get("nameRu")
                        o["nameRu"] = marker
        resp = client.post(f"{BASE_URL}/api/sauna/prices", json=prices, timeout=120)
        assert resp.status_code == 200, resp.text[:300]
        again = client.get(f"{BASE_URL}/api/sauna/prices", timeout=60).json()
        got = None
        for c in again.get("categories", []):
            if c["id"] == target[0]:
                for o in c["options"]:
                    if o["id"] == target[1]:
                        got = o.get("nameRu")
        assert got == marker, f"nameRu not persisted, got {got!r}"
        # restore
        for c in again.get("categories", []):
            if c["id"] == target[0]:
                for o in c["options"]:
                    if o["id"] == target[1]:
                        o["nameRu"] = original
        client.post(f"{BASE_URL}/api/sauna/prices", json=again, timeout=120)
