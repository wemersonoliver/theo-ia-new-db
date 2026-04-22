-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove previous schedule if exists (safe re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('sync-whatsapp-profile-pictures-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule daily run at 04:00 UTC
SELECT cron.schedule(
  'sync-whatsapp-profile-pictures-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/sync-whatsapp-profile-pictures',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
    body := '{"mode":"cron"}'::jsonb
  ) AS request_id;
  $$
);