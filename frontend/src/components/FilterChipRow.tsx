import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";

export interface ChipOption<T extends string> {
  key: T | "all";
  label: string;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  value: T | "all";
  onChange: (v: T | "all") => void;
  testIDPrefix?: string;
}

export default function FilterChipRow<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix = "chip",
}: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onChange(opt.key as T | "all")}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
              testID={`${testIDPrefix}-${opt.key}`}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.label,
                  { color: active ? "#fff" : colors.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 56, justifyContent: "center" },
  row: { paddingHorizontal: 24, gap: 8, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.1 },
});
