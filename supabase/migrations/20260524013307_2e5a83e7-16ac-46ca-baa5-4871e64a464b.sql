
DO $$
DECLARE
  v_phones text[] := ARRAY['5547991293662','5547989118695','5547988447793'];
  v_phone text;
  r RECORD;
BEGIN
  FOREACH v_phone IN ARRAY v_phones LOOP
    -- Para cada (account_id, phone) existente em contacts
    FOR r IN
      SELECT DISTINCT account_id FROM public.contacts WHERE phone = v_phone
    LOOP
      -- CRM (via contact_id → deals)
      DELETE FROM public.crm_deal_products WHERE deal_id IN (
        SELECT d.id FROM public.crm_deals d
        JOIN public.contacts c ON c.id = d.contact_id
        WHERE c.account_id = r.account_id AND c.phone = v_phone
      );
      DELETE FROM public.crm_deal_tasks WHERE deal_id IN (
        SELECT d.id FROM public.crm_deals d
        JOIN public.contacts c ON c.id = d.contact_id
        WHERE c.account_id = r.account_id AND c.phone = v_phone
      );
      DELETE FROM public.crm_activities WHERE deal_id IN (
        SELECT d.id FROM public.crm_deals d
        JOIN public.contacts c ON c.id = d.contact_id
        WHERE c.account_id = r.account_id AND c.phone = v_phone
      );
      DELETE FROM public.crm_deals WHERE contact_id IN (
        SELECT id FROM public.contacts WHERE account_id = r.account_id AND phone = v_phone
      );

      -- WhatsApp / IA
      DELETE FROM public.whatsapp_pending_responses WHERE account_id = r.account_id AND phone = v_phone;
      DELETE FROM public.whatsapp_ai_sessions WHERE account_id = r.account_id AND phone = v_phone;
      DELETE FROM public.whatsapp_conversations WHERE account_id = r.account_id AND phone = v_phone;

      -- iGreen
      BEGIN DELETE FROM public.igreen_product_video_followups WHERE account_id = r.account_id AND phone = v_phone; EXCEPTION WHEN undefined_table THEN NULL; END;
      BEGIN DELETE FROM public.igreen_scenario_enrollments WHERE account_id = r.account_id AND contact_phone = v_phone; EXCEPTION WHEN undefined_table THEN NULL; END;
      BEGIN DELETE FROM public.igreen_lead_data WHERE account_id = r.account_id AND phone = v_phone; EXCEPTION WHEN undefined_table THEN NULL; END;

      -- Follow-up
      BEGIN DELETE FROM public.followup_tracking WHERE phone = v_phone; EXCEPTION WHEN undefined_table THEN NULL; END;
      BEGIN DELETE FROM public.custom_followup_queue WHERE enrollment_id IN (SELECT id FROM public.custom_followup_enrollments WHERE account_id = r.account_id AND phone = v_phone); EXCEPTION WHEN undefined_table THEN NULL; END;
      BEGIN DELETE FROM public.custom_followup_enrollments WHERE account_id = r.account_id AND phone = v_phone; EXCEPTION WHEN undefined_table THEN NULL; END;

      -- Roleta
      BEGIN DELETE FROM public.roulette_assignments WHERE account_id = r.account_id AND phone = v_phone; EXCEPTION WHEN undefined_table THEN NULL; END;

      -- Agendamentos
      BEGIN DELETE FROM public.appointments WHERE account_id = r.account_id AND phone = v_phone; EXCEPTION WHEN undefined_table THEN NULL; END;

      -- Contato por último
      DELETE FROM public.contacts WHERE account_id = r.account_id AND phone = v_phone;
    END LOOP;

    -- Limpa também registros órfãos por telefone (sem contato)
    DELETE FROM public.whatsapp_pending_responses WHERE phone = v_phone;
    DELETE FROM public.whatsapp_ai_sessions WHERE phone = v_phone;
    DELETE FROM public.whatsapp_conversations WHERE phone = v_phone;
  END LOOP;
END $$;
