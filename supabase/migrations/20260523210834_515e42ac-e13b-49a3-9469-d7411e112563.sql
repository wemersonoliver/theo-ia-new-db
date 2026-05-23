
DO $$
DECLARE
  v_account_id uuid;
  v_phone text := '5547991293662';
  v_contact_id uuid;
BEGIN
  SELECT am.account_id INTO v_account_id
  FROM public.account_members am
  JOIN public.profiles p ON p.user_id = am.user_id
  WHERE p.email = 'projetoswemerson.tw@gmail.com' AND am.status = 'active'
  ORDER BY (am.role = 'owner') DESC LIMIT 1;

  IF v_account_id IS NULL THEN RAISE NOTICE 'account not found'; RETURN; END IF;

  SELECT id INTO v_contact_id FROM public.contacts WHERE account_id = v_account_id AND phone = v_phone LIMIT 1;
  IF v_contact_id IS NOT NULL THEN
    DELETE FROM public.crm_deals WHERE contact_id = v_contact_id;
  END IF;

  DELETE FROM public.whatsapp_conversations WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.whatsapp_ai_sessions WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.whatsapp_pending_responses WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.igreen_lead_data WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.igreen_product_video_followups WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.igreen_scenario_enrollments WHERE account_id = v_account_id AND contact_phone = v_phone;
  DELETE FROM public.custom_followup_enrollments WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.custom_followup_events WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.custom_followup_queue WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.followup_tracking WHERE phone = v_phone AND user_id IN (SELECT user_id FROM public.account_members WHERE account_id = v_account_id);
  DELETE FROM public.roulette_assignments WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.appointments WHERE account_id = v_account_id AND phone = v_phone;

  IF v_contact_id IS NOT NULL THEN
    DELETE FROM public.contacts WHERE id = v_contact_id;
  END IF;
END $$;
