DO $$
DECLARE
  v_account uuid := '1aae0245-dbe0-4c9f-9050-8572ac1d894f';
  v_user uuid := 'd88231dd-dc8c-4b1b-a650-2b5c0ca3a322';
  v_phone text := '5594981030361';
BEGIN
  DELETE FROM crm_activities WHERE deal_id IN (SELECT d.id FROM crm_deals d JOIN contacts c ON c.id=d.contact_id WHERE c.phone=v_phone AND c.account_id=v_account);
  DELETE FROM crm_deals WHERE contact_id IN (SELECT id FROM contacts WHERE phone=v_phone AND account_id=v_account);
  DELETE FROM igreen_lead_data WHERE phone=v_phone AND account_id=v_account;
  DELETE FROM whatsapp_ai_sessions WHERE phone=v_phone AND user_id=v_user;
  DELETE FROM whatsapp_pending_responses WHERE phone=v_phone AND user_id=v_user;
  DELETE FROM whatsapp_conversations WHERE phone=v_phone AND account_id=v_account;
  DELETE FROM followup_messages WHERE tracking_id IN (SELECT id FROM followup_tracking WHERE phone=v_phone AND user_id=v_user);
  DELETE FROM followup_tracking WHERE phone=v_phone AND user_id=v_user;
  DELETE FROM appointments WHERE phone=v_phone AND account_id=v_account;
  DELETE FROM roulette_assignments WHERE phone=v_phone AND account_id=v_account;
  DELETE FROM contacts WHERE phone=v_phone AND account_id=v_account;
END $$;