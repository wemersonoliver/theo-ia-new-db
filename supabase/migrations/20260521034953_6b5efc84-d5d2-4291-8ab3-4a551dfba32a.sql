
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('process-igreen-video-followups-every-minute')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-igreen-video-followups-every-minute');

SELECT cron.schedule(
  'process-igreen-video-followups-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/process-igreen-video-followups',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
    body := jsonb_build_object('ts', now())
  );
  $$
);
