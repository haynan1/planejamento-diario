import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/theme/ThemeProvider";
import { api, Goal, Stats, Profile } from "@/src/api/client";
import ProgressRing from "@/src/components/ProgressRing";
import GoalCard from "@/src/components/GoalCard";
import PrimaryButton from "@/src/components/PrimaryButton";
import { getDailyPhrase, getGreeting } from "@/src/constants/goals";
import { useToast } from "@/src/components/Toast";
import Avatar from "@/src/components/Avatar";
import Mascot from "@/src/components/Mascot";
import { todayLocalISO } from "@/src/utils/date";
import { useGoalActions } from "@/src/hooks/use-goal-actions";

export default function DashboardScreen() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [g, s, p] = await Promise.all([
        api.listGoals({ date_eq: todayLocalISO() }),
        api.getStats(),
        api.getProfile(),
      ]);
      setGoals(g);
      setStats(s);
      setProfile(p);
    } catch {
      toast.show("Erro ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const { toggleComplete, cycleStatus } = useGoalActions({
    reload: load,
    completedMessage: "Meta concluída! Continue avançando.",
  });

  const progress = stats && stats.total_today > 0 ? stats.completed_today / stats.total_today : 0;
  const phrase = profile?.motivational_phrases_enabled !== false ? getDailyPhrase() : "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
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
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brand, { color: colors.accent }]}>ROCKET FORWARD</Text>
            <Text style={[styles.greeting, { color: colors.textPrimary }]}>
              {getGreeting(profile?.name)}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Pronto para avançar hoje?
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/perfil")}
            activeOpacity={0.85}
            accessibilityLabel="Abrir perfil"
            accessibilityRole="button"
            testID="header-avatar"
          >
            <Avatar base64={profile?.avatar_base64} size={48} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Progress card */}
        <LinearGradient
          colors={
            mode === "dark"
              ? ["#1C2741", "#121A2F"]
              : ["#FFFFFF", "#F4F6F9"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: colors.border }]}
        >
          <View style={{ alignItems: "center" }}>
            <ProgressRing
              progress={progress}
              size={180}
              thickness={14}
              centerSubLabel="Progresso de hoje"
            />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {stats?.completed_today ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Concluídas</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {stats?.pending_today ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pendentes</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {stats?.current_streak ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sequência</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Streak-at-risk warning */}
        {stats?.streak_at_risk ? (
          <View style={[styles.riskCard, { backgroundColor: colors.warning + "14", borderColor: colors.warning + "40" }]}>
            <Mascot pose="worried" size={44} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.riskTitle, { color: colors.textPrimary }]}>
                Sua sequência de {stats.current_streak} {stats.current_streak === 1 ? "dia" : "dias"} está em risco
              </Text>
              <Text style={[styles.riskSub, { color: colors.textSecondary }]}>
                Conclua ao menos uma meta hoje para mantê-la viva.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Motivational phrase */}
        {phrase ? (
          <View style={[styles.phraseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="zap" size={16} color={colors.accent} />
            <Text style={[styles.phrase, { color: colors.textSecondary }]}>{phrase}</Text>
          </View>
        ) : null}

        {/* Today's goals header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Metas de hoje</Text>
          <TouchableOpacity onPress={() => router.push("/metas")} testID="see-all-goals">
            <Text style={[styles.linkText, { color: colors.accent }]}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        {loading ? null : goals.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Mascot pose="sleepy" size={64} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Nenhuma meta cadastrada ainda
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Comece criando sua primeira meta e dê o primeiro passo.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {goals.slice(0, 5).map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onToggleComplete={toggleComplete}
                onCycleStatus={cycleStatus}
                compact
              />
            ))}
          </View>
        )}

        <PrimaryButton
          label="Criar nova meta"
          icon="plus"
          onPress={() => router.push("/criar-meta")}
          fullWidth
          style={{ marginTop: 24 }}
          testID="create-goal-cta"
        />

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Continue subindo. Um passo por vez.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  brand: { fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 4 },
  greeting: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: "500", marginTop: 4 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    gap: 20,
  },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  divider: { width: 1, height: 32 },
  riskCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  riskTitle: { fontSize: 13, fontWeight: "800", letterSpacing: -0.1 },
  riskSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  phraseCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  phrase: { flex: 1, fontSize: 13, fontStyle: "italic", lineHeight: 18 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  linkText: { fontSize: 13, fontWeight: "700" },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  footer: { fontSize: 12, textAlign: "center", marginTop: 12, fontStyle: "italic" },
});
