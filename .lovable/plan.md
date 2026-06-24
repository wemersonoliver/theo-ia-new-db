
## Plano aprovado — aplicar correções

### Etapa 1 — Bug do dispatcher iGreen (causa raiz do flood)

Editar `supabase/functions/igreen-scenario-dispatcher/index.ts`:

1. **Linhas 232-239** — trocar a detecção de "primeiro item do bundle" para usar sentinela `-1`:
   ```ts
   const lastPos = enrollment.current_item_position;
   const bundleStarted = typeof lastPos === "number" && lastPos >= 0;
   const nextItem = bundleStarted
     ? (items.find((it) => it.position > lastPos) ?? null)
     : items[0];
   ```
   (com a lógica antiga, `> 0` fazia a posição 0 nunca ser reconhecida como "já enviada", reenviando infinitamente o item 0 a cada tick do cron.)

2. **`advanceToNext`** — trocar todos os `current_item_position: 0` por `current_item_position: -1` (linhas 487, 518, 527, 540), para que ao iniciar o próximo bundle o sentinela esteja correto.

3. **Anti-flood (cinto-e-suspensórios)** — antes do envio, checar se já existe `igreen_scenario_events` `sent` com `(enrollment_id, day_number, period, message_id)` nos últimos 90 segundos. Se sim, pula e empurra `next_run_at` em +5min.

### Etapa 2 — Salvaguarda no `process-pending-ai`

Editar `supabase/functions/process-pending-ai/index.ts`:

- Logo após buscar `pending`, descartar (marcar `processed=true` e retornar) qualquer item cujo `scheduled_at` esteja há mais de **30 minutos** no passado. Evita que filas acumuladas durante semanas de desconexão disparem todas juntas no reconnect.

### Etapa 3 — Salvaguarda no `whatsapp-webhook`

Editar `supabase/functions/whatsapp-webhook/index.ts`:

- No handler de `connection.update` com `state === "close"`, além da lógica atual, executar:
  ```sql
  DELETE FROM whatsapp_pending_responses WHERE user_id = <userId>;
  ```
  Não adianta segurar respostas IA enquanto o WA está desconectado — quando reconectar elas viram flood.

### Etapa 4 — Migration de limpeza (escopo Marcio + reset global suave)

Uma migration única:

```sql
-- (a) Default do current_item_position passa a ser -1 (novo sentinela)
ALTER TABLE public.igreen_scenario_enrollments
  ALTER COLUMN current_item_position SET DEFAULT -1;

-- (b) Reset suave de enrollments ativos: para cada um, posiciona current_item_position
-- no MAIOR position já enviado nas últimas 48h dentro do (day,period) corrente.
-- Se nada foi enviado, fica -1 (começa do início do bundle).
UPDATE public.igreen_scenario_enrollments e
SET current_item_position = COALESCE((
  SELECT MAX(i.position)
  FROM public.igreen_scenario_events ev
  JOIN public.igreen_scenario_items i ON i.message_id = ev.message_id
  WHERE ev.enrollment_id = e.id
    AND ev.day_number = e.current_day
    AND ev.period = e.current_period
    AND ev.status = 'sent'
    AND ev.sent_at > now() - interval '2 days'
), -1),
updated_at = now()
WHERE e.status IN ('active','pending_tag');

-- (c) Estanca o flood do Marcio
DELETE FROM public.whatsapp_pending_responses
WHERE user_id = 'fbc9254d-6577-468d-adba-5d639ed0e759';

DELETE FROM public.whatsapp_ai_sessions
WHERE user_id = 'fbc9254d-6577-468d-adba-5d639ed0e759';

-- Cancela os 8 cenários iGreen ativos dele (conforme solicitado)
UPDATE public.igreen_scenario_enrollments
SET status = 'cancelled',
    stop_reason = 'manual_cleanup_loop_2026_06_24',
    next_run_at = NULL,
    updated_at = now()
WHERE account_id IN (SELECT id FROM public.accounts WHERE owner_user_id = 'fbc9254d-6577-468d-adba-5d639ed0e759')
  AND status IN ('active','pending_tag');
```

### Etapa 5 — Validação

- `SELECT enrollment_id, message_id, count(*) FROM igreen_scenario_events WHERE sent_at > now()-interval '30 minutes' AND status='sent' GROUP BY 1,2 HAVING count(*) > 1` → deve ficar vazio nos próximos minutos.
- `SELECT count(*) FROM whatsapp_pending_responses WHERE user_id='fbc9254d-...'` → 0.
- Confirmar com o Marcio que o flood parou.

### Detalhe técnico
- 3 arquivos editados: `igreen-scenario-dispatcher/index.ts`, `process-pending-ai/index.ts`, `whatsapp-webhook/index.ts`.
- 1 migration (Etapa 4) com 4 statements.
- Sem mudança de UI.
