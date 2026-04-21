-- Backfill account_id em registros antigos a partir do user_id (owner) ou via account_members
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'whatsapp_conversations','whatsapp_ai_sessions','whatsapp_pending_responses',
    'contacts','appointments','appointment_types','appointment_slots',
    'crm_deals','crm_pipelines','crm_stages','crm_activities','crm_deal_products',
    'products','knowledge_base_documents','notification_contacts','platform_settings',
    'followup_config','followup_tracking','subscriptions','support_tickets'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format($f$
      UPDATE public.%I t
      SET account_id = a.id
      FROM public.accounts a
      WHERE t.account_id IS NULL
        AND a.owner_user_id = t.user_id
    $f$, tbl);

    EXECUTE format($f$
      UPDATE public.%I t
      SET account_id = m.account_id
      FROM public.account_members m
      WHERE t.account_id IS NULL
        AND m.user_id = t.user_id
        AND m.status = 'active'
    $f$, tbl);
  END LOOP;
END $$;

-- Garantir que todo usuário com profile tenha um account/owner_member
INSERT INTO public.accounts (owner_user_id, name)
SELECT p.user_id, COALESCE(p.full_name, 'Minha Empresa')
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.owner_user_id = p.user_id);

INSERT INTO public.account_members (account_id, user_id, role, status)
SELECT a.id, a.owner_user_id, 'owner', 'active'
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_members m
  WHERE m.account_id = a.id AND m.user_id = a.owner_user_id
);