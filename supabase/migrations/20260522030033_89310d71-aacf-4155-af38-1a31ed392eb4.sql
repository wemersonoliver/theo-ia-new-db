
DO $$
DECLARE
  v_phone text := '5547989118695';
  v_contact_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_contact_ids FROM public.contacts WHERE phone = v_phone;

  IF v_contact_ids IS NOT NULL THEN
    DELETE FROM public.crm_deal_products WHERE deal_id IN (SELECT id FROM public.crm_deals WHERE contact_id = ANY(v_contact_ids));
    DELETE FROM public.crm_deal_tasks WHERE deal_id IN (SELECT id FROM public.crm_deals WHERE contact_id = ANY(v_contact_ids));
    DELETE FROM public.crm_activities WHERE deal_id IN (SELECT id FROM public.crm_deals WHERE contact_id = ANY(v_contact_ids));
    DELETE FROM public.crm_deals WHERE contact_id = ANY(v_contact_ids);
  END IF;

  DELETE FROM public.igreen_lead_data WHERE phone = v_phone;
  DELETE FROM public.igreen_scenario_enrollments WHERE contact_phone = v_phone;

  DELETE FROM public.custom_followup_queue WHERE enrollment_id IN (SELECT id FROM public.custom_followup_enrollments WHERE phone = v_phone);
  DELETE FROM public.custom_followup_events WHERE phone = v_phone;
  DELETE FROM public.custom_followup_enrollments WHERE phone = v_phone;
  DELETE FROM public.followup_tracking WHERE phone = v_phone;

  DELETE FROM public.whatsapp_pending_responses WHERE phone = v_phone;
  DELETE FROM public.whatsapp_ai_sessions WHERE phone = v_phone;
  DELETE FROM public.whatsapp_conversations WHERE phone = v_phone;

  DELETE FROM public.contacts WHERE phone = v_phone;
END $$;
