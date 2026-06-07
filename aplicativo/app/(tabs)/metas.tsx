import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeProvider";
import { api, Goal } from "@/src/api/client";
import GoalCard from "@/src/components/GoalCard";
import FilterChipRow from "@/src/components/FilterChipRow";
import { CATEGORIES, PRIORITIES, STATUSES, Status, Priority, Category } from "@/src/constants/goals";
import { useToast } from "@/src/components/Toast";
import { useAchievements } from "@/src/components/AchievementProvider";
import { cancelGoalNotification } from "@/src/notifications";

type FilterTab = "status" | "prioridade" | "categoria";

export default function MetasScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { checkAndCelebrate, celebrateGoalCompletion } = useAchievements();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("status");
  const [statusF, setStatusF] = useState<Status | "all">("all");
  const [priF, setPriF] = useState<Priority | "all">("all");
  const [catF, setCatF] = useState<Category | "all">("all");

  const load = useCallback(async () => {
    try {
      const filters: Record<string, string> = {};
      if (statusF !== "all") filters.status = statusF;
      if (priF !== "all") filters.priority = priF;
      if (catF !== "all") filters.category = catF;
      const data = await api.listGoals(filters as any);
      setGoals(data);
    } catch {
      toast.show("Erro ao carregar metas", "error");
    }
  }, [statusF, priF, catF, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleComplete = async (g: Goal) => {
    try {
      const next = g.status === "concluida" ? "pendente" : "concluida";
      await api.updateGoal(g.id, { status: next });
      if (next === "concluida") {
        await cancelGoalNotification(g.id);
      }
      toast.show(next === "concluida" ? "Meta concluída!" : "Meta reaberta", "success");
      load();
      if (next === "concluida") {
        celebrateGoalCompletion(g.title);
        checkAndCelebrate();
      }
    } catch {
      toast.show("Erro ao atualizar", "error");
    }
  };

  const cycleStatus = async (g: Goal) => {
    const order = ["pendente", "em_andamento", "concluida"] as const;
    const next = order[(order.indexOf(g.status) + 1) % order.length];
    try {
      await api.updateGoal(g.id, { status: next });
      load();
    } catch {
      toast.show("Erro ao atualizar", "error");
    }
  };

  const onDelete = async (g: Goal) => {
    try {
      await api.deleteGoal(g.id);
      await cancelGoalNotification(g.id);
      toast.show("Meta excluída", "success");
      load();
    } catch {
      toast.show("Erro ao excluir", "error");
    }
  };

  const onEdit = (g: Goal) => {
    router.push({ pathname: "/criar-meta", params: { id: g.series_id ?? g.id } });
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "status", label: "Status" },
    { key: "prioridade", label: "Prioridade" },
    { key: "categoria", label: "Categoria" },
  ];

  const filterOptions = useMemo(() => {
    if (filterTab === "status") {
      return [{ key: "all" as const, label: "Todos" }, ...STATUSES.map((s) => ({ key: s.key, label: s.label }))];
    }
    if (filterTab === "prioridade") {
      return [{ key: "all" as const, label: "Todas" }, ...PRIORITIES.map((p) => ({ key: p.key, label: p.label }))];
    }
    return [{ key: "all" as const, label: "Todas" }, ...CATEGORIES.map((c) => ({ key: c.key, label: c.label }))];
  }, [filterTab]);

  const currentValue =
    filterTab === "status" ? statusF : filterTab === "prioridade" ? priF : catF;

  const setCurrent = (v: string) => {
    if (filterTab === "status") setStatusF(v as any);
    else if (filterTab === "prioridade") setPriF(v as any);
    else setCatF(v as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Metas</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {goals.length} {goals.length === 1 ? "meta" : "metas"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/criar-meta")}
          style={[styles.addBtn, { backgroundColor: colors.accent }]}
          testID="metas-add-button"
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        {tabs.map((t) => {
          const active = filterTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setFilterTab(t.key)}
              style={[
                styles.tab,
                { borderBottomColor: active ? colors.accent : "transparent" },
              ]}
              testID={`filter-tab-${t.key}`}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.textPrimary : colors.textSecondary },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FilterChipRow
        options={filterOptions}
        value={currentValue}
        onChange={(v) => setCurrent(v as string)}
        testIDPrefix="filter"
      />

      <FlatList
        data={goals}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onToggleComplete={toggleComplete}
            onCycleStatus={cycleStatus}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="target" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Nenhuma meta encontrada
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Toque em + para criar sua primeira meta.
            </Text>
          </View>
        }
      />
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
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 24,
    marginTop: 8,
  },
  tab: { paddingVertical: 10, borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontWeight: "700" },
  list: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8 },
  empty: { padding: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 8, marginTop: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  emptySub: { fontSize: 13, textAlign: "center" },
});
