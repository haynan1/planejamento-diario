import AsyncStorage from "@react-native-async-storage/async-storage";

import { Priority, Status, Category, CATEGORIES } from "@/src/constants/goals";

const GOALS_KEY = "rocket_forward:goals";
const PROFILE_KEY = "rocket_forward:profile";
const ACHIEVEMENTS_KEY = "rocket_forward:achievements";
const FREE_ACTIVE_GOAL_LIMIT = 5;

export interface Goal {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string | null;
  priority: Priority;
  category: Category;
  status: Status;
  created_at: string;
  completed_at?: string | null;
}

export interface Stats {
  total_goals: number;
  completed_goals: number;
  completed_today: number;
  pending_today: number;
  total_today: number;
  today_rate: number;
  completion_rate: number;
  productive_days: number;
  best_streak: number;
  current_streak: number;
  weekly_evolution: { date: string; count: number }[];
}

export interface Profile {
  id: string;
  name: string;
  motivational_phrases_enabled: boolean;
  theme: "light" | "dark";
  is_premium: boolean;
  notifications_enabled: boolean;
  avatar_base64: string | null;
}

export interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface AchievementsResponse {
  items: Achievement[];
  total: number;
  unlocked: number;
}

export interface MonthlyReport {
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  evolution: { date: string; count: number }[];
  total_completed_30d: number;
}

export class FreeLimitError extends Error {
  limit: number;
  constructor(message: string, limit: number) {
    super(message);
    this.limit = limit;
    this.name = "FreeLimitError";
  }
}

export interface GoalFilters {
  status?: Status;
  priority?: Priority;
  category?: Category;
  date_from?: string;
  date_to?: string;
  date_eq?: string;
}

const defaultProfile: Profile = {
  id: "default",
  name: "Astronauta",
  motivational_phrases_enabled: true,
  theme: "dark",
  is_premium: false,
  notifications_enabled: false,
  avatar_base64: null,
};

const achievementDefinitions = [
  { key: "first_goal", title: "Decolagem", description: "Criou sua primeira meta", icon: "rocket", group: "Inicio" },
  { key: "completed_1", title: "Primeiro passo", description: "Concluiu 1 meta", icon: "check-circle", group: "Conclusao" },
  { key: "completed_5", title: "Em ritmo", description: "Concluiu 5 metas", icon: "trending-up", group: "Conclusao" },
  { key: "completed_10", title: "Acelerando", description: "Concluiu 10 metas", icon: "zap", group: "Conclusao" },
  { key: "completed_50", title: "Em orbita", description: "Concluiu 50 metas", icon: "globe", group: "Conclusao" },
  { key: "completed_100", title: "Estrela cadente", description: "Concluiu 100 metas", icon: "star", group: "Conclusao" },
  { key: "streak_3", title: "Constancia inicial", description: "3 dias consecutivos produtivos", icon: "flame", group: "Sequencia" },
  { key: "streak_7", title: "Semana de fogo", description: "7 dias consecutivos produtivos", icon: "flame", group: "Sequencia" },
  { key: "streak_14", title: "Disciplina forjada", description: "14 dias consecutivos produtivos", icon: "flame", group: "Sequencia" },
  { key: "streak_30", title: "Mente de aco", description: "30 dias consecutivos produtivos", icon: "flame", group: "Sequencia" },
  { key: "all_categories", title: "Vida equilibrada", description: "Concluiu metas de todas as 9 categorias", icon: "compass", group: "Variedade" },
  { key: "perfect_day", title: "Dia perfeito", description: "Concluiu 100% das metas em um dia", icon: "sun", group: "Dia" },
] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
};
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function getGoals(): Promise<Goal[]> {
  return readJson<Goal[]>(GOALS_KEY, []);
}

async function saveGoals(goals: Goal[]): Promise<void> {
  await writeJson(GOALS_KEY, goals);
}

async function getUnlockedMap(): Promise<Record<string, string>> {
  return readJson<Record<string, string>>(ACHIEVEMENTS_KEY, {});
}

async function saveUnlockedMap(map: Record<string, string>): Promise<void> {
  await writeJson(ACHIEVEMENTS_KEY, map);
}

function sortGoals(goals: Goal[]) {
  return [...goals].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
  });
}

