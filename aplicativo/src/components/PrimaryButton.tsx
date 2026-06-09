import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: React.ComponentProps<typeof Feather>["name"];
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export default function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  testID,
  style,
  fullWidth,
}: Props) {
  const { colors } = useTheme();
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const bg = isPrimary ? colors.accent : isSecondary ? colors.surfaceElevated : "transparent";
  const fg = isPrimary ? "#FFFFFF" : colors.textPrimary;
  const borderColor = isSecondary ? colors.border : "transparent";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor },
        fullWidth && { alignSelf: "stretch" },
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
      activeOpacity={0.85}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={16} color={fg} /> : null}
          <Text style={[styles.text, { color: fg }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { fontSize: 15, fontWeight: "700", letterSpacing: -0.1 },
});
