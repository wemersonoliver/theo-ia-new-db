DO $$
DECLARE
  v_phones text[] := ARRAY['5547989118695', '47989118695', '554789118695', '4789118695'];
  v_contact_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_contact_ids
  FROM public.contacts
  WHERE phone = ANY(v_phones);

  IF v_contact_ids IS NOT NULL THEN
    DELETE FROM public.crm_deal_products
    WHERE deal_id IN (SELECT id FROM public.crm_deals WHERE contact_id = ANY(v_contact_ids));

    DELETE FROM public.crm_deal_tasks
    WHERE deal_id IN (SELECT id FROM public.crm_deals WHERE contact_id = ANY(v_contact_ids));

    DELETE FROM public.crm_activities
    WHERE deal_id IN (SELECT id FROM public.crm_deals WHERE contact_id = ANY(v_contact_ids));

    DELETE FROM public.crm_deals
    WHERE contact_id = ANY(v_contact_ids);
  END IF;

  DELETE FROM public.igreen_product_video_followups
  WHERE phone = ANY(v_phones);

  DELETE FROM public.igreen_lead_data
  WHERE phone = ANY(v_phones);

  DELETE FROM public.igreen_scenario_enrollments
  WHERE contact_phone = ANY(v_phones);

  DELETE FROM public.custom_followup_queue
  WHERE enrollment_id IN (
    SELECT id FROM public.custom_followup_enrollments WHERE phone = ANY(v_phones)
  );

  DELETE FROM public.custom_followup_events
  WHERE phone = ANY(v_phones);

  DELETE FROM public.custom_followup_enrollments
  WHERE phone = ANY(v_phones);

  DELETE FROM public.followup_tracking
  WHERE phone = ANY(v_phones);

  DELETE FROM public.whatsapp_pending_responses
  WHERE phone = ANY(v_phones);

  DELETE FROM public.whatsapp_ai_sessions
  WHERE phone = ANY(v_phones);

  DELETE FROM public.whatsapp_conversations
  WHERE phone = ANY(v_phones);

  DELETE FROM public.contacts
  WHERE phone = ANY(v_phones);
END $$;