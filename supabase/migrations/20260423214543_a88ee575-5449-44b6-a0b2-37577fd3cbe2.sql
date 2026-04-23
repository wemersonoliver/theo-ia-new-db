UPDATE whatsapp_instances
SET status = 'disconnected',
    qr_code_base64 = NULL,
    pairing_code = NULL,
    last_sync_at = now(),
    updated_at = now()
WHERE instance_name = 'solpositivosolar_d09db41f';