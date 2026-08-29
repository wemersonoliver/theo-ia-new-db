# Diagnóstico: por que o Supabase está saturado com só 2 usuários

O problema não é volume de usuários — é volume de **automação**. O projeto tem 26 tarefas agendadas (cron), várias rodando a cada 30 segundos ou 1 minuto, e cada execução dispara uma Edge Function que varre tabelas inteiras sem índice. Além disso, os logs internos dessas tarefas nunca são limpos e já ocupam 3,5 GB de disco.

## O que foi confirmado no banco

1. **Logs de cron ocupando 2.677 MB** (`cron.job_run_details`) — nunca foram limpos desde a criação do projeto, e nunca passaram por autovacuum.
2. **Logs de chamadas HTTP ocupando 881 MB** (`net._http_response`) — mesma causa.
   - Juntos: ~3,5 GB de disco puro de lixo, o que sozinho já dispara o alerta de "esgotando recursos".
3. **26 jobs agendados ativos**, dos quais 6 rodam a cada 1 minuto ou menos:
   - `attendance-flow-tick` (a cada 30s), `send-welcome-sequence`, `send-task-reminders`, `roulette-expire-assignments`, `custom-followup-dispatcher`, `igreen-scenario-dispatcher`, `process-igreen-video-followups`.
   - Isso gera ~5.000 invocações de Edge Function por hora, quase todas sem nada para fazer.
4. **Consultas mais caras (tempo total acumulado):**
   - `whatsapp_conversations` filtrando por `user_id + last_message_at`, trazendo a coluna `messages` (JSONB gigante) — 145.101 chamadas, 3h49min de CPU acumulada. Não existe índice para esse filtro.
   - `igreen_scenario_events` com filtro de 6 colunas — 40.405 chamadas, 1h05min. Só existe índice em `enrollment_id`.
   - `whatsapp_ai_config` filtrando por `reminder_enabled` — 41.719 chamadas, 46min. Sem índice.
   - `contacts` filtrando por `tags &&` (array) — 130.900 chamadas, 44min. Sem índice GIN.
   - `whatsapp_conversations` por `ai_active` — sem índice.
5. **`ai_usage_log` com 97.624 linhas** e sem política de retenção.

## Plano de correção

### Etapa 1 — Liberar disco (efeito imediato)
- Truncar `cron.job_run_details` e `net._http_response`.
- Criar job diário de retenção: manter apenas 3 dias de `job_run_details` e 1 dia de `_http_response`.
- Criar job de retenção para `ai_usage_log` (manter 90 dias, dados agregados de custo permanecem nos painéis).

### Etapa 2 — Índices nas consultas quentes
- `whatsapp_conversations (user_id, last_message_at DESC)`
- `whatsapp_conversations (ai_active) WHERE ai_active = true`
- `whatsapp_conversations (account_id, last_message_at DESC)`
- `igreen_scenario_events (enrollment_id, day_number, period, message_id, status)`
- `whatsapp_ai_config (reminder_enabled) WHERE reminder_enabled = true`
- `contacts USING GIN (tags)`

### Etapa 3 — Reduzir frequência dos cron jobs
Ajustar para frequências compatíveis com o uso real:
- `attendance-flow-tick`: 30s → 2 min
- `send-welcome-sequence`, `send-task-reminders`, `roulette-expire-assignments`, `custom-followup-dispatcher`, `igreen-scenario-dispatcher`, `process-igreen-video-followups`: 1 min → 5 min
- Jobs `igreen_*` e `system-followup-*`: manter, mas desativar os que pertencem a funcionalidades sem nenhuma conta ativa usando (a confirmar com você — ver pergunta abaixo).

Nenhuma dessas mudanças altera comportamento visível: lembretes, follow-ups e disparos continuam funcionando, apenas com granularidade de minutos em vez de segundos.

### Etapa 4 — Parar de trazer a coluna `messages` inteira
A função que roda 145 mil vezes lê o histórico completo de cada conversa (JSONB pesado) só para decidir se deve disparar follow-up. Ajustar para ler apenas os campos necessários (`phone`, `last_message_at`, `ai_active`) e buscar o histórico só da conversa que realmente será processada.

## Detalhes técnicos
- Migração SQL com `TRUNCATE`, `CREATE INDEX`, e `cron.alter_job` / `cron.schedule` para retenção.
- Ajuste em `supabase/functions/followup-check-inactive/index.ts` (e equivalentes) para remover `messages` do `select` inicial.
- Após aplicar, rodar `EXPLAIN ANALYZE` nas duas consultas mais caras para confirmar uso dos novos índices.
