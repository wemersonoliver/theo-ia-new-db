
DO $$
DECLARE
  v_account uuid := '1aae0245-dbe0-4c9f-9050-8572ac1d894f';
  v_user    uuid := 'd88231dd-dc8c-4b1b-a650-2b5c0ca3a322';
  v_phone   text := '5547989118695';
BEGIN
  DELETE FROM crm_deals d USING contacts c
    WHERE d.contact_id = c.id AND c.account_id = v_account AND c.phone = v_phone;

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
  DELETE FROM followup_tracking WHERE user_id = v_user AND phone = v_phone;
  DELETE FROM roulette_assignments WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM appointments WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM contacts WHERE account_id = v_account AND phone = v_phone;
END $$;
