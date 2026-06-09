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
import { api, Profile } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { cancelAllGoalNotifications } from "@/src/notifications";
import { haptics } from "@/src/utils/haptics";

const FEATURES = [
  { icon: "bell", title: "Notificações inteligentes", desc: "Lembretes no horário ideal e alertas de sequência" },
  { icon: "bar-chart-2", title: "Relatórios avançados", desc: "Evolução de 30 dias, gráficos por categoria e prioridade" },
  { icon: "repeat", title: "Metas ilimitadas", desc: "Sem o limite de 5 metas ativas do plano gratuito" },
  { icon: "award", title: "Temas exclusivos", desc: "Em breve: paletas premium para personalizar o app" },
  { icon: "cloud", title: "Backup em nuvem", desc: "Em breve: sincronize entre dispositivos com segurança" },
];

export default function PremiumScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await api.getProfile());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePremium = async () => {
    setLoading(true);
    try {
      const next = !(profile?.is_premium ?? false);
      haptics.success();
      let updated: Profile;
      if (next) {
        updated = await api.updateProfile({ is_premium: true });
      } else {
        // Premium-only perks must fully unwind on downgrade — otherwise the
        // user keeps receiving reminders for a feature the UI now hides.
        await cancelAllGoalNotifications();
        updated = await api.updateProfile({ is_premium: false, notifications_enabled: false });
      }
      setProfile(updated);
      toast.show(
        next ? "Premium ativado! Aproveite todos os recursos." : "Premium desativado",
        "success"
      );
    } catch {
      toast.show("Erro ao alterar plano", "error");
    } finally {
      setLoading(false);
    }
  };

  const isPremium = profile?.is_premium ?? false;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          testID="premium-close"
        >
          <Feather name="x" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.accent, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.badge}>
            <Feather name="star" size={12} color="#fff" />
            <Text style={styles.badgeText}>PREMIUM</Text>
          </View>
          <Text style={styles.heroTitle}>Acelere ainda mais sua decolagem</Text>
          <Text style={styles.heroSub}>
            Desbloqueie recursos avançados e mantenha seu progresso sem limites.
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceCurrency}>R$</Text>
            <Text style={styles.priceValue}>14,90</Text>
            <Text style={styles.pricePer}>/mês</Text>
          </View>
          <Text style={styles.heroFootnote}>Cobrança mensal · Cancele quando quiser</Text>
        </LinearGradient>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>O QUE VOCÊ DESBLOQUEIA</Text>

        <View style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {FEATURES.map((f, idx) => (
            <View key={f.title}>
              <View style={styles.featRow}>
                <View style={[styles.featIcon, { backgroundColor: colors.accent + "1A" }]}>
                  <Feather name={f.icon as any} size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.featTitle, { color: colors.textPrimary }]}>{f.title}</Text>
                  <Text style={[styles.featDesc, { color: colors.textSecondary }]}>{f.desc}</Text>
                </View>
                <Feather name="check" size={18} color={colors.success} />
              </View>
              {idx < FEATURES.length - 1 ? (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              ) : null}
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={togglePremium}
          disabled={loading}
          style={[
            styles.cta,
            {
              backgroundColor: isPremium ? colors.surfaceElevated : colors.accent,
              borderColor: isPremium ? colors.border : colors.accent,
              opacity: loading ? 0.6 : 1,
            },
          ]}
          testID="premium-toggle"
        >
          <Feather
            name={isPremium ? "check-circle" : "zap"}
            size={18}
            color={isPremium ? colors.success : "#fff"}
          />
          <Text
            style={[
              styles.ctaText,
              { color: isPremium ? colors.textPrimary : "#fff" },
            ]}
          >
            {isPremium ? "Premium ativo · Tocar para desativar" : "Ativar Premium (modo demo)"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Integração de pagamento ainda não habilitada. Este é um modo demo para validar a experiência.
          O upgrade real será via assinatura no app.
        </Text>
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
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  scroll: { padding: 24, paddingTop: 8, paddingBottom: 32, gap: 20 },
  hero: { padding: 28, borderRadius: 24, alignItems: "center", gap: 8 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "#ffffff33",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center", letterSpacing: -0.4, marginTop: 8 },
  heroSub: { color: "#ffffffd9", fontSize: 14, textAlign: "center", lineHeight: 20 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 16 },
  priceCurrency: { color: "#fff", fontSize: 18, fontWeight: "700", marginRight: 4, marginBottom: 8 },
  priceValue: { color: "#fff", fontSize: 56, fontWeight: "800", letterSpacing: -2, lineHeight: 60 },
  pricePer: { color: "#ffffffcc", fontSize: 16, fontWeight: "600", marginBottom: 10, marginLeft: 4 },
  heroFootnote: { color: "#ffffffaa", fontSize: 12, fontWeight: "600" },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginLeft: 4 },
  featuresCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  featRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  featIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  featDesc: { fontSize: 12, lineHeight: 16 },
  divider: { height: 1, marginVertical: 4 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 16, borderRadius: 999, borderWidth: 1,
  },
  ctaText: { fontSize: 15, fontWeight: "800", letterSpacing: -0.1 },
  disclaimer: { fontSize: 11, textAlign: "center", fontStyle: "italic", lineHeight: 16 },
});
