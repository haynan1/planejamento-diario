import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { STORAGE_KEYS } from "@/src/constants/storage";
import { storage } from "@/src/utils/storage";
import { ThemeMode, ThemeColors, getColors } from "./index";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
  resetMode: () => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = STORAGE_KEYS.themeMode;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(STORAGE_KEY, "dark");
      if (stored === "light" || stored === "dark") {
        setModeState(stored);
      }
      setHydrated(true);
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.setItem(STORAGE_KEY, m);
  }, []);

  const resetMode = useCallback(() => {
    setModeState("dark");
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      storage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, colors: getColors(mode), setMode, resetMode, toggle }),
    [mode, setMode, resetMode, toggle]
  );

  if (!hydrated) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
