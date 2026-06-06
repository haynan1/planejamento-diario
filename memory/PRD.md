# Rocket Forward — PRD

Aplicativo mobile (React Native + Expo) de produtividade pessoal em **português do Brasil**, focado em metas diárias, planejamento e evolução.

## Stack
- Frontend: Expo Router 6 (SDK 54), React Native 0.81, TypeScript
- Backend: FastAPI + MongoDB (motor)
- Tema: Claro/Escuro com alternância (preferido: escuro)
- Sem autenticação (perfil único `default`)

## Telas
1. **Início** (`/`) — Saudação, ProgressRing, contadores (concluídas/pendentes/sequência), frase motivacional, lista de metas de hoje, CTA "Criar nova meta".
2. **Metas** — Lista completa com abas de filtros (Status / Prioridade / Categoria), chip row, ações: concluir, ciclar status, editar, excluir.
3. **Planejamento** — Segmented Hoje/Semana/Mês, metas agrupadas por data com timeline.
4. **Histórico** — Stat cards (Concluídas, Dias Produtivos, Taxa, Recorde), gráfico de barras da semana, resumo geral.
5. **Perfil** — Avatar, nome editável, mini stats, toggles (tema, frases motivacionais), Limpar dados.

## Modal
- **Criar/Editar Meta** (`/criar-meta`) — Título, descrição, data (chips + texto), horário, prioridade (Baixa/Média/Alta), categoria (9 opções), status (Pendente/Em andamento/Concluída).

## Backend Endpoints
- `GET /api/` — health
- `GET/POST/PUT/DELETE /api/goals` (com filtros: status, priority, category, date_from, date_to, date_eq)
- `GET /api/stats` — total, concluídas, hoje, sequência, melhor sequência, evolução semanal
- `GET/PUT /api/profile`
- `POST /api/clear-data`

## Paleta (azul + vermelho premium)
- Dark: bg #070B14, primary #3B69FF, accent #FF2A4D
- Light: bg #F4F6F9, primary #214FE0, accent #E61A3A

## Notas
- Frases motivacionais: lista fixa (10 frases), seleção determinística por dia.
- Sem login na v1; estrutura preparada para expandir.

## Iteração 2 — Gamificação + Premium (demo)
- **Gamificação**: 12 conquistas em 5 grupos (Início, Conclusão, Sequência, Variedade, Dia). Avaliadas via `POST /api/achievements/check` e celebradas com modal animado após criar/concluir metas.
- **Notificações locais**: `expo-notifications` agenda lembretes no horário da meta. Funciona em build nativo (no preview web é no-op por design).
- **Plano Premium (modo demo)**: `Profile.is_premium` controla acesso. Tier gratuito limitado a 5 metas ativas (HTTP 402 com código `FREE_LIMIT_REACHED`); Premium libera notificações + relatórios + metas ilimitadas. Sem integração de pagamento na v1 — toggle no `/premium` valida UX.
- **Relatórios avançados** (Premium): `GET /api/reports/monthly` — barras por categoria/prioridade + evolução de 30 dias.
- **Novas telas modais**: `/conquistas`, `/premium`, `/relatorios`.
