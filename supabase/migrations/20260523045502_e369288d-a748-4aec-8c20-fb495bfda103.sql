
DO $$
DECLARE
  v_account uuid := '1aae0245-dbe0-4c9f-9050-8572ac1d894f';
  v_phone text := '5547988447793';
  v_contact uuid := '03055198-2720-4b20-8091-358d5328c848';
BEGIN
  DELETE FROM crm_deals WHERE contact_id = v_contact;
  DELETE FROM whatsapp_conversations WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM whatsapp_ai_sessions WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM whatsapp_pending_responses WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM attendance_flow_runs WHERE phone = v_phone;
  DELETE FROM igreen_lead_data WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM igreen_product_video_followups WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM igreen_scenario_enrollments WHERE account_id = v_account AND contact_phone = v_phone;
  DELETE FROM custom_followup_enrollments WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM custom_followup_events WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM custom_followup_queue WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM followup_tracking WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM roulette_assignments WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM appointments WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM ai_voice_usage WHERE phone = v_phone;
  DELETE FROM contacts WHERE id = v_contact;
END $$;
