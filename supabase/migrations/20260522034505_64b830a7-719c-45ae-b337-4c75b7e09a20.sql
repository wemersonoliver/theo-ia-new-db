DO $$
DECLARE
  v_user_id uuid;
  v_account_id uuid;
  v_phones text[] := ARRAY[
    '5547989118695',
    '47989118695',
    '989118695',
    '5547989118695@s.whatsapp.net',
    '47989118695@s.whatsapp.net'
  ];
  v_contact_ids uuid[] := ARRAY[]::uuid[];
  v_deal_ids uuid[] := ARRAY[]::uuid[];
  v_followup_tracking_ids uuid[] := ARRAY[]::uuid[];
  v_custom_enrollment_ids uuid[] := ARRAY[]::uuid[];
  v_igreen_enrollment_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT u.id, am.account_id
    INTO v_user_id, v_account_id
  FROM auth.users u
  JOIN public.account_members am
    ON am.user_id = u.id
   AND am.status = 'active'
  WHERE u.email ILIKE 'projetoswemerson.tw@gmail%'
  ORDER BY (am.role = 'owner') DESC, am.invited_at ASC
  LIMIT 1;

  IF v_user_id IS NULL OR v_account_id IS NULL THEN
    RAISE EXCEPTION 'Usuário/conta não encontrado para projetoswemerson.tw@gmail';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_contact_ids
  FROM public.contacts
  WHERE phone = ANY(v_phones)
    AND (user_id = v_user_id OR account_id = v_account_id);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_deal_ids
  FROM public.crm_deals
  WHERE (contact_id = ANY(v_contact_ids))
    AND (user_id = v_user_id OR account_id = v_account_id);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_followup_tracking_ids
  FROM public.followup_tracking
  WHERE phone = ANY(v_phones)
    AND (user_id = v_user_id OR account_id = v_account_id);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_custom_enrollment_ids
  FROM public.custom_followup_enrollments
  WHERE phone = ANY(v_phones)
    AND account_id = v_account_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_igreen_enrollment_ids
  FROM public.igreen_scenario_enrollments
  WHERE contact_phone = ANY(v_phones)
    AND account_id = v_account_id;

  DELETE FROM public.crm_activities
  WHERE deal_id = ANY(v_deal_ids)
     OR (account_id = v_account_id AND user_id = v_user_id AND content ILIKE '%5547989118695%');

  DELETE FROM public.crm_deal_tasks
  WHERE deal_id = ANY(v_deal_ids)
     OR (account_id = v_account_id AND user_id = v_user_id AND description ILIKE '%5547989118695%');

  DELETE FROM public.crm_deal_products
  WHERE deal_id = ANY(v_deal_ids)
     OR (account_id = v_account_id AND user_id = v_user_id);

  DELETE FROM public.crm_deals
  WHERE id = ANY(v_deal_ids);

  DELETE FROM public.followup_messages
  WHERE tracking_id = ANY(v_followup_tracking_ids)
     OR (phone = ANY(v_phones) AND (user_id = v_user_id OR account_id = v_account_id));

  DELETE FROM public.followup_tracking
  WHERE id = ANY(v_followup_tracking_ids)
     OR (phone = ANY(v_phones) AND (user_id = v_user_id OR account_id = v_account_id));

  DELETE FROM public.custom_followup_events
  WHERE enrollment_id = ANY(v_custom_enrollment_ids)
     OR (phone = ANY(v_phones) AND account_id = v_account_id);

  DELETE FROM public.custom_followup_queue
  WHERE enrollment_id = ANY(v_custom_enrollment_ids)
     OR (phone = ANY(v_phones) AND account_id = v_account_id);

  DELETE FROM public.custom_followup_enrollments
  WHERE id = ANY(v_custom_enrollment_ids)
     OR (phone = ANY(v_phones) AND account_id = v_account_id);

  DELETE FROM public.igreen_scenario_events
  WHERE enrollment_id = ANY(v_igreen_enrollment_ids);

  DELETE FROM public.igreen_scenario_enrollments
  WHERE id = ANY(v_igreen_enrollment_ids)
     OR (contact_phone = ANY(v_phones) AND account_id = v_account_id);

  DELETE FROM public.igreen_product_video_followups
  WHERE phone = ANY(v_phones)
    AND (user_id = v_user_id OR account_id = v_account_id);

  DELETE FROM public.igreen_lead_data
  WHERE phone = ANY(v_phones)
    AND account_id = v_account_id;

  DELETE FROM public.appointments
  WHERE phone = ANY(v_phones)
    AND (user_id = v_user_id OR account_id = v_account_id);

  DELETE FROM public.whatsapp_pending_responses
  WHERE phone = ANY(v_phones)
    AND (user_id = v_user_id OR account_id = v_account_id);

  DELETE FROM public.whatsapp_ai_sessions
  WHERE phone = ANY(v_phones)
    AND (user_id = v_user_id OR account_id = v_account_id);

  DELETE FROM public.whatsapp_conversations
  WHERE phone = ANY(v_phones)
    AND (user_id = v_user_id OR account_id = v_account_id);

  DELETE FROM public.contacts
  WHERE id = ANY(v_contact_ids)
     OR (phone = ANY(v_phones) AND (user_id = v_user_id OR account_id = v_account_id));

  DELETE FROM public.attendance_flow_runs
  WHERE phone = ANY(v_phones);
END $$;