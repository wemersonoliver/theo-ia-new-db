-- Remove agendamento anterior se existir
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-welcome-sequence-every-minute') then
    perform cron.unschedule('send-welcome-sequence-every-minute');
  end if;
end $$;

select cron.schedule(
  'send-welcome-sequence-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url:='https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/send-welcome-sequence',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsanNpZmtqd2t1YnhhcWd4eHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3MDcsImV4cCI6MjA4NzUxMjcwN30.EL2ZuGe9Q5Wkdm_JcRUO0IWuMBeFxHn8KloQ7tkZaR8"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);