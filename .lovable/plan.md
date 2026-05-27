## Diagnóstico confirmado

- Conta da Thays com `is_igreen=true`: `2cf994fc-…` (instância `biz1027_principal` conectada).
- Conversa do teste `5594981091975` chegou na conta correta (34 mensagens nas últimas 2h).
- Mas **zero** linhas em `igreen_state_events`, `igreen_traces`, `igreen_operational_metrics`, `igreen_conversation_state` — pipeline v2 nunca executou.
- Causa: `whatsapp-webhook` e `process-pending-ai` chamam **sempre** `whatsapp-ai-agent` (antigo), sem checar `accounts.is_igreen`. A função `whatsapp-igreen-agent-v2` existe e está deployada, mas nada do tráfego real entra nela.

## Correção (2 arquivos, mínima, sem regressão)

### 1) `supabase/functions/process-pending-ai/index.ts`
Antes do `fetch` que dispara o agente:
- Resolver `accountId` a partir de `pending.account_id` (ou da própria `whatsapp_conversations`).
- Consultar `accounts.is_igreen`.
- Se `true` → `targetFn = "whatsapp-igreen-agent-v2"`.
- Senão → `targetFn = "whatsapp-ai-agent"` (mantém o comportamento atual).
- Passar `accountId` no body para o v2.
- Log `[router] account=… → <fn>` para evidência.

### 2) `supabase/functions/whatsapp-webhook/index.ts`
No fallback "no delay configured, call AI immediately" (linha ~1096):
- Mesmo check em `accounts.is_igreen` (o `accountId` já está em escopo na função `triggerAIResponse`).
- Roteia para `whatsapp-igreen-agent-v2` quando aplicável.

Nenhuma outra função, schema, RLS, frontend ou comportamento de contas não-iGreen muda.

## Validação ao vivo após o deploy

1. Pedir nova mensagem da Thays (ou re-disparar manualmente).
2. Conferir nas tabelas (filtrando `account_id = 2cf994fc-…` e janela de minutos):
   - `igreen_traces` — passos do pipeline.
   - `igreen_state_events` — eventos do state-engine.
   - `igreen_operational_metrics` — custo/latência por turno.
   - `igreen_conversation_state` — snapshot atualizado da conversa `5594981091975`.
3. Conferir nos logs do `process-pending-ai` a linha `[router] account=2cf994fc-… → whatsapp-igreen-agent-v2`.
4. Conferir nos logs do `whatsapp-ai-agent` **ausência** de invocações para essa account na janela.

## Entregáveis ao final

- Linhas SQL reais (counts + amostras) das 4 tabelas `igreen_*` acima.
- Trecho dos logs mostrando o roteamento.
- Confirmação textual de que o agente antigo não foi mais usado para a Thays.
