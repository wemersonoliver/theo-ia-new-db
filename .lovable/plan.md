# Aba "Tarefas" — Visão Usuário + Admin

Aproveitar a tabela existente `crm_deal_tasks` (já tem `completed`, `due_date`, `assigned_to`, `account_id`, `completed_at`, `completed_by`) para criar uma central de tarefas robusta — sem migrations de schema novas.

## 1. Menu lateral

**`src/components/Sidebar.tsx`** — adicionar item antes de "Configurações":
- `{ to: "/tasks", icon: ListChecks, label: "Tarefas", perm: "crm" }` (usa permissão `crm` já existente, herdada por owner/manager/seller).

**`src/components/admin/AdminSidebar.tsx`** — adicionar:
- `{ to: "/admin/tasks", icon: ListChecks, label: "Tarefas (Global)" }` após "CRM".

**`src/App.tsx`** — registrar rotas:
- `/tasks` → `<ProtectedRoute><Tasks /></ProtectedRoute>`
- `/admin/tasks` → `<AdminTasks />`

## 2. Página do Usuário — `src/pages/Tasks.tsx`

Layout dentro de `DashboardLayout` com:

**Cabeçalho de KPIs (4 cards):**
- Total de tarefas, Concluídas, Pendentes, Atrasadas (vencidas e não concluídas), Para hoje.

**Filtros (barra superior):**
- Status: Todas / Pendentes / Concluídas / Atrasadas / Hoje / Próximos 7 dias
- Responsável (membros da conta, via `useTeamMembers`)
- Negócio (busca por título do deal)
- Período (data de vencimento — preset 7d/30d/90d/all)
- Busca por texto (título)

**Tabs internas:**
- `Lista` — tabela com colunas: ✅ checkbox, Título, Negócio (link clicável → CRM), Responsável (avatar), Vencimento (com badge "Atrasada"/"Hoje"), Concluída em, Ações (editar/excluir). Ordenação por vencimento crescente, agrupada por dia.
- `Kanban` — 3 colunas (Pendentes, Em atraso, Concluídas) com drag para marcar concluído.
- `Calendário` — reuso de `AppointmentCalendar` adaptado mostrando tarefas por dia.
- `Desempenho` — gráficos:
  - Barras: tarefas concluídas por membro (últimos 30 dias).
  - Linha: tarefas concluídas por dia (últimos 30 dias).
  - Pizza: distribuição por status.
  - Tabela: "Top performers" com taxa de conclusão (% concluídas / total) e tempo médio de conclusão por membro.

**Ações:**
- Botão "Nova tarefa" abre dialog (precisa selecionar um Deal — usa `useCRMDeals`). Reusa lógica existente de `useCRMDealTasks`.
- Toggle inline (checkbox) → otimista, com `toggleTask`.
- Editar/Excluir via dropdown.

**Hook novo:** `src/hooks/useAllTasks.ts` — busca todas as tarefas da conta (filtra por `account_id` via RLS), com joins em deals (título) e profiles (nome do responsável). Suporta filtros e retorna agregados.

## 3. Página Admin — `src/pages/admin/AdminTasks.tsx`

Acessa via Service-role-bypass usando RLS de super_admin (já habilitado em `crm_deal_tasks`? Não — precisa adicionar policy ou usar edge function). 

**Verificação:** `crm_deal_tasks` hoje só tem policy "Team members" + "own". Vou adicionar policy: "Super admins manage all deal tasks" via migration mínima.

Layout `AdminLayout`:

**KPIs globais:** Total de tarefas no sistema, Concluídas (período), Em atraso, Usuários com tarefas ativas, Taxa média de conclusão.

**Filtros:**
- Período (7d/30d/90d/custom)
- Conta/Empresa (lista de `accounts`)
- Usuário (lista de profiles)
- Status

**Seções:**
1. **Gráficos globais:**
   - Barras horizontais: Top 10 usuários por tarefas concluídas.
   - Linha: Tarefas criadas vs concluídas por dia.
   - Pizza: % por status global.
   - Heatmap (opcional, via grid simples): atividade por dia da semana × hora.

2. **Tabela de Desempenho por Usuário** (linha por user):
   - Avatar/Nome, Conta, Total criadas, Concluídas, Em atraso, Taxa de conclusão (%), Tempo médio de conclusão (h), Última atividade.
   - Ordenação por qualquer coluna; clique expande para ver tarefas do usuário.

3. **Lista expansível por Usuário:**
   - Accordion: cada usuário → lista de tarefas (mesma tabela do user view, somente leitura para admin).

**Hook novo:** `src/hooks/useAdminTasks.ts` — usa cliente Supabase (com policy super_admin) para buscar tarefas globais com joins em `profiles`, `accounts`, `crm_deals`.

## 4. Componentes novos

- `src/components/tasks/TaskFilters.tsx`
- `src/components/tasks/TaskTable.tsx` (compartilhado user/admin via prop `readOnly`)
- `src/components/tasks/TaskKPICards.tsx`
- `src/components/tasks/TaskDialog.tsx` (criar/editar)
- `src/components/tasks/TaskCharts.tsx` (recharts: BarChart, LineChart, PieChart)
- `src/components/tasks/TaskCalendarView.tsx`
- `src/components/admin/AdminTaskPerformanceTable.tsx`

## 5. Migration mínima

```sql
-- Permitir super_admins verem/gerenciarem todas as tarefas
CREATE POLICY "Super admins manage all deal tasks"
ON public.crm_deal_tasks
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
```

## 6. Detalhes técnicos

- Usar `recharts` (já no projeto via `@/components/ui/chart`).
- Atualizações otimistas com TanStack Query (padrão já usado).
- Mobile: tabela vira cards empilhados (`md:hidden` / `hidden md:table`).
- Tema: amber/slate no admin, primary normal no usuário (consistente com padrões).
- Badges de status: vermelho (atrasada), azul (hoje), cinza (futura), verde (concluída).
- Realtime opcional (v2): subscription em `crm_deal_tasks` filtrado por `account_id`.

## Arquivos a criar/editar

**Editar:** `src/components/Sidebar.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/App.tsx`
**Criar:** `src/pages/Tasks.tsx`, `src/pages/admin/AdminTasks.tsx`, `src/hooks/useAllTasks.ts`, `src/hooks/useAdminTasks.ts`, e os 7 componentes acima.
**Migration:** policy super_admin em `crm_deal_tasks`.
