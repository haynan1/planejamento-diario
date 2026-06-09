import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/theme/ThemeProvider";
import { api, Achievement, XP_PER_COMPLETED_GOAL } from "@/src/api/client";
import { haptics } from "@/src/utils/haptics";
import Mascot, { MascotPose } from "@/src/components/Mascot";

interface CtxValue {
  /** Evaluates local achievements and shows the first newly unlocked one. */
  checkAndCelebrate: () => Promise<void>;
  celebrateGoalCompletion: (goalTitle?: string) => void;
}

interface CelebrationSpec {
  kicker: string;
  title: string;
  description: string;
  badge: string;
  accentColor: string;
  mascotPose: MascotPose;
}

const Ctx = createContext<CtxValue | null>(null);

/** How long the bottom celebration overlay stays on screen (mirrors the timeout in triggerCelebration). */
const CELEBRATION_OVERLAY_DURATION_MS = 2400;
/** Breathing room between the overlay fading out and the achievement modal appearing. */
const CELEBRATION_HANDOFF_GAP_MS = 250;

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
  award: "award",
  target: "target",
  flag: "flag",
  repeat: "repeat",
};

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);
  const [celebration, setCelebration] = useState<CelebrationSpec | null>(null);
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const completionProgress = useRef(new Animated.Value(0)).current;
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timestamp (ms) when the bottom celebration overlay is expected to finish — lets the achievement modal wait its turn instead of stacking on top of it. */
  const celebrationEndsAtRef = useRef(0);
  const confetti = useRef(
    Array.from({ length: 18 }, (_, index) => ({
      key: index,
      left: 16 + ((index * 37) % 68),
      delay: (index % 6) * 45,
      rotate: index % 2 === 0 ? "18deg" : "-24deg",
      color: ["#22C55E", "#38BDF8", "#F97316", "#FACC15", "#A78BFA", "#FB7185"][index % 6],
    }))
  ).current;

  const showNext = useCallback(
    (list: Achievement[]) => {
      if (list.length === 0) return;
      haptics.success();
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

  const triggerCelebration = useCallback(
    (spec: CelebrationSpec) => {
      haptics.success();
      if (completionTimer.current) clearTimeout(completionTimer.current);
      completionProgress.stopAnimation();
      completionProgress.setValue(0);
      setCelebration(spec);
      celebrationEndsAtRef.current = Date.now() + CELEBRATION_OVERLAY_DURATION_MS;

      Animated.sequence([
        Animated.timing(completionProgress, {
          toValue: 1,
          duration: 760,
          easing: Easing.out(Easing.back(1.15)),
          useNativeDriver: true,
        }),
        Animated.delay(1050),
        Animated.timing(completionProgress, {
          toValue: 2,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setCelebration(null);
      });

      completionTimer.current = setTimeout(() => setCelebration(null), 2400);
    },
    [completionProgress]
  );

  const celebrateGoalCompletion = useCallback(
    (goalTitle?: string) => {
      triggerCelebration({
        kicker: "BOA!",
        title: "Meta concluída",
        description: goalTitle?.trim() || "Meta concluída",
        badge: `+${XP_PER_COMPLETED_GOAL} XP`,
        accentColor: colors.success,
        mascotPose: "happy",
      });
    },
    [triggerCelebration, colors.success]
  );

  const celebrateLevelUp = useCallback(
    (level: number) => {
      triggerCelebration({
        kicker: "EVOLUÇÃO!",
        title: `Nível ${level}`,
        description: "Sua constância está te levando mais longe.",
        badge: "LEVEL UP",
        accentColor: colors.accent,
        mascotPose: "proud",
      });
    },
    [triggerCelebration, colors.accent]
  );

  const checkAndCelebrate = useCallback(async () => {
    try {
      const [achievementsRes, levelRes] = await Promise.all([
        api.checkAchievements(),
        api.checkLevelUp(),
      ]);
      if (levelRes.leveled_up) {
        celebrateLevelUp(levelRes.level);
      }
      const unlocked = achievementsRes.newly_unlocked;
      if (unlocked && unlocked.length > 0) {
        // Let any active/about-to-start bottom celebration overlay finish first so it never collides with the achievement modal.
        const wait = celebrationEndsAtRef.current - Date.now();
        if (wait > 0) {
          setTimeout(() => showNext(unlocked), wait + CELEBRATION_HANDOFF_GAP_MS);
        } else {
          showNext(unlocked);
        }
      }
    } catch {
      // ignore
    }
  }, [showNext, celebrateLevelUp]);

  return (
    <Ctx.Provider value={{ checkAndCelebrate, celebrateGoalCompletion }}>
      {children}
      {celebration ? (
        <View pointerEvents="none" style={styles.completionOverlay} testID="goal-completion-celebration">
          {confetti.map((piece) => {
            const translateY = completionProgress.interpolate({
              inputRange: [0, 1, 2],
              outputRange: [-80, 170 + (piece.key % 5) * 18, 210],
            });
            const translateX = completionProgress.interpolate({
              inputRange: [0, 1, 2],
              outputRange: [0, piece.key % 2 === 0 ? 28 : -28, piece.key % 2 === 0 ? 38 : -38],
            });
            const pieceOpacity = completionProgress.interpolate({
              inputRange: [0, 0.15, 1.6, 2],
              outputRange: [0, 1, 1, 0],
            });
            return (
              <Animated.View
                key={piece.key}
                style={[
                  styles.confettiPiece,
                  {
                    left: `${piece.left}%`,
                    backgroundColor: piece.color,
                    opacity: pieceOpacity,
                    transform: [
                      { translateY },
                      { translateX },
                      { rotate: piece.rotate },
                    ],
                  },
                ]}
              />
            );
          })}

          <Animated.View
            style={[
              styles.completionCard,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: celebration.accentColor + "55",
                opacity: completionProgress.interpolate({
                  inputRange: [0, 0.12, 1.75, 2],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: completionProgress.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [90, 0, -24],
                    }),
                  },
                  {
                    scale: completionProgress.interpolate({
                      inputRange: [0, 0.45, 0.68, 1, 2],
                      outputRange: [0.72, 1.12, 0.96, 1, 0.95],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.mascotBubble,
                {
                  backgroundColor: celebration.accentColor + "1A",
                  borderColor: celebration.accentColor + "40",
                  transform: [
                    {
                      rotate: completionProgress.interpolate({
                        inputRange: [0, 0.35, 0.7, 1],
                        outputRange: ["-12deg", "10deg", "-5deg", "0deg"],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Mascot pose={celebration.mascotPose} size={48} />
            </Animated.View>
            <View style={styles.completionTextWrap}>
              <Text style={[styles.completionKicker, { color: celebration.accentColor }]}>{celebration.kicker}</Text>
              <Text style={[styles.completionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {celebration.title}
              </Text>
              <Text style={[styles.completionDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                {celebration.description}
              </Text>
            </View>
            <View style={[styles.xpPill, { backgroundColor: celebration.accentColor + "20" }]}>
              <Text style={[styles.xpText, { color: celebration.accentColor }]}>{celebration.badge}</Text>
            </View>
          </Animated.View>
        </View>
      ) : null}
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
                onPress={() => {
                  haptics.tap();
                  close();
                }}
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
  if (!c) return { checkAndCelebrate: async () => {}, celebrateGoalCompletion: () => {} };
  return c;
}

export { iconMap };

const styles = StyleSheet.create({
  completionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 9000,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 92,
  },
  completionCard: {
    width: "100%",
    maxWidth: Math.min(420, Dimensions.get("window").width - 36),
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  mascotBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  completionTextWrap: { flex: 1, minWidth: 0 },
  completionKicker: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  completionTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.2, marginTop: 1 },
  completionDesc: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  xpPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  xpText: { fontSize: 12, fontWeight: "900" },
  confettiPiece: {
    position: "absolute",
    top: 0,
    width: 8,
    height: 16,
    borderRadius: 3,
  },
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
