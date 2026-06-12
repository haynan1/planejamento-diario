import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { STORAGE_KEYS } from "@/src/constants/storage";
import { storage } from "@/src/utils/storage";
import { api, Goal, recurrenceMatchesDate } from "@/src/api/client";
import { addLocalDays, formatLocalISODate, parseLocalISODate, todayLocalISO } from "@/src/utils/date";

const STORAGE_KEY = STORAGE_KEYS.goalNotificationIds;
const RECURRENCE_ID_SEPARATOR = "::";
const NOTIFICATION_LOOKAHEAD_DAYS = 366;
// How many upcoming occurrences to schedule at once for a recurring goal.
// Local notification budgets are limited (iOS caps ~64 pending app-wide), so we
// keep a rolling window instead of scheduling the whole series, and refill it
// via resyncRecurringNotifications() whenever the app comes to the foreground.
const NOTIFICATION_BATCH_SIZE = 8;

type NotifMap = Record<string, string[]>; // goalId -> notificationIds

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getMap(): Promise<NotifMap> {
  const raw = await storage.getItem<string>(STORAGE_KEY, "");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string | string[]>;
    const normalized: NotifMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      // Older versions stored a single id per goal; normalize to an array.
      normalized[key] = Array.isArray(value) ? value : [value];
    }
    return normalized;
  } catch {
    return {};
  }
}

async function setMap(m: NotifMap) {
  await storage.setItem(STORAGE_KEY, JSON.stringify(m));
}

export interface PermissionState {
  status: Notifications.PermissionStatus;
  canAskAgain: boolean;
  granted: boolean;
}

export async function getNotificationPermissionState(): Promise<PermissionState> {
  if (Platform.OS === "web") {
    return { status: "denied" as any, canAskAgain: false, granted: false };
  }
  const res = await Notifications.getPermissionsAsync();
  return {
    status: res.status,
    canAskAgain: res.canAskAgain ?? false,
    granted: res.status === "granted",
  };
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (Platform.OS === "web") {
    return { status: "denied" as any, canAskAgain: false, granted: false };
  }
  const res = await Notifications.requestPermissionsAsync();
  return {
    status: res.status,
    canAskAgain: res.canAskAgain ?? false,
    granted: res.status === "granted",
  };
}

function buildTriggerDate(goal: Goal): Date | null {
  return buildTriggerDateForGoalDate(goal, goal.date);
}

function buildTriggerDateForGoalDate(goal: Goal, date: string): Date | null {
  if (!date) return null;
  const [hours, minutes] = (goal.time ?? "09:00").split(":").map(Number);
  const d = parseLocalISODate(date);
  d.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() < Date.now() + 30 * 1000) return null;
  return d;
}

function notificationKey(goalId: string) {
  return goalId.split(RECURRENCE_ID_SEPARATOR)[0];
}

/**
 * Returns up to `limit` future trigger dates for a goal.
 * For one-off goals this is at most a single date; for recurring goals it walks
 * the lookahead window collecting the next non-completed occurrences so we can
 * schedule a rolling batch instead of just the very next one.
 */
function buildUpcomingTriggerDates(goal: Goal, limit: number): Date[] {
  if (!goal.recurrence) {
    const trigger = buildTriggerDate(goal);
    return trigger ? [trigger] : [];
  }
  if (goal.status === "concluida" && !goal.series_id) return [];

  const dates: Date[] = [];
  let cursor = parseLocalISODate(
    [todayLocalISO(), goal.date, goal.recurrence.start_date].sort().at(-1) ?? todayLocalISO(),
  );

  for (let i = 0; i <= NOTIFICATION_LOOKAHEAD_DAYS && dates.length < limit; i += 1) {
    const date = formatLocalISODate(cursor);
    const override = goal.recurrence_overrides?.[date];
    if (recurrenceMatchesDate(goal.recurrence, date) && override?.status !== "concluida") {
      const trigger = buildTriggerDateForGoalDate(goal, date);
      if (trigger) dates.push(trigger);
    }
    cursor = addLocalDays(cursor, 1);
  }

  return dates;
}

async function cancelIds(ids: string[]) {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
  }
}

export async function scheduleGoalNotification(goal: Goal): Promise<string[] | null> {
  if (Platform.OS === "web") return null;
  const perm = await getNotificationPermissionState();
  if (!perm.granted) return null;

  const map = await getMap();
  const key = notificationKey(goal.series_id ?? goal.id);

  // Cancel whatever was scheduled before so we never accumulate stale ids.
  await cancelIds(map[key] ?? []);

  if (goal.status === "concluida" && !goal.recurrence) {
    delete map[key];
    await setMap(map);
    return null;
  }

  const limit = goal.recurrence ? NOTIFICATION_BATCH_SIZE : 1;
  const triggers = buildUpcomingTriggerDates(goal, limit);
  if (triggers.length === 0) {
    delete map[key];
    await setMap(map);
    return null;
  }

  const ids: string[] = [];
  for (const trigger of triggers) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Hora de avançar 🚀",
          body: goal.title,
          data: { goalId: key },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        },
      });
      ids.push(id);
    } catch {
      // ignore individual scheduling failures
    }
  }

  if (ids.length === 0) {
    delete map[key];
    await setMap(map);
    return null;
  }

  map[key] = ids;
  await setMap(map);
  return ids;
}

export async function cancelGoalNotification(goalId: string): Promise<void> {
  const map = await getMap();
  const key = notificationKey(goalId);
  const ids = [...(map[key] ?? []), ...(map[goalId] ?? [])];

  if (Platform.OS !== "web" && ids.length > 0) {
    await cancelIds(ids);
  }

  if (ids.length > 0 || map[key] || map[goalId]) {
    delete map[key];
    delete map[goalId];
    await setMap(map);
  }
}

/**
 * Refills the rolling notification window for every active recurring goal.
 * Local notification batches drain as occurrences fire/pass, so this should be
 * called whenever the app returns to the foreground (see app/_layout.tsx) to
 * keep recurring reminders alive without requiring the user to re-save goals.
 */
export async function resyncRecurringNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const [perm, profile] = await Promise.all([getNotificationPermissionState(), api.getProfile()]);
    if (!perm.granted || !profile.is_premium || !profile.notifications_enabled) return;

    const goals = await api.listRecurringGoals();
    for (const goal of goals) {
      if (goal.status === "concluida") continue;
      await scheduleGoalNotification(goal);
    }
  } catch {
    // ignore — best effort resync
  }
}

export async function cancelAllGoalNotifications(): Promise<void> {
  if (Platform.OS !== "web") {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // ignore
    }
  }
  await setMap({});
}
