CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior (se existir)
DO $$
BEGIN
  PERFORM cron.unschedule('enforce-trial-expiration-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'enforce-trial-expiration-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/enforce-trial-expiration',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
    body := jsonb_build_object('source','cron','at', now())
  );
  $$
);