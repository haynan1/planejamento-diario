import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeProvider";
import { api, FreeLimitError } from "@/src/api/client";
import PrimaryButton from "@/src/components/PrimaryButton";
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  Priority,
  Category,
  Status,
} from "@/src/constants/goals";
import { useToast } from "@/src/components/Toast";
import { useAchievements } from "@/src/components/AchievementProvider";
import { scheduleGoalNotification, cancelGoalNotification } from "@/src/notifications";

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const labelDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
};

export default function CriarMetaScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { checkAndCelebrate } = useAchievements();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("media");
  const [category, setCategory] = useState<Category>("pessoal");
  const [status, setStatus] = useState<Status>("pendente");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const goals = await api.listGoals();
        const g = goals.find((x) => x.id === editingId);
        if (g) {
          setTitle(g.title);
          setDescription(g.description ?? "");
          setDate(g.date);
          setTime(g.time ?? "");
          setPriority(g.priority);
          setCategory(g.category);
          setStatus(g.status);
        }
      } catch {
        // ignore
      }
    })();
  }, [editingId]);

  const dateOptions = useMemo(() => {
    const today = todayISO();
    return [
      { key: today, label: "Hoje" },
      { key: addDays(today, 1), label: "Amanhã" },
      { key: addDays(today, 2), label: labelDate(addDays(today, 2)) },
      { key: addDays(today, 7), label: "Próxima semana" },
    ];
  }, []);

  const onSave = async () => {
    if (!title.trim()) {
      toast.show("Informe um título para a meta", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        date,
        time: time.trim() || null,
        priority,
        category,
        status,
      };
      let savedGoal;
      if (editingId) {
        savedGoal = await api.updateGoal(editingId, payload as any);
        await cancelGoalNotification(editingId);
        toast.show("Meta atualizada", "success");
      } else {
        savedGoal = await api.createGoal(payload as any);
        toast.show("Meta criada! Hora de decolar.", "success");
      }
      // Schedule notification (no-op if permission/premium not set)
      try {
        const profile = await api.getProfile();
        if (profile.is_premium && profile.notifications_enabled) {
          await scheduleGoalNotification(savedGoal);
        }
      } catch {
        // ignore
      }
      // Check achievements after saving
      checkAndCelebrate();
      router.back();
    } catch (e: any) {
      if (e instanceof FreeLimitError) {
        toast.show(e.message, "error");
        // Open paywall right after toast appears
        setTimeout(() => router.replace("/premium"), 600);
      } else {
        toast.show("Erro ao salvar meta", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            testID="modal-close"
          >
            <Feather name="x" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {editingId ? "Editar meta" : "Criar nova meta"}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Título da meta</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Estudar 1h de React Native"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              testID="input-title"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Descrição (opcional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Detalhes que te ajudem a executar..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.textarea,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              testID="input-description"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Data</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {dateOptions.map((d) => {
                const active = date === d.key;
                return (
                  <TouchableOpacity
                    key={d.key}
                    onPress={() => setDate(d.key)}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: active ? colors.accent : colors.surface,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                    testID={`date-${d.key}`}
                  >
                    <Text style={{ color: active ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 },
              ]}
              testID="input-date"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Horário (opcional)</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              testID="input-time"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Prioridade</Text>
            <View style={styles.row}>
              {PRIORITIES.map((p) => {
                const active = priority === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setPriority(p.key)}
                    style={[
                      styles.segItem,
                      {
                        backgroundColor: active ? p.color : colors.surface,
                        borderColor: active ? p.color : colors.border,
                      },
                    ]}
                    testID={`priority-${p.key}`}
                  >
                    <Text style={{ color: active ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Categoria</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[
                      styles.catItem,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    testID={`category-${c.key}`}
                  >
                    <Feather name={c.icon as any} size={14} color={active ? "#fff" : colors.textSecondary} />
                    <Text
                      style={{
                        color: active ? "#fff" : colors.textSecondary,
                        fontWeight: "600",
                        fontSize: 12,
                      }}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
            <View style={styles.row}>
              {STATUSES.map((s) => {
                const active = status === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setStatus(s.key)}
                    style={[
                      styles.segItem,
                      {
                        backgroundColor: active ? colors.success : colors.surface,
                        borderColor: active ? colors.success : colors.border,
                      },
                    ]}
                    testID={`status-${s.key}`}
                  >
                    <Text style={{ color: active ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 12 }}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <PrimaryButton
            label="Cancelar"
            onPress={() => router.back()}
            variant="secondary"
            style={{ flex: 1 }}
            testID="modal-cancel"
          />
          <PrimaryButton
            label={editingId ? "Atualizar meta" : "Salvar meta"}
            onPress={onSave}
            loading={saving}
            icon="check"
            style={{ flex: 1.4 }}
            testID="modal-save"
          />
        </View>
      </KeyboardAvoidingView>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  scroll: { padding: 24, paddingBottom: 24, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "500",
  },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { gap: 8 },
  choiceChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  row: { flexDirection: "row", gap: 8 },
  segItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
});
