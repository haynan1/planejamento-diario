import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  api,
  FreeLimitError,
  XP_PER_COMPLETED_GOAL,
  recurrenceMatchesDate,
  Goal,
} from "@/src/api/client";
import { STORAGE_KEYS } from "@/src/constants/storage";
import { addLocalDays, formatLocalISODate, parseLocalISODate, todayLocalISO } from "@/src/utils/date";

const NOW = new Date("2026-06-08T09:00:00");

/** Day offset from the frozen "now", expressed as a local ISO date string. */
const iso = (offsetDays: number) =>
  formatLocalISODate(addLocalDays(parseLocalISODate(formatLocalISODate(NOW)), offsetDays));

type NewGoal = Omit<Goal, "id" | "created_at" | "completed_at">;

function baseGoal(overrides: Partial<NewGoal> = {}): NewGoal {
  return {
    title: "Meta de teste",
    date: todayLocalISO(),
    priority: "media",
    category: "estudos",
    status: "pendente",
    ...overrides,
  };
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  await AsyncStorage.clear();
  await api.clearData();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("recurrenceMatchesDate", () => {
  it("matches every day of a 'forever' recurrence from its start date onward", () => {
    const recurrence = { type: "forever" as const, start_date: iso(0) };
    expect(recurrenceMatchesDate(recurrence, iso(0))).toBe(true);
    expect(recurrenceMatchesDate(recurrence, iso(10))).toBe(true);
    expect(recurrenceMatchesDate(recurrence, iso(-1))).toBe(false);
  });

  it("treats end_date as an inclusive upper bound", () => {
    const recurrence = { type: "forever" as const, start_date: iso(0), end_date: iso(5) };
    expect(recurrenceMatchesDate(recurrence, iso(5))).toBe(true);
    expect(recurrenceMatchesDate(recurrence, iso(6))).toBe(false);
  });

  it("limits 'count' recurrences to the configured number of days", () => {
    const recurrence = { type: "count" as const, start_date: iso(0), days: 3 };
    expect(recurrenceMatchesDate(recurrence, iso(0))).toBe(true);
    expect(recurrenceMatchesDate(recurrence, iso(2))).toBe(true);
    expect(recurrenceMatchesDate(recurrence, iso(3))).toBe(false);
  });

  it("filters weekdays/weekends by the actual day of week", () => {
    const weekdays = { type: "weekdays" as const, start_date: iso(-30) };
    const weekends = { type: "weekends" as const, start_date: iso(-30) };
    for (let offset = 0; offset < 14; offset += 1) {
      const date = iso(offset);
      const day = parseLocalISODate(date).getDay();
      expect(recurrenceMatchesDate(weekdays, date)).toBe(day >= 1 && day <= 5);
      expect(recurrenceMatchesDate(weekends, date)).toBe(day === 0 || day === 6);
    }
  });
});

describe("createGoal", () => {
  it("persists a new goal with a generated id and timestamps", async () => {
    const goal = await api.createGoal(baseGoal({ title: "Estudar TypeScript" }));
    expect(goal.id).toBeTruthy();
    expect(goal.created_at).toBeTruthy();
    expect(goal.completed_at).toBeNull();

    const stored = await api.listGoals({ date_eq: todayLocalISO() });
    expect(stored.map((g) => g.title)).toContain("Estudar TypeScript");
  });

  it("stamps completed_at when created already completed", async () => {
    const goal = await api.createGoal(baseGoal({ status: "concluida" }));
    expect(goal.completed_at).toBeTruthy();
  });

  it("enforces the free active-goal limit", async () => {
    for (let i = 0; i < 5; i += 1) {
      await api.createGoal(baseGoal({ title: `Meta ${i}`, date: iso(i) }));
    }
    await expect(
      api.createGoal(baseGoal({ title: "Meta extra", date: iso(5) })),
    ).rejects.toBeInstanceOf(FreeLimitError);
  });

  it("does not count already-completed goals toward the active limit", async () => {
    for (let i = 0; i < 5; i += 1) {
      await api.createGoal(baseGoal({ title: `Concluida ${i}`, date: iso(i), status: "concluida" }));
    }
    const goal = await api.createGoal(baseGoal({ title: "Ainda cabe" }));
    expect(goal.id).toBeTruthy();
  });

  it("lifts the active-goal limit for premium users", async () => {
    await api.updateProfile({ is_premium: true });
    for (let i = 0; i < 6; i += 1) {
      await api.createGoal(baseGoal({ title: `Premium ${i}`, date: iso(i) }));
    }
    const goals = await api.listGoals({ date_from: iso(0), date_to: iso(6) });
    expect(goals).toHaveLength(6);
  });
});

describe("updateGoal", () => {
  it("stamps and clears completed_at as status toggles", async () => {
    const goal = await api.createGoal(baseGoal());

    const completed = await api.updateGoal(goal.id, { status: "concluida" });
    expect(completed.completed_at).toBeTruthy();

    const reopened = await api.updateGoal(goal.id, { status: "pendente" });
    expect(reopened.completed_at).toBeNull();
  });

  it("records per-occurrence overrides for recurring goals without mutating the template", async () => {
    const template = await api.createGoal(
      baseGoal({ title: "Treino", recurrence: { type: "forever", start_date: iso(0) } }),
    );
    const occurrenceId = `${template.id}::${iso(2)}`;

    const occurrence = await api.updateGoal(occurrenceId, { status: "concluida" });
    expect(occurrence.id).toBe(occurrenceId);
    expect(occurrence.status).toBe("concluida");
    expect(occurrence.completed_at).toBeTruthy();

    const refreshedTemplate = await api.getGoal(template.id);
    expect(refreshedTemplate.status).toBe("pendente");

    const untouchedOccurrence = await api.getGoal(`${template.id}::${iso(3)}`);
    expect(untouchedOccurrence.status).toBe("pendente");
  });

  it("throws when the goal does not exist", async () => {
    await expect(api.updateGoal("does-not-exist", { status: "concluida" })).rejects.toThrow();
  });

  it("throws when a requested recurring occurrence is outside the series", async () => {
    const template = await api.createGoal(
      baseGoal({ title: "Academia", recurrence: { type: "weekdays", start_date: iso(0) } }),
    );

    await expect(api.getGoal(`${template.id}::${iso(5)}`)).rejects.toThrow("Ocorrencia nao encontrada");
  });
});

describe("deleteGoal", () => {
  it("removes a non-recurring goal entirely", async () => {
    const goal = await api.createGoal(baseGoal());
    await api.deleteGoal(goal.id);
    await expect(api.getGoal(goal.id)).rejects.toThrow();
  });

  it("truncates a recurring series right before the stopped occurrence", async () => {
    const template = await api.createGoal(
      baseGoal({ title: "Corrida", recurrence: { type: "forever", start_date: iso(0) } }),
    );
    await api.deleteGoal(`${template.id}::${iso(2)}`);

    const occurrences = await api.listGoals({ date_from: iso(0), date_to: iso(5) });
    const dates = occurrences.filter((g) => g.series_id === template.id).map((g) => g.date);
    expect(dates).toEqual([iso(0), iso(1)]);
  });

  it("removes a future recurring series outright when it has no completions yet", async () => {
    const template = await api.createGoal(
      baseGoal({ title: "Futuro", date: iso(5), recurrence: { type: "forever", start_date: iso(5) } }),
    );
    await api.deleteGoal(template.id);
    await expect(api.getGoal(template.id)).rejects.toThrow();
  });

  it("throws when deleting a goal that does not exist", async () => {
    await expect(api.deleteGoal("does-not-exist")).rejects.toThrow("Meta nao encontrada");
  });
});

describe("listGoals expansion", () => {
  it("expands weekday recurrences only on matching days of the week", async () => {
    const template = await api.createGoal(
      baseGoal({ title: "Academia", recurrence: { type: "weekdays", start_date: iso(0) } }),
    );
    const occurrences = await api.listGoals({ date_from: iso(0), date_to: iso(13) });
    const series = occurrences.filter((g) => g.series_id === template.id);

    for (const goal of series) {
      const day = parseLocalISODate(goal.date).getDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }

    const expectedCount = Array.from({ length: 14 }, (_, i) => parseLocalISODate(iso(i)).getDay()).filter(
      (day) => day >= 1 && day <= 5,
    ).length;
    expect(series).toHaveLength(expectedCount);
  });

  it("limits 'count' recurrences to N occurrences from the start date", async () => {
    await api.createGoal(
      baseGoal({ title: "Desafio 3 dias", recurrence: { type: "count", start_date: iso(0), days: 3 } }),
    );
    const occurrences = await api.listGoals({ date_from: iso(0), date_to: iso(10) });
    expect(occurrences.map((g) => g.date)).toEqual([iso(0), iso(1), iso(2)]);
  });
});

describe("getStats", () => {
  it("computes today's counters, xp and level from goal data", async () => {
    await api.createGoal(baseGoal({ title: "Feito", status: "concluida" }));
    await api.createGoal(baseGoal({ title: "Pendente", status: "pendente" }));

    const stats = await api.getStats();
    expect(stats.completed_today).toBe(1);
    expect(stats.pending_today).toBe(1);
    expect(stats.total_today).toBe(2);
    expect(stats.xp).toBe(XP_PER_COMPLETED_GOAL);
    expect(stats.level).toBe(1);
  });

  it("keeps the streak alive and not at risk once today is already productive", async () => {
    await api.createGoal(baseGoal({ title: "Hoje", date: iso(0), status: "concluida" }));
    await api.createGoal(baseGoal({ title: "Ontem", date: iso(-1), status: "concluida" }));
    await api.createGoal(baseGoal({ title: "Anteontem", date: iso(-2), status: "concluida" }));

    const stats = await api.getStats();
    expect(stats.current_streak).toBe(3);
    expect(stats.streak_at_risk).toBe(false);
  });

  it("falls back to yesterday's streak and flags risk while today has pending work", async () => {
    await api.createGoal(baseGoal({ title: "Ontem", date: iso(-1), status: "concluida" }));
    await api.createGoal(baseGoal({ title: "Anteontem", date: iso(-2), status: "concluida" }));
    await api.createGoal(baseGoal({ title: "Hoje pendente", date: iso(0), status: "pendente" }));

    const stats = await api.getStats();
    expect(stats.current_streak).toBe(2);
    expect(stats.streak_at_risk).toBe(true);
  });

  it("does not flag risk when there is nothing pending today to lose the streak over", async () => {
    await api.createGoal(baseGoal({ title: "Ontem", date: iso(-1), status: "concluida" }));

    const stats = await api.getStats();
    expect(stats.current_streak).toBe(1);
    expect(stats.streak_at_risk).toBe(false);
  });
});

describe("achievements", () => {
  it("unlocks first_goal on creation and reports progress toward the next milestone", async () => {
    await api.createGoal(baseGoal({ title: "Primeira meta" }));

    const { newly_unlocked } = await api.checkAchievements();
    expect(newly_unlocked.map((a) => a.key)).toContain("first_goal");

    const { items } = await api.listAchievements();
    const created3 = items.find((a) => a.key === "created_3")!;
    expect(created3.unlocked).toBe(false);
    expect(created3.progress_current).toBe(1);
    expect(created3.progress_target).toBe(3);
  });

  it("unlocks completion milestones once and never re-reports them", async () => {
    const goal = await api.createGoal(baseGoal({ title: "Concluir" }));
    await api.updateGoal(goal.id, { status: "concluida" });

    const first = await api.checkAchievements();
    expect(first.newly_unlocked.map((a) => a.key)).toContain("completed_1");

    const second = await api.checkAchievements();
    expect(second.newly_unlocked).toHaveLength(0);
    expect(second.total_unlocked).toBe(first.total_unlocked);
  });
});

describe("checkLevelUp", () => {
  it("reports a level-up exactly once when crossing the XP threshold", async () => {
    const goalsNeeded = Math.ceil(150 / XP_PER_COMPLETED_GOAL);
    for (let i = 0; i < goalsNeeded; i += 1) {
      await api.createGoal(baseGoal({ title: `Meta ${i}`, date: iso(i % 5), status: "concluida" }));
    }

    expect(await api.checkLevelUp()).toEqual({ leveled_up: true, level: 2, previous: 1 });
    expect(await api.checkLevelUp()).toEqual({ leveled_up: false, level: 2, previous: 2 });
  });
});

describe("monthlyReport", () => {
  it("aggregates only the last 30 days of completed goals by category and priority", async () => {
    await api.createGoal(
      baseGoal({ title: "Estudo", date: iso(-1), status: "concluida", category: "estudos", priority: "alta" }),
    );
    await api.createGoal(
      baseGoal({ title: "Trabalho", date: iso(-2), status: "concluida", category: "trabalho", priority: "media" }),
    );
    await api.createGoal(
      baseGoal({ title: "Antigo demais", date: iso(-40), status: "concluida", category: "saude", priority: "baixa" }),
    );
    await api.createGoal(
      baseGoal({ title: "Pendente", date: iso(-1), status: "pendente", category: "estudos", priority: "alta" }),
    );

    const report = await api.monthlyReport();
    expect(report.by_category).toEqual({ estudos: 1, trabalho: 1 });
    expect(report.by_priority).toEqual({ alta: 1, media: 1 });
    expect(report.total_completed_30d).toBe(2);
    expect(report.evolution).toHaveLength(30);
    expect(report.evolution.find((e) => e.date === iso(-1))?.count).toBe(1);
    expect(report.evolution.find((e) => e.date === iso(-2))?.count).toBe(1);
  });

  it("separates on-time completions, late completions and missed goals", async () => {
    jest.setSystemTime(parseLocalISODate(iso(-2)));
    const onTime = await api.createGoal(baseGoal({ title: "No prazo", date: iso(-2) }));
    await api.updateGoal(onTime.id, { status: "concluida" });

    jest.setSystemTime(NOW);
    const late = await api.createGoal(baseGoal({ title: "Atrasada", date: iso(-3) }));
    await api.updateGoal(late.id, { status: "concluida" });
    await api.createGoal(baseGoal({ title: "Nao feita", date: iso(-1), status: "pendente" }));

    const report = await api.monthlyReport();
    expect(report.total_due_30d).toBe(3);
    expect(report.total_completed_30d).toBe(2);
    expect(report.total_late_completed_30d).toBe(1);
    expect(report.total_missed_30d).toBe(1);
    expect(report.evolution.find((e) => e.date === iso(-3))?.late_count).toBe(1);
    expect(report.evolution.find((e) => e.date === iso(-1))?.missed_count).toBe(1);
  });

  it("reports missed occurrences from recurring goals without storing each occurrence", async () => {
    await api.createGoal(
      baseGoal({ title: "Ritual", date: iso(-2), recurrence: { type: "count", start_date: iso(-2), days: 3 } }),
    );

    const report = await api.monthlyReport();
    expect(report.total_due_30d).toBe(3);
    expect(report.total_missed_30d).toBe(2);
    expect(report.evolution.find((e) => e.date === iso(-2))?.missed_count).toBe(1);
    expect(report.evolution.find((e) => e.date === iso(-1))?.missed_count).toBe(1);
    expect(report.evolution.find((e) => e.date === iso(0))?.missed_count).toBe(0);
  });
});

describe("clearData", () => {
  it("wipes goals and persisted app preferences", async () => {
    await api.createGoal(baseGoal({ title: "Para apagar", status: "concluida" }));
    await api.updateProfile({
      name: "Usuario teste",
      motivational_phrases_enabled: false,
      is_premium: true,
      notifications_enabled: true,
      avatar_base64: "data:image/jpeg;base64,abc",
    });
    await AsyncStorage.setItem(STORAGE_KEYS.themeMode, JSON.stringify("light"));
    await AsyncStorage.setItem(STORAGE_KEYS.goalNotificationIds, JSON.stringify(JSON.stringify({ goal: ["notif-id"] })));
    await api.checkAchievements();
    await api.checkLevelUp();

    await api.clearData();

    expect(await api.listGoals({ date_eq: todayLocalISO() })).toHaveLength(0);
    expect((await api.listAchievements()).unlocked).toBe(0);
    expect(await api.getProfile()).toMatchObject({
      name: "Astronauta",
      motivational_phrases_enabled: true,
      is_premium: false,
      notifications_enabled: false,
      avatar_base64: null,
    });
    expect(await AsyncStorage.getItem(STORAGE_KEYS.themeMode)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.goalNotificationIds)).toBeNull();
  });
});
