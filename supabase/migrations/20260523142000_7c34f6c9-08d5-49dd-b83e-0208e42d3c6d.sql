DO $$
DECLARE
  v_account uuid := '1aae0245-dbe0-4c9f-9050-8572ac1d894f';
  v_phone text := '5547989118695';
  v_contact uuid := '17fab328-ed62-4294-81a4-72eaa918fb92';
BEGIN
  DELETE FROM public.crm_deals WHERE contact_id = v_contact;
  DELETE FROM public.whatsapp_conversations WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.whatsapp_ai_sessions WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.whatsapp_pending_responses WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.attendance_flow_runs WHERE phone=v_phone;
  DELETE FROM public.igreen_lead_data WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.igreen_product_video_followups WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.igreen_scenario_enrollments WHERE account_id=v_account AND contact_phone=v_phone;
  DELETE FROM public.custom_followup_enrollments WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.custom_followup_events WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.custom_followup_queue WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.followup_tracking WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.roulette_assignments WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.appointments WHERE account_id=v_account AND phone=v_phone;
  DELETE FROM public.contacts WHERE id = v_contact;
END $$;