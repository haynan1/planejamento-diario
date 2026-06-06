import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/theme/ThemeProvider";
import { api, Achievement } from "@/src/api/client";

interface CtxValue {
  /** Calls backend to evaluate achievements and shows the first newly unlocked one. */
  checkAndCelebrate: () => Promise<void>;
}

const Ctx = createContext<CtxValue | null>(null);

const iconMap: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  rocket: "navigation",
  "check-circle": "check-circle",
  "trending-up": "trending-up",
  zap: "zap",
  globe: "globe",
  star: "star",
  flame: "zap",
  compass: "compass",
  sun: "sun",
};

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const showNext = useCallback(
    (list: Achievement[]) => {
      if (list.length === 0) return;
      const [first, ...rest] = list;
      setCurrent(first);
      setQueue(rest);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    },
    [scale, opacity]
  );

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.7, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(null);
      if (queue.length > 0) {
        // Slight delay before showing next
        setTimeout(() => showNext(queue), 250);
      }
    });
  }, [scale, opacity, queue, showNext]);

  const checkAndCelebrate = useCallback(async () => {
    try {
      const res = await api.checkAchievements();
      if (res.newly_unlocked && res.newly_unlocked.length > 0) {
        showNext(res.newly_unlocked);
      }
    } catch {
      // ignore
    }
  }, [showNext]);

  return (
    <Ctx.Provider value={{ checkAndCelebrate }}>
      {children}
      <Modal
        transparent
        visible={!!current}
        animationType="none"
        onRequestClose={close}
        testID="achievement-modal"
      >
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          {current ? (
            <Animated.View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  opacity,
                  transform: [{ scale }],
                },
              ]}
            >
              <LinearGradient
                colors={[colors.accent, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconRing}
              >
                <View style={[styles.iconCenter, { backgroundColor: colors.surfaceElevated }]}>
                  <Feather
                    name={iconMap[current.icon] ?? "award"}
                    size={36}
                    color={colors.accent}
                  />
                </View>
              </LinearGradient>
              <Text style={[styles.label, { color: colors.accent }]}>CONQUISTA DESBLOQUEADA</Text>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                {current.description}
              </Text>
              <TouchableOpacity
                onPress={close}
                style={[styles.btn, { backgroundColor: colors.accent }]}
                testID="achievement-modal-close"
              >
                <Text style={styles.btnText}>Continuar avançando</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

export function useAchievements() {
  const c = useContext(Ctx);
  if (!c) return { checkAndCelebrate: async () => {} };
  return c;
}

export { iconMap };

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3, textAlign: "center" },
  desc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  btn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    alignSelf: "stretch",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.2 },
});
