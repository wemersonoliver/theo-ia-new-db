
-- Table: followup_config
CREATE TABLE public.followup_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  inactivity_hours integer NOT NULL DEFAULT 24,
  max_days integer NOT NULL DEFAULT 6,
  morning_window_start text NOT NULL DEFAULT '08:00',
  morning_window_end text NOT NULL DEFAULT '12:00',
  evening_window_start text NOT NULL DEFAULT '13:00',
  evening_window_end text NOT NULL DEFAULT '19:00',
  bargaining_tools text,
  exclude_handoff boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.followup_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own followup config"
  ON public.followup_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_followup_config_updated_at
  BEFORE UPDATE ON public.followup_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: followup_tracking
CREATE TABLE public.followup_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  current_step integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  last_sent_at timestamptz,
  next_scheduled_at timestamptz,
  context_summary text,
  engagement_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, phone)
);

ALTER TABLE public.followup_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own followup tracking"
  ON public.followup_tracking FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_followup_tracking_updated_at
  BEFORE UPDATE ON public.followup_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
