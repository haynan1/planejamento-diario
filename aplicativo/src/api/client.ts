import AsyncStorage from "@react-native-async-storage/async-storage";

import { Priority, Status, Category, CATEGORIES, PRIORITIES } from "@/src/constants/goals";
import { APP_STORAGE_KEYS, STORAGE_KEYS } from "@/src/constants/storage";
import { addLocalDays, formatLocalISODate, parseLocalISODate, todayLocalISO } from "@/src/utils/date";

const GOALS_KEY = STORAGE_KEYS.goals;
const PROFILE_KEY = STORAGE_KEYS.profile;
const ACHIEVEMENTS_KEY = STORAGE_KEYS.achievements;
const LEVEL_KEY = STORAGE_KEYS.level;
const FREE_ACTIVE_GOAL_LIMIT = 5;
const RECURRENCE_ID_SEPARATOR = "::";
const RECURRING_LOOKAHEAD_DAYS = 30;

/** Source of truth for the XP awarded per completed goal — also surfaced in the celebration UI. */
export const XP_PER_COMPLETED_GOAL = 10;

function xpRequiredForLevel(level: number) {
  return level * 150;
}

function levelFromXp(xp: number) {
  let level = 1;
  let xpAtLevelStart = 0;
  let xpForLevel = xpRequiredForLevel(level);
  while (xp >= xpAtLevelStart + xpForLevel) {
    xpAtLevelStart += xpForLevel;
    level += 1;
    xpForLevel = xpRequiredForLevel(level);
  }
  return { level, xpIntoLevel: xp - xpAtLevelStart, xpForLevel };
}

export type RecurrenceType = "weekdays" | "weekends" | "count" | "forever";

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
  /** True when an active streak will lapse unless a goal is completed today. */
  streak_at_risk: boolean;
  weekly_evolution: { date: string; count: number }[];
  xp: number;
  level: number;
  xp_into_level: number;
  xp_for_level: number;
}

export interface Profile {
  id: string;
  name: string;
  motivational_phrases_enabled: boolean;
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
  /** How close the user is to unlocking — null when the achievement has no measurable progress (e.g. "all categories"). */
  progress_current: number | null;
  progress_target: number | null;
}

export interface AchievementsResponse {
  items: Achievement[];
  total: number;
  unlocked: number;
}

