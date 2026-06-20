ALTER TABLE public.igreen_scenario_enrollments
DROP CONSTRAINT IF EXISTS igreen_scenario_enrollments_status_check;

ALTER TABLE public.igreen_scenario_enrollments
ADD CONSTRAINT igreen_scenario_enrollments_status_check
CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'stopped'::text, 'pending_tag'::text]));