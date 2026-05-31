-- Reset estado de teste para 5547989118695 e mover card atual.

-- 1) Estado da conversa Green
DELETE FROM public.igreen_conversation_state WHERE phone = '5547989118695';

-- 2) Eventos de transporte/idempotência desse phone (sem perder histórico de conversa)
DELETE FROM public.igreen_transport_events WHERE phone = '5547989118695';
DELETE FROM public.igreen_automation_executions WHERE phone = '5547989118695';
DELETE FROM public.igreen_state_events WHERE phone = '5547989118695';
DELETE FROM public.igreen_traces WHERE phone = '5547989118695' AND created_at >= now() - interval '7 days';

-- 3) Dados temporários do lead
DELETE FROM public.igreen_lead_data WHERE phone = '5547989118695';
DELETE FROM public.igreen_document_validations WHERE phone = '5547989118695';

-- 4) Limpa histórico de mensagens do contato de teste (mantém o registro da conversa,
-- mas zera mensagens para um teste limpo do fluxo).
UPDATE public.whatsapp_conversations
   SET messages = '[]'::jsonb,
       total_messages = 0,
       last_message_at = now(),
       updated_at = now()
 WHERE phone = '5547989118695';

-- 5) Move o card existente desse contato para "Iniciou atendimento" no pipeline Vendas
DO $$
DECLARE
  v_account uuid := '2cf994fc-4a1b-440c-be8b-c91a5c25fd32';
  v_target_stage uuid;
  v_contact uuid;
BEGIN
  SELECT s.id INTO v_target_stage
    FROM public.crm_stages s
    JOIN public.crm_pipelines p ON p.id = s.pipeline_id
   WHERE s.account_id = v_account
     AND p.name ILIKE 'Vendas'
     AND lower(s.name) = 'iniciou atendimento'
   LIMIT 1;

  SELECT id INTO v_contact FROM public.contacts
   WHERE account_id = v_account AND phone = '5547989118695' LIMIT 1;

  IF v_target_stage IS NOT NULL AND v_contact IS NOT NULL THEN
    UPDATE public.crm_deals
       SET stage_id = v_target_stage,
           updated_at = now()
     WHERE account_id = v_account
       AND contact_id = v_contact
       AND won_at IS NULL
       AND lost_at IS NULL;
  END IF;
END $$;