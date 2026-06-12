## Diagnóstico — conta `marcioevandrocosta@hotmail.com`

A conta (`3f304fb6-fd4e-46d0-9831-b23fabd37b7a`, `is_igreen=true`) tem o cenário **CENARIO1** ativo, instância WhatsApp `biz1025_principal` conectada, e **19 inscrições no cenário** (`igreen_scenario_enrollments`), das quais **17 já estão vencidas** (`next_run_at < now()`, `status=active`). Mesmo assim, **nenhum evento foi disparado**: `igreen_scenario_events = 0` para essa conta e `last_sent_at = NULL` em todas as 19 inscrições.

### Causa raiz

O cron `igreen-scenario-dispatcher-1m` roda a cada minuto e o pg_cron reporta `succeeded` — mas, olhando os logs HTTP da Edge Function:

```
POST /functions/v1/igreen-scenario-dispatcher  → 401 (todas as últimas execuções)
```

A função usa `requireInternalKey(req)` e compara o header `x-internal-key` com o secret `INTERNAL_CRON_SECRET`. O job do pg_cron envia o valor `229a8e11606878372cac9f41fa0016dab8d851a1b947570c91723083beeb73c6`, mas esse valor **não coincide** com o `INTERNAL_CRON_SECRET` configurado nas Edge Functions. Resultado: a requisição é rejeitada antes de qualquer processamento, nada é enviado, nada é logado.

### Escopo do problema (não é só Igreen)

Os mesmos 401 atingem outras tarefas críticas que dependem do mesmo secret:

- `igreen-scenario-dispatcher` — cenários Igreen
- `attendance-flow-dispatch` — fluxos de atendimento
- `send-welcome-sequence` — boas-vindas
- `custom-followup-dispatcher` / `custom-followup-trigger` — follow-ups personalizados
- `roulette-expire-assignments` — roleta de leads
- `followup-dispatch` / `followup-generate-sequence` — follow-up IA
- `system-followup-dispatch` / `system-followup-generate-sequence` — follow-up de sistema

Tudo isso está parado pelo mesmo motivo.

## Plano de correção

### 1. Sincronizar o secret `INTERNAL_CRON_SECRET`
Atualizar o secret das Edge Functions para o valor que os jobs do pg_cron já estão enviando:

```
INTERNAL_CRON_SECRET = 229a8e11606878372cac9f41fa0016dab8d851a1b947570c91723083beeb73c6
```

Esse é o caminho mais seguro: não mexe em pg_cron (que tem várias linhas duplicando o secret hardcoded), apenas alinha o servidor.

### 2. Reativar o disparo imediato dos vencidos
Após o secret sincronizar, o cron de 1 minuto já vai pegar os 17 atrasados da conta do Marcio (e os atrasados de outras contas) automaticamente. Não é necessário "rebobinar" — o dispatcher tem `lte("next_run_at", now)`.

### 3. Validação
- Consultar os logs HTTP de `igreen-scenario-dispatcher` em 1–2 minutos → esperar `200`.
- Verificar `igreen_scenario_events` da conta `3f304fb6-...` → devem aparecer linhas com `status=sent`.
- Verificar `last_sent_at` em `igreen_scenario_enrollments` da conta → não deve mais ser `NULL`.
- Conferir que os outros crons afetados (welcome, roulette, attendance-flow, custom-followup) também voltam a 200.

### 4. (Opcional, fora deste escopo) Reduzir risco futuro
Recomendo num próximo passo: parar de hardcodar o secret nos comandos do pg_cron e usar `current_setting('app.internal_cron_secret', true)` ou um cofre `vault.secrets`, para que rotações de secret não exijam mexer em N jobs. Não faz parte deste plano para manter a mudança mínima e segura.

## Detalhes técnicos

- Sem migração de banco.
- Sem alteração de código.
- Apenas atualização do secret `INTERNAL_CRON_SECRET` nas Edge Functions via ferramenta de secrets.
- Arquivos envolvidos no diagnóstico (não precisam ser editados): `supabase/functions/_cron_auth.ts`, `supabase/functions/igreen-scenario-dispatcher/index.ts`.
