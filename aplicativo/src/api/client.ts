import AsyncStorage from "@react-native-async-storage/async-storage";

import { Priority, Status, Category, CATEGORIES, PRIORITIES } from "@/src/constants/goals";
import { addLocalDays, formatLocalISODate, parseLocalISODate, todayLocalISO } from "@/src/utils/date";

const GOALS_KEY = "rocket_forward:goals";
const PROFILE_KEY = "rocket_forward:profile";
const ACHIEVEMENTS_KEY = "rocket_forward:achievements";
const FREE_ACTIVE_GOAL_LIMIT = 5;
const RECURRENCE_ID_SEPARATOR = "::";
const RECURRING_LOOKAHEAD_DAYS = 30;

export type RecurrenceType = "daily" | "weekdays" | "weekends" | "count" | "forever";

export interface GoalRecurrence {
  type: RecurrenceType;
  start_date: string;
  end_date?: string;
  days?: number;
}

export interface GoalOccurrenceOverride {
  status: Status;
  completed_at?: string | null;
}

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
  recurrence?: GoalRecurrence | null;
  recurrence_overrides?: Record<string, GoalOccurrenceOverride>;
  series_id?: string;
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

interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  group: string;
}

const createdMilestones = [1, 3, 5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000];
const completedMilestones = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 1000];
const streakMilestones = [2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 75, 90, 120, 180, 365];
const productiveDayMilestones = [1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 250, 365];
const perfectDayMilestones = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50];
const recurringMilestones = [1, 3, 5, 10, 25, 50];

function milestoneTitle(value: number, first: string, middle: string, high: string) {
  if (value === 1) return first;
  if (value < 50) return `${middle} ${value}`;
  return `${high} ${value}`;
}

const achievementDefinitions: AchievementDefinition[] = [
  ...createdMilestones.map((count) => ({
    key: count === 1 ? "first_goal" : `created_${count}`,
    title: milestoneTitle(count, "Decolagem", "Construtor", "Arquiteto"),
    description: `Criou ${count} ${count === 1 ? "meta" : "metas"}`,
    icon: count >= 100 ? "rocket" : "target",
    group: "Inicio",
  })),
  ...completedMilestones.map((count) => ({
    key: `completed_${count}`,
    title:
      count === 1
        ? "Primeiro passo"
        : count === 5
          ? "Em ritmo"
          : count === 10
            ? "Acelerando"
            : count === 50
              ? "Em orbita"
              : count === 100
                ? "Estrela cadente"
                : milestoneTitle(count, "Primeiro passo", "Impulso", "Lenda"),
    description: `Concluiu ${count} ${count === 1 ? "meta" : "metas"}`,
    icon: count >= 100 ? "star" : count >= 50 ? "globe" : count >= 10 ? "zap" : "check-circle",
    group: "Conclusao",
  })),
  ...streakMilestones.map((days) => ({
    key: `streak_${days}`,
    title:
      days === 3
        ? "Constancia inicial"
        : days === 7
          ? "Semana de fogo"
          : days === 14
            ? "Disciplina forjada"
            : days === 30
              ? "Mente de aco"
              : milestoneTitle(days, "Faísca", "Sequência", "Chama eterna"),
    description: `${days} dias consecutivos produtivos`,
    icon: "flame",
    group: "Sequencia",
  })),
  ...productiveDayMilestones.map((days) => ({
    key: `productive_days_${days}`,
    title: milestoneTitle(days, "Dia produtivo", "Rotina", "Calendario dourado"),
    description: `Teve ${days} ${days === 1 ? "dia produtivo" : "dias produtivos"}`,
    icon: "sun",
    group: "Dias produtivos",
  })),
  ...perfectDayMilestones.map((days) => ({
    key: days === 1 ? "perfect_day" : `perfect_days_${days}`,
    title: days === 1 ? "Dia perfeito" : `Perfeição ${days}`,
    description: `Concluiu 100% das metas em ${days} ${days === 1 ? "dia" : "dias"}`,
    icon: "award",
    group: "Dia",
  })),
  ...CATEGORIES.map((category) => ({
    key: `category_${category.key}`,
    title: `Explorador: ${category.label}`,
    description: `Concluiu uma meta de ${category.label}`,
    icon: "compass",
    group: "Variedade",
  })),
  {
    key: "all_categories",
    title: "Vida equilibrada",
    description: "Concluiu metas de todas as 9 categorias",
    icon: "compass",
    group: "Variedade",
  },
  ...PRIORITIES.flatMap((priority) =>
    [1, 5, 25].map((count) => ({
      key: `priority_${priority.key}_${count}`,
      title: `${priority.label} ${count}`,
      description: `Concluiu ${count} ${count === 1 ? "meta" : "metas"} de prioridade ${priority.label.toLowerCase()}`,
      icon: "flag",
      group: "Prioridade",
    })),
  ),
  ...recurringMilestones.map((count) => ({
    key: `recurring_${count}`,
    title: milestoneTitle(count, "Ritual iniciado", "Automação", "Maestro da rotina"),
    description: `Criou ${count} ${count === 1 ? "meta repetida" : "metas repetidas"}`,
    icon: "repeat",
    group: "Repetição",
  })),
];

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const lastYearRange = () => {
  const today = todayLocalISO();
  return {
    date_from: formatLocalISODate(addLocalDays(parseLocalISODate(today), -365)),
    date_to: today,
  };
};

