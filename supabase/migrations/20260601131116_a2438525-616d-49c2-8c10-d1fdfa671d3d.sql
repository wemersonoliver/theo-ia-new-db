
DELETE FROM public.igreen_conversation_state WHERE phone = '5547989118695';
DELETE FROM public.igreen_state_events       WHERE phone = '5547989118695';
DELETE FROM public.igreen_transport_events   WHERE phone = '5547989118695';
DELETE FROM public.igreen_tool_locks         WHERE phone = '5547989118695';
DELETE FROM public.igreen_lead_data          WHERE phone = '5547989118695';
DELETE FROM public.igreen_automation_executions WHERE phone = '5547989118695';

UPDATE public.whatsapp_conversations
   SET messages = '[]'::jsonb,
       total_messages = 0,
       last_message_at = now(),
       updated_at = now()
 WHERE phone = '5547989118695';

UPDATE public.crm_deals d
   SET stage_id = (
         SELECT s.id FROM public.crm_stages s
          WHERE s.pipeline_id = (SELECT pipeline_id FROM public.crm_stages WHERE id = d.stage_id)
          ORDER BY s.position ASC NULLS LAST
          LIMIT 1
       ),
       updated_at = now()
 WHERE d.contact_id IN (SELECT id FROM public.contacts WHERE phone = '5547989118695');
