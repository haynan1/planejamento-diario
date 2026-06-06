import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/theme/ThemeProvider";
import { api, Achievement } from "@/src/api/client";
import { iconMap } from "@/src/components/AchievementProvider";

export default function ConquistasScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Re-evaluate before loading so the list is up-to-date
      await api.checkAchievements().catch(() => null);
      const res = await api.listAchievements();
      setItems(res.items);
      setUnlocked(res.unlocked);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, Achievement[]>();
    items.forEach((a) => {
      if (!map.has(a.group)) map.set(a.group, []);
      map.get(a.group)!.push(a);
    });
    return Array.from(map.entries());
  }, [items]);

  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          testID="conquistas-close"
        >
          <Feather name="x" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Conquistas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.accent, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Feather name="award" size={36} color="#fff" />
          <Text style={styles.heroValue}>
            {unlocked} <Text style={styles.heroValueMuted}>/ {total}</Text>
          </Text>
          <Text style={styles.heroLabel}>Conquistas desbloqueadas</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.heroSub}>{pct}% completo</Text>
        </LinearGradient>

        {loading ? null : groups.map(([group, list]) => (
          <View key={group} style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.textMuted }]}>
              {group.toUpperCase()}
            </Text>
            <View style={{ gap: 10 }}>
              {list.map((a) => {
                const iconName = iconMap[a.icon] ?? "award";
                return (
                  <View
                    key={a.key}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: a.unlocked ? colors.accent : colors.border,
                        opacity: a.unlocked ? 1 : 0.6,
                      },
                    ]}
                    testID={`achievement-card-${a.key}`}
                  >
                    <View
                      style={[
                        styles.iconWrap,
                        {
                          backgroundColor: a.unlocked ? colors.accent + "22" : colors.surfaceElevated,
                          borderColor: a.unlocked ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name={a.unlocked ? iconName : "lock"}
                        size={20}
                        color={a.unlocked ? colors.accent : colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                        {a.title}
                      </Text>
                      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                        {a.description}
                      </Text>
                    </View>
                    {a.unlocked ? (
                      <Feather name="check-circle" size={18} color={colors.success} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
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
  headerBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  scroll: { padding: 24, paddingBottom: 32, gap: 20 },
  heroCard: { padding: 28, borderRadius: 20, alignItems: "center", gap: 8 },
  heroValue: { color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  heroValueMuted: { color: "#ffffff99", fontSize: 28 },
  heroLabel: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  progressBar: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ffffff33",
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 3 },
  heroSub: { color: "#ffffffcc", fontSize: 12, fontWeight: "600", marginTop: 4 },
  group: { gap: 8 },
  groupTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginLeft: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  cardDesc: { fontSize: 12, lineHeight: 16 },
});
