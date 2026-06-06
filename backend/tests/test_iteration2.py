"""Iteration 2 backend tests: achievements, monthly report, premium gating, profile flags."""
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
def clean_before(client):
    r = client.post(f"{API}/clear-data", timeout=10)
    assert r.status_code == 200
    yield


def _payload(**kw):
    base = {
        "title": "TEST_Goal",
        "description": "",
        "date": date.today().isoformat(),
        "time": "10:00",
        "priority": "media",
        "category": "pessoal",
        "status": "pendente",
    }
    base.update(kw)
    return base


# ---------- Profile flags ----------
def test_profile_defaults_premium_and_notifications(client):
    r = client.get(f"{API}/profile", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["is_premium"] is False
    assert j["notifications_enabled"] is False
    assert "_id" not in j


def test_profile_update_premium_and_notifications(client):
    r = client.put(f"{API}/profile", json={"is_premium": True, "notifications_enabled": True}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["is_premium"] is True
    assert j["notifications_enabled"] is True
    # persistence check
    g = client.get(f"{API}/profile", timeout=10).json()
    assert g["is_premium"] is True and g["notifications_enabled"] is True
    # reset back to false for downstream tests
    client.put(f"{API}/profile", json={"is_premium": False, "notifications_enabled": False}, timeout=10)


# ---------- Achievements list ----------
def test_achievements_list_default(client):
    r = client.get(f"{API}/achievements", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["total"] == 12
    assert len(j["items"]) == 12
    # default no unlocks
    assert j["unlocked"] == 0
    for item in j["items"]:
        assert "key" in item and "title" in item and "icon" in item and "group" in item
        assert item["unlocked"] is False
        assert item["unlocked_at"] is None


# ---------- Achievements check rules ----------
def test_achievements_first_goal_unlocked_on_creation(client):
    # ensure clean
    client.delete(f"{API}/goals", timeout=10)
    # create one goal
    g = client.post(f"{API}/goals", json=_payload(title="TEST_First")).json()
    assert g["id"]
    # check achievements
    r = client.post(f"{API}/achievements/check", timeout=10)
    assert r.status_code == 200
    j = r.json()
    keys = [e["key"] for e in j["newly_unlocked"]]
    assert "first_goal" in keys
    # GET reflects unlocked
    lst = client.get(f"{API}/achievements", timeout=10).json()
    by_key = {a["key"]: a for a in lst["items"]}
    assert by_key["first_goal"]["unlocked"] is True
    assert by_key["first_goal"]["unlocked_at"] is not None
    assert by_key["completed_1"]["unlocked"] is False


def test_achievements_completed_1_unlocked_on_completion(client):
    # complete the goal created above
    goals = client.get(f"{API}/goals", timeout=10).json()
    assert goals, "expected at least one goal"
    gid = goals[0]["id"]
    upd = client.put(f"{API}/goals/{gid}", json={"status": "concluida"}, timeout=10)
    assert upd.status_code == 200
    r = client.post(f"{API}/achievements/check", timeout=10)
    assert r.status_code == 200
    j = r.json()
    keys = [e["key"] for e in j["newly_unlocked"]]
    assert "completed_1" in keys
    # idempotent: re-running doesn't duplicate
    r2 = client.post(f"{API}/achievements/check", timeout=10)
    assert r2.status_code == 200
    assert r2.json()["newly_unlocked"] == []


# ---------- Monthly report ----------
def test_monthly_report_structure(client):
    r = client.get(f"{API}/reports/monthly", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "by_category" in j
    assert "by_priority" in j and set(["baixa", "media", "alta"]).issubset(j["by_priority"].keys())
    assert "evolution" in j and len(j["evolution"]) == 30
    for entry in j["evolution"]:
        assert "date" in entry and "count" in entry
    assert "total_completed_30d" in j
    # at least one completed in this run
    assert j["total_completed_30d"] >= 1


# ---------- Free tier limit & premium bypass ----------
def test_free_tier_limit_402_and_premium_bypass(client):
    # clean slate
    client.post(f"{API}/clear-data", timeout=10)
    # ensure not premium
    client.put(f"{API}/profile", json={"is_premium": False}, timeout=10)
    # create 5 active goals
    for i in range(5):
        r = client.post(f"{API}/goals", json=_payload(title=f"TEST_Active_{i}"), timeout=10)
        assert r.status_code == 200, r.text
    # 6th should fail with 402
    r6 = client.post(f"{API}/goals", json=_payload(title="TEST_Sixth"), timeout=10)
    assert r6.status_code == 402, r6.text
    detail = r6.json().get("detail") or {}
    assert isinstance(detail, dict)
    assert detail.get("code") == "FREE_LIMIT_REACHED"
    assert detail.get("limit") == 5

    # Activate premium and try again -> success
    p = client.put(f"{API}/profile", json={"is_premium": True}, timeout=10).json()
    assert p["is_premium"] is True
    rok = client.post(f"{API}/goals", json=_payload(title="TEST_Premium_Sixth"), timeout=10)
    assert rok.status_code == 200, rok.text

    # Create a concluida directly while free should also work (it's not active)
    client.put(f"{API}/profile", json={"is_premium": False}, timeout=10)
    rc = client.post(f"{API}/goals", json=_payload(title="TEST_Concluded", status="concluida"), timeout=10)
    assert rc.status_code == 200, rc.text


# ---------- Clear-data clears achievements ----------
def test_clear_data_clears_achievements(client):
    # ensure something unlocked
    client.post(f"{API}/clear-data", timeout=10)
    client.post(f"{API}/goals", json=_payload(title="TEST_ForAchv"), timeout=10)
    client.post(f"{API}/achievements/check", timeout=10)
    before = client.get(f"{API}/achievements", timeout=10).json()
    assert before["unlocked"] >= 1
    # clear
    r = client.post(f"{API}/clear-data", timeout=10)
    assert r.status_code == 200
    after = client.get(f"{API}/achievements", timeout=10).json()
    assert after["unlocked"] == 0
    assert all(a["unlocked"] is False for a in after["items"])
