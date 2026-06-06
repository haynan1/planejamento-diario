import { Priority, Status, Category } from "@/src/constants/goals";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    if (res.status === 402 && parsed?.detail?.code === "FREE_LIMIT_REACHED") {
      throw new FreeLimitError(parsed.detail.message, parsed.detail.limit);
    }
    const text = parsed ? JSON.stringify(parsed) : `Request failed: ${res.status}`;
    throw new Error(text);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface GoalFilters {
  status?: Status;
  priority?: Priority;
  category?: Category;
  date_from?: string;
  date_to?: string;
  date_eq?: string;
}

export const api = {
  listGoals: (filters: GoalFilters = {}): Promise<Goal[]> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, String(v));
    });
    const qs = params.toString();
    return request<Goal[]>(`/goals${qs ? `?${qs}` : ""}`);
  },
  createGoal: (g: Omit<Goal, "id" | "created_at" | "completed_at">): Promise<Goal> =>
    request<Goal>("/goals", { method: "POST", body: JSON.stringify(g) }),
  updateGoal: (id: string, g: Partial<Goal>): Promise<Goal> =>
    request<Goal>(`/goals/${id}`, { method: "PUT", body: JSON.stringify(g) }),
  deleteGoal: (id: string): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>(`/goals/${id}`, { method: "DELETE" }),
  getStats: (): Promise<Stats> => request<Stats>("/stats"),
  getProfile: (): Promise<Profile> => request<Profile>("/profile"),
  updateProfile: (p: Partial<Profile>): Promise<Profile> =>
    request<Profile>("/profile", { method: "PUT", body: JSON.stringify(p) }),
  clearData: (): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>("/clear-data", { method: "POST" }),
  listAchievements: (): Promise<AchievementsResponse> =>
    request<AchievementsResponse>("/achievements"),
  checkAchievements: (): Promise<{ newly_unlocked: Achievement[]; total_unlocked: number }> =>
    request<{ newly_unlocked: Achievement[]; total_unlocked: number }>("/achievements/check", {
      method: "POST",
    }),
  monthlyReport: (): Promise<MonthlyReport> => request<MonthlyReport>("/reports/monthly"),
};
