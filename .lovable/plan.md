## Diagnóstico

Investiguei a conversa com `5547989118695` no banco (tabela `igreen_traces` + `igreen_transport_events`).

### Problema 1 — IA "parou" depois do vídeo
O que aconteceu no turno `igr_1780341061481_6c448f` (mensagem "Gostei", 19:11):

1. Supervisor decidiu certo → specialist `green` no stage `engage_check`.
2. O specialist GEROU a resposta (trace `specialist_completed` mostra `messages_count: 1`).
3. Os chunks foram preparados (`behavior_chunks_generated count: 1`).
4. Na hora de enviar, **a Evolution API devolveu HTTP 502** nas 3 tentativas do `withBackoff`. Resultado no `igreen_transport_events`:
   - `status: failed`, `error: evolution_send_502`, `sent_at: null`.
5. Como o chunk falhou definitivamente, a fala foi perdida e nada apareceu pro cliente — parece que a IA "parou".

A causa raiz é instabilidade momentânea da Evolution API, mas o sistema atual **descarta a mensagem** quando isso acontece. Não há requeue, não há aviso, e o próximo turno só dispara se o cliente mandar algo novo.

### Problema 2 — "Áudio não processado"
No mesmo histórico, o áudio às 19:06 foi transcrito (`ai_content: "[Áudio transcrito] O é mesmo?"`) e a IA reagiu pedindo o nome de novo. Ou seja: o pipeline funcionou, mas a transcrição saiu ruim e a IA ignorou. Não vi áudio mais recente sem processamento. Sugestão de ação preventiva abaixo.

---

## Plano

### 1. Retry resiliente quando Evolution falha com 5xx
Arquivos: `supabase/functions/_igreen_v2/transport/send-orchestrator.ts`, `supabase/functions/_igreen_v2/retry/backoff.ts`.

- Em `realSendText`, anexar o status HTTP ao erro (`evolution_send_502` já existe, mas explicitar `status: 502`).
- Em `backoff.ts`, classificar 5xx como `transient` (já é, por exclusão), **aumentar `attempts` para 5** e `maxMs` para 15s especificamente quando a chamada vier do transporte (passar `opts.attempts=5, baseMs=800, maxMs=15000` na chamada de `realSendText`).
- Em `sendOrchestrated`, se o chunk final falhar mesmo após retry, **persistir um pedido de re-tentativa** em `whatsapp_pending_responses` com `scheduled_at = now() + 20s`, reusando o pipeline já existente (`process-pending-ai` re-chama o agent). Marcar nos `extras.last_send_failed_at` pra evitar loop infinito (máx 2 reenfileiramentos consecutivos).

### 2. Aviso/observabilidade
- Adicionar um trace `transport.send_failed_final` em `igreen_traces` quando todos os retries falharem (pra detectar surtos no painel admin de saúde).
- Marcar `whatsapp_instances.status` ou `igreen_provider_health` (já existe) com `last_error_at` quando Evolution responder 5xx 3x seguidas.

### 3. Áudio — endurecer interpretação de transcrição ruim
Arquivo: `supabase/functions/_igreen_v2/agents/green/run.ts` (lógica de extração de nome no estágio `ask_name`).

- Se `ai_content` veio de áudio e o texto extraído tem menos de 3 palavras úteis OU não bate com padrão de nome próprio (regex `^[A-ZÁÊÔÃÕa-záêôãõ]{2,}( [A-ZÁÊÔÃÕa-záêôãõ]{2,}){0,3}$`), **não aceitar como nome** e responder algo como "Não consegui entender o áudio direitinho, pode me escrever seu nome aqui em texto?".

### 4. Reset do número de teste
Após implementar, aplicar migration de reset (já fizemos antes) pra `5547989118695` testar o fluxo limpo.

---

## Detalhes técnicos (para o desenvolvedor)

- **Não criar nova tabela**: o `whatsapp_pending_responses` já suporta o requeue (campos `phone`, `account_id`, `scheduled_at`, `processed`).
- O `process-pending-ai` já chama `whatsapp-igreen-agent-v2` quando `processed=false`. Basta inserir uma row com `scheduled_at` futuro pra forçar nova execução.
- Para evitar loop infinito: armazenar `extras.send_retry_count` no `igreen_conversation_state` e parar de re-enfileirar após 2 tentativas. Após isso, registrar um trace `transport.permanently_failed` e enviar tag `falha_envio` no contato.
- Não mexer no fluxo de validação de fatura (já corrigido na rodada anterior).

## Validação

- Testar com Evolution simulando 502 (mockar `EVOLUTION_API_URL` pra um endpoint que retorna 502): confirmar que o agent re-tentativa após 20s e entrega na segunda passada.
- Testar com Evolution OK: confirmar que NÃO há row extra criada em `whatsapp_pending_responses` (só requeue em caso de falha).
- Mandar áudio ruim no estágio `ask_name`: confirmar pedido de texto em vez de aceitar "O é mesmo?" como nome.
