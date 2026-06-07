export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  info: string;
  overlay: string;
}

export const darkColors: ThemeColors = {
  background: "#070B14",
  surface: "#121A2F",
  surfaceElevated: "#1C2741",
  primary: "#3B69FF",
  accent: "#FF2A4D",
  textPrimary: "#FFFFFF",
  textSecondary: "#8D9EBA",
  textMuted: "#5C6A87",
  border: "#212E4A",
  success: "#10B981",
  warning: "#F59E0B",
  info: "#3B82F6",
  overlay: "rgba(0,0,0,0.6)",
};

export const lightColors: ThemeColors = {
  background: "#F4F6F9",
  surface: "#FFFFFF",
  surfaceElevated: "#F8FAFC",
  primary: "#214FE0",
  accent: "#E61A3A",
  textPrimary: "#0A1121",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  success: "#059669",
  warning: "#D97706",
  info: "#2563EB",
  overlay: "rgba(15,23,42,0.45)",
};

export const radius = {
  card: 16,
  button: 999,
  chip: 999,
  modal: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const getColors = (mode: ThemeMode): ThemeColors =>
  mode === "dark" ? darkColors : lightColors;
