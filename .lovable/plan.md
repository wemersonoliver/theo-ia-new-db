# Plano — Corrigir envio do vídeo no roteamento do qualifier

## Causa raiz confirmada (logs `5547989118695`)
No `qualifier/run.ts` → `case "route_green"`, o patch grava `video_sent: true` e `video_sent_at` no `extras` **antes** da tool `send_discovery_video` rodar. Como o `ctx.state` é mutado em memória, a tool encontra `extras.video_sent === true` e retorna imediatamente `skipped: true` (`skip_reason: "state_unchanged"`). O vídeo nunca é enviado pela Evolution.

## Ajustes

### 1. `supabase/functions/_igreen_v2/agents/qualifier/run.ts`
No `case "route_green"`, remover do `patch.extras`:
- `video_sent: true`
- `video_sent_at: new Date().toISOString()`

Manter:
- `greeted`, `product_choice: "green"`, `explained: true`, `solution_confirmed: true` (esses só suprimem a re-explicação do green specialist, não afetam o envio do vídeo).
- A chamada `tool_calls.push({ name: "send_discovery_video", args: { produto: "green" } })`.

A própria tool, ao enviar com sucesso, grava `video_sent: true` + `video_sent_at` + `video_sent_provider_id` no `extras`. No próximo turno, `green/stages.decideGreenStage` verá `video_sent=true` e seguirá para `engage_check`.

### 2. Anti-duplicação preservada
A tool já tem dois locks:
- `idempotencyKey: video:${produto}:${phone}` (impede reentrância concorrente).
- Consulta `igreen_transport_events` dos últimos 10 min (impede reenvio se já mandou).

Sem a flag prematura, ambos continuam funcionando e o duplicado segue prevenido.

### 3. Garantir ordem texto → vídeo
Já implementado em `whatsapp-igreen-agent-v2/index.ts` (texto enviado antes da tool de vídeo). Vou conferir após o ajuste para garantir que não foi revertido.

### 4. Reset + simulação end-to-end
Migração para limpar estado do número de teste e validar o fluxo completo:

```text
DELETE FROM igreen_conversation_state WHERE phone = '5547989118695';
DELETE FROM igreen_state_events       WHERE phone = '5547989118695';
DELETE FROM igreen_transport_events   WHERE phone = '5547989118695';
DELETE FROM igreen_tool_locks         WHERE phone = '5547989118695';
DELETE FROM igreen_lead_data          WHERE phone = '5547989118695';
UPDATE whatsapp_conversations SET messages = '[]'::jsonb, total_messages = 0
 WHERE phone = '5547989118695';
-- card volta para "Novo Lead" para validar a movimentação automática
UPDATE admin_crm_deals
   SET stage_id = (SELECT id FROM admin_crm_stages
                   WHERE position = (SELECT MIN(position) FROM admin_crm_stages))
 WHERE contact_phone = '5547989118695';
```

### 5. Validação via simulação automatizada
Após deploy, executar `curl_edge_functions` em `whatsapp-igreen-agent-v2` simulando a sequência:
1. "Oi" → espera saudação + pedido de nome.
2. "Wemerson" → espera menu 1/2/3.
3. "1" → espera **2 mensagens de texto + vídeo entregue** (checar `igreen_transport_events.kind='video', status='sent'`).
4. "Ok" → espera `engage_check` + tag `em atendimento` + card movido para "Iniciou atendimento" + pergunta de consumo.
5. "Pago uns 350 reais" + "SP" + "Enel" → espera `simulate_discount_concreto` (texto único com %, valor, cashback) e pedido de fatura.

Critério de sucesso por turno: consultar `igreen_state_events` e `igreen_transport_events` para confirmar eventos esperados e ausência de `skipped:true` indevido em `send_discovery_video`.

### 6. Re-deploy
- `whatsapp-igreen-agent-v2` (mesma function compila `_igreen_v2/*`).

## Arquivos
- `supabase/functions/_igreen_v2/agents/qualifier/run.ts` (edição cirúrgica no case `route_green`).
- Nova migração de reset do número de teste.

## Pós-execução
Reportar resultado de cada turno simulado (eventos + transport events) e confirmar que o vídeo chegou e o card moveu.
