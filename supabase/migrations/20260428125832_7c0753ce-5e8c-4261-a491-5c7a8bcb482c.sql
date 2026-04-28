
-- 1) Declina follow-ups pendentes/vencidos de usuários sem WhatsApp conectado
UPDATE public.followup_tracking ft
SET status = 'declined', updated_at = now()
WHERE ft.status = 'pending'
  AND ft.next_scheduled_at <= now()
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_instances wi
    WHERE wi.user_id = ft.user_id AND wi.status = 'connected'
  );

-- 2) Declina follow-ups pendentes/vencidos onde a conversa teve handoff humano (ai_active = false)
UPDATE public.followup_tracking ft
SET status = 'declined', updated_at = now()
WHERE ft.status = 'pending'
  AND ft.next_scheduled_at <= now()
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_conversations wc
    WHERE wc.user_id = ft.user_id
      AND wc.phone = ft.phone
      AND wc.ai_active = false
  );
