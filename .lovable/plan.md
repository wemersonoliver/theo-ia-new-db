

## Calendário visual estilo Google Calendar

Vou transformar a página `/appointments` em uma agenda visual moderna, parecida com o exemplo enviado (DeepCRM/Google Calendar), mantendo a simplicidade como prioridade.

---

### Layout novo

```text
┌────────────────────────────────────────────────────────────────────┐
│ [Hoje] [‹] [›]   Abril de 2026          [Mês][Semana][Dia]  [+ Novo]│
├────────────────────────────────────────────────────────────────────┤
│ Filtros: [👤 Responsável ▾] [🏷️ Status ▾] [🔎 Buscar...]           │
├────────────────────────────────────────────────────────────────────┤
│  DOM    SEG    TER    QUA    QUI    SEX    SÁB                     │
│  ┌────┬────┬────┬────┬────┬────┬────┐                              │
│  │ 29 │ 30 │ 31 │  1 │  2 │  3 │  4 │                              │
│  │    │    │    │ ●  │    │    │    │  ← bolinhas coloridas        │
│  ├────┼────┼────┼────┼────┼────┼────┤    por responsável           │
│  │  5 │  6 │  7 │  8 │  9 │ 10 │ 11 │                              │
│  │    │ ●● │    │    │ ●  │    │    │                              │
│  ├────┼────┼────┼────┼────┼────┼────┤                              │
│  │ 12 │ 13 │ 14 │ 15 │ 16 │ 17 │ 18 │                              │
│  │    │    │    │ 09:00 Teste│    │    │  ← compromisso inline     │
│  ...                                                                │
└────────────────────────────────────────────────────────────────────┘
```

Clicando em um dia → abre **drawer lateral** com a lista detalhada daquele dia (cards atuais reaproveitados).
Clicando em um compromisso no grid → abre o mesmo drawer já focado no agendamento.
Clicando em dia vazio → abre o `AppointmentDialog` já com a data preenchida.

---

### Modos de visualização

1. **Mês** (padrão): grid 7×5/6, cada célula mostra até 3 compromissos resumidos (`HH:MM Título`) + "+N mais"
2. **Semana**: 7 colunas com faixas horárias verticais (06:00–22:00), compromissos em blocos coloridos
3. **Dia**: 1 coluna com timeline vertical detalhada

---

### Filtros (barra superior, sempre visível)

- **Responsável**: multi-select com avatares dos membros da equipe (`useTeamMembers`). Padrão para owner/manager: "Toda a equipe". Para vendedor/atendente: travado em "Meus agendamentos".
- **Status**: chips clicáveis (Agendado · Confirmado · Concluído · Cancelado)
- **Busca**: por nome do contato, telefone ou título

---

### Sugestões para deixar ainda melhor (simplicidade)

1. **Cores por responsável** — cada membro ganha uma cor automática (paleta fixa de 8 cores). O ponto/bloco no calendário herda essa cor → bate o olho e sabe de quem é.
2. **Indicador "Hoje"** com círculo destacado (igual Google Calendar).
3. **Atalhos de teclado**: `T` = hoje, `←/→` = navegar, `M/S/D` = trocar visualização, `N` = novo agendamento.
4. **Mini-legenda fixa no rodapé**: lista os responsáveis filtrados com sua cor.
5. **Hover preview**: passar o mouse num compromisso mostra tooltip com nome do cliente, telefone e status — sem precisar clicar.
6. **Arrastar para reagendar** (drag-and-drop): mover um compromisso para outro dia atualiza a data automaticamente. Confirmação rápida via toast com "Desfazer".
7. **Botão flutuante "+"** no canto inferior direito no mobile, para criar agendamento com um toque.
8. **Card de resumo** acima do calendário: "Hoje você tem 3 agendamentos · 1 pendente de confirmação" (já existe `todayAppointments` no hook).

---

### O que será criado/alterado

**Novos arquivos:**
- `src/components/appointments/AppointmentCalendar.tsx` — componente principal com grid mensal/semanal/diário
- `src/components/appointments/AppointmentDayDrawer.tsx` — drawer lateral com lista do dia
- `src/components/appointments/AppointmentFilters.tsx` — barra de filtros (responsável/status/busca)
- `src/components/appointments/AppointmentEventChip.tsx` — bloco visual de compromisso na grade
- `src/lib/assignee-colors.ts` — utilitário que mapeia `user_id` → cor fixa

**Alterados:**
- `src/pages/Appointments.tsx` — substituir layout atual (calendário pequeno + lista) pelo novo calendário visual em tela cheia
- `src/hooks/useAppointments.ts` — adicionar busca por intervalo de datas (mês/semana visível) ao invés de só um dia, e mutation `rescheduleAppointment` para drag-and-drop

**Mantido como está:**
- `AppointmentDialog` (formulário de criação) — só será reusado
- Hooks de criação/atribuição/status/exclusão — apenas reaproveitados

---

### Detalhes técnicos

- **Biblioteca de calendário**: usar `date-fns` (já instalado) para construir a grade manualmente — sem nova dependência pesada. Mantém bundle leve e visual 100% Tailwind/shadcn.
- **Drag-and-drop**: usar `@dnd-kit/core` se já estiver no projeto (o CRM Kanban usa); senão, implementar com HTML5 drag nativo para evitar nova dep.
- **Performance**: a query do mês carrega só o intervalo visível (`.gte(start).lte(end)`), substituindo a busca atual por dia.
- **Responsivo**: no mobile (<768px) o modo "Mês" colapsa para visualização "Lista por dia" (mais legível em telas pequenas) — visualizações Semana/Dia ficam acessíveis nos botões.
- **Permissões**: vendedor/atendente recebe filtro forçado `assigned_to = user.id` no client (e RLS já garante no banco).

