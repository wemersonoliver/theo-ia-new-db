SELECT i.provider AS instance_provider, p.provider AS account_provider, i.status, i.waha_session_name
FROM public.whatsapp_instances i
LEFT JOIN public.account_wa_provider p ON p.account_id = i.account_id
WHERE i.account_id = '9f9b5baf-17ab-45ae-b78b-7f12fa745567'
  AND i.instance_name = 'biz1049_principal';