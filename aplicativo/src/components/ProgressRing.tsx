import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/src/theme/ThemeProvider";

interface Props {
  progress: number; // 0..1
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}

export default function ProgressRing({
  progress,
  size = 180,
  thickness = 12,
  centerLabel,
  centerSubLabel,
}: Props) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID="progress-ring">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accent}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {centerLabel ?? `${Math.round(clamped * 100)}%`}
        </Text>
        {centerSubLabel ? (
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{centerSubLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  value: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  sub: { fontSize: 12, fontWeight: "600", marginTop: 4, letterSpacing: 1, textTransform: "uppercase" },
});
