UPDATE public.whatsapp_instances
SET status = 'disconnected',
    qr_code_base64 = NULL,
    pairing_code = NULL,
    phone_number = NULL,
    profile_name = NULL,
    last_sync_at = NULL,
    updated_at = now()
WHERE id = '4ecec876-62e1-4179-97b7-368c5d4bc721';