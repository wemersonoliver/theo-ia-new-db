
-- system_followup_config (singleton — uma linha global)
CREATE TABLE IF NOT EXISTS public.system_followup_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  inactivity_hours integer NOT NULL DEFAULT 24,
  max_days integer NOT NULL DEFAULT 6,
  morning_window_start text NOT NULL DEFAULT '08:00',
  morning_window_end text NOT NULL DEFAULT '12:00',
  evening_window_start text NOT NULL DEFAULT '13:00',
  evening_window_end text NOT NULL DEFAULT '19:00',
  bargaining_tools text,
  exclude_handoff boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_followup_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage system followup config"
ON public.system_followup_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE TRIGGER update_system_followup_config_updated_at
BEFORE UPDATE ON public.system_followup_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert singleton row
INSERT INTO public.system_followup_config (enabled) VALUES (false)
ON CONFLICT DO NOTHING;

-- system_followup_tracking
CREATE TABLE IF NOT EXISTS public.system_followup_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  current_step integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  last_sent_at timestamptz,
  next_scheduled_at timestamptz,
  context_summary text,
  engagement_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_followup_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage system followup tracking"
ON public.system_followup_tracking
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_system_followup_tracking_status_schedule
ON public.system_followup_tracking (status, next_scheduled_at);

CREATE TRIGGER update_system_followup_tracking_updated_at
BEFORE UPDATE ON public.system_followup_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
