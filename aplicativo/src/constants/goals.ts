export type Priority = "baixa" | "media" | "alta";
export type Status = "pendente" | "em_andamento" | "concluida";
export type Category =
  | "estudos"
  | "trabalho"
  | "saude"
  | "financas"
  | "espiritual"
  | "pessoal"
  | "familia"
  | "empreendedorismo"
  | "outros";

export const PRIORITIES: { key: Priority; label: string; color: string }[] = [
  { key: "baixa", label: "Baixa", color: "#3B82F6" },
  { key: "media", label: "Média", color: "#F59E0B" },
  { key: "alta", label: "Alta", color: "#FF2A4D" },
];

export const STATUSES: { key: Status; label: string }[] = [
  { key: "pendente", label: "Pendente" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluída" },
];

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "estudos", label: "Estudos", icon: "book" },
  { key: "trabalho", label: "Trabalho", icon: "briefcase" },
  { key: "saude", label: "Saúde", icon: "heart" },
  { key: "financas", label: "Finanças", icon: "dollar-sign" },
  { key: "espiritual", label: "Espiritual", icon: "sun" },
  { key: "pessoal", label: "Pessoal", icon: "user" },
  { key: "familia", label: "Família", icon: "users" },
  { key: "empreendedorismo", label: "Empreendedorismo", icon: "trending-up" },
  { key: "outros", label: "Outros", icon: "more-horizontal" },
];

export const categoryLabel = (k: Category) =>
  CATEGORIES.find((c) => c.key === k)?.label ?? "Outros";
export const priorityLabel = (k: Priority) =>
  PRIORITIES.find((p) => p.key === k)?.label ?? "Média";
export const statusLabel = (k: Status) =>
  STATUSES.find((s) => s.key === k)?.label ?? "Pendente";

export const MOTIVATIONAL_PHRASES: string[] = [
  "Um passo hoje, uma conquista amanhã.",
  "Continue avançando.",
  "Sua constância é o combustível.",
  "Pequenas metas constroem grandes destinos.",
  "Hoje é mais uma chance de decolar.",
  "Você não precisa correr, só precisa continuar.",
  "Cada meta concluída te leva mais longe.",
  "Disciplina é direção.",
  "Avance um pouco mais.",
  "O futuro começa na próxima ação.",
];

export const getDailyPhrase = (): string => {
  const dayKey = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) hash = (hash * 31 + dayKey.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % MOTIVATIONAL_PHRASES.length;
  return MOTIVATIONAL_PHRASES[idx];
};

export const getGreeting = (name?: string): string => {
  const h = new Date().getHours();
  let g = "Boa noite";
  if (h >= 5 && h < 12) g = "Bom dia";
  else if (h >= 12 && h < 18) g = "Boa tarde";
  return name ? `${g}, ${name}` : g;
};
