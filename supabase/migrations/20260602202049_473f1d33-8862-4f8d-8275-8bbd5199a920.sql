DELETE FROM public.igreen_traces WHERE phone = '5547989118695';
DELETE FROM public.igreen_transport_events WHERE phone = '5547989118695';
DELETE FROM public.igreen_document_validations WHERE phone = '5547989118695';
DELETE FROM public.igreen_tool_locks WHERE phone = '5547989118695';
DELETE FROM public.igreen_state_events WHERE phone = '5547989118695';
DELETE FROM public.igreen_lead_data WHERE phone = '5547989118695';
DELETE FROM public.igreen_automation_executions WHERE phone = '5547989118695';
DELETE FROM public.igreen_conversation_state WHERE phone = '5547989118695';
DELETE FROM public.whatsapp_pending_responses WHERE phone = '5547989118695';
UPDATE public.whatsapp_conversations
   SET messages = '[]'::jsonb,
       ai_active = true,
       outcome = NULL, outcome_reason = NULL, outcome_value_cents = NULL,
       closed_at = NULL, closed_by = NULL,
       updated_at = now()
 WHERE phone = '5547989118695';