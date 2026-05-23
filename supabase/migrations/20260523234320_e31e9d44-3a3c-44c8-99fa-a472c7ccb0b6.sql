DO $$
DECLARE
  v_email text := 'projetoswemerson.tw@gmail.com';
  v_phone text := '5547991293662';
  v_user_id uuid;
  v_account_id uuid;
  v_contact_ids uuid[];
BEGIN
  SELECT p.user_id INTO v_user_id FROM public.profiles p
  WHERE lower(p.email) = lower(v_email) LIMIT 1;

  SELECT a.id INTO v_account_id FROM public.accounts a
  WHERE a.owner_user_id = v_user_id
  ORDER BY a.created_at ASC LIMIT 1;

  IF v_account_id IS NULL THEN
    SELECT am.account_id INTO v_account_id FROM public.account_members am
    WHERE am.user_id = v_user_id ORDER BY am.created_at ASC LIMIT 1;
  END IF;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada para %', v_email;
  END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_contact_ids
  FROM public.contacts WHERE account_id = v_account_id AND phone = v_phone;

  DELETE FROM public.whatsapp_pending_responses WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.whatsapp_ai_sessions WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.igreen_product_video_followups WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.igreen_scenario_enrollments WHERE account_id = v_account_id AND contact_phone = v_phone;
  DELETE FROM public.custom_followup_events WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.custom_followup_queue WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.custom_followup_enrollments WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.followup_tracking WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.roulette_assignments WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.appointments WHERE account_id = v_account_id AND phone = v_phone;

  IF array_length(v_contact_ids, 1) IS NOT NULL THEN
    DELETE FROM public.crm_deal_products WHERE deal_id IN (
      SELECT id FROM public.crm_deals WHERE account_id = v_account_id AND contact_id = ANY(v_contact_ids)
    );
    DELETE FROM public.crm_deal_tasks WHERE deal_id IN (
      SELECT id FROM public.crm_deals WHERE account_id = v_account_id AND contact_id = ANY(v_contact_ids)
    );
    DELETE FROM public.crm_activities WHERE deal_id IN (
      SELECT id FROM public.crm_deals WHERE account_id = v_account_id AND contact_id = ANY(v_contact_ids)
    );
    DELETE FROM public.crm_deals WHERE account_id = v_account_id AND contact_id = ANY(v_contact_ids);
  END IF;

  DELETE FROM public.igreen_lead_data WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.whatsapp_conversations WHERE account_id = v_account_id AND phone = v_phone;
  DELETE FROM public.contacts WHERE account_id = v_account_id AND phone = v_phone;
END $$;