
ALTER TABLE public.igreen_scenarios
  ADD COLUMN IF NOT EXISTS final_tag text,
  ADD COLUMN IF NOT EXISTS final_tag_delay_hours integer NOT NULL DEFAULT 24;

ALTER TABLE public.igreen_scenario_enrollments
  ADD COLUMN IF NOT EXISTS final_tag_applied_at timestamptz;
