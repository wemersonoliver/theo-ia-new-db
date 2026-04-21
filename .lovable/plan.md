

## Tornar o card de negócio do CRM mais completo

Vou transformar o `DealDialog` (que abre ao clicar num card do CRM) em um **painel lateral rico** com todas as informações do cliente, anotações, ações rápidas e histórico — mantendo simples para usuários leigos.

---

### Novo layout (drawer lateral à direita, em vez de modal central)

```text
┌────────────────────────────────────────────────────────────┐
│ ← [Título do Negócio]              [✏️] [⋮ mais]   [✕]    │
│   🏷️ Estágio atual ▾   • R$ 1.200,00   • Alta prioridade   │
├────────────────────────────────────────────────────────────┤
│ AÇÕES RÁPIDAS                                              │
│  [💬 Conversar no WhatsApp] [📅 Agendar] [✅ Ganho] [❌ Perdido] │
├────────────────────────────────────────────────────────────┤
│ 👤 CLIENTE                                                 │
│   Nome:  Maria Silva                                       │
│   📞 (47) 99999-0000  [copiar]                             │
│   🏷️ Tags: vip, indicação                                  │
│   👥 Responsável: João  ▾                                  │
├────────────────────────────────────────────────────────────┤
│ 📝 ANOTAÇÕES E HISTÓRICO                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Escreva uma anotação...                       [Salvar]│ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  • João — há 2h                                            │
│    "Cliente pediu retorno na sexta"                        │
│  • Sistema — há 1d                                         │
│    Movido de "Atendimento IA" → "Negociação"               │
│  • Maria — há 3d                                           │
│    Negócio criado                                          │
├────────────────────────────────────────────────────────────┤
│ 🛒 PRODUTOS  [+ adicionar]                                 │
│   1x Plano Mensal    R$ 97,00         [✕]                  │
│   Total: R$ 97,00                                          │
├────────────────────────────────────────────────────────────┤
│ 📅 PRÓXIMO AGENDAMENTO                                     │
│   Reunião — 25/04 às 14:00 com João  [ver]                │
│   (ou: "Nenhum agendamento" + botão criar)                 │
├────────────────────────────────────────────────────────────┤
│ ⚙️ DETALHES (recolhível)                                   │
│   Descrição · Previsão de fechamento · Criado em ...       │
└────────────────────────────────────────────────────────────┘
```

---

### Botões de ação rápida (topo, sempre visíveis)

1. **💬 Conversar no WhatsApp** → abre `/conversations?phone={telefone}` direto na conversa do cliente.
2. **📅 Agendar** → abre o `AppointmentDialog` já preenchido com nome, telefone e responsável do negócio.
3. **✅ Marcar como Ganho** → move o negócio para o último estágio (ou estágio "Ganho") + registra atividade automática.
4. **❌ Marcar como Perdido** → pede motivo curto (input rápido) e arquiva.

---

### Anotações + Histórico (timeline unificada)

Usar a tabela existente `crm_activities` (já existe no banco) para registrar:
- **Anotações manuais** do usuário (`type: 'note'`)
- **Eventos automáticos** do sistema (`type: 'stage_change'`, `type: 'created'`, `type: 'won'`, `type: 'lost'`, `type: 'appointment_created'`)

Tudo aparece numa timeline reversa (mais recente em cima), com ícone, autor, tempo relativo ("há 2h") e conteúdo. Campo de input no topo para adicionar nova anotação com um clique.

---

### Sugestões extras para deixar o card mais completo (sem complicar)

1. **Cor do estágio na borda lateral do drawer** — bate o olho e sabe em que fase está.
2. **Indicador de "tempo parado"** — se o negócio está no mesmo estágio há mais de 7 dias, mostra um aviso amarelo "⏰ Parado há 12 dias — vale dar um follow-up?".
3. **Última mensagem do WhatsApp** — preview de 1 linha da última conversa com esse contato (se houver), com botão "Ver conversa".
4. **Próximo agendamento** — busca em `appointments` pelo telefone do contato e mostra o mais próximo no futuro.
5. **Cópia rápida** — botões `[copiar]` ao lado do telefone e do valor para facilitar compartilhar.
6. **Atribuir responsável visível no topo** — `AssigneeSelector` com avatar colorido (usar `assignee-colors`).
7. **Atalhos de teclado**: `Esc` fecha · `Ctrl+Enter` salva anotação · `W` marca ganho.
8. **Botão "Ir para o contato"** — leva para `/contacts?id=...` para ver tudo do cliente.
9. **Confirmação suave ao excluir** — modal "Tem certeza? Esta ação não pode ser desfeita" com botão destacado.
10. **Modo edição inline** — clicar no título, valor ou estágio edita direto, sem precisar abrir formulário separado (tipo Trello/Notion).

---

### O que será criado/alterado

**Novos arquivos:**
- `src/components/crm/DealDetailsDrawer.tsx` — novo componente principal (drawer lateral com seções)
- `src/components/crm/DealActivityTimeline.tsx` — timeline de anotações + eventos automáticos
- `src/components/crm/DealQuickActions.tsx` — barra de botões de ação rápida
- `src/hooks/useCRMActivities.ts` — hook para listar/criar atividades do deal
- `src/hooks/useDealRelatedData.ts` — busca paralela: última conversa + próximo agendamento + produtos do deal

**Alterados:**
- `src/components/crm/KanbanBoard.tsx` — substituir `DealDialog` por `DealDetailsDrawer` no clique do card; manter `DealDialog` apenas para criação rápida (botão "+")
- `src/components/crm/DealCard.tsx` — adicionar pequenos indicadores: ícone de WhatsApp se há conversa ativa, ícone de calendário se há agendamento futuro, badge "⏰" se parado >7 dias
- `src/hooks/useCRMDeals.ts` — adicionar mutations `markAsWon(id)` e `markAsLost(id, reason)` que também registram atividade automática

**Mantido:**
- `DealDialog` continua existindo para o fluxo de **criação** de negócio (formulário rápido)
- `useCRMDeals`, `useProducts`, `useContacts` reaproveitados

---

### Detalhes técnicos

- **Componente base**: usar o `Sheet` do shadcn (lateral direito, ~480px desktop / fullscreen mobile) — já está no projeto.
- **Atividades**: a tabela `crm_activities` já existe com RLS por `account_id`. Eventos automáticos serão inseridos no client após cada mutation (`updateDeal` registra mudança de estágio, `markAsWon` registra ganho, etc.).
- **Botão WhatsApp**: navega para `/conversations?phone=${normalizePhone(deal.contact_phone)}` — a página Conversations já aceita esse query param.
- **Botão Agendar**: reusa o `AppointmentDialog` existente passando `defaultPhone`, `defaultContactName`, `defaultAssignedTo`.
- **Próximo agendamento**: query simples em `appointments` filtrada por telefone normalizado e `appointment_date >= hoje`, ordenada e limitada a 1.
- **Última conversa**: query em `whatsapp_conversations` por telefone normalizado, lendo só o último item de `messages`.
- **Performance**: tudo carregado em paralelo via `Promise.all` ao abrir o drawer; cache local para não refetch ao reabrir o mesmo deal em <30s.
- **Mobile**: drawer ocupa tela inteira, ações ficam em barra fixa no topo, timeline rolável.

