from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta, date as date_cls

from achievements import ACHIEVEMENTS, evaluate_achievements

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

FREE_ACTIVE_GOAL_LIMIT = 5

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

Priority = Literal["baixa", "media", "alta"]
Status = Literal["pendente", "em_andamento", "concluida"]
Category = Literal[
    "estudos", "trabalho", "saude", "financas", "espiritual",
    "pessoal", "familia", "empreendedorismo", "outros"
]


class GoalBase(BaseModel):
    title: str
    description: Optional[str] = ""
    date: str  # ISO date YYYY-MM-DD
    time: Optional[str] = None  # HH:MM
    priority: Priority = "media"
    category: Category = "pessoal"
    status: Status = "pendente"


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    priority: Optional[Priority] = None
    category: Optional[Category] = None
    status: Optional[Status] = None


class Goal(GoalBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None


class Profile(BaseModel):
    id: str = "default"
    name: str = "Astronauta"
    motivational_phrases_enabled: bool = True
    theme: Literal["light", "dark"] = "dark"
    is_premium: bool = False
    notifications_enabled: bool = False
    avatar_base64: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    motivational_phrases_enabled: Optional[bool] = None
    theme: Optional[Literal["light", "dark"]] = None
    is_premium: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    avatar_base64: Optional[str] = None


@api_router.get("/")
async def root():
    return {"message": "Rocket Forward API", "status": "ok"}


# -------- Goals --------
@api_router.get("/goals", response_model=List[Goal])
async def list_goals(
    status: Optional[Status] = None,
    priority: Optional[Priority] = None,
    category: Optional[Category] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    date_eq: Optional[str] = Query(None, description="Exact date YYYY-MM-DD"),
):
    q = {}
    if status:
        q["status"] = status
    if priority:
        q["priority"] = priority
    if category:
        q["category"] = category
    if date_eq:
        q["date"] = date_eq
    elif date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        q["date"] = rng
    docs = await db.goals.find(q, {"_id": 0}).sort("date", 1).to_list(2000)
    return [Goal(**d) for d in docs]


@api_router.post("/goals", response_model=Goal)
async def create_goal(payload: GoalCreate):
    # Free tier limit: max 5 active (non-concluida) goals
    profile = await db.profile.find_one({"id": "default"}, {"_id": 0})
    is_premium = bool(profile and profile.get("is_premium"))
    if not is_premium:
        active_count = await db.goals.count_documents({"status": {"$ne": "concluida"}})
        if active_count >= FREE_ACTIVE_GOAL_LIMIT and payload.status != "concluida":
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "FREE_LIMIT_REACHED",
                    "message": f"Limite de {FREE_ACTIVE_GOAL_LIMIT} metas ativas atingido. Faça upgrade para Premium e crie metas ilimitadas.",
                    "limit": FREE_ACTIVE_GOAL_LIMIT,
                },
            )
    goal = Goal(**payload.model_dump())
    await db.goals.insert_one(goal.model_dump())
    return goal


