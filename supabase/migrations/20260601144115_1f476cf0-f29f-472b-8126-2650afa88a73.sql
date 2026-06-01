-- Reset igreen state for test number 5547989118695
DELETE FROM public.igreen_conversation_state WHERE phone = '5547989118695';
DELETE FROM public.igreen_state_events       WHERE phone = '5547989118695';
DELETE FROM public.igreen_transport_events   WHERE phone = '5547989118695';
DELETE FROM public.igreen_tool_locks         WHERE phone = '5547989118695';
DELETE FROM public.igreen_lead_data          WHERE phone = '5547989118695';
DELETE FROM public.igreen_automation_executions WHERE phone = '5547989118695';

-- Esvazia histórico de mensagens da conversa
UPDATE public.whatsapp_conversations
SET messages = '[]'::jsonb,
    total_messages = 0,
    last_message_at = now(),
    updated_at = now()
WHERE phone = '5547989118695';

-- Move card do CRM para o primeiro estágio do pipeline atual (se existir)
UPDATE public.crm_deals d
SET stage_id = (
      SELECT s.id
      FROM public.crm_stages s
      WHERE s.pipeline_id = (
        SELECT cs.pipeline_id FROM public.crm_stages cs WHERE cs.id = d.stage_id
      )
      ORDER BY s.position ASC NULLS LAST, s.created_at ASC
      LIMIT 1
    ),
    updated_at = now()
WHERE d.contact_id IN (
  SELECT id FROM public.contacts WHERE phone = '5547989118695'
);
