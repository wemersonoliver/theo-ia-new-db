DO $$
DECLARE
  v_phone text := '5547991293662';
  v_account uuid := '1aae0245-dbe0-4c9f-9050-8572ac1d894f';
  v_contact uuid := '0a370677-8296-442c-bec6-0f1cca7509ac';
BEGIN
  DELETE FROM public.whatsapp_pending_responses WHERE phone = v_phone;
  DELETE FROM public.whatsapp_ai_sessions WHERE phone = v_phone;
  DELETE FROM public.whatsapp_conversations WHERE phone = v_phone;
  DELETE FROM public.igreen_lead_data WHERE phone = v_phone;
  DELETE FROM public.igreen_scenario_enrollments WHERE contact_phone = v_phone;
  DELETE FROM public.igreen_product_video_followups WHERE phone = v_phone;
  DELETE FROM public.custom_followup_queue WHERE phone = v_phone;
  DELETE FROM public.custom_followup_events WHERE phone = v_phone;
  DELETE FROM public.custom_followup_enrollments WHERE phone = v_phone;
  DELETE FROM public.followup_tracking WHERE phone = v_phone;
  DELETE FROM public.roulette_assignments WHERE phone = v_phone;
  DELETE FROM public.appointments WHERE phone = v_phone;
  DELETE FROM public.attendance_flow_runs WHERE phone = v_phone;
  DELETE FROM public.ai_voice_usage WHERE phone = v_phone;
  DELETE FROM public.crm_deals WHERE contact_id = v_contact;
  DELETE FROM public.contacts WHERE id = v_contact;
END $$;