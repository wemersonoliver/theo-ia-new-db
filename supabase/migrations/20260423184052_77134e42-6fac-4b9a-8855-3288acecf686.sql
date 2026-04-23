UPDATE public.whatsapp_instances wi
SET account_id = a.id
FROM public.accounts a
WHERE a.owner_user_id = wi.user_id
  AND wi.account_id IS NULL;