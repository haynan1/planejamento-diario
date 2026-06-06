import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeProvider";
import { api, Goal } from "@/src/api/client";
import GoalCard from "@/src/components/GoalCard";
import { useToast } from "@/src/components/Toast";

type Mode = "hoje" | "semana" | "mes";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const startOfWeek = (d: Date) => {
  const out = new Date(d);
  const day = out.getDay();
  const diff = (day + 6) % 7; // Monday as first day
  out.setDate(out.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
};

const endOfWeek = (d: Date) => {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return e;
};

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const formatLongDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
};

export default function PlanejamentoScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("hoje");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    if (mode === "hoje") return { from: isoDate(now), to: isoDate(now) };
    if (mode === "semana") return { from: isoDate(startOfWeek(now)), to: isoDate(endOfWeek(now)) };
    return { from: isoDate(startOfMonth(now)), to: isoDate(endOfMonth(now)) };
  }, [mode]);

  const load = useCallback(async () => {
    try {
      const data = await api.listGoals({ date_from: range.from, date_to: range.to });
      setGoals(data);
    } catch {
      toast.show("Erro ao carregar planejamento", "error");
    }
  }, [range, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Goal[]>();
    [...goals]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((g) => {
        if (!map.has(g.date)) map.set(g.date, []);
        map.get(g.date)!.push(g);
      });
    return Array.from(map.entries());
  }, [goals]);

  const toggleComplete = async (g: Goal) => {
    try {
      const next = g.status === "concluida" ? "pendente" : "concluida";
      await api.updateGoal(g.id, { status: next });
      load();
    } catch {
      toast.show("Erro ao atualizar", "error");
    }
  };

  const modes: { key: Mode; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Planejamento</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Organize sua próxima decolagem
        </Text>
      </View>

      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {modes.map((m) => {
          const active = mode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[
                styles.segmentItem,
                { backgroundColor: active ? colors.accent : "transparent" },
              ]}
              testID={`plan-mode-${m.key}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? "#fff" : colors.textSecondary },
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {grouped.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="calendar" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Nada planejado por aqui
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Veja o que precisa ser feito para continuar avançando.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/criar-meta")}
              style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
              testID="plan-create-cta"
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.emptyBtnText}>Criar meta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          grouped.map(([date, dayGoals]) => (
            <View key={date} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <View style={[styles.dayDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.dayTitle, { color: colors.textPrimary }]}>
                  {formatLongDate(date)}
                </Text>
              </View>
              <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              <View style={{ gap: 10, paddingLeft: 16 }}>
                {dayGoals.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    onToggleComplete={toggleComplete}
                    compact
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: "500", marginTop: 4 },
  segment: {
    flexDirection: "row",
    marginHorizontal: 24,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 999 },
  segmentText: { fontSize: 13, fontWeight: "700" },
  scroll: { padding: 24, gap: 24, paddingBottom: 48 },
  daySection: { gap: 12 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayDot: { width: 10, height: 10, borderRadius: 5 },
  dayTitle: { fontSize: 15, fontWeight: "700", textTransform: "capitalize" },
  timelineLine: { position: "absolute", left: 4, top: 24, bottom: 0, width: 2 },
  empty: { padding: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  emptySub: { fontSize: 13, textAlign: "center" },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