export interface MonthlyReport {
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  evolution: { date: string; count: number; late_count: number; missed_count: number }[];
  total_due_30d: number;
  total_completed_30d: number;
  total_late_completed_30d: number;
  total_missed_30d: number;
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

/**
 * Expanding recurring goals into per-date occurrences is the hottest path in
 * this module — every screen load fans out into listGoals/getStats/
 * checkAchievements/checkLevelUp, each re-walking the same ~365-day window.
 * Cache by (date range, day) and drop the cache whenever goals are written;
 * "day" keeps "today"-relative ranges correct across midnight rollovers.
 */
const expansionCache = new Map<string, { today: string; result: Goal[] }>();

function expandGoals(goals: Goal[], filters: GoalFilters) {
  const range = getRecurringRange(filters);
  const today = todayLocalISO();
  const cacheKey = `${range.from}|${range.to}`;
  const cached = expansionCache.get(cacheKey);
  if (cached && cached.today === today) return cached.result;

  const result = goals.flatMap((goal) => expandRecurringGoal(goal, range.from, range.to));
  expansionCache.set(cacheKey, { today, result });
  return result;
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
  expansionCache.clear();
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

function completedLocalDate(goal: Goal) {
  if (!goal.completed_at) return null;
  const date = new Date(goal.completed_at);
  if (Number.isNaN(date.getTime())) return null;
  return formatLocalISODate(date);
}

function wasCompletedLate(goal: Goal) {
  const completedDate = completedLocalDate(goal);
  return Boolean(completedDate && completedDate > goal.date);
}

function emptyReportDay(date: string) {
  return { date, count: 0, late_count: 0, missed_count: 0 };
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

function streakEndingAt(dates: Set<string>, date: string) {
  let cursor = parseLocalISODate(date);
  let count = 0;
  while (dates.has(formatLocalISODate(cursor))) {
    count += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return count;
}

/**
 * A streak survives until the day actually ends — someone who hasn't completed
 * anything yet at 8am still has yesterday's streak "alive". Counting it as 0
 * the instant the clock rolls over would be both wrong and needlessly
 * discouraging, so we fall back to the streak ending yesterday when today has
 * no productive record yet.
 */
function currentStreak(dates: Set<string>) {
  const today = todayLocalISO();
  if (dates.has(today)) return streakEndingAt(dates, today);
  return streakEndingAt(dates, formatLocalISODate(addLocalDays(parseLocalISODate(today), -1)));
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
  const progress: Record<string, { current: number; target: number }> = {};

  const mark = (key: string, current: number, target: number) => {
    evaluated[key] = current >= target;
    progress[key] = { current, target };
  };

  for (const count of createdMilestones) {
    mark(count === 1 ? "first_goal" : `created_${count}`, createdGoalIds.size, count);
  }
  for (const count of completedMilestones) {
    mark(`completed_${count}`, completedGoals.length, count);
  }
  for (const days of streakMilestones) {
    mark(`streak_${days}`, streak, days);
  }
  for (const days of productiveDayMilestones) {
    mark(`productive_days_${days}`, dates.size, days);
  }
  for (const days of perfectDayMilestones) {
    mark(days === 1 ? "perfect_day" : `perfect_days_${days}`, perfectDayCount, days);
  }
  for (const category of CATEGORIES) {
    mark(`category_${category.key}`, completedCategories.has(category.key) ? 1 : 0, 1);
  }
  evaluated.all_categories = CATEGORIES.every((c) => completedCategories.has(c.key));
  progress.all_categories = { current: completedCategories.size, target: CATEGORIES.length };
  for (const priority of PRIORITIES) {
    for (const count of [1, 5, 25]) {
      mark(`priority_${priority.key}_${count}`, completedByPriority.get(priority.key) ?? 0, count);
    }
  }
  for (const count of recurringMilestones) {
    mark(`recurring_${count}`, recurringGoalIds.size, count);
  }

  return { evaluated, progress };
}

function hydrateAchievements(
  evaluated: Record<string, boolean>,
  progress: Record<string, { current: number; target: number }>,
  unlockedMap: Record<string, string>,
): Achievement[] {
  return achievementDefinitions.map((definition) => {
    const isUnlocked = Boolean(evaluated[definition.key]);
    const p = progress[definition.key];
    return {
      ...definition,
      unlocked: isUnlocked,
      unlocked_at: isUnlocked ? unlockedMap[definition.key] ?? null : null,
      progress_current: p ? Math.min(p.current, p.target) : null,
      progress_target: p ? p.target : null,
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
  const xp = completed.length * XP_PER_COMPLETED_GOAL;
  const { level, xpIntoLevel, xpForLevel } = levelFromXp(xp);
  const activeStreak = currentStreak(dates);
  const streakAtRisk = activeStreak > 0 && !dates.has(today) && pendingToday > 0;

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
    current_streak: activeStreak,
    streak_at_risk: streakAtRisk,
    weekly_evolution,
    xp,
    level,
    xp_into_level: xpIntoLevel,
    xp_for_level: xpForLevel,
  };
}

export const api = {
  getGoal: async (id: string): Promise<Goal> => {
    const goals = await getGoals();
    const occurrence = parseOccurrenceId(id);
    const goal = goals.find((g) => g.id === (occurrence?.goalId ?? id));
    if (!goal) throw new Error("Meta nao encontrada");
    if (!occurrence) return goal;
    const occurrenceGoal = expandRecurringGoal(goal, occurrence.date, occurrence.date)[0];
    if (!occurrenceGoal) throw new Error("Ocorrencia nao encontrada");
    return occurrenceGoal;
  },

  listGoals: async (filters: GoalFilters = {}): Promise<Goal[]> => {
    const goals = await getGoals();
    return sortGoals(applyFilters(expandGoals(goals, filters), filters));
  },

  /** Raw (non-expanded) recurring goal templates — used to (re)schedule reminders. */
  listRecurringGoals: async (): Promise<Goal[]> => {
    const goals = await getGoals();
    return goals.filter((g) => !!g.recurrence);
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

    if (!goal) throw new Error("Meta nao encontrada");

    if (!goal.recurrence) {
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
    await AsyncStorage.multiRemove(APP_STORAGE_KEYS);
    expansionCache.clear();
    return { ok: true };
  },

  /** Compares the current level against the last seen one, persisting and reporting level-ups for celebration. */
  checkLevelUp: async (): Promise<{ leveled_up: boolean; level: number; previous: number }> => {
    const [goals, storedLevel] = await Promise.all([getGoals(), readJson<number>(LEVEL_KEY, 1)]);
    const completedCount = expandGoals(goals, lastYearRange()).filter((g) => g.status === "concluida").length;
    const { level } = levelFromXp(completedCount * XP_PER_COMPLETED_GOAL);
    if (level !== storedLevel) {
      await writeJson(LEVEL_KEY, level);
    }
    return { leveled_up: level > storedLevel, level, previous: storedLevel };
  },

  listAchievements: async (): Promise<AchievementsResponse> => {
    const [goals, unlockedMap] = await Promise.all([getGoals(), getUnlockedMap()]);
    const { evaluated, progress } = evaluateAchievements(expandGoals(goals, lastYearRange()));
    const items = hydrateAchievements(evaluated, progress, unlockedMap);
    return {
      items,
      total: items.length,
      unlocked: items.filter((item) => item.unlocked).length,
    };
  },

  checkAchievements: async (): Promise<{ newly_unlocked: Achievement[]; total_unlocked: number }> => {
    const [goals, unlockedMap] = await Promise.all([getGoals(), getUnlockedMap()]);
    const { evaluated, progress } = evaluateAchievements(expandGoals(goals, lastYearRange()));
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

    const items = hydrateAchievements(evaluated, progress, nextMap);
    return {
      newly_unlocked: items.filter((item) => newlyUnlockedKeys.includes(item.key)),
      total_unlocked: items.filter((item) => item.unlocked).length,
    };
  },

  monthlyReport: async (): Promise<MonthlyReport> => {
    const goals = await getGoals();
    const todayIso = todayLocalISO();
    const today = parseLocalISODate(todayIso);
    const start = formatLocalISODate(addLocalDays(today, -29));
    const expandedGoals = expandGoals(goals, { date_from: start, date_to: todayIso });
    const due = expandedGoals.filter((g) => g.date >= start && g.date <= todayIso);
    const completed = due.filter((g) => g.status === "concluida");
    const lateCompleted = completed.filter(wasCompletedLate);
    const missed = due.filter((g) => g.date < todayIso && g.status !== "concluida");
    const by_category: Record<string, number> = {};
    const by_priority: Record<string, number> = {};
    const evolutionByDate = new Map<string, { date: string; count: number; late_count: number; missed_count: number }>();

    for (const goal of due) {
      const day = evolutionByDate.get(goal.date) ?? emptyReportDay(goal.date);

      if (goal.status === "concluida") {
        day.count += 1;
        if (wasCompletedLate(goal)) day.late_count += 1;
        by_category[goal.category] = (by_category[goal.category] ?? 0) + 1;
        by_priority[goal.priority] = (by_priority[goal.priority] ?? 0) + 1;
      } else if (goal.date < todayIso) {
        day.missed_count += 1;
      }

      evolutionByDate.set(goal.date, day);
    }

    const evolution = Array.from({ length: 30 }, (_, index) => {
      const date = formatLocalISODate(addLocalDays(today, index - 29));
      return evolutionByDate.get(date) ?? emptyReportDay(date);
    });

    return {
      by_category,
      by_priority,
      evolution,
      total_due_30d: due.length,
      total_completed_30d: completed.length,
      total_late_completed_30d: lateCompleted.length,
      total_missed_30d: missed.length,
    };
  },
};
