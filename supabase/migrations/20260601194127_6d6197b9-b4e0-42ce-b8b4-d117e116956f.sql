
DELETE FROM igreen_state_events WHERE phone='5547989118695';
DELETE FROM igreen_transport_events WHERE phone='5547989118695';
DELETE FROM igreen_tool_locks WHERE phone='5547989118695';
DELETE FROM igreen_lead_data WHERE phone='5547989118695';
DELETE FROM igreen_automation_executions WHERE phone='5547989118695';
DELETE FROM igreen_document_validations WHERE phone='5547989118695';
DELETE FROM igreen_traces WHERE phone='5547989118695';
DELETE FROM igreen_conversation_state WHERE phone='5547989118695';
DELETE FROM whatsapp_pending_responses WHERE phone='5547989118695';
UPDATE whatsapp_conversations
  SET messages='[]'::jsonb, total_messages=0, last_message_at=now(), updated_at=now()
  WHERE phone='5547989118695';

-- Move CRM card de volta para a primeira etapa do funil do usuário dono
UPDATE crm_deals d
  SET stage_id = (
    SELECT s.id FROM crm_stages s
    WHERE s.user_id = d.user_id
    ORDER BY s.position ASC LIMIT 1
  ),
  updated_at = now()
  WHERE d.user_id='734f3e5b-aeab-477e-b582-654359bee34b'
    AND d.contact_id IN (
      SELECT id FROM contacts
      WHERE phone='5547989118695'
        AND user_id='734f3e5b-aeab-477e-b582-654359bee34b'
    );