@api_router.get("/goals/{goal_id}", response_model=Goal)
async def get_goal(goal_id: str):
    doc = await db.goals.find_one({"id": goal_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Meta não encontrada")
    return Goal(**doc)


@api_router.put("/goals/{goal_id}", response_model=Goal)
async def update_goal(goal_id: str, payload: GoalUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        doc = await db.goals.find_one({"id": goal_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Meta não encontrada")
        return Goal(**doc)
    if update.get("status") == "concluida":
        update["completed_at"] = datetime.now(timezone.utc).isoformat()
    elif "status" in update:
        update["completed_at"] = None
    res = await db.goals.update_one({"id": goal_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Meta não encontrada")
    doc = await db.goals.find_one({"id": goal_id}, {"_id": 0})
    return Goal(**doc)


@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str):
    res = await db.goals.delete_one({"id": goal_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Meta não encontrada")
    return {"ok": True}


@api_router.delete("/goals")
async def clear_all_goals():
    await db.goals.delete_many({})
    return {"ok": True}


# -------- Stats --------
@api_router.get("/stats")
async def get_stats():
    today_iso = datetime.now(timezone.utc).date().isoformat()
    total = await db.goals.count_documents({})
    completed = await db.goals.count_documents({"status": "concluida"})
    completed_today = await db.goals.count_documents({"status": "concluida", "date": today_iso})
    pending_today = await db.goals.count_documents({"status": {"$ne": "concluida"}, "date": today_iso})
    total_today = completed_today + pending_today

    # Weekly evolution: last 7 days
    today = datetime.now(timezone.utc).date()
    week = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_iso = d.isoformat()
        count = await db.goals.count_documents({"status": "concluida", "date": d_iso})
        week.append({"date": d_iso, "count": count})

    # Productive days = days with at least 1 completed goal
    productive_days_set = set()
    async for doc in db.goals.find({"status": "concluida"}, {"_id": 0, "date": 1}):
        productive_days_set.add(doc.get("date"))
    productive_days = len(productive_days_set)

    # Best streak based on completed goal dates
    sorted_dates = sorted(productive_days_set)
    best_streak = 0
    current = 0
    prev: Optional[date_cls] = None
    for ds in sorted_dates:
        try:
            d_obj = date_cls.fromisoformat(ds)
        except Exception:
            continue
        if prev is None or (d_obj - prev).days == 1:
            current += 1
        elif (d_obj - prev).days == 0:
            pass
        else:
            current = 1
        prev = d_obj
        if current > best_streak:
            best_streak = current

    # Current streak (ending today or yesterday)
    current_streak = 0
    cursor_day = today
    while cursor_day.isoformat() in productive_days_set:
        current_streak += 1
        cursor_day = cursor_day - timedelta(days=1)

    completion_rate = round((completed / total) * 100) if total > 0 else 0
    today_rate = round((completed_today / total_today) * 100) if total_today > 0 else 0

    return {
        "total_goals": total,
        "completed_goals": completed,
        "completed_today": completed_today,
        "pending_today": pending_today,
        "total_today": total_today,
        "today_rate": today_rate,
        "completion_rate": completion_rate,
        "productive_days": productive_days,
        "best_streak": best_streak,
        "current_streak": current_streak,
        "weekly_evolution": week,
    }


# -------- Profile --------
@api_router.get("/profile", response_model=Profile)
async def get_profile():
    doc = await db.profile.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        p = Profile()
        await db.profile.insert_one(p.model_dump())
        return p
    return Profile(**doc)


@api_router.put("/profile", response_model=Profile)
async def update_profile(payload: ProfileUpdate):
    update = payload.model_dump(exclude_unset=True)
    if update:
        await db.profile.update_one({"id": "default"}, {"$set": update}, upsert=True)
    doc = await db.profile.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        return Profile()
    return Profile(**doc)


@api_router.post("/clear-data")
async def clear_all_data():
    await db.goals.delete_many({})
    await db.profile.delete_many({})
    await db.achievements.delete_many({})
    return {"ok": True}


# -------- Achievements --------
@api_router.get("/achievements")
async def list_achievements():
    """List all achievements with unlock state + unlocked_at timestamp."""
    unlocked_map = {}
    async for doc in db.achievements.find({}, {"_id": 0}):
        unlocked_map[doc["key"]] = doc.get("unlocked_at")
    result = []
    for a in ACHIEVEMENTS:
        result.append({
            **a,
            "unlocked": a["key"] in unlocked_map,
            "unlocked_at": unlocked_map.get(a["key"]),
        })
    total = len(ACHIEVEMENTS)
    unlocked_count = sum(1 for a in result if a["unlocked"])
    return {"items": result, "total": total, "unlocked": unlocked_count}


@api_router.post("/achievements/check")
async def check_achievements():
    """Evaluate criteria and persist any newly unlocked achievements. Returns the list of newly unlocked."""
    state = await evaluate_achievements(db)
    existing = set()
    async for doc in db.achievements.find({}, {"_id": 0, "key": 1}):
        existing.add(doc["key"])
    newly = []
    now_iso = datetime.now(timezone.utc).isoformat()
    by_key = {a["key"]: a for a in ACHIEVEMENTS}
    for key, ok in state.items():
        if ok and key not in existing and key in by_key:
            meta = by_key[key]
            entry = {
                "key": key,
                "title": meta["title"],
                "description": meta["description"],
                "icon": meta["icon"],
                "group": meta["group"],
                "unlocked_at": now_iso,
            }
            await db.achievements.insert_one(dict(entry))
            newly.append(entry)
    return {"newly_unlocked": newly, "total_unlocked": len(existing) + len(newly)}


# -------- Reports (Premium-only data points still returned for paywall preview) --------
@api_router.get("/reports/monthly")
async def monthly_report():
    """Per-category and per-priority breakdown of completed goals in the last 30 days."""
    today = datetime.now(timezone.utc).date()
    start = (today - timedelta(days=29)).isoformat()
    by_category: dict = {}
    by_priority: dict = {"baixa": 0, "media": 0, "alta": 0}
    completed_per_day: dict = {}
    async for doc in db.goals.find(
        {"status": "concluida", "date": {"$gte": start}},
        {"_id": 0, "category": 1, "priority": 1, "date": 1},
    ):
        cat = doc.get("category", "outros")
        by_category[cat] = by_category.get(cat, 0) + 1
        pri = doc.get("priority", "media")
        if pri in by_priority:
            by_priority[pri] += 1
        d = doc.get("date")
        if d:
            completed_per_day[d] = completed_per_day.get(d, 0) + 1
    # Fill 30 day evolution
    evolution = []
    for i in range(29, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        evolution.append({"date": d, "count": completed_per_day.get(d, 0)})
    return {
        "by_category": by_category,
        "by_priority": by_priority,
        "evolution": evolution,
        "total_completed_30d": sum(by_category.values()),
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