const makeOccurrenceId = (goalId: string, date: string) => `${goalId}${RECURRENCE_ID_SEPARATOR}${date}`;

function parseOccurrenceId(id: string) {
  const [goalId, date] = id.split(RECURRENCE_ID_SEPARATOR);
  if (!goalId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { goalId, date };
}

function getRecurringRange(filters: GoalFilters) {
  const today = todayLocalISO();
  if (filters.date_eq) return { from: filters.date_eq, to: filters.date_eq };
  return {
    from: filters.date_from ?? today,
    to: filters.date_to ?? formatLocalISODate(addLocalDays(parseLocalISODate(today), RECURRING_LOOKAHEAD_DAYS)),
  };
}

function recurrenceOccursOnDate(recurrence: GoalRecurrence, date: string) {
  if (date < recurrence.start_date) return false;

  const current = parseLocalISODate(date);
  const start = parseLocalISODate(recurrence.start_date);
  const daysSinceStart = Math.round((current.getTime() - start.getTime()) / 86400000);
  if (daysSinceStart < 0) return false;
  if (recurrence.type === "count" && daysSinceStart >= (recurrence.days ?? 0)) return false;

  const day = current.getDay();
  if (recurrence.type === "weekdays") return day >= 1 && day <= 5;
  if (recurrence.type === "weekends") return day === 0 || day === 6;
  return true;
}

export function recurrenceMatchesDate(recurrence: GoalRecurrence, date: string) {
  if (recurrence.end_date && date > recurrence.end_date) return false;
  return recurrenceOccursOnDate(recurrence, date);
}

function expandRecurringGoal(goal: Goal, from: string, to: string) {
  if (!goal.recurrence) return [goal];

  const items: Goal[] = [];
  let cursor = parseLocalISODate(from);
  const end = parseLocalISODate(to);

  while (cursor <= end) {
    const date = formatLocalISODate(cursor);
    const override = goal.recurrence_overrides?.[date];
    const completedRecord = (override?.status ?? goal.status) === "concluida" && recurrenceOccursOnDate(goal.recurrence, date);
    if (recurrenceMatchesDate(goal.recurrence, date) || completedRecord) {
      items.push({
        ...goal,
        id: makeOccurrenceId(goal.id, date),
        series_id: goal.id,
        date,
        status: override?.status ?? goal.status,
        completed_at: override?.completed_at ?? null,
      });
    }
    cursor = addLocalDays(cursor, 1);
  }

  return items;
}

function expandGoals(goals: Goal[], filters: GoalFilters) {
  const range = getRecurringRange(filters);
  return goals.flatMap((goal) => expandRecurringGoal(goal, range.from, range.to));
}

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
    const prev = parseLocalISODate(sorted[i - 1]);
    const next = parseLocalISODate(sorted[i]);
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
  let cursor = parseLocalISODate(todayLocalISO());
  let count = 0;
  while (dates.has(formatLocalISODate(cursor))) {
    count += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return count;
}

function evaluateAchievements(goals: Goal[]) {
  const completedGoals = goals.filter((g) => g.status === "concluida");
  const dates = productiveDates(goals);
  const completedCategories = new Set(completedGoals.map((g) => g.category));
  const createdGoalIds = new Set(goals.map((g) => g.series_id ?? g.id));
  const recurringGoalIds = new Set(goals.filter((g) => g.recurrence).map((g) => g.series_id ?? g.id));
  const completedByPriority = new Map<Priority, number>();
  const byDate = new Map<string, Goal[]>();

  for (const goal of goals) {
    byDate.set(goal.date, [...(byDate.get(goal.date) ?? []), goal]);
  }

  for (const goal of completedGoals) {
    completedByPriority.set(goal.priority, (completedByPriority.get(goal.priority) ?? 0) + 1);
  }

  const perfectDayCount = [...byDate.values()].filter(
    (items) => items.length > 0 && items.every((g) => g.status === "concluida"),
  ).length;
  const streak = bestStreak(dates);

  const evaluated: Record<string, boolean> = {};

  for (const count of createdMilestones) {
    evaluated[count === 1 ? "first_goal" : `created_${count}`] = createdGoalIds.size >= count;
  }
  for (const count of completedMilestones) {
    evaluated[`completed_${count}`] = completedGoals.length >= count;
  }
  for (const days of streakMilestones) {
    evaluated[`streak_${days}`] = streak >= days;
  }
  for (const days of productiveDayMilestones) {
    evaluated[`productive_days_${days}`] = dates.size >= days;
  }
  for (const days of perfectDayMilestones) {
    evaluated[days === 1 ? "perfect_day" : `perfect_days_${days}`] = perfectDayCount >= days;
  }
  for (const category of CATEGORIES) {
    evaluated[`category_${category.key}`] = completedCategories.has(category.key);
  }
  evaluated.all_categories = CATEGORIES.every((c) => completedCategories.has(c.key));
  for (const priority of PRIORITIES) {
    for (const count of [1, 5, 25]) {
      evaluated[`priority_${priority.key}_${count}`] = (completedByPriority.get(priority.key) ?? 0) >= count;
    }
  }
  for (const count of recurringMilestones) {
    evaluated[`recurring_${count}`] = recurringGoalIds.size >= count;
  }

  return evaluated;
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
  const today = todayLocalISO();
  const completed = goals.filter((g) => g.status === "concluida");
  const completedToday = goals.filter((g) => g.date === today && g.status === "concluida").length;
  const pendingToday = goals.filter((g) => g.date === today && g.status !== "concluida").length;
  const totalToday = completedToday + pendingToday;
  const dates = productiveDates(goals);
  const now = parseLocalISODate(today);

  const weekly_evolution = Array.from({ length: 7 }, (_, index) => {
    const date = formatLocalISODate(addLocalDays(now, index - 6));
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
  getGoal: async (id: string): Promise<Goal> => {
    const goals = await getGoals();
    const occurrence = parseOccurrenceId(id);
    const goal = goals.find((g) => g.id === (occurrence?.goalId ?? id));
    if (!goal) throw new Error("Meta nao encontrada");
    return occurrence ? expandRecurringGoal(goal, occurrence.date, occurrence.date)[0] : goal;
  },

  listGoals: async (filters: GoalFilters = {}): Promise<Goal[]> => {
    const goals = await getGoals();
    return sortGoals(applyFilters(expandGoals(goals, filters), filters));
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
    const occurrence = parseOccurrenceId(id);
    const index = goals.findIndex((g) => g.id === (occurrence?.goalId ?? id));
    if (index < 0) throw new Error("Meta nao encontrada");

    const previous = goals[index];
    const occurrenceStatusOnly =
      occurrence &&
      patch.status !== undefined &&
      Object.keys(patch).every((key) => key === "status" || key === "completed_at");

    if (occurrenceStatusOnly) {
      const nextStatus = patch.status as Status;
      const statusChanged = nextStatus !== (previous.recurrence_overrides?.[occurrence.date]?.status ?? previous.status);
      const nextOverrides = { ...(previous.recurrence_overrides ?? {}) };
      nextOverrides[occurrence.date] = {
        status: nextStatus,
        completed_at:
          statusChanged && nextStatus === "concluida"
            ? new Date().toISOString()
            : statusChanged
              ? null
              : previous.recurrence_overrides?.[occurrence.date]?.completed_at ?? null,
      };

      const next: Goal = {
        ...previous,
        recurrence_overrides: nextOverrides,
      };
      const updated = [...goals];
      updated[index] = next;
      await saveGoals(updated);
      return expandRecurringGoal(next, occurrence.date, occurrence.date)[0];
    }

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
    const occurrence = parseOccurrenceId(id);
    const goalId = occurrence?.goalId ?? id;
    const index = goals.findIndex((g) => g.id === goalId);
    const goal = goals[index];

    if (!goal?.recurrence) {
      await saveGoals(goals.filter((g) => g.id !== goalId));
      return { ok: true };
    }

    const stopDate = occurrence?.date ?? todayLocalISO();
    const endDate = formatLocalISODate(addLocalDays(parseLocalISODate(stopDate), -1));
    const completedRecords = goal.status === "concluida" || Object.values(goal.recurrence_overrides ?? {}).some(
      (override) => override.status === "concluida",
    );

    if (endDate < goal.recurrence.start_date && !completedRecords) {
      await saveGoals(goals.filter((g) => g.id !== goalId));
      return { ok: true };
    }

    const currentEndDate = goal.recurrence.end_date;
    const nextEndDate = currentEndDate && currentEndDate < endDate ? currentEndDate : endDate;
    const updated = [...goals];
    updated[index] = {
      ...goal,
      recurrence: {
        ...goal.recurrence,
        end_date: nextEndDate,
      },
    };
    await saveGoals(updated);
    return { ok: true };
  },

  getStats: async (): Promise<Stats> => {
    const goals = await getGoals();
    return calculateStats(expandGoals(goals, lastYearRange()));
  },

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
    const items = hydrateAchievements(evaluateAchievements(expandGoals(goals, lastYearRange())), unlockedMap);
    return {
      items,
      total: items.length,
      unlocked: items.filter((item) => item.unlocked).length,
    };
  },

  checkAchievements: async (): Promise<{ newly_unlocked: Achievement[]; total_unlocked: number }> => {
    const [goals, unlockedMap] = await Promise.all([getGoals(), getUnlockedMap()]);
    const evaluated = evaluateAchievements(expandGoals(goals, lastYearRange()));
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
    const today = parseLocalISODate(todayLocalISO());
    const start = formatLocalISODate(addLocalDays(today, -29));
    const expandedGoals = expandGoals(goals, { date_from: start, date_to: formatLocalISODate(today) });
    const completed = expandedGoals.filter((g) => g.status === "concluida" && g.date >= start);
    const by_category: Record<string, number> = {};
    const by_priority: Record<string, number> = {};

    for (const goal of completed) {
      by_category[goal.category] = (by_category[goal.category] ?? 0) + 1;
      by_priority[goal.priority] = (by_priority[goal.priority] ?? 0) + 1;
    }

    const evolution = Array.from({ length: 30 }, (_, index) => {
      const date = formatLocalISODate(addLocalDays(today, index - 29));
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
