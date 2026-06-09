import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Thin web-safe wrapper around expo-haptics — the native module is unavailable
 * on web, and every call site would otherwise need its own Platform guard.
 */
const fire = (fn: () => Promise<void>) => {
  if (Platform.OS === "web") return;
  fn().catch(() => {});
};

export const haptics = {
  /** Light tap for routine taps — toggles, chips, navigation. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Slightly stronger tap for committing an action — saving, cycling status. */
  select: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Destructive actions — deleting or ending a goal. */
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Positive milestones — completing a goal, unlocking an achievement, leveling up. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
