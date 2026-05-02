## Regra: Finalizar atendimento exige classificação (Ganho / Perdido / Desistência)

Todo atendimento (conversa) só pode ser encerrado depois que o atendente o classificar como **Ganho**, **Perdido** ou **Desistência**. A classificação atualiza automaticamente o negócio (deal) vinculado, alimenta as métricas individuais do atendente e as métricas gerais do sistema, com filtro por funil no dashboard.

### O que o usuário verá

- Novo botão **"Finalizar atendimento"** no topo do chat (ao lado do nome do contato), visível para o atendente responsável (e owner/manager).
- Ao clicar, abre um diálogo "Como foi este atendimento?" com 3 opções grandes e coloridas:
  - **Ganho** (verde) — pede valor da venda (opcional, pré-preenchido com valor do deal) e observação.
  - **Perdido** (vermelho) — pede motivo (campo de texto curto, obrigatório).
  - **Desistência** (cinza) — pede observação (opcional).
- Sem classificação, o chat permanece aberto. Se o atendente tentar fechar/arquivar a conversa, o sistema bloqueia com aviso "Classifique o atendimento antes de finalizá-lo".
- Após classificar:
  - A conversa é marcada como finalizada e some da lista ativa (filtro padrão "Em atendimento"); aparece em um novo filtro "Finalizadas" com badge da classificação.
  - O deal correspondente é movido automaticamente para a etapa Ganho/Perdido do funil dele e recebe `won_at`/`lost_at` + motivo.
  - Toast de confirmação e som curto.
- No **Dashboard** novos cartões e quebras:
  - KPIs novos: **Ganhos**, **Perdidos**, **Desistências**, **Taxa de conversão (Ganho / Total finalizados)**.
  - Tabela "Desempenho por atendente" ganha colunas **Ganhos / Perdidos / Desist. / Conv.%**.
  - Os filtros existentes (período, atendente, funil) já se aplicam aos novos números.

### Banco de dados

Migration:

- `whatsapp_conversations`:
  - `outcome text` — valores: `won` | `lost` | `abandoned` | `null` (em aberto).
  - `outcome_reason text` — motivo/observação.
  - `outcome_value_cents integer` — valor (apenas para Ganho).
  - `closed_at timestamptz` — quando foi finalizada.
  - `closed_by uuid` — atendente que finalizou.
- Índice em `(account_id, closed_at)` e `(account_id, outcome)`.
- Para cada `crm_pipelines` sem etapa "Ganho"/"Perdido", a migration insere as etapas faltantes ao final (cor verde/vermelho). Atendimento humano segue como etapa intermediária.

### Backend (lógica de finalização)

Nova edge function `finalize-conversation` (ou RPC `finalize_conversation`) — preferimos RPC SECURITY DEFINER para atomicidade:

1. Valida que o caller é o `assigned_to` da conversa OU owner/manager.
2. Valida `outcome ∈ {won, lost, abandoned}` e exige `outcome_reason` quando `lost`.
3. Atualiza `whatsapp_conversations` com `outcome`, `outcome_reason`, `outcome_value_cents`, `closed_at = now()`, `closed_by = auth.uid()`, `ai_active = false`.
4. Localiza o `crm_deals` ativo do contato no funil ativo do atendente:
   - `won` → move para etapa "Ganho", seta `won_at = now()`, atualiza `value_cents` se enviado.
   - `lost` → move para "Perdido", seta `lost_at = now()`, `lost_reason = motivo`.
   - `abandoned` → move para "Perdido" com `lost_reason = 'Desistência: ' || motivo` (mantemos só 2 colunas no Kanban; métrica separa).
5. Cancela follow-up (`cancel_followup_sequence(_user_id, _phone, 'handoff')`).
6. Insere `crm_activities` com tipo `outcome` registrando a ação.

### Frontend

- `src/components/conversations/FinalizeDialog.tsx` (novo) — diálogo com 3 cards de classificação + campos condicionais.
- `src/pages/Conversations.tsx` — botão "Finalizar atendimento" no header do chat; bloqueia ação de "Arquivar" se `outcome` ainda for null; adiciona aba/filtro "Finalizadas" na lista lateral com badge colorido.
- `src/hooks/useConversations.ts` — incluir novos campos no select e tipos.
- `src/hooks/useFinalizeConversation.ts` (novo) — mutation que chama a RPC, faz invalidate de `conversations`, `crm-deals` e `dashboard-metrics`.
- `src/lib/dashboard-metrics.ts` + `src/hooks/useDashboardMetrics.ts`:
  - Adicionar contagem de `won/lost/abandoned` no período usando `closed_at` + `outcome`.
  - Por atendente: agregação por `closed_by`.
  - Aplicar filtro de funil: cruzar `phone` da conversa com contatos cujos deals pertencem a stages do funil escolhido (mesma lógica já usada para tempo de espera).
- `src/components/dashboard/KPICards.tsx` — novos 3 cards (Ganhos / Perdidos / Desistências) e card de Taxa de conversão.
- `src/components/dashboard/SellerPerformanceTable.tsx` — colunas Ganhos, Perdidos, Desistências, Conv.%.

### Permissões / RLS

- A RPC roda como `SECURITY DEFINER` validando `auth.uid()`.
- Policies existentes já cobrem leitura/escrita de `whatsapp_conversations`/`crm_deals` por membros da conta.
- Owner/manager pode reabrir um atendimento (limpar `outcome`) — botão "Reabrir" só aparece para esses papéis.

### Detalhes técnicos relevantes

- O Kanban e o `useDashboardMetrics` já usam `won_at`/`lost_at` do `crm_deals`, então as métricas atuais de Vendas continuam funcionando — os novos KPIs derivam de `whatsapp_conversations.outcome` para refletir "atendimento finalizado", que é independente de venda fechada via Kanban.
- "Desistência" não tem campo nativo no `crm_deals`; usamos `lost_at` + `lost_reason` prefixado para manter o funil consistente, mas o relatório no dashboard mostra a coluna separada baseada no `outcome` da conversa.
- Notificações desktop (hook `useBrowserNotifications` já existente) emitem aviso quando outro membro finaliza um atendimento que estava atribuído a você (caso de override por owner).
