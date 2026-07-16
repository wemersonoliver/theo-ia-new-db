ALTER TABLE public.system_api_health
  ADD COLUMN IF NOT EXISTS incident_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_error_context jsonb;

COMMENT ON COLUMN public.system_api_health.incident_started_at IS 'Timestamp of the first failure in the current unresolved incident.';
COMMENT ON COLUMN public.system_api_health.last_error_context IS 'Small diagnostic context for the most recent API health failure.';