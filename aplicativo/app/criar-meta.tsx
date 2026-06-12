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
import { api, FreeLimitError, Goal, RecurrenceType } from "@/src/api/client";
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
import ModalHeader from "@/src/components/ModalHeader";
import { scheduleGoalNotification, cancelGoalNotification } from "@/src/notifications";
import { formatGoalTimeInput, normalizeGoalTime } from "@/src/utils/time";
import { addLocalDays, formatLocalISODate, isValidLocalISODate, parseLocalISODate, todayLocalISO } from "@/src/utils/date";
import { haptics } from "@/src/utils/haptics";

const addDays = (iso: string, n: number) => {
  return formatLocalISODate(addLocalDays(parseLocalISODate(iso), n));
};

const labelDate = (iso: string) => {
  const d = parseLocalISODate(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
};

type RecurrenceOption = "none" | RecurrenceType;

const recurrenceOptions: { key: RecurrenceOption; label: string }[] = [
  { key: "none", label: "Não repetir" },
  { key: "weekdays", label: "Dias úteis" },
  { key: "weekends", label: "Finais de semana" },
  { key: "count", label: "Quantidade" },
  { key: "forever", label: "365 dias" },
];

export default function CriarMetaScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { checkAndCelebrate } = useAchievements();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayLocalISO());
  const [time, setTime] = useState<string>("");
  const [recurrence, setRecurrence] = useState<RecurrenceOption>("none");
  const [recurrenceDays, setRecurrenceDays] = useState("7");
  const [priority, setPriority] = useState<Priority>("media");
  const [category, setCategory] = useState<Category>("pessoal");
  const [status, setStatus] = useState<Status>("pendente");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const g = await api.getGoal(editingId);
        setTitle(g.title);
        setDescription(g.description ?? "");
        setDate(g.date);
        setTime(g.time ?? "");
        setRecurrence(g.recurrence?.type ?? "none");
        setRecurrenceDays(String(g.recurrence?.days ?? 7));
        setPriority(g.priority);
        setCategory(g.category);
        setStatus(g.status);
      } catch {
        // ignore
      }
    })();
  }, [editingId]);

  const dateOptions = useMemo(() => {
    const today = todayLocalISO();
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
    if (!isValidLocalISODate(date)) {
      toast.show("Informe uma data válida no formato AAAA-MM-DD", "error");
      return;
    }
    const normalizedTime = normalizeGoalTime(time);
    if (time.trim() && !normalizedTime) {
      toast.show("Informe um horário válido no formato HH:MM", "error");
      return;
    }
    const parsedRecurrenceDays = Number(recurrenceDays);
    if (recurrence === "count" && (!Number.isInteger(parsedRecurrenceDays) || parsedRecurrenceDays < 1)) {
      toast.show("Informe uma quantidade de dias válida", "error");
      return;
    }
    const recurrencePayload =
      recurrence === "none"
        ? null
        : {
            type: recurrence,
            start_date: date,
            ...(recurrence === "count" ? { days: parsedRecurrenceDays } : {}),
            ...(recurrence === "forever" ? { end_date: addDays(date, 364) } : {}),
          };

    haptics.select();
    setSaving(true);
    try {
      const payload: Omit<Goal, "id" | "created_at" | "completed_at"> = {
        title: title.trim(),
        description: description.trim(),
        date,
        time: normalizedTime,
        recurrence: recurrencePayload,
        priority,
        category,
        status,
      };
      if (!editingId) {
        payload.recurrence_overrides = {};
      }
      let savedGoal;
      if (editingId) {
        savedGoal = await api.updateGoal(editingId, payload);
        await cancelGoalNotification(editingId);
        toast.show("Meta atualizada", "success");
      } else {
        savedGoal = await api.createGoal(payload);
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
    } catch (e: unknown) {
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
        <ModalHeader
          title={editingId ? "Editar meta" : "Criar nova meta"}
          closeTestID="modal-close"
        />

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
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
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
              keyboardType="numbers-and-punctuation"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderColor: date.trim() && !isValidLocalISODate(date) ? colors.accent : colors.border,
                  marginTop: 8,
                },
              ]}
              testID="input-date"
            />
            {date.trim() && !isValidLocalISODate(date) ? (
              <Text style={[styles.helper, { color: colors.accent }]}>
                Use o formato AAAA-MM-DD, ex: 2026-06-08
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Horário (opcional)</Text>
            <TextInput
              value={time}
              onChangeText={(value) => setTime(formatGoalTimeInput(value))}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={[
                styles.input,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              testID="input-time"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Repetição</Text>
            <View style={styles.catGrid}>
              {recurrenceOptions.map((option) => {
                const active = recurrence === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setRecurrence(option.key)}
                    style={[
                      styles.catItem,
                      {
                        backgroundColor: active ? colors.accent : colors.surface,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    testID={`recurrence-${option.key}`}
                  >
                    <Feather name={option.key === "none" ? "x-circle" : "repeat"} size={14} color={active ? "#fff" : colors.textSecondary} />
                    <Text
                      style={{
                        color: active ? "#fff" : colors.textSecondary,
                        fontWeight: "600",
                        fontSize: 12,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {recurrence === "count" ? (
              <>
                <TextInput
                  value={recurrenceDays}
                  onChangeText={(value) => setRecurrenceDays(value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Ex: 7"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[
                    styles.input,
                    { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  testID="input-recurrence-days"
                />
                <Text style={[styles.helper, { color: colors.textMuted }]}>
                  Inclui a data escolhida.
                </Text>
              </>
            ) : null}
            {recurrence === "forever" ? (
              <Text style={[styles.helper, { color: colors.textMuted }]}>
                Cria uma ocorrencia por dia por 365 dias, contando a partir da data escolhida.
              </Text>
            ) : null}
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
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
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
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
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
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
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
  scroll: { padding: 24, paddingBottom: 24, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  helper: { fontSize: 11, fontWeight: "600", marginTop: -2 },
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
