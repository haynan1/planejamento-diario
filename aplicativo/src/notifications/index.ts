import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { storage } from "@/src/utils/storage";
import { Goal } from "@/src/api/client";

const STORAGE_KEY = "rf_goal_notif_ids";

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
  if (!goal.date) return null;
  const dateStr = goal.time ? `${goal.date}T${goal.time}:00` : `${goal.date}T09:00:00`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // Only schedule if in the future (at least 30 seconds ahead)
  if (d.getTime() < Date.now() + 30 * 1000) return null;
  return d;
}

export async function scheduleGoalNotification(goal: Goal): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const perm = await getNotificationPermissionState();
  if (!perm.granted) return null;

  const map = await getMap();
  // Cancel previous, if any
  if (map[goal.id]) {
    try {
      await Notifications.cancelScheduledNotificationAsync(map[goal.id]);
    } catch {
      // ignore
    }
  }
  const trigger = buildTriggerDate(goal);
  if (!trigger || goal.status === "concluida") {
    delete map[goal.id];
    await setMap(map);
    return null;
  }
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Hora de avançar 🚀",
        body: goal.title,
        data: { goalId: goal.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
    map[goal.id] = id;
    await setMap(map);
    return id;
  } catch {
    return null;
  }
}

export async function cancelGoalNotification(goalId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const map = await getMap();
  const id = map[goalId];
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
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
