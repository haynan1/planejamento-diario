import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";

interface Props {
  label: string;
  value: string | number;
  icon?: React.ComponentProps<typeof Feather>["name"];
  accentColor?: string;
  testID?: string;
}

export default function StatCard({ label, value, icon, accentColor, testID }: Props) {
  const { colors } = useTheme();
  const tint = accentColor || colors.primary;
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID={testID}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: tint + "1A" }]}>
          <Feather name={icon} size={18} color={tint} />
        </View>
      ) : null}
      <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" },
});
