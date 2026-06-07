import React, { useCallback, useEffect, useState } from "react";
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
import { api, MonthlyReport, Profile } from "@/src/api/client";
import { CATEGORIES, PRIORITIES } from "@/src/constants/goals";

export default function RelatoriosScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([api.monthlyReport(), api.getProfile()]);
      setReport(r);
      setProfile(p);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isPremium = profile?.is_premium ?? false;

  const maxCat = Math.max(1, ...Object.values(report?.by_category ?? {}));
  const maxPri = Math.max(1, ...Object.values(report?.by_priority ?? {}));
  const maxEvo = Math.max(1, ...(report?.evolution.map((e) => e.count) ?? [1]));

  if (!isPremium) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            testID="relatorios-close"
          >
            <Feather name="x" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Relatórios</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.paywall}>
          <LinearGradient
            colors={[colors.accent, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.lockIcon}
          >
            <Feather name="lock" size={32} color="#fff" />
          </LinearGradient>
          <Text style={[styles.paywallTitle, { color: colors.textPrimary }]}>
            Relatórios avançados são Premium
          </Text>
          <Text style={[styles.paywallDesc, { color: colors.textSecondary }]}>
            Veja sua evolução de 30 dias com gráficos detalhados por categoria, prioridade e dia. Desbloqueie no plano Premium.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/premium")}
            style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
            testID="paywall-upgrade-cta"
          >
            <Feather name="zap" size={16} color="#fff" />
            <Text style={styles.upgradeText}>Conhecer o Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          testID="relatorios-close"
        >
          <Feather name="x" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Relatórios</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Últimos 30 dias</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
            {report?.total_completed_30d ?? 0}
          </Text>
          <Text style={[styles.summaryDesc, { color: colors.textSecondary }]}>metas concluídas</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Evolução diária</Text>
          <View style={styles.evolutionRow}>
            {(report?.evolution ?? []).map((e, idx) => {
              const h = (e.count / maxEvo) * 80;
              return (
                <View
                  key={idx}
                  style={[
                    styles.evoBar,
                    { height: Math.max(3, h), backgroundColor: e.count > 0 ? colors.accent : colors.border },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.evoFooter}>
            <Text style={[styles.evoLabel, { color: colors.textMuted }]}>30 dias atrás</Text>
            <Text style={[styles.evoLabel, { color: colors.textMuted }]}>Hoje</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Por categoria</Text>
          <View style={{ gap: 8 }}>
            {CATEGORIES.map((c) => {
              const count = report?.by_category?.[c.key] ?? 0;
              const w = (count / maxCat) * 100;
              return (
                <View key={c.key} style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: colors.textSecondary }]}>
                    {c.label}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceElevated }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${w}%`, backgroundColor: colors.primary },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barCount, { color: colors.textPrimary }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Por prioridade</Text>
          <View style={{ gap: 8 }}>
            {PRIORITIES.map((p) => {
              const count = report?.by_priority?.[p.key] ?? 0;
              const w = (count / maxPri) * 100;
              return (
                <View key={p.key} style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: colors.textSecondary }]}>
                    {p.label}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceElevated }]}>
                    <View style={[styles.barFill, { width: `${w}%`, backgroundColor: p.color }]} />
                  </View>
                  <Text style={[styles.barCount, { color: colors.textPrimary }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
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
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  scroll: { padding: 24, paddingBottom: 32, gap: 16 },
  summary: { padding: 24, borderRadius: 20, borderWidth: 1, alignItems: "center" },
  summaryLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  summaryValue: { fontSize: 56, fontWeight: "800", letterSpacing: -2, marginTop: 4 },
  summaryDesc: { fontSize: 13, fontWeight: "500" },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  evolutionRow: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 90 },
  evoBar: { flex: 1, borderRadius: 2 },
  evoFooter: { flexDirection: "row", justifyContent: "space-between" },
  evoLabel: { fontSize: 10, fontWeight: "600" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  barLabel: { width: 110, fontSize: 12, fontWeight: "600" },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barCount: { width: 26, textAlign: "right", fontSize: 13, fontWeight: "700" },
  paywall: { flex: 1, padding: 32, alignItems: "center", justifyContent: "center", gap: 12 },
  lockIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  paywallTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 },
  paywallDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  upgradeBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999, marginTop: 12,
  },
  upgradeText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
