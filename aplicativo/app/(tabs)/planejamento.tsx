import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
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
import { useAchievements } from "@/src/components/AchievementProvider";
import { cancelGoalNotification } from "@/src/notifications";
import { formatLocalISODate, parseLocalISODate } from "@/src/utils/date";

type Mode = "hoje" | "semana" | "mes";
type SectionItem = [string, Goal[]];
interface ListSection {
  key: "overdue" | "today" | "upcoming";
  title: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  accent: string;
  data: SectionItem[];
}

const isoDate = formatLocalISODate;

const startOfWeek = (d: Date) => {
  const out = new Date(d);
  const day = out.getDay();
  out.setDate(out.getDate() - day);
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

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const formatLongDate = (iso: string) => {
  const d = parseLocalISODate(iso);
  const weekday = capitalize(d.toLocaleDateString("pt-BR", { weekday: "long" }));
  const dayMonth = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  return `${weekday} · ${dayMonth}`;
};

const todayISO = () => isoDate(new Date());

export default function PlanejamentoScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { checkAndCelebrate, celebrateGoalCompletion } = useAchievements();
  const [mode, setMode] = useState<Mode>("semana");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const computeRange = useCallback((m: Mode) => {
    const now = new Date();
    if (m === "hoje") return { from: isoDate(now), to: isoDate(now) };
    if (m === "semana") return { from: isoDate(startOfWeek(now)), to: isoDate(endOfWeek(now)) };
    return { from: isoDate(startOfMonth(now)), to: isoDate(endOfMonth(now)) };
  }, []);

  const load = useCallback(async () => {
    try {
      const range = computeRange(mode);
      const data = await api.listGoals({ date_from: range.from, date_to: range.to });
      setGoals(data);
    } catch {
      toast.show("Erro ao carregar planejamento", "error");
    }
  }, [mode, computeRange, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const sections = useMemo(() => {
    const today = todayISO();
    const map = new Map<string, Goal[]>();
    [...goals]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time ?? "99:99") < (b.time ?? "99:99") ? -1 : 1))
      .forEach((g) => {
        if (!map.has(g.date)) map.set(g.date, []);
        map.get(g.date)!.push(g);
      });
    const all = Array.from(map.entries());
    const overdue = all.filter(([date]) => date < today);
    const todayGoals = all.filter(([date]) => date === today);
    const upcoming = all.filter(([date]) => date > today);
    return { overdue, today: todayGoals, upcoming };
  }, [goals]);

  const totalGoals = goals.length;
  const totalCompleted = goals.filter((g) => g.status === "concluida").length;
  const overdueCount = sections.overdue.reduce(
    (sum, [, list]) => sum + list.filter((g) => g.status !== "concluida").length,
    0
  );

  const toggleComplete = useCallback(async (g: Goal) => {
    try {
      const next = g.status === "concluida" ? "pendente" : "concluida";
      await api.updateGoal(g.id, { status: next });
      if (next === "concluida") await cancelGoalNotification(g.id);
      load();
      if (next === "concluida") {
        celebrateGoalCompletion(g.title);
        checkAndCelebrate();
      }
    } catch {
      toast.show("Erro ao atualizar", "error");
    }
  }, [load, celebrateGoalCompletion, checkAndCelebrate, toast]);

  const deleteGoal = useCallback(async (g: Goal) => {
    try {
      await api.deleteGoal(g.id);
      await cancelGoalNotification(g.id);
      toast.show(g.recurrence ? "Meta recorrente encerrada" : "Meta excluida", "success");
      load();
    } catch {
      toast.show("Erro ao excluir", "error");
    }
  }, [load, toast]);

  const listSections = useMemo<ListSection[]>(() => {
    const result: ListSection[] = [];
    if (sections.overdue.length > 0)
      result.push({ key: "overdue", title: "Atrasadas", icon: "alert-circle", accent: colors.accent, data: sections.overdue });
    if (sections.today.length > 0)
      result.push({ key: "today", title: "Hoje", icon: "sun", accent: colors.success, data: sections.today });
    if (sections.upcoming.length > 0)
      result.push({ key: "upcoming", title: "Próximos dias", icon: "arrow-up-right", accent: colors.primary, data: sections.upcoming });
    return result;
  }, [sections, colors.accent, colors.success, colors.primary]);

  const renderItem = useCallback(
    ({ item: [date, list], section }: { item: SectionItem; section: ListSection }) => {
      const done = list.filter((g) => g.status === "concluida").length;
      return (
        <View style={styles.daySection}>
          <View style={styles.dayHeader}>
            <View style={[styles.dayDot, { backgroundColor: section.accent }]} />
            <Text style={[styles.dayTitle, { color: colors.textPrimary }]}>
              {formatLongDate(date)}
            </Text>
            <View style={[styles.dayCount, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.dayCountText, { color: colors.textSecondary }]}>
                {done}/{list.length}
              </Text>
            </View>
          </View>
          <View style={[styles.dayList, { borderLeftColor: colors.border }]}>
            {list.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onToggleComplete={toggleComplete}
                onDelete={section.key === "overdue" ? deleteGoal : undefined}
                compact
              />
            ))}
          </View>
        </View>
      );
    },
    [toggleComplete, deleteGoal, colors]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ListSection }) => {
      const isFirst = listSections[0]?.key === section.key;
      const total = section.data.reduce((s, [, l]) => s + l.length, 0);
      return (
        <View style={[styles.sectionHead, !isFirst && styles.sectionHeadGap]}>
          <View style={[styles.sectionIcon, { backgroundColor: section.accent + "1A" }]}>
            <Feather name={section.icon} size={14} color={section.accent} />
          </View>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>{section.title}</Text>
          <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
            {total} {total === 1 ? "meta" : "metas"}
          </Text>
        </View>
      );
    },
    [colors, listSections]
  );

  const isEmpty = goals.length === 0;

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
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`plan-mode-${m.key}`}
              activeOpacity={0.85}
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

      {!isEmpty ? (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="layers" size={12} color={colors.textSecondary} />
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              {totalGoals} {totalGoals === 1 ? "meta" : "metas"}
            </Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: colors.success + "1A", borderColor: colors.success + "44" }]}>
            <Feather name="check-circle" size={12} color={colors.success} />
            <Text style={[styles.summaryText, { color: colors.success }]}>
              {totalCompleted} concluída{totalCompleted === 1 ? "" : "s"}
            </Text>
          </View>
          {overdueCount > 0 ? (
            <View style={[styles.summaryChip, { backgroundColor: colors.accent + "1A", borderColor: colors.accent + "44" }]}>
              <Feather name="alert-circle" size={12} color={colors.accent} />
              <Text style={[styles.summaryText, { color: colors.accent }]}>
                {overdueCount} atrasada{overdueCount === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <SectionList<SectionItem, ListSection>
        sections={listSections}
        keyExtractor={(item) => item[0]}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="calendar" size={40} color={colors.textMuted} />
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
              <Text style={styles.emptyBtnText}>Criar nova meta</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
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
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 6,
    flexWrap: "wrap",
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  summaryText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionHeadGap: { marginTop: 24 },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: { fontSize: 14, fontWeight: "800", letterSpacing: 0.2, flex: 1 },
  sectionCount: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  daySection: { gap: 10 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  dayTitle: { fontSize: 13, fontWeight: "700", flex: 1, letterSpacing: -0.1 },
  dayCount: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dayCountText: { fontSize: 11, fontWeight: "700" },
  dayList: {
    gap: 8,
    paddingLeft: 14,
    borderLeftWidth: 1,
    marginLeft: 3,
  },
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
