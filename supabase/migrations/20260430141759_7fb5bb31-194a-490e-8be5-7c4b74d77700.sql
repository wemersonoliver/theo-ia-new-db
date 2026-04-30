
-- Pausa os crons antigos (se existirem)
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid, jobname FROM cron.job
    WHERE command LIKE '%/followup-ai%' OR command LIKE '%/system-followup-ai%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
    RAISE NOTICE 'Unscheduled old job: %', job_record.jobname;
  END LOOP;
END $$;

-- Remove crons novos com mesmos nomes (idempotência)
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'followup-generate-sequence-5min',
      'followup-dispatch-5min',
      'system-followup-generate-sequence-5min',
      'system-followup-dispatch-5min'
    )
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END $$;

-- Agenda os 4 novos crons
SELECT cron.schedule(
  'followup-generate-sequence-5min',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/followup-generate-sequence',
       headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);

SELECT cron.schedule(
  'followup-dispatch-5min',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/followup-dispatch',
       headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);

SELECT cron.schedule(
  'system-followup-generate-sequence-5min',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/system-followup-generate-sequence',
       headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);

SELECT cron.schedule(
  'system-followup-dispatch-5min',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/system-followup-dispatch',
       headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
