-- Força recarga do cache do PostgREST para garantir que a coluna
-- whatsapp_ai_sessions.handed_off_at seja reconhecida pela API.
SELECT pg_notification_queue_usage();
NOTIFY pgrst, 'reload schema';