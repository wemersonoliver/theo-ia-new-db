-- System follow-up cron jobs (every 15 minutes)
SELECT cron.schedule(
  'system-followup-check-inactive-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/system-followup-check-inactive',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'system-followup-ai-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/system-followup-ai',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);