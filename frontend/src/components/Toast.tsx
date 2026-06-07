import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Text, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme/ThemeProvider";

type ToastType = "success" | "error" | "info";

interface ToastCtx {
  show: (msg: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>("success");
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string, t: ToastType = "success") => {
      setMsg(m);
      setType(t);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          setMsg(null);
        });
      }, 2200);
    },
    [opacity]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const iconName: Record<ToastType, React.ComponentProps<typeof Feather>["name"]> = {
    success: "check-circle",
    error: "alert-circle",
    info: "info",
  };
  const tint: Record<ToastType, string> = {
    success: colors.success,
    error: colors.accent,
    info: colors.info,
  };

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              opacity,
              top: insets.top + 12,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          testID="toast"
        >
          <Feather name={iconName[type]} size={18} color={tint[type]} />
          <Text style={[styles.msg, { color: colors.textPrimary }]} numberOfLines={2}>{msg}</Text>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) return { show: () => {} };
  return c;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    left: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 9999,
  },
  msg: { flex: 1, fontSize: 14, fontWeight: "600" },
});
