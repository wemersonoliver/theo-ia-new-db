DO $$
DECLARE
  v_phone text := '5547989118695';
  v_account uuid := '1aae0245-dbe0-4c9f-9050-8572ac1d894f';
  v_contact uuid;
BEGIN
  SELECT id INTO v_contact FROM contacts WHERE phone=v_phone AND account_id=v_account;

  DELETE FROM whatsapp_ai_sessions WHERE phone=v_phone;
  DELETE FROM whatsapp_pending_responses WHERE phone=v_phone;
  DELETE FROM whatsapp_conversations WHERE phone=v_phone;
  DELETE FROM igreen_lead_data WHERE phone=v_phone AND account_id=v_account;
  DELETE FROM igreen_scenario_enrollments WHERE contact_phone=v_phone AND account_id=v_account;
  DELETE FROM igreen_product_video_followups WHERE phone=v_phone AND account_id=v_account;
  DELETE FROM appointments WHERE phone=v_phone;

  DELETE FROM followup_messages m USING followup_tracking t
    WHERE m.tracking_id=t.id AND t.phone=v_phone;
  DELETE FROM followup_tracking WHERE phone=v_phone;

  IF v_contact IS NOT NULL THEN
    DELETE FROM crm_activities WHERE deal_id IN (SELECT id FROM crm_deals WHERE contact_id=v_contact);
    DELETE FROM crm_deal_products WHERE deal_id IN (SELECT id FROM crm_deals WHERE contact_id=v_contact);
    DELETE FROM crm_deal_tasks WHERE deal_id IN (SELECT id FROM crm_deals WHERE contact_id=v_contact);
    DELETE FROM crm_deals WHERE contact_id=v_contact;
    DELETE FROM contacts WHERE id=v_contact;
  END IF;
END $$;