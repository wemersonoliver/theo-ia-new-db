
DO $$
DECLARE
  acc_ids uuid[] := ARRAY['9d472d81-f31b-427f-ab57-a319cfbfdfbd'::uuid, '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'::uuid];
  user_ids uuid[] := ARRAY['3e3dc9c7-9a31-4670-97f4-42abfb5f73cb'::uuid, '734f3e5b-aeab-477e-b582-654359bee34b'::uuid];
  ph text := '5547989118695';
BEGIN
  DELETE FROM crm_deals WHERE contact_id IN (SELECT id FROM contacts WHERE account_id = ANY(acc_ids) AND phone = ph);
  DELETE FROM whatsapp_conversations WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM whatsapp_ai_sessions WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM whatsapp_pending_responses WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM igreen_lead_data WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM igreen_product_video_followups WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM igreen_scenario_enrollments WHERE account_id = ANY(acc_ids) AND contact_phone = ph;
  DELETE FROM custom_followup_enrollments WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM custom_followup_events WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM custom_followup_queue WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM followup_tracking WHERE phone = ph AND user_id = ANY(user_ids);
  DELETE FROM roulette_assignments WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM appointments WHERE account_id = ANY(acc_ids) AND phone = ph;
  DELETE FROM contacts WHERE account_id = ANY(acc_ids) AND phone = ph;
END $$;
