-- (a) Default do sentinela de posição passa a ser -1
ALTER TABLE public.igreen_scenario_enrollments
  ALTER COLUMN current_item_position SET DEFAULT -1;

-- (b) Reset suave: posiciona current_item_position no MAIOR position
-- já enviado nas últimas 48h dentro do (day, period) corrente.
-- Se nada foi enviado, fica -1 (começa do início do bundle).
UPDATE public.igreen_scenario_enrollments e
SET current_item_position = COALESCE((
  SELECT MAX(i.position)
  FROM public.igreen_scenario_events ev
  JOIN public.igreen_scenario_items i
    ON i.message_id = ev.message_id
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

-- Para (status=stopped) todos os cenários iGreen ativos do Marcio
UPDATE public.igreen_scenario_enrollments
SET status = 'stopped',
    stop_reason = 'manual_cleanup_loop_2026_06_24',
    next_run_at = NULL,
    updated_at = now()
WHERE account_id IN (
  SELECT id FROM public.accounts WHERE owner_user_id = 'fbc9254d-6577-468d-adba-5d639ed0e759'
)
AND status IN ('active','pending_tag');