DO $$
DECLARE
  v_account_id uuid;
  v_user_id uuid;
  v_phone text := '5547991293662';
BEGIN
  SELECT p.user_id INTO v_user_id
  FROM public.profiles p
  WHERE p.email = 'projetoswemerson.tw@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found';
    RETURN;
  END IF;

  SELECT a.id INTO v_account_id
  FROM public.accounts a
  WHERE a.owner_user_id = v_user_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    SELECT am.account_id INTO v_account_id
    FROM public.account_members am
    WHERE am.user_id = v_user_id AND am.status = 'active'
    LIMIT 1;
  END IF;

  IF v_account_id IS NULL THEN
    RAISE NOTICE 'Account not found';
    RETURN;
  END IF;

  DELETE FROM public.crm_deals WHERE account_id = v_account_id AND contact_id IN (SELECT id FROM public.contacts WHERE account_id = v_account_id AND phone = v_phone);
  DELETE FROM public.whatsapp_conversations WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.whatsapp_ai_sessions WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.whatsapp_pending_responses WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.igreen_lead_data WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.igreen_product_video_followups WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.igreen_scenario_enrollments WHERE account_id = v_account_id AND contact_phone = v_phone;
  DELETE FROM public.custom_followup_enrollments WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.followup_tracking WHERE user_id = v_user_id AND phone = v_phone;
  DELETE FROM public.roulette_assignments WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.appointments WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.contacts WHERE account_id = v_account_id AND phone = v_phone;
END $$;