function applyFilters(goals: Goal[], filters: GoalFilters) {
  return goals.filter((goal) => {
    if (filters.status && goal.status !== filters.status) return false;
    if (filters.priority && goal.priority !== filters.priority) return false;
    if (filters.category && goal.category !== filters.category) return false;
    if (filters.date_eq && goal.date !== filters.date_eq) return false;
    if (filters.date_from && goal.date < filters.date_from) return false;
    if (filters.date_to && goal.date > filters.date_to) return false;
    return true;
  });
}

function productiveDates(goals: Goal[]) {
  return new Set(goals.filter((g) => g.status === "concluida").map((g) => g.date));
}

function bestStreak(dates: Set<string>) {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`);
    const next = new Date(`${sorted[i]}T00:00:00`);
    const diff = Math.round((next.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return best;
}

function currentStreak(dates: Set<string>) {
  let cursor = new Date(`${todayISO()}T00:00:00`);
  let count = 0;
  while (dates.has(isoDate(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function evaluateAchievements(goals: Goal[]) {
  const completedGoals = goals.filter((g) => g.status === "concluida");
  const dates = productiveDates(goals);
  const completedCategories = new Set(completedGoals.map((g) => g.category));
  const byDate = new Map<string, Goal[]>();

  for (const goal of goals) {
    byDate.set(goal.date, [...(byDate.get(goal.date) ?? []), goal]);
  }

  const perfectDay = [...byDate.values()].some(
    (items) => items.length > 0 && items.every((g) => g.status === "concluida"),
  );
  const streak = bestStreak(dates);

  return {
    first_goal: goals.length >= 1,
    completed_1: completedGoals.length >= 1,
    completed_5: completedGoals.length >= 5,
    completed_10: completedGoals.length >= 10,
    completed_50: completedGoals.length >= 50,
    completed_100: completedGoals.length >= 100,
    streak_3: streak >= 3,
    streak_7: streak >= 7,
    streak_14: streak >= 14,
    streak_30: streak >= 30,
    all_categories: CATEGORIES.every((c) => completedCategories.has(c.key)),
    perfect_day: perfectDay,
  };
}

function hydrateAchievements(
  evaluated: Record<string, boolean>,
  unlockedMap: Record<string, string>,
): Achievement[] {
  return achievementDefinitions.map((definition) => {
    const isUnlocked = Boolean(evaluated[definition.key]);
    return {
      ...definition,
      unlocked: isUnlocked,
      unlocked_at: isUnlocked ? unlockedMap[definition.key] ?? null : null,
    };
  });
}

async function calculateStats(goals: Goal[]): Promise<Stats> {
  const today = todayISO();
  const completed = goals.filter((g) => g.status === "concluida");
  const completedToday = goals.filter((g) => g.date === today && g.status === "concluida").length;
  const pendingToday = goals.filter((g) => g.date === today && g.status !== "concluida").length;
  const totalToday = completedToday + pendingToday;
  const dates = productiveDates(goals);
  const now = new Date(`${today}T00:00:00`);

  const weekly_evolution = Array.from({ length: 7 }, (_, index) => {
    const date = isoDate(addDays(now, index - 6));
    return {
      date,
      count: goals.filter((g) => g.date === date && g.status === "concluida").length,
    };
  });

  return {
    total_goals: goals.length,
    completed_goals: completed.length,
    completed_today: completedToday,
    pending_today: pendingToday,
    total_today: totalToday,
    today_rate: totalToday ? completedToday / totalToday : 0,
    completion_rate: goals.length ? completed.length / goals.length : 0,
    productive_days: dates.size,
    best_streak: bestStreak(dates),
    current_streak: currentStreak(dates),
    weekly_evolution,
  };
}

export const api = {
  listGoals: async (filters: GoalFilters = {}): Promise<Goal[]> => {
    const goals = await getGoals();
    return sortGoals(applyFilters(goals, filters));
  },

  createGoal: async (payload: Omit<Goal, "id" | "created_at" | "completed_at">): Promise<Goal> => {
    const [goals, profile] = await Promise.all([getGoals(), api.getProfile()]);
    const activeCount = goals.filter((g) => g.status !== "concluida").length;
    if (!profile.is_premium && payload.status !== "concluida" && activeCount >= FREE_ACTIVE_GOAL_LIMIT) {
      throw new FreeLimitError(
        `Limite de ${FREE_ACTIVE_GOAL_LIMIT} metas ativas atingido. Faca upgrade para Premium e crie metas ilimitadas.`,
        FREE_ACTIVE_GOAL_LIMIT,
      );
    }

    const now = new Date().toISOString();
    const goal: Goal = {
      ...payload,
      id: uid(),
      created_at: now,
      completed_at: payload.status === "concluida" ? now : null,
    };
    await saveGoals([...goals, goal]);
    return goal;
  },

  updateGoal: async (id: string, patch: Partial<Goal>): Promise<Goal> => {
    const goals = await getGoals();
    const index = goals.findIndex((g) => g.id === id);
    if (index < 0) throw new Error("Meta nao encontrada");

    const previous = goals[index];
    const statusChanged = patch.status !== undefined && patch.status !== previous.status;
    const next: Goal = {
      ...previous,
      ...patch,
      completed_at:
        statusChanged && patch.status === "concluida"
          ? new Date().toISOString()
          : statusChanged
            ? null
            : patch.completed_at !== undefined
              ? patch.completed_at
              : previous.completed_at,
    };

    const updated = [...goals];
    updated[index] = next;
    await saveGoals(updated);
    return next;
  },

  deleteGoal: async (id: string): Promise<{ ok: boolean }> => {
    const goals = await getGoals();
    await saveGoals(goals.filter((g) => g.id !== id));
    return { ok: true };
  },

  getStats: async (): Promise<Stats> => calculateStats(await getGoals()),

  getProfile: async (): Promise<Profile> => {
    const stored = await readJson<Partial<Profile>>(PROFILE_KEY, {});
    return { ...defaultProfile, ...stored, id: "default" };
  },

  updateProfile: async (patch: Partial<Profile>): Promise<Profile> => {
    const next = { ...(await api.getProfile()), ...patch, id: "default" };
    await writeJson(PROFILE_KEY, next);
    return next;
  },

  clearData: async (): Promise<{ ok: boolean }> => {
    await AsyncStorage.multiRemove([GOALS_KEY, ACHIEVEMENTS_KEY]);
    return { ok: true };
  },

  listAchievements: async (): Promise<AchievementsResponse> => {
    const [goals, unlockedMap] = await Promise.all([getGoals(), getUnlockedMap()]);
    const items = hydrateAchievements(evaluateAchievements(goals), unlockedMap);
    return {
      items,
      total: items.length,
      unlocked: items.filter((item) => item.unlocked).length,
    };
  },

  checkAchievements: async (): Promise<{ newly_unlocked: Achievement[]; total_unlocked: number }> => {
    const [goals, unlockedMap] = await Promise.all([getGoals(), getUnlockedMap()]);
    const evaluated = evaluateAchievements(goals);
    const now = new Date().toISOString();
    const nextMap = { ...unlockedMap };
    const newlyUnlockedKeys: string[] = [];

    for (const definition of achievementDefinitions) {
      if (evaluated[definition.key] && !nextMap[definition.key]) {
        nextMap[definition.key] = now;
        newlyUnlockedKeys.push(definition.key);
      }
    }

    if (newlyUnlockedKeys.length > 0) {
      await saveUnlockedMap(nextMap);
    }

    const items = hydrateAchievements(evaluated, nextMap);
    return {
      newly_unlocked: items.filter((item) => newlyUnlockedKeys.includes(item.key)),
      total_unlocked: items.filter((item) => item.unlocked).length,
    };
  },

  monthlyReport: async (): Promise<MonthlyReport> => {
    const goals = await getGoals();
    const today = new Date(`${todayISO()}T00:00:00`);
    const start = isoDate(addDays(today, -29));
    const completed = goals.filter((g) => g.status === "concluida" && g.date >= start);
    const by_category: Record<string, number> = {};
    const by_priority: Record<string, number> = {};

    for (const goal of completed) {
      by_category[goal.category] = (by_category[goal.category] ?? 0) + 1;
      by_priority[goal.priority] = (by_priority[goal.priority] ?? 0) + 1;
    }

    const evolution = Array.from({ length: 30 }, (_, index) => {
      const date = isoDate(addDays(today, index - 29));
      return {
        date,
        count: completed.filter((g) => g.date === date).length,
      };
    });

    return {
      by_category,
      by_priority,
      evolution,
      total_completed_30d: completed.length,
    };
  },
};
