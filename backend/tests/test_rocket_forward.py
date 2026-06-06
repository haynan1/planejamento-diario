"""Backend tests for Rocket Forward API."""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://rocket-forward.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # cleanup
    try:
        s.post(f"{API}/clear-data", timeout=10)
    except Exception:
        pass


@pytest.fixture(scope="module", autouse=True)
def clean_before(client):
    client.post(f"{API}/clear-data", timeout=10)
    yield


# ---------- Health ----------
def test_root(client):
    r = client.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j.get("status") == "ok"


# ---------- Profile ----------
def test_profile_default(client):
    r = client.get(f"{API}/profile", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["id"] == "default"
    assert j["theme"] in ("dark", "light")
    assert "_id" not in j


def test_profile_update(client):
    r = client.put(f"{API}/profile", json={"name": "TEST_User", "theme": "light", "motivational_phrases_enabled": False}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["name"] == "TEST_User"
    assert j["theme"] == "light"
    assert j["motivational_phrases_enabled"] is False
    # GET to verify persistence
    r2 = client.get(f"{API}/profile", timeout=10)
    assert r2.json()["name"] == "TEST_User"


# ---------- Goals CRUD ----------
def _payload(**kw):
    base = {
        "title": "TEST_Goal",
        "description": "desc",
        "date": date.today().isoformat(),
        "time": "10:00",
        "priority": "alta",
        "category": "trabalho",
        "status": "pendente",
    }
    base.update(kw)
    return base


def test_create_goal(client):
    r = client.post(f"{API}/goals", json=_payload(), timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["title"] == "TEST_Goal"
    assert j["priority"] == "alta"
    assert "_id" not in j
    assert j["id"]
    pytest.goal_id = j["id"]


def test_list_goals(client):
    r = client.get(f"{API}/goals", timeout=10)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert any(g["id"] == pytest.goal_id for g in arr)
    for g in arr:
        assert "_id" not in g


def test_filter_goals(client):
    # create another goal
    other = client.post(f"{API}/goals", json=_payload(title="TEST_Other", priority="baixa", category="saude", status="em_andamento", date=(date.today()+timedelta(days=2)).isoformat())).json()
    r = client.get(f"{API}/goals", params={"priority": "alta"}, timeout=10)
    assert r.status_code == 200
    ids = [g["id"] for g in r.json()]
    assert pytest.goal_id in ids
    assert other["id"] not in ids

    r = client.get(f"{API}/goals", params={"category": "saude"}, timeout=10)
    assert other["id"] in [g["id"] for g in r.json()]

    r = client.get(f"{API}/goals", params={"date_eq": date.today().isoformat()}, timeout=10)
    ids = [g["id"] for g in r.json()]
    assert pytest.goal_id in ids
    assert other["id"] not in ids

    r = client.get(f"{API}/goals", params={"date_from": date.today().isoformat(), "date_to": (date.today()+timedelta(days=5)).isoformat()}, timeout=10)
    ids = [g["id"] for g in r.json()]
    assert other["id"] in ids


def test_update_goal_completed(client):
    r = client.put(f"{API}/goals/{pytest.goal_id}", json={"status": "concluida"}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "concluida"
    assert j["completed_at"] is not None


def test_update_goal_revert(client):
    r = client.put(f"{API}/goals/{pytest.goal_id}", json={"status": "pendente"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["completed_at"] is None


def test_stats(client):
    # mark completed for today
    client.put(f"{API}/goals/{pytest.goal_id}", json={"status": "concluida"}, timeout=10)
    r = client.get(f"{API}/stats", timeout=10)
    assert r.status_code == 200
    j = r.json()
    for k in ["total_goals", "completed_today", "pending_today", "weekly_evolution", "best_streak", "current_streak", "completion_rate"]:
        assert k in j
    assert len(j["weekly_evolution"]) == 7
    assert j["completed_today"] >= 1
    assert j["current_streak"] >= 1


def test_delete_goal(client):
    r = client.delete(f"{API}/goals/{pytest.goal_id}", timeout=10)
    assert r.status_code == 200
    r2 = client.get(f"{API}/goals/{pytest.goal_id}", timeout=10)
    assert r2.status_code == 404


def test_clear_data(client):
    client.post(f"{API}/goals", json=_payload(title="TEST_ToClear"), timeout=10)
    r = client.post(f"{API}/clear-data", timeout=10)
    assert r.status_code == 200
    arr = client.get(f"{API}/goals", timeout=10).json()
    assert arr == []
