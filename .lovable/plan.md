# Estabilização do pipeline outbound (Fase 6)

Sem novas features. Apenas dois bugs operacionais confirmados na auditoria.

## 1. Persistência outbound no painel

**Arquivo:** `supabase/functions/_igreen_v2/transport/send-orchestrator.ts`

Após cada chunk com `status === "sent"`, fazer append em `whatsapp_conversations.messages` usando service role (cliente `svc()` já existente). Uma nova função interna `persistOutboundChunk()` será chamada logo após o `recordEvent(... status: "sent" ...)`.

Objeto inserido em `messages` (compatível com formato usado por `whatsapp-webhook` e `send-whatsapp-message`):

```json
{
  "id": "<uuid>",
  "timestamp": "<ISO now>",
  "from_me": true,
  "content": "<chunk.text>",
  "type": "text",
  "sent_by": "ai",
  "provider_message_id": "<id>",
  "correlation_id": "<correlation_id>",
  "chunk_index": <n>
}
```

Update na linha da conversa (lookup por `account_id + phone`):
- `messages = messages || jsonb_build_array(...)` (append)
- `last_message_at = now()`
- `total_messages = total_messages + 1`
- `updated_at = now()`
- **não mexer em** `ai_active` (continua true)

Se a linha não existir (caso de borda), criar com `account_id`, `phone`, `ai_active=true`. Falha de persistência não pode derrubar o envio: try/catch com `console.error` + métrica `outbound.persist_failed`.

Dry-run e modo sem Evolution **não** persistem (não houve envio real).

## 2. Truncamento do specialist green

**Arquivo:** `supabase/functions/_igreen_v2/agents/green/run.ts`

Mudanças no `generateText()`:
- Respeitar `ctx.selected_model` (vindo do model-router); fallback `gemini-2.5-flash-lite`.
- `maxOutputTokens: 600`.
- Adicionar `thinkingConfig: { thinkingBudget: 0 }` no `generationConfig` (evita consumo de orçamento por tokens de raciocínio em modelos 2.5).
- Manter timeout 8s e fallbacks atuais.

O tipo `AgentContext` já carrega o modelo selecionado pelo router; usar essa propriedade (verificar o nome exato no `_types.ts` antes de salvar — `selected_model` ou `model`).

## 3. Validação end-to-end

Após deploy de `whatsapp-igreen-agent-v2` (e dependências `_igreen_v2`):
1. Pedir teste novo na conta `Thays.chavess@gmail.com` / `5547989118695`.
2. Verificar evidências:
   - `igreen_transport_events` → `status=sent`, `provider_message_id` preenchido por chunk
   - `igreen_traces` → `behavior_chunks_generated` coerente, `agent.completed` sem erro
   - `whatsapp_conversations.messages` → contém objeto novo com `from_me:true`, `sent_by:"ai"`
   - `igreen_conversation_state` → `handoff_ativo=false`, `specialist=green`
   - WhatsApp recebe mensagem completa (sem corte mid-frase)
3. Entregar: SQL de validação, trecho dos novos traces e correlation_id do teste.

## Fora de escopo

- Nada de Fase 7
- Sem mudança na arquitetura de transport/state/router
- Sem alteração no painel frontend (já lê `whatsapp_conversations.messages` + realtime)
- Sem alteração no failsafe (já corrigido na rodada anterior)
