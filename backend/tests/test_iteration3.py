"""Iteration 3 backend tests: profile.avatar_base64 set/clear + clear-data resets + regression on existing endpoints."""
import os
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://rocket-forward.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    try:
        s.post(f"{API}/clear-data", timeout=10)
    except Exception:
        pass


@pytest.fixture(scope="module", autouse=True)
def _clean(client):
    r = client.post(f"{API}/clear-data", timeout=10)
    assert r.status_code == 200
    yield


# ---------- Avatar field ----------
SAMPLE_B64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQE="


def test_profile_default_includes_avatar_base64_null(client):
    r = client.get(f"{API}/profile", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "avatar_base64" in j
    assert j["avatar_base64"] is None
    assert "_id" not in j


def test_profile_set_avatar_base64(client):
    r = client.put(f"{API}/profile", json={"avatar_base64": SAMPLE_B64}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["avatar_base64"] == SAMPLE_B64
    # Persistence via GET
    g = client.get(f"{API}/profile", timeout=10).json()
    assert g["avatar_base64"] == SAMPLE_B64


def test_profile_clear_avatar_to_null(client):
    # First ensure set
    client.put(f"{API}/profile", json={"avatar_base64": SAMPLE_B64}, timeout=10)
    # Now clear
    r = client.put(f"{API}/profile", json={"avatar_base64": None}, timeout=10)
    assert r.status_code == 200
    # NOTE: Current backend update_profile strips None values (only sets non-None),
    # so passing null does NOT actually clear. Verify true behavior here.
    j = r.json()
    g = client.get(f"{API}/profile", timeout=10).json()
    # Document expected vs actual:
    # Expected by review: avatar_base64 should become None when client sends null
    assert g["avatar_base64"] is None, (
        f"Backend did not clear avatar when null sent. Got: {g['avatar_base64']!r}. "
        "This indicates ProfileUpdate strips None and PUT cannot unset avatar."
    )


def test_profile_partial_update_preserves_avatar(client):
    # set avatar
    client.put(f"{API}/profile", json={"avatar_base64": SAMPLE_B64}, timeout=10)
    # update name only
    r = client.put(f"{API}/profile", json={"name": "TEST_Astronauta"}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["name"] == "TEST_Astronauta"
    assert j["avatar_base64"] == SAMPLE_B64


def test_clear_data_resets_avatar(client):
    # ensure set
    client.put(f"{API}/profile", json={"avatar_base64": SAMPLE_B64}, timeout=10)
    r = client.post(f"{API}/clear-data", timeout=10)
    assert r.status_code == 200
    g = client.get(f"{API}/profile", timeout=10).json()
    assert g["avatar_base64"] is None
    assert g["name"] == "Astronauta"


# ---------- Regression: existing endpoints unchanged ----------
def _payload(**kw):
    base = {
        "title": "TEST_Reg",
        "description": "",
        "date": date.today().isoformat(),
        "time": "10:00",
        "priority": "media",
        "category": "pessoal",
        "status": "pendente",
    }
    base.update(kw)
    return base


def test_goals_crud_with_filters(client):
    client.post(f"{API}/clear-data", timeout=10)
    g1 = client.post(f"{API}/goals", json=_payload(title="TEST_A", priority="alta", category="trabalho")).json()
    g2 = client.post(f"{API}/goals", json=_payload(title="TEST_B", priority="baixa", category="saude")).json()
    assert g1["id"] and g2["id"]
    # filter by priority
    r = client.get(f"{API}/goals", params={"priority": "alta"}, timeout=10)
    assert r.status_code == 200
    items = r.json()
    assert any(it["id"] == g1["id"] for it in items)
    assert all(it["priority"] == "alta" for it in items)
    # filter by category
    r2 = client.get(f"{API}/goals", params={"category": "saude"}, timeout=10).json()
    assert all(it["category"] == "saude" for it in r2)
    # date_eq
    r3 = client.get(f"{API}/goals", params={"date_eq": date.today().isoformat()}, timeout=10).json()
    assert len(r3) >= 2
    # update -> get verifies persistence
    upd = client.put(f"{API}/goals/{g1['id']}", json={"status": "concluida"}, timeout=10).json()
    assert upd["status"] == "concluida" and upd["completed_at"] is not None
    got = client.get(f"{API}/goals/{g1['id']}", timeout=10).json()
    assert got["status"] == "concluida"
    # delete -> 404 after
    d = client.delete(f"{API}/goals/{g2['id']}", timeout=10)
    assert d.status_code == 200
    miss = client.get(f"{API}/goals/{g2['id']}", timeout=10)
    assert miss.status_code == 404


def test_stats_endpoint(client):
    r = client.get(f"{API}/stats", timeout=10)
    assert r.status_code == 200
    j = r.json()
    for k in ["total_goals", "completed_goals", "completed_today", "pending_today",
              "today_rate", "completion_rate", "productive_days",
              "best_streak", "current_streak", "weekly_evolution"]:
        assert k in j
    assert len(j["weekly_evolution"]) == 7


def test_achievements_list_and_check(client):
    r = client.get(f"{API}/achievements", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["total"] == 12 and len(j["items"]) == 12
    chk = client.post(f"{API}/achievements/check", timeout=10)
    assert chk.status_code == 200
    assert "newly_unlocked" in chk.json()


def test_monthly_report(client):
    r = client.get(f"{API}/reports/monthly", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "by_category" in j and "by_priority" in j
    assert len(j["evolution"]) == 30


def test_free_limit_still_402(client):
    client.post(f"{API}/clear-data", timeout=10)
    client.put(f"{API}/profile", json={"is_premium": False}, timeout=10)
    for i in range(5):
        rok = client.post(f"{API}/goals", json=_payload(title=f"TEST_Lim_{i}"), timeout=10)
        assert rok.status_code == 200, rok.text
    r6 = client.post(f"{API}/goals", json=_payload(title="TEST_Lim_6"), timeout=10)
    assert r6.status_code == 402
    detail = r6.json().get("detail") or {}
    assert detail.get("code") == "FREE_LIMIT_REACHED"
    assert detail.get("limit") == 5
    # cleanup
    client.post(f"{API}/clear-data", timeout=10)
