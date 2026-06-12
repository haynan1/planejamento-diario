import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/src/theme/ThemeProvider";
import { api, Profile, Stats, AchievementsResponse } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import Avatar from "@/src/components/Avatar";
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  cancelAllGoalNotifications,
} from "@/src/notifications";
import { haptics } from "@/src/utils/haptics";

export default function PerfilScreen() {
  const { colors, mode, setMode, resetMode } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [achievements, setAchievements] = useState<AchievementsResponse | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [notifGranted, setNotifGranted] = useState(false);
  const [notifCanAsk, setNotifCanAsk] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s, a] = await Promise.all([
        api.getProfile(),
        api.getStats(),
        api.listAchievements(),
      ]);
      setProfile(p);
      setStats(s);
      setAchievements(a);
      setNameInput(p.name);
      const perm = await getNotificationPermissionState();
      setNotifGranted(perm.granted);
      setNotifCanAsk(perm.canAskAgain);
    } catch {
      toast.show("Erro ao carregar perfil", "error");
    }
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveName = async () => {
    const trimmed = nameInput.trim() || "Astronauta";
    try {
      const p = await api.updateProfile({ name: trimmed });
      setProfile(p);
      setEditingName(false);
      toast.show("Nome atualizado", "success");
    } catch {
      toast.show("Erro ao salvar", "error");
    }
  };

  const togglePhrases = async (v: boolean) => {
    haptics.tap();
    try {
      const p = await api.updateProfile({ motivational_phrases_enabled: v });
      setProfile(p);
    } catch {
      toast.show("Erro ao atualizar", "error");
    }
  };

  const toggleTheme = () => {
    haptics.tap();
    setMode(mode === "dark" ? "light" : "dark");
  };

  const clearData = async () => {
    haptics.warning();
    try {
      await cancelAllGoalNotifications();
      await api.clearData();
      resetMode();
      toast.show("Dados limpos com sucesso", "success");
      load();
    } catch {
      toast.show("Erro ao limpar dados", "error");
    }
  };

  const confirmClearData = () => {
    Alert.alert(
      "Limpar todos os dados?",
      "Isso remove metas, conquistas, perfil, preferências e notificações agendadas.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Limpar", style: "destructive", onPress: clearData },
      ],
    );
  };

  const pickAvatar = async () => {
    if (uploadingPhoto) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          toast.show("Permita acesso às fotos nas configurações.", "info");
          try {
            await Linking.openSettings();
          } catch {
            // ignore
          }
        } else {
          toast.show("Permissão negada para a galeria", "error");
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const b64 = asset.base64;
      if (!b64) {
        toast.show("Não foi possível ler a imagem", "error");
        return;
      }
      setUploadingPhoto(true);
      const dataUri = `data:image/jpeg;base64,${b64}`;
      const updated = await api.updateProfile({ avatar_base64: dataUri });
      setProfile(updated);
      toast.show("Foto de perfil atualizada", "success");
    } catch {
      toast.show("Erro ao atualizar foto", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removeAvatar = async () => {
    try {
      const updated = await api.updateProfile({ avatar_base64: null });
      setProfile(updated);
      toast.show("Foto removida", "success");
    } catch {
      toast.show("Erro ao remover foto", "error");
    }
  };

  const toggleNotifications = async (next: boolean) => {
    haptics.tap();
    if (!next) {
      await api.updateProfile({ notifications_enabled: false });
      await cancelAllGoalNotifications();
      const p = await api.getProfile();
      setProfile(p);
      toast.show("Notificações desativadas", "info");
      return;
    }
    if (Platform.OS === "web") {
      toast.show("Notificações estão disponíveis apenas no aplicativo (build).", "info");
      return;
    }
    const current = await getNotificationPermissionState();
    if (current.granted) {
      const p = await api.updateProfile({ notifications_enabled: true });
      setProfile(p);
      setNotifGranted(true);
      toast.show("Notificações ativadas", "success");
      return;
    }
    if (!current.canAskAgain) {
      toast.show("Permita notificações nas configurações do seu dispositivo.", "info");
      try {
        await Linking.openSettings();
      } catch {
        // ignore
      }
      return;
    }
    const req = await requestNotificationPermission();
    setNotifGranted(req.granted);
    setNotifCanAsk(req.canAskAgain);
    if (req.granted) {
      const p = await api.updateProfile({ notifications_enabled: true });
      setProfile(p);
      toast.show("Notificações ativadas", "success");
    } else {
      toast.show("Permissão negada. Você pode alterar nas configurações.", "info");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={mode === "dark" ? ["#1C2741", "#070B14"] : ["#EEF2FF", "#F4F6F9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: colors.border }]}
        >
          <View style={styles.avatarWrap}>
            <TouchableOpacity
              onPress={pickAvatar}
              activeOpacity={0.85}
              disabled={uploadingPhoto}
              accessibilityLabel="Alterar foto de perfil"
              accessibilityRole="button"
              testID="avatar-picker"
            >
              <View style={[styles.avatarRing, { borderColor: colors.accent }]}>
                <Avatar base64={profile?.avatar_base64} size={92} color={colors.accent} />
                {uploadingPhoto ? (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
              </View>
              <View style={[styles.cameraBadge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
                <Feather name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            {profile?.avatar_base64 ? (
              <TouchableOpacity
                onPress={removeAvatar}
                style={styles.removePhoto}
                testID="avatar-remove"
              >
                <Text style={[styles.removePhotoText, { color: colors.textMuted }]}>
                  Remover foto
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.removePhotoText, { color: colors.textMuted }]}>
                Toque para adicionar uma foto
              </Text>
            )}
          </View>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                style={[
                  styles.nameInput,
                  { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                placeholder="Seu nome"
                placeholderTextColor={colors.textMuted}
                autoFocus
                testID="profile-name-input"
              />
              <TouchableOpacity
                onPress={saveName}
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                accessibilityLabel="Salvar nome"
                accessibilityRole="button"
                testID="profile-name-save"
              >
                <Feather name="check" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setEditingName(true)}
              style={styles.nameRow}
              accessibilityLabel="Editar nome"
              accessibilityRole="button"
              testID="profile-name-edit"
            >
              <Text style={[styles.name, { color: colors.textPrimary }]}>
                {profile?.name ?? "Astronauta"}
              </Text>
              <Feather name="edit-2" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Construindo seu futuro, uma meta por vez.
          </Text>

          <View style={styles.levelRow}>
            <View style={[styles.levelBadge, { backgroundColor: colors.accent + "1A", borderColor: colors.accent + "40" }]}>
              <Feather name="trending-up" size={12} color={colors.accent} />
              <Text style={[styles.levelBadgeText, { color: colors.accent }]}>
                Nível {stats?.level ?? 1}
              </Text>
            </View>
            <View style={styles.xpBarWrap}>
              <View style={[styles.xpBarTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.xpBarFill,
                    {
                      backgroundColor: colors.accent,
                      width: `${stats ? Math.min(100, Math.round((stats.xp_into_level / Math.max(1, stats.xp_for_level)) * 100)) : 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.xpBarLabel, { color: colors.textMuted }]}>
                {stats?.xp_into_level ?? 0}/{stats?.xp_for_level ?? 150} XP até o próximo nível
              </Text>
            </View>
          </View>

          <View style={styles.miniStats}>
            <View style={styles.miniBox}>
              <Text style={[styles.miniValue, { color: colors.textPrimary }]}>
                {stats?.total_goals ?? 0}
              </Text>
              <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>Criadas</Text>
            </View>
            <View style={[styles.miniDivider, { backgroundColor: colors.border }]} />
            <View style={styles.miniBox}>
              <Text style={[styles.miniValue, { color: colors.success }]}>
                {stats?.completed_goals ?? 0}
              </Text>
              <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>Concluídas</Text>
            </View>
            <View style={[styles.miniDivider, { backgroundColor: colors.border }]} />
            <View style={styles.miniBox}>
              <Text style={[styles.miniValue, { color: colors.accent }]}>
                {stats?.best_streak ?? 0}
              </Text>
              <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>Recorde</Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>PROGRESSO</Text>

        <TouchableOpacity
          onPress={() => router.push("/conquistas")}
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          testID="open-conquistas"
        >
          <View style={[styles.settingIcon, { backgroundColor: colors.accent + "1A" }]}>
            <Feather name="award" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Conquistas</Text>
            <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
              {achievements ? `${achievements.unlocked} de ${achievements.total} desbloqueadas` : "Veja suas medalhas"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/relatorios")}
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          testID="open-relatorios"
        >
          <View style={[styles.settingIcon, { backgroundColor: colors.primary + "1A" }]}>
            <Feather name="bar-chart-2" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
              Relatórios avançados
            </Text>
            <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
              Evolução de 30 dias por categoria e prioridade
            </Text>
          </View>
          {!profile?.is_premium ? (
            <View style={[styles.proPill, { backgroundColor: colors.accent }]}>
              <Text style={styles.proPillText}>PRO</Text>
            </View>
          ) : (
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/premium")}
          activeOpacity={0.9}
          testID="open-premium"
        >
          <LinearGradient
            colors={[colors.accent, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumCard}
          >
            <View style={styles.premiumIcon}>
              <Feather name="star" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>
                {profile?.is_premium ? "Você é Premium ✨" : "Seja Premium"}
              </Text>
              <Text style={styles.premiumSub}>
                {profile?.is_premium
                  ? "Todos os recursos liberados"
                  : "Notificações + relatórios + metas ilimitadas"}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>PREFERÊNCIAS</Text>

        <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primary + "1A" }]}>
                <Feather name={mode === "dark" ? "moon" : "sun"} size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                  Tema {mode === "dark" ? "escuro" : "claro"}
                </Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                  Alternar aparência do app
                </Text>
              </View>
            </View>
            <Switch
              value={mode === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#fff"
              accessibilityLabel="Alternar tema escuro"
              accessibilityRole="switch"
              testID="theme-toggle"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.warning + "1A" }]}>
                <Feather name="zap" size={16} color={colors.warning} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                  Frases motivacionais
                </Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                  Exibir frase do dia no início
                </Text>
              </View>
            </View>
            <Switch
              value={profile?.motivational_phrases_enabled ?? true}
              onValueChange={togglePhrases}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#fff"
              accessibilityLabel="Alternar frases motivacionais"
              accessibilityRole="switch"
              testID="phrases-toggle"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.accent + "1A" }]}>
                <Feather name="bell" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                  Notificações de metas
                </Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                  {!profile?.is_premium
                    ? "Recurso Premium · Lembretes no horário"
                    : notifGranted
                    ? "Lembretes ativos no horário da meta"
                    : !notifCanAsk
                    ? "Permissão bloqueada · Abra as configurações"
                    : "Lembre-se das suas metas no horário"}
                </Text>
              </View>
            </View>
            <Switch
              value={!!profile?.is_premium && (profile?.notifications_enabled ?? false) && notifGranted}
              onValueChange={(v) => {
                if (!profile?.is_premium) {
                  router.push("/premium");
                  return;
                }
                toggleNotifications(v);
              }}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#fff"
              accessibilityLabel="Alternar notificações de metas"
              accessibilityRole="switch"
              testID="notifications-toggle"
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DADOS</Text>

        <TouchableOpacity
          onPress={confirmClearData}
          style={[styles.dangerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          testID="clear-data-button"
        >
          <View style={[styles.settingIcon, { backgroundColor: colors.accent + "1A" }]}>
            <Feather name="trash-2" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.accent }]}>Limpar todos os dados</Text>
            <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
              Remove metas e preferências
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Rocket Forward · v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48, gap: 16 },
  heroCard: { padding: 24, borderRadius: 24, borderWidth: 1, alignItems: "center", gap: 10 },
  avatarWrap: { alignItems: "center", gap: 8 },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 50,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  removePhoto: { marginTop: 2 },
  removePhotoText: { fontSize: 11, fontWeight: "600" },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  name: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  editRow: { flexDirection: "row", gap: 8, marginTop: 8, width: "100%" },
  nameInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  saveBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tagline: { fontSize: 13, textAlign: "center", fontStyle: "italic" },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 14,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  levelBadgeText: { fontSize: 12, fontWeight: "800", letterSpacing: -0.1 },
  xpBarWrap: { flex: 1, gap: 5 },
  xpBarTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
  xpBarFill: { height: "100%", borderRadius: 999 },
  xpBarLabel: { fontSize: 10, fontWeight: "600" },
  miniStats: { flexDirection: "row", marginTop: 16, alignSelf: "stretch", alignItems: "center" },
  miniBox: { flex: 1, alignItems: "center" },
  miniValue: { fontSize: 20, fontWeight: "800" },
  miniLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase", marginTop: 4 },
  miniDivider: { width: 1, height: 28 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 12, marginLeft: 4 },
  settingsCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  settingIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  settingTitle: { fontSize: 14, fontWeight: "700" },
  settingSub: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginVertical: 4 },
  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 20,
  },
  premiumIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff33",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumTitle: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  premiumSub: { color: "#ffffffcc", fontSize: 12, fontWeight: "500", marginTop: 2 },
  proPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  proPillText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  footer: { textAlign: "center", fontSize: 12, marginTop: 24 },
});
