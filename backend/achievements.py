from typing import List, Dict, Set, Optional
from datetime import date as date_cls, timedelta

ACHIEVEMENTS: List[Dict] = [
    # First step
    {"key": "first_goal", "title": "Decolagem", "description": "Criou sua primeira meta", "icon": "rocket", "group": "Início"},
    # Completion milestones
    {"key": "completed_1", "title": "Primeiro passo", "description": "Concluiu 1 meta", "icon": "check-circle", "group": "Conclusão"},
    {"key": "completed_5", "title": "Em ritmo", "description": "Concluiu 5 metas", "icon": "trending-up", "group": "Conclusão"},
    {"key": "completed_10", "title": "Acelerando", "description": "Concluiu 10 metas", "icon": "zap", "group": "Conclusão"},
    {"key": "completed_50", "title": "Em órbita", "description": "Concluiu 50 metas", "icon": "globe", "group": "Conclusão"},
    {"key": "completed_100", "title": "Estrela cadente", "description": "Concluiu 100 metas", "icon": "star", "group": "Conclusão"},
    # Streaks
    {"key": "streak_3", "title": "Constância inicial", "description": "3 dias consecutivos produtivos", "icon": "flame", "group": "Sequência"},
    {"key": "streak_7", "title": "Semana de fogo", "description": "7 dias consecutivos produtivos", "icon": "flame", "group": "Sequência"},
    {"key": "streak_14", "title": "Disciplina forjada", "description": "14 dias consecutivos produtivos", "icon": "flame", "group": "Sequência"},
    {"key": "streak_30", "title": "Mente de aço", "description": "30 dias consecutivos produtivos", "icon": "flame", "group": "Sequência"},
    # Variety
    {"key": "all_categories", "title": "Vida equilibrada", "description": "Concluiu metas de todas as 9 categorias", "icon": "compass", "group": "Variedade"},
    # Perfect day
    {"key": "perfect_day", "title": "Dia perfeito", "description": "Concluiu 100% das metas em um dia", "icon": "sun", "group": "Dia"},
]

CATEGORIES_LIST = [
    "estudos", "trabalho", "saude", "financas", "espiritual",
    "pessoal", "familia", "empreendedorismo", "outros",
]


def best_streak_from_dates(dates: Set[str]) -> int:
    if not dates:
        return 0
    sorted_dates: List[date_cls] = []
    for ds in sorted(dates):
        try:
            sorted_dates.append(date_cls.fromisoformat(ds))
        except Exception:
            continue
    if not sorted_dates:
        return 0
    best = 1
    current = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
            current += 1
            best = max(best, current)
        elif (sorted_dates[i] - sorted_dates[i - 1]).days == 0:
            continue
        else:
            current = 1
    return best


async def evaluate_achievements(db) -> Dict[str, bool]:
    """Returns dict {key: unlocked_bool} for every achievement."""
    total_goals = await db.goals.count_documents({})
    completed = await db.goals.count_documents({"status": "concluida"})

    # Productive day dates (any completed goal)
    productive_days: Set[str] = set()
    completed_categories: Set[str] = set()
    async for doc in db.goals.find({"status": "concluida"}, {"_id": 0, "date": 1, "category": 1}):
        if doc.get("date"):
            productive_days.add(doc["date"])
        if doc.get("category"):
            completed_categories.add(doc["category"])

    best = best_streak_from_dates(productive_days)

    # Perfect day: at least one date where ALL goals on that date have status concluida and count >= 1
    perfect = False
    # Aggregate by date
    pipeline = [
        {"$group": {
            "_id": "$date",
            "total": {"$sum": 1},
            "done": {"$sum": {"$cond": [{"$eq": ["$status", "concluida"]}, 1, 0]}},
        }},
    ]
    async for row in db.goals.aggregate(pipeline):
        if row["total"] > 0 and row["total"] == row["done"]:
            perfect = True
            break

    all_cats = all(c in completed_categories for c in CATEGORIES_LIST)

    return {
        "first_goal": total_goals >= 1,
        "completed_1": completed >= 1,
        "completed_5": completed >= 5,
        "completed_10": completed >= 10,
        "completed_50": completed >= 50,
        "completed_100": completed >= 100,
        "streak_3": best >= 3,
        "streak_7": best >= 7,
        "streak_14": best >= 14,
        "streak_30": best >= 30,
        "all_categories": all_cats,
        "perfect_day": perfect,
    }
