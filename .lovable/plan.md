
# Roleta: presença online + timeout de aceite

Adiciona dois controles à Roleta de Atendimento:

1. **Filtro por usuários online** — só inclui no rodízio quem estiver online no sistema.
2. **Timeout de aceite** — se o atendente sorteado não iniciar o atendimento em X minutos (padrão 5), perde a vez e o sistema reatribui automaticamente para o próximo da fila.

---

## 1. Detecção de presença (online/offline)

Hoje já existe `account_members.last_seen_at`, mas não é atualizado em tempo real. Vamos:

- Criar hook global `usePresenceHeartbeat` montado no layout autenticado:
  - A cada 60s faz `UPDATE account_members SET last_seen_at = now()` para o membership do usuário logado.
  - Também executa um update final em `beforeunload` / `visibilitychange` (hidden).
- Definir **online** = `last_seen_at` nos últimos **2 minutos**.
- Indicador visual (bolinha verde/cinza) na lista de participantes da Roleta, com auto-refresh a cada 30s.

## 2. Mudanças no banco (`roulette_config`)

Adicionar colunas:
- `require_online boolean default false` — se ligado, ignora offline no sorteio.
- `accept_timeout_minutes int default 5` — janela para aceitar o atendimento.
- `online_threshold_seconds int default 120` — define o que é "online".

Nova tabela **`roulette_assignments`** (controle do timeout):
- `id`, `account_id`, `user_id`, `phone`, `owner_user_id`, `contact_name`
- `assigned_at timestamptz`, `expires_at timestamptz`
- `status text` — `pending` | `accepted` | `expired` | `reassigned`
- `accepted_at`, `attempts int default 1`, `skipped_user_ids uuid[]`
- RLS: membros da conta leem; service role escreve.

## 3. Função SQL `roulette_pick_next` (atualizada)

Aceita parâmetros extras:
- `_exclude_user_ids uuid[]` — para pular quem já recusou nesse handoff.
- `_only_online boolean` — quando true, filtra `last_seen_at > now() - online_threshold`.

Lógica:
1. Carrega `roulette_config` (enabled, participants, require_online, threshold).
2. Monta candidatos: participantes ativos da conta menos `_exclude_user_ids`.
3. Se `require_online` e `_only_online`, filtra por `last_seen_at` recente.
4. Se lista vazia → retorna NULL (handoff fica sem assignment, owner é notificado).
5. Round-robin baseado em `last_assigned_user_id`; atualiza `last_assigned_user_id`/`last_assigned_at`.

## 4. Integração no handoff (`whatsapp-ai-agent`)

`applyRouletteOnHandoff`:
- Chama `roulette_pick_next` com `only_online = require_online`.
- Cria registro em `roulette_assignments` com `expires_at = now() + accept_timeout_minutes`.
- Notifica o atendente via WhatsApp do sistema com texto: "Você tem **X minutos** para iniciar este atendimento, senão será passado ao próximo."
- Atualiza `whatsapp_conversations.assigned_to`, `contacts.assigned_to`, `crm_deals.assigned_to` como já faz hoje.

## 5. Detecção de "iniciou o atendimento"

Considera **aceito** quando:
- O atendente envia uma mensagem para esse `phone` (mensagem outbound criada por `user_id == assigned_to`), OU
- O atendente abre/marca a conversa como atribuída a si manualmente.

No webhook outbound / no envio manual, hook chamará uma função `accept_roulette_assignment(_phone, _user_id)` que marca o assignment ativo como `accepted`.

## 6. Cron de expiração (timeout)

Nova edge function **`roulette-expire-assignments`** (verify_jwt = false):
- Busca `roulette_assignments` com `status='pending'` e `expires_at < now()`.
- Para cada uma:
  1. Marca como `expired`.
  2. Chama `roulette_pick_next` excluindo todos os `skipped_user_ids` + o atual.
  3. Se vier novo usuário: cria novo assignment (`attempts+1`), reatribui conversa/contato/deal, notifica novo atendente e avisa o anterior que perdeu a vez.
  4. Se não houver candidato: notifica o owner da conta que o handoff está sem atendente disponível.

Agendamento via `pg_cron` a cada 1 minuto (insert tool com URL/anon key reais do projeto).

## 7. UI — `RouletteTab`

Adicionar acima da lista de participantes:
- **Switch** "Exigir usuário online" (vinculado a `require_online`).
- **Input numérico** "Tempo para aceitar (minutos)" — 1 a 60, default 5 (vinculado a `accept_timeout_minutes`).
- Texto explicativo curto sobre cada regra.

Na lista de participantes:
- Bolinha verde (online) / cinza (offline) ao lado do nome, com tooltip "Visto há X min".
- Quando `require_online` está ligado, mostrar contagem "X de Y online" no topo.

Hook `useRouletteConfig` atualizado para suportar os novos campos. Hook `useTeamMembers` já traz `last_seen_at`.

## 8. Detalhes técnicos

- `usePresenceHeartbeat` desligado para super_admin navegando `/admin` (não polui presença das contas reais).
- Realtime opcional na lista de participantes (subscribe em `account_members`) para refletir mudanças sem refresh manual; fallback é o auto-refresh de 30s.
- Reatribuições em sequência respeitam `skipped_user_ids` para evitar loop infinito no mesmo handoff.
- Mensagem WhatsApp ao atendente expirado: "⏰ Você não iniciou o atendimento de {cliente} em {X} min. A vez foi passada ao próximo."

## Arquivos previstos

- Migration: novas colunas em `roulette_config`, tabela `roulette_assignments` + RLS, função `roulette_pick_next` (replace) e `accept_roulette_assignment`.
- Insert SQL (cron): agendamento `pg_cron` para `roulette-expire-assignments`.
- Edge function nova: `supabase/functions/roulette-expire-assignments/index.ts`.
- `supabase/functions/whatsapp-ai-agent/index.ts` — cria assignment + notificação com timeout.
- `supabase/functions/send-whatsapp-message/index.ts` (ou ponto único de envio outbound do usuário) — chamar `accept_roulette_assignment` quando user_id outbound bate com assignment pendente.
- `src/hooks/usePresenceHeartbeat.ts` (novo) montado em layout autenticado.
- `src/hooks/useRouletteConfig.ts` — novos campos.
- `src/components/settings/RouletteTab.tsx` — switch online + input timeout + indicador online por membro.
