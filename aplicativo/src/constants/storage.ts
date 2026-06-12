export const STORAGE_KEYS = {
  goals: "rocket_forward:goals",
  profile: "rocket_forward:profile",
  achievements: "rocket_forward:achievements",
  level: "rocket_forward:level",
  themeMode: "rf_theme_mode",
  goalNotificationIds: "rf_goal_notif_ids",
} as const;

export const APP_STORAGE_KEYS = Object.values(STORAGE_KEYS);
