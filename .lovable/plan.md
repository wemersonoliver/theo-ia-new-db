
# Aceite obrigatório de atendimento (vinculado à Roleta)

## Regra de ativação

O fluxo de aceite **só existe** quando:
1. A conta tem **mais de 1 membro ativo** em `account_members`, **E**
2. A **Roleta está ativa** (`roulette_config.enabled = true`), **E**
3. A nova flag `roulette_config.require_acceptance = true`.

Se qualquer condição falhar → comportamento atual permanece intacto: o admin/owner recebe a notificação padrão por WhatsApp (`notify-handoff` etc.) e a conversa fica visível como hoje.

---

## 1. Schema

Migration:
```sql
ALTER TABLE public.roulette_config
  ADD COLUMN require_acceptance boolean NOT NULL DEFAULT false;
```

## 2. UI da Roleta (`RouletteTab.tsx`)

Novo switch logo abaixo de "Exigir online":
- **"Exigir aceite do atendimento"**
- Texto: "Quando a roleta atribuir um lead, o atendente precisa clicar em 'Aceitar' antes de ver a conversa. Só então o lead vira responsabilidade dele."
- Desabilitado (com tooltip) quando a Roleta está desligada ou só há 1 membro.

## 3. Integração com a Roleta (sem mudanças no `whatsapp-ai-agent`)

A roleta já cria registros em `roulette_assignments` com status `pending` quando atribui. Vamos reutilizar isso como fonte de verdade do "aceite pendente":

- `roulette_assignments.status = 'pending'` → conversa **bloqueada** para todos exceto o `user_id` sorteado.
- Atendente sorteado clica "Aceitar" → chama RPC `accept_roulette_assignment(phone, user_id)` (já existe) e a conversa libera.
- Timeout/expiração já cuida do reroteamento.

**Sem aceite obrigatório** (`require_acceptance = false`): a conversa já fica visível ao sorteado normalmente, como hoje. Nada muda.

## 4. Frontend — Conversations

`useConversations` passa a trazer também o assignment pendente do usuário atual:

```text
pendingAssignments = roulette_assignments
  where account_id = X
    and user_id = auth.uid()
    and status = 'pending'
    and expires_at > now()
```

Para cada conversa:
- Se `require_acceptance && roleta ativa && multi-user` E existe assignment `pending` para o usuário atual neste `phone` → renderiza **card de aceite** no lugar do chat:
  - Nome do contato + telefone + última mensagem (preview de 1 linha)
  - Tempo restante (countdown a partir de `expires_at`)
  - Botão **"Aceitar atendimento"** (primary)
  - Texto: "Ao aceitar, este lead vira sua responsabilidade e passa a contar nas suas métricas."
- Se a conversa foi atribuída a **outro** atendente e está pending → simplesmente não aparece na lista do usuário (filtro client-side por assignment).
- Owner/manager veem tudo normalmente (override pelo papel — sem bloqueio).

## 5. Ação "Aceitar"

Nova mutation `acceptAssignment(phone)` em `useConversations`:
1. RPC `accept_roulette_assignment(phone, auth.uid())` → marca assignment como `accepted`.
2. `update whatsapp_conversations set assigned_to = auth.uid() where account_id and phone and assigned_to is null`.
3. Reflete em `contacts.assigned_to` e `crm_deals` ativos.
4. Se a RPC retornou `null` (já expirou/foi reatribuído) → toast "Esse atendimento expirou ou foi transferido" e remove o card.

## 6. Notificações no navegador

Novo hook `useBrowserNotifications` (montado no `ProtectedRoute`):
- Pede `Notification.requestPermission()` na primeira visita autenticada (flag em `localStorage`).
- Subscribe Realtime em `roulette_assignments` filtrado por `account_id` do usuário.
- Quando `INSERT` com `user_id == auth.uid()` e `status == 'pending'`:
  - `new Notification("Novo atendimento aguardando aceite", { body: "{contato} foi atribuído a você. Aceite em até X min.", tag: "assign-{phone}" })`
  - Som curto.
  - Click → foca a janela e navega para `/conversations?phone={phone}`.
- Fallback (permissão negada): toast persistente do sonner + badge no Sidebar.
- **Não dispara** quando o aceite obrigatório está desligado — nesse modo a notificação fica por conta do canal padrão WhatsApp.

## 7. Indicador na Sidebar/Header

Pequeno badge "Atendimentos aguardando aceite" no item "Conversas" do menu, contando assignments `pending` para o usuário atual. Click leva à primeira conversa pendente.

## 8. Métricas (sem migration)

Já funciona: `useDashboardMetrics` agrupa por `assigned_to`. Como aceitar seta `assigned_to = user_id` na conversa, no contato e no deal, todos os KPIs (leads, atendimentos, agendamentos, vendas) e o `SellerPerformanceTable` passam automaticamente a contar para o atendente que aceitou. O período conta a partir do `accepted_at`.

## 9. Fluxo "sem multi-usuário ou sem roleta"

Caminho preservado integralmente:
- `whatsapp-ai-agent` faz handoff → chama `notify-handoff` → admin recebe no WhatsApp como hoje.
- Conversa fica visível ao admin sem nenhum bloqueio.
- Nenhum card de aceite, nenhuma notificação no navegador.
- A flag `require_acceptance` é ignorada quando a Roleta está desligada.

## Arquivos previstos

- Migration: nova coluna `require_acceptance`.
- `src/hooks/useRouletteConfig.ts` — incluir o novo campo.
- `src/components/settings/RouletteTab.tsx` — novo switch (desabilitado quando roleta off ou 1 membro).
- `src/hooks/useConversations.ts` — buscar `roulette_assignments` pending do usuário; expor `pendingPhones` e mutation `acceptAssignment`.
- `src/pages/Conversations.tsx` — card de aceite + ocultar chat quando pendente + badge "Pendente" na lista.
- `src/hooks/useBrowserNotifications.ts` (novo) — permissão + realtime de `roulette_assignments`.
- `src/components/BrowserNotificationsProvider.tsx` (novo) — wrapper montado em `ProtectedRoute`.
- `src/components/AppSidebar.tsx` — badge de pendentes.
