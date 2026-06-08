import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Goal } from "@/src/api/client";
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  Status,
} from "@/src/constants/goals";
import { parseLocalISODate } from "@/src/utils/date";

interface Props {
  goal: Goal;
  onToggleComplete?: (g: Goal) => void;
  onEdit?: (g: Goal) => void;
  onDelete?: (g: Goal) => void;
  onCycleStatus?: (g: Goal) => void;
  compact?: boolean;
}

const formatDate = (iso: string) => {
  try {
    const d = parseLocalISODate(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
};

const recurrenceLabel = (goal: Goal) => {
  if (!goal.recurrence) return "";
  if (goal.recurrence.type === "weekdays") return "Dias úteis";
  if (goal.recurrence.type === "weekends") return "Finais de semana";
  if (goal.recurrence.type === "count") return `${goal.recurrence.days ?? 0} dias`;
  return "365 dias";
};

export default function GoalCard({
  goal,
  onToggleComplete,
  onEdit,
  onDelete,
  onCycleStatus,
  compact,
}: Props) {
  const { colors } = useTheme();
  const cat = CATEGORIES.find((c) => c.key === goal.category)!;
  const pri = PRIORITIES.find((p) => p.key === goal.priority)!;
  const st = STATUSES.find((s) => s.key === goal.status)!;
  const completed = goal.status === "concluida";
  const checkScale = useRef(new Animated.Value(completed ? 1 : 0.86)).current;

  useEffect(() => {
    if (completed) {
      Animated.sequence([
        Animated.spring(checkScale, { toValue: 1.22, friction: 4, useNativeDriver: true }),
        Animated.spring(checkScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.spring(checkScale, { toValue: 0.86, friction: 6, useNativeDriver: true }).start();
    }
  }, [checkScale, completed]);

  const statusColor: Record<Status, string> = {
    pendente: colors.textMuted,
    em_andamento: colors.warning,
    concluida: colors.success,
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        completed && { opacity: 0.7 },
      ]}
      testID={`goal-card-${goal.id}`}
    >
      <Animated.View style={{ transform: [{ scale: checkScale }] }}>
      <TouchableOpacity
        onPress={() => onToggleComplete?.(goal)}
        style={[
          styles.checkbox,
          {
            borderColor: completed ? colors.success : colors.border,
            backgroundColor: completed ? colors.success : "transparent",
          },
        ]}
        testID={`goal-toggle-${goal.id}`}
        activeOpacity={0.7}
      >
        {completed ? <Feather name="check" size={16} color="#fff" /> : null}
      </TouchableOpacity>
      </Animated.View>

      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary },
            completed && { textDecorationLine: "line-through", color: colors.textSecondary },
          ]}
          numberOfLines={2}
        >
          {goal.title}
        </Text>

        {!compact && goal.description ? (
          <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
            {goal.description}
          </Text>
        ) : null}

        <View style={styles.meta}>
          <View style={[styles.chip, { backgroundColor: colors.primary + "1A" }]}>
            <Feather name={cat.icon as any} size={11} color={colors.primary} />
            <Text style={[styles.chipText, { color: colors.primary }]}>{cat.label}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: pri.color + "1A" }]}>
            <View style={[styles.dot, { backgroundColor: pri.color }]} />
            <Text style={[styles.chipText, { color: pri.color }]}>{pri.label}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onCycleStatus?.(goal)}
            style={[styles.chip, { backgroundColor: statusColor[goal.status] + "1A" }]}
            testID={`goal-status-${goal.id}`}
          >
            <Text style={[styles.chipText, { color: statusColor[goal.status] }]}>
              {st.label}
            </Text>
          </TouchableOpacity>
          {goal.recurrence ? (
            <View style={[styles.chip, { backgroundColor: colors.accent + "1A" }]}>
              <Feather name="repeat" size={11} color={colors.accent} />
              <Text style={[styles.chipText, { color: colors.accent }]}>
                {recurrenceLabel(goal)}
              </Text>
            </View>
          ) : null}
          <View style={styles.dateRow}>
            <Feather name="calendar" size={11} color={colors.textMuted} />
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {formatDate(goal.date)}
              {goal.time ? ` · ${goal.time}` : ""}
            </Text>
          </View>
        </View>
      </View>

      {(onEdit || onDelete) && (!compact || onDelete) ? (
        <View style={styles.actions}>
          {onEdit ? (
            <TouchableOpacity
              onPress={() => onEdit(goal)}
              style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}
              testID={`goal-edit-${goal.id}`}
            >
              <Feather name="edit-2" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity
              onPress={() => onDelete(goal)}
              style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}
              accessibilityLabel={goal.recurrence ? "Encerrar meta recorrente" : "Excluir meta"}
              testID={`goal-delete-${goal.id}`}
            >
              <Feather name={goal.recurrence ? "stop-circle" : "trash-2"} size={14} color={colors.accent} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  body: { flex: 1, gap: 8 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  desc: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  dateText: { fontSize: 11, fontWeight: "600" },
  actions: { gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
