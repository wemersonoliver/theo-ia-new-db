ALTER TABLE public.igreen_scenario_enrollments
  ADD COLUMN IF NOT EXISTS current_item_position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_igreen_enrollments_due
  ON public.igreen_scenario_enrollments (status, next_run_at)
  WHERE status = 'active';