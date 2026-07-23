INSERT INTO public.account_wa_provider (account_id, provider, updated_at)
VALUES ('9f9b5baf-17ab-45ae-b78b-7f12fa745567', 'waha', now())
ON CONFLICT (account_id)
DO UPDATE SET provider = EXCLUDED.provider, updated_at = now();

UPDATE public.whatsapp_instances
SET provider = 'waha',
    waha_session_name = COALESCE(waha_session_name, instance_name),
    updated_at = now()
WHERE account_id = '9f9b5baf-17ab-45ae-b78b-7f12fa745567'
  AND instance_name = 'biz1049_principal';