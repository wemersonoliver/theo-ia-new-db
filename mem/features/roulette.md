---
name: Roleta de Atendimento
description: Round-robin de handoff entre membros da account via roulette_config + RPC roulette_pick_next
type: feature
---
Roleta distribui handoffs (transferência IA→humano) entre membros ativos da account.
- Tabela: `roulette_config` (uma por account_id, UNIQUE).
- RPC `roulette_pick_next(_account_id)` SECURITY DEFINER retorna próximo user_id ordenando por `account_members.invited_at` e usando `last_assigned_user_id` como cursor.
- Aplicada em `whatsapp-ai-agent/index.ts` na função `applyRouletteOnHandoff`, chamada após `notifyHandoff` no bloco de message limit reached.
- Só ativa se `account_members` ativos >= 2 e `roulette_config.enabled = true`.
- Atualiza `whatsapp_conversations.assigned_to`, `contacts.assigned_to` e `crm_deals.assigned_to` (deal ativo).
- Notifica o atendente sorteado pelo WhatsApp do sistema (system_whatsapp_instance).
- UI: aba "Roleta" em /settings (`src/components/settings/RouletteTab.tsx`), oculta efetivamente quando single-user.
- Apenas owner edita; membros só leem (RLS).
