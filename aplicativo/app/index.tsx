import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";

import { useTheme } from "@/src/theme/ThemeProvider";

const { width, height } = Dimensions.get("window");

interface Star {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height * 0.7,
    size: Math.random() * 2 + 1,
    duration: 1500 + Math.random() * 2500,
    delay: Math.random() * 2000,
  }));
}

function TwinklingStar({ star }: { star: Star }) {
  const opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: star.duration,
          delay: star.delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: star.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, star.delay, star.duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: star.x,
        top: star.y,
        width: star.size * 2,
        height: star.size * 2,
        borderRadius: star.size,
        backgroundColor: "#fff",
        opacity,
      }}
    />
  );
}

function RocketIcon({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <SvgGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E2E8F0" />
        </SvgGradient>
        <SvgGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF2A4D" />
          <Stop offset="0.5" stopColor="#F59E0B" />
          <Stop offset="1" stopColor="#FFEB8A" />
        </SvgGradient>
      </Defs>
      {/* Flame */}
      <Path
        d="M40 76 Q48 92 56 76 Q52 84 48 88 Q44 84 40 76 Z"
        fill="url(#flame)"
      />
      {/* Body */}
      <Path
        d="M48 8 C58 20 64 36 64 50 L64 66 L32 66 L32 50 C32 36 38 20 48 8 Z"
        fill="url(#body)"
      />
      {/* Window */}
      <Circle cx="48" cy="38" r="7" fill="#3B69FF" />
      <Circle cx="48" cy="38" r="4" fill="#070B14" />
      <Circle cx="46" cy="36" r="1.4" fill="#fff" opacity={0.9} />
      {/* Left fin */}
      <Path d="M32 50 L20 70 L32 66 Z" fill="#FF2A4D" />
      {/* Right fin */}
      <Path d="M64 50 L76 70 L64 66 Z" fill="#FF2A4D" />
      {/* Bottom band */}
      <Path d="M32 60 L64 60 L64 66 L32 66 Z" fill="#3B69FF" opacity={0.85} />
    </Svg>
  );
}

export default function WelcomeScreen() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const [launching, setLaunching] = useState(false);

  const stars = useMemo(() => generateStars(40), []);

  // Idle animations
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.5)).current;

  // Launch animations
  const liftY = useRef(new Animated.Value(0)).current;
  const liftScale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const trailHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.5,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    floatLoop.start();
    pulseLoop.start();
    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [float, pulse, ringOpacity]);

  const onLaunch = () => {
    if (launching) return;
    setLaunching(true);
    Animated.parallel([
      Animated.timing(trailHeight, {
        toValue: 1,
        duration: 700,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(liftScale, {
          toValue: 0.92,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(liftY, {
          toValue: -height * 1.1,
          duration: 900,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(550),
        Animated.timing(fade, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      router.replace("/home");
    });
  };

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={
          mode === "dark"
            ? ["#070B14", "#0F1530", "#070B14"]
            : ["#0F1530", "#1C2741", "#0F1530"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars */}
      {stars.map((s, i) => (
        <TwinklingStar key={i} star={s} />
      ))}

      {/* Distant glow */}
      <View
        style={[
          styles.glow,
          { backgroundColor: colors.primary, opacity: mode === "dark" ? 0.18 : 0.12 },
        ]}
      />
      <View
        style={[
          styles.glowAccent,
          { backgroundColor: colors.accent, opacity: mode === "dark" ? 0.16 : 0.1 },
        ]}
      />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Animated.View style={[styles.content, { opacity: fade }]}>
          <View style={styles.topBlock}>
            <Text style={[styles.brandLabel, { color: "#FF2A4D" }]}>ROCKET FORWARD</Text>
            <Text style={styles.headline}>Cada meta concluída{"\n"}é um passo à frente.</Text>
            <Text style={styles.subline}>
              Transforme intenção em movimento. Construa disciplina, um dia por vez.
            </Text>
          </View>

          <View style={styles.center} pointerEvents="box-none">
            {/* Animated pulse rings */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  borderColor: "#FF2A4D",
                  transform: [{ scale: pulseScale }],
                  opacity: ringOpacity,
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ringInner,
                { borderColor: "#3B69FF55" },
              ]}
            />

            {/* Trail behind rocket */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.trail,
                {
                  height: trailHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, height],
                  }),
                  opacity: trailHeight.interpolate({
                    inputRange: [0, 0.1, 1],
                    outputRange: [0, 1, 0],
                  }),
                },
              ]}
            >
              <LinearGradient
                colors={["#FF2A4D", "#F59E0B00"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ flex: 1, borderRadius: 30 }}
              />
            </Animated.View>

            {/* Rocket button */}
            <Animated.View
              style={{
                transform: [
                  { translateY: launching ? liftY : translateY },
                  { scale: liftScale },
                ],
              }}
            >
              <TouchableOpacity
                onPress={onLaunch}
                activeOpacity={0.85}
                disabled={launching}
                accessibilityLabel="Decolar"
                accessibilityRole="button"
                accessibilityState={{ disabled: launching, busy: launching }}
                testID="welcome-launch-button"
              >
                <LinearGradient
                  colors={["#FF2A4D", "#3B69FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buttonGradient}
                >
                  <View style={styles.buttonInner}>
                    <RocketIcon size={96} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.bottomBlock}>
            <Text style={styles.cta}>
              {launching ? "Decolando..." : "Toque no foguete para decolar"}
            </Text>
            <View style={styles.dotsRow}>
              <View style={[styles.dot, { backgroundColor: "#FF2A4D" }]} />
              <View style={[styles.dot, { backgroundColor: "#3B69FF" }]} />
              <View style={[styles.dot, { backgroundColor: "#fff", opacity: 0.4 }]} />
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: "space-between" },
  topBlock: { alignItems: "center", paddingTop: 24, gap: 8 },
  brandLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
  },
  headline: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 32,
    marginTop: 6,
  },
  subline: {
    color: "#8D9EBA",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  center: { alignItems: "center", justifyContent: "center", position: "relative" },
  ring: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
  },
  ringInner: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
  },
  trail: {
    position: "absolute",
    width: 18,
    bottom: -40,
  },
  buttonGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    padding: 4,
    shadowColor: "#FF2A4D",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  buttonInner: {
    flex: 1,
    borderRadius: 76,
    backgroundColor: "#070B14",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBlock: { alignItems: "center", paddingBottom: 24, gap: 12 },
  cta: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.4 },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -120,
    left: -80,
  },
  glowAccent: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    bottom: -100,
    right: -80,
  },
});
