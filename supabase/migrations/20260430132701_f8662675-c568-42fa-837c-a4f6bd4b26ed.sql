UPDATE system_followup_tracking
SET next_scheduled_at = (
  CASE
    WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Sao_Paulo')) < 12
      THEN (((now() AT TIME ZONE 'America/Sao_Paulo')::date + time '08:30' + (random() * interval '3 hours')) AT TIME ZONE 'America/Sao_Paulo')
    WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Sao_Paulo')) < 19
      THEN (((now() AT TIME ZONE 'America/Sao_Paulo')::date + time '13:30' + (random() * interval '5 hours')) AT TIME ZONE 'America/Sao_Paulo')
    ELSE ((((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1) + time '08:30' + (random() * interval '3 hours')) AT TIME ZONE 'America/Sao_Paulo')
  END
)
WHERE status = 'pending';