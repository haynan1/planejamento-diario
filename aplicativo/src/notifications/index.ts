import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { storage } from "@/src/utils/storage";
import { Goal, recurrenceMatchesDate } from "@/src/api/client";
import { addLocalDays, formatLocalISODate, parseLocalISODate, todayLocalISO } from "@/src/utils/date";

const STORAGE_KEY = "rf_goal_notif_ids";
const RECURRENCE_ID_SEPARATOR = "::";
const NOTIFICATION_LOOKAHEAD_DAYS = 366;

type NotifMap = Record<string, string>; // goalId -> notificationId

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
    return JSON.parse(raw) as NotifMap;
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

function buildNextTriggerDate(goal: Goal): Date | null {
  if (!goal.recurrence) return buildTriggerDate(goal);
  if (goal.status === "concluida" && !goal.series_id) return null;

  let cursor = parseLocalISODate(
    [todayLocalISO(), goal.date, goal.recurrence.start_date].sort().at(-1) ?? todayLocalISO(),
  );

  for (let i = 0; i <= NOTIFICATION_LOOKAHEAD_DAYS; i += 1) {
    const date = formatLocalISODate(cursor);
    const override = goal.recurrence_overrides?.[date];
    if (recurrenceMatchesDate(goal.recurrence, date) && override?.status !== "concluida") {
      const trigger = buildTriggerDateForGoalDate(goal, date);
      if (trigger) return trigger;
    }
    cursor = addLocalDays(cursor, 1);
  }

  return null;
}

export async function scheduleGoalNotification(goal: Goal): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const perm = await getNotificationPermissionState();
  if (!perm.granted) return null;

  const map = await getMap();
  // Cancel previous, if any
  const key = notificationKey(goal.series_id ?? goal.id);
  if (map[key]) {
    try {
      await Notifications.cancelScheduledNotificationAsync(map[key]);
    } catch {
      // ignore
    }
  }
  const trigger = buildNextTriggerDate(goal);
  if (!trigger || goal.status === "concluida") {
    delete map[key];
    await setMap(map);
    return null;
  }
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
    map[key] = id;
    await setMap(map);
    return id;
  } catch {
    return null;
  }
}

export async function cancelGoalNotification(goalId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const map = await getMap();
  const key = notificationKey(goalId);
  const id = map[key] ?? map[goalId];
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
    delete map[key];
    delete map[goalId];
    await setMap(map);
  }
}

export async function cancelAllGoalNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
  await setMap({});
}
