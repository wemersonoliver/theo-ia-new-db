CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove versão antiga se existir
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'igreen-scenario-dispatcher-1m';

SELECT cron.schedule(
  'igreen-scenario-dispatcher-1m',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/igreen-scenario-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8'
    ),
    body := jsonb_build_object('source', 'pg_cron', 't', now())
  );
  $$
);