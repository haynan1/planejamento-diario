import { useCallback } from "react";

import { api, Goal } from "@/src/api/client";
import { useAchievements } from "@/src/components/AchievementProvider";
import { useToast } from "@/src/components/Toast";
import { cancelGoalNotification, scheduleGoalNotification } from "@/src/notifications";

interface UseGoalActionsOptions {
  reload: () => void | Promise<void>;
  completedMessage?: string | null;
  reopenedMessage?: string | null;
}

export function useGoalActions({
  reload,
  completedMessage = "Meta concluída!",
  reopenedMessage = "Meta reaberta",
}: UseGoalActionsOptions) {
  const toast = useToast();
  const { checkAndCelebrate, celebrateGoalCompletion } = useAchievements();

  const scheduleIfEnabled = useCallback(async (goal: Goal) => {
    try {
      const profile = await api.getProfile();
      if (profile.is_premium && profile.notifications_enabled) {
        await scheduleGoalNotification(goal);
      }
    } catch {
      // Scheduling is best effort; the goal update already succeeded.
    }
  }, []);

  const toggleComplete = useCallback(
    async (goal: Goal) => {
      try {
        const next = goal.status === "concluida" ? "pendente" : "concluida";
        const updated = await api.updateGoal(goal.id, { status: next });
        if (next === "concluida") {
          await cancelGoalNotification(goal.id);
        } else {
          await scheduleIfEnabled(updated);
        }

        const message = next === "concluida" ? completedMessage : reopenedMessage;
        if (message) toast.show(message, "success");

        await reload();
        if (next === "concluida") {
          celebrateGoalCompletion(goal.title);
          checkAndCelebrate();
        }
      } catch {
        toast.show("Erro ao atualizar meta", "error");
      }
    },
    [checkAndCelebrate, celebrateGoalCompletion, completedMessage, reload, reopenedMessage, scheduleIfEnabled, toast],
  );

  const cycleStatus = useCallback(
    async (goal: Goal) => {
      const order = ["pendente", "em_andamento", "concluida"] as const;
      const next = order[(order.indexOf(goal.status) + 1) % order.length];
      try {
        const updated = await api.updateGoal(goal.id, { status: next });
        if (next === "concluida") {
          await cancelGoalNotification(goal.id);
        } else {
          await scheduleIfEnabled(updated);
        }
        await reload();
        if (next === "concluida") {
          celebrateGoalCompletion(goal.title);
          checkAndCelebrate();
        }
      } catch {
        toast.show("Erro ao atualizar meta", "error");
      }
    },
    [checkAndCelebrate, celebrateGoalCompletion, reload, scheduleIfEnabled, toast],
  );

  const deleteGoal = useCallback(
    async (goal: Goal) => {
      try {
        await api.deleteGoal(goal.id);
        await cancelGoalNotification(goal.id);
        toast.show(goal.recurrence ? "Meta recorrente encerrada" : "Meta excluída", "success");
        await reload();
      } catch {
        toast.show("Erro ao excluir", "error");
      }
    },
    [reload, toast],
  );

  return { toggleComplete, cycleStatus, deleteGoal };
}
