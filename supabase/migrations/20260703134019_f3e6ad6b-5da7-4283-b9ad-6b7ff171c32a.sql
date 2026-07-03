UPDATE public.whatsapp_instances
SET provider = 'waha',
    status = 'disconnected',
    qr_code_base64 = NULL,
    pairing_code = NULL,
    updated_at = now()
WHERE instance_name = 'biz1053_principal';