## Causa raiz

A função `delete-contact-cascade` apaga a `whatsapp_conversations` e algumas tabelas Igreen antigas, mas **não limpa o estado persistente do pipeline v2**. O contato `5594981091975` tem hoje em `igreen_conversation_state`:

- `handoff_ativo = true`
- `specialist = "failsafe"`

Quando o contato volta a mandar mensagem após ser excluído, o v2 (`whatsapp-igreen-agent-v2`) lê esse state e responde com `fast_path: { bypass: true, action: "noop", reason: "handoff_active" }` — ou seja, a IA fica "desativada" mesmo depois da exclusão. Os logs confirmam exatamente isso na última execução.

Além do `igreen_conversation_state`, o cascade também ignora outras tabelas v2 escopadas por `(account_id, phone)` que carregam memória/locks/métricas do contato (`igreen_memory_window`, `igreen_memory_summaries`, `igreen_state_events`, `igreen_state_snapshots`, `igreen_traces`, `igreen_transport_events`, `igreen_tool_locks`, `igreen_timeouts`, `igreen_token_usage`, `igreen_model_routing`, `igreen_conversation_priority`, `igreen_automation_executions`, `igreen_document_validations`, `igreen_cancellations`).

## Correção (1 arquivo)

**`supabase/functions/delete-contact-cascade/index.ts`**

Adicionar à constante `PHONE_TABLES` todas as tabelas Igreen v2 escopadas por `(account_id, phone)`, para que o "Excluir contato" realmente zere o estado do pipeline novo:

```ts
{ table: "igreen_conversation_state", phoneCol: "phone" },
{ table: "igreen_conversation_priority", phoneCol: "phone" },
{ table: "igreen_state_events", phoneCol: "phone" },
{ table: "igreen_state_snapshots", phoneCol: "phone" },
{ table: "igreen_traces", phoneCol: "phone" },
{ table: "igreen_transport_events", phoneCol: "phone" },
{ table: "igreen_memory_window", phoneCol: "phone" },
{ table: "igreen_memory_summaries", phoneCol: "phone" },
{ table: "igreen_tool_locks", phoneCol: "phone" },
{ table: "igreen_timeouts", phoneCol: "phone" },
{ table: "igreen_token_usage", phoneCol: "phone" },
{ table: "igreen_model_routing", phoneCol: "phone" },
{ table: "igreen_automation_executions", phoneCol: "phone" },
{ table: "igreen_document_validations", phoneCol: "phone" },
{ table: "igreen_cancellations", phoneCol: "phone" },
```

Nada mais muda. RLS, frontend, contas não-iGreen e o webhook continuam iguais. O insert de nova `whatsapp_conversations` já cria com `ai_active=true` quando não há keyword filter, então sem o `handoff_ativo` órfão o v2 volta a processar normalmente.

## Limpeza pontual do contato da Thays

Como o registro com `handoff_ativo=true` já está no banco (criado no último teste), também precisamos apagar de uma vez as linhas órfãs do `5594981091975` em `account_id = 2cf994fc-4a1b-440c-be8b-c91a5c25fd32`, para que o próximo teste já funcione mesmo sem reexcluir o contato pela UI. Isso vai numa migration de DELETE direcionada (sem alterar schema).

## Validação

1. Excluir o contato `5594981091975` pela UI da Thays.
2. Confirmar via SQL que `igreen_conversation_state`, `igreen_memory_window`, `igreen_state_events`, `igreen_traces` ficaram **sem linhas** para esse phone+account.
3. Pedir nova mensagem do contato.
4. Conferir nos logs do `process-pending-ai` o `[router] … → whatsapp-igreen-agent-v2` e nos logs do v2 que a resposta **não** entra mais em `fast_path bypass handoff_active` — deve seguir o pipeline normal (supervisor → especialista → envio).
