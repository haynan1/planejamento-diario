import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { useTheme } from "@/src/theme/ThemeProvider";
import { api, Stats } from "@/src/api/client";
import StatCard from "@/src/components/StatCard";
import { useToast } from "@/src/components/Toast";

const dayLabel = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return ["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()];
};

export default function HistoricoScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await api.getStats());
    } catch {
      toast.show("Erro ao carregar histórico", "error");
    }
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const maxBar = Math.max(1, ...(stats?.weekly_evolution.map((w) => w.count) ?? [1]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Histórico</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Você está evoluindo. Continue avançando.
          </Text>
        </View>

        <View style={styles.grid}>
          <StatCard
            label="Metas Concluídas"
            value={stats?.completed_goals ?? 0}
            icon="check-circle"
            accentColor={colors.success}
            testID="stat-completed"
          />
          <StatCard
            label="Dias Produtivos"
            value={stats?.productive_days ?? 0}
            icon="sun"
            accentColor={colors.warning}
            testID="stat-productive"
          />
        </View>
        <View style={styles.grid}>
          <StatCard
            label="Taxa de Conclusão"
            value={`${stats?.completion_rate ?? 0}%`}
            icon="trending-up"
            accentColor={colors.primary}
            testID="stat-rate"
          />
          <StatCard
            label="Melhor Sequência"
            value={stats?.best_streak ?? 0}
            icon="zap"
            accentColor={colors.accent}
            testID="stat-streak"
          />
        </View>

        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Evolução da semana</Text>
          <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
            Metas concluídas nos últimos 7 dias
          </Text>
          <View style={styles.barsRow}>
            {(stats?.weekly_evolution ?? []).map((w) => {
              const h = (w.count / maxBar) * 120;
              return (
                <View key={w.date} style={styles.barCol}>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceElevated }]}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(4, h),
                          backgroundColor: w.count > 0 ? colors.accent : colors.border,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barCount, { color: colors.textPrimary }]}>{w.count}</Text>
                  <Text style={[styles.barLabel, { color: colors.textMuted }]}>{dayLabel(w.date)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Resumo geral</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total de metas</Text>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{stats?.total_goals ?? 0}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Sequência atual</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {stats?.current_streak ?? 0} {(stats?.current_streak ?? 0) === 1 ? "dia" : "dias"}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Concluídas hoje</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {stats?.completed_today ?? 0}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48, gap: 16 },
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: "500", marginTop: 4 },
  grid: { flexDirection: "row", gap: 12 },
  chartCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  chartTitle: { fontSize: 16, fontWeight: "800" },
  chartSub: { fontSize: 12, marginTop: 2, marginBottom: 16 },
  barsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 170 },
  barCol: { alignItems: "center", flex: 1, gap: 6 },
  barTrack: { width: 22, height: 120, borderRadius: 11, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", borderRadius: 11 },
  barCount: { fontSize: 12, fontWeight: "700" },
  barLabel: { fontSize: 11, fontWeight: "600" },
  summaryCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
  summaryTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  summaryLabel: { fontSize: 13, fontWeight: "500" },
  summaryValue: { fontSize: 15, fontWeight: "700" },
  divider: { height: 1 },
});
