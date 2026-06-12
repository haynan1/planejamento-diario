import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/theme/ThemeProvider";

interface ModalHeaderProps {
  title?: string;
  closeTestID?: string;
}

export default function ModalHeader({ title, closeTestID }: ModalHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityLabel="Fechar"
        accessibilityRole="button"
        testID={closeTestID}
      >
        <Feather name="x" size={18} color={colors.textPrimary} />
      </TouchableOpacity>
      {title ? (
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
});
