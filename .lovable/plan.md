# Estabilização do Pipeline v2 — Correções Operacionais

Foco: deixar o pipeline existente funcionando em produção real. Sem nova arquitetura.

## 1. Migration: coluna `ai_processing_until`

Adicionar coluna em `whatsapp_conversations`:

```sql
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_processing_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wa_conv_ai_processing_until
  ON public.whatsapp_conversations(ai_processing_until)
  WHERE ai_processing_until IS NOT NULL;
```

Resultado: `process-pending-ai` consegue adquirir o lock e o specialist `qualifier` para de cair em failsafe por erro de coluna inexistente.

## 2. Corrigir loop crítico do failsafe

Arquivo: `supabase/functions/_igreen_v2/agents/failsafe/run.ts`

Hoje, qualquer erro/timeout aciona `runFailsafe` que seta `handoff_ativo=true` no estado — trava a conversa para sempre (fast-path bypass eterno).

Mudança: distinguir failsafe **técnico** (erro/timeout) de failsafe **explícito** (supervisor pediu handoff humano).

- `intent === "error"` ou `intent === "timeout"` → resposta neutra, **NÃO** seta `handoff_ativo`, **NÃO** seta `specialist: "failsafe"` no patch.
- `intent === "supervisor_handoff"` (ou ausente/legacy) → mantém comportamento atual (ativa handoff de fato).

Arquivo: `supabase/functions/_igreen_v2/agents/_run.ts`
- Já passa `intent: "error" | "timeout"` ao `runFailsafe` — só precisamos consumir esse sinal lá dentro.

## 3. Limpar estado travado da conversa `5594981091975`

Migração de data para o contato de teste da Thays (account `2cf994fc-4a1b-440c-be8b-c91a5c25fd32`):

- `igreen_conversation_state`: `handoff_ativo=false`, `specialist=null`
- `whatsapp_conversations`: `ai_active=true`, `ai_processing_until=null`
- Limpar locks pendentes em `igreen_transport_events` órfãos da última correlation

## 4. Investigar falha de `send-whatsapp-message`

Não é alteração às cegas — primeiro **coletar evidência**:

- Ler logs de `send-whatsapp-message` na janela da correlation `igr_1779849386206_4acbeb`.
- Ler `igreen_transport_events` daquela correlation: status, error, chunk_index, provider_message_id.
- Conferir telefone enviado ao Evolution: `5594981091975` (13 dígitos canônicos) vs variante `559481091975`.

Decidir correção depois da evidência:
- Se for normalização → alinhar `send-orchestrator.ts` com o fallback de variante que já existe em `send-whatsapp-message`.
- Se for Evolution rejeitando payload → ajustar headers/instance.
- Se for lock travado em `media-queue` → liberar lock órfão.

## 5. Investigar raiz do `qualifier` em failsafe

Consultar:
- `igreen_traces` WHERE correlation_id = `igr_1779849386206_4acbeb` ORDER BY timestamp.
- `igreen_state_events` da mesma correlation.

Esperado: confirmar que a única exception era `column ai_processing_until does not exist`. Se houver outra causa, corrigir pontualmente.

## 6. Validação end-to-end

Depois das correções aplicadas:
- Pedir à Thays para enviar nova mensagem de `5594981091975`.
- Conferir em paralelo:
  - `igreen_traces` da nova correlation → `qualifier` completa sem failsafe.
  - `igreen_transport_events` → `status=sent`, `provider_message_id` real.
  - `whatsapp_conversations.messages` → resposta da IA persistida.
  - `igreen_conversation_state` → `handoff_ativo=false` ao final.
  - WhatsApp real → mensagem recebida pela Thays.

## Detalhes técnicos

Arquivos que serão alterados:
- `supabase/migrations/<novo>.sql` — coluna + cleanup de dados
- `supabase/functions/_igreen_v2/agents/failsafe/run.ts` — branch técnico vs explícito
- (Possivelmente) `supabase/functions/_igreen_v2/transport/send-orchestrator.ts` — após diagnóstico do item 4

Ordem de execução:
1. Migration (coluna + reset do estado travado) — desbloqueia tudo
2. Patch do failsafe — impede recaída
3. Diagnóstico dos itens 4 e 5 com queries em traces/events
4. Correção pontual do transport (se necessário)
5. Teste real com a Thays
