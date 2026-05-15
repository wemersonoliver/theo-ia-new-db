
-- Wave 3: Events + Webhooks for Custom Followup

CREATE TABLE IF NOT EXISTS public.custom_followup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  flow_id uuid,
  enrollment_id uuid,
  step_id uuid,
  step_position int,
  variant_id text,
  phone text,
  event_type text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfe_account_created ON public.custom_followup_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cfe_flow_created ON public.custom_followup_events(flow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cfe_event_type ON public.custom_followup_events(event_type);

ALTER TABLE public.custom_followup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select events" ON public.custom_followup_events
  FOR SELECT USING (auth.uid() IS NOT NULL AND account_id IN (
    SELECT account_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.custom_followup_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  flow_id uuid,
  name text NOT NULL DEFAULT 'Webhook',
  url text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['sent','completed','stopped','failed']::text[],
  headers jsonb DEFAULT '{}'::jsonb,
  secret text,
  enabled boolean NOT NULL DEFAULT true,
  last_status int,
  last_error text,
  last_fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfw_account ON public.custom_followup_webhooks(account_id);
CREATE INDEX IF NOT EXISTS idx_cfw_flow ON public.custom_followup_webhooks(flow_id);

ALTER TABLE public.custom_followup_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select webhooks" ON public.custom_followup_webhooks
  FOR SELECT USING (auth.uid() IS NOT NULL AND account_id IN (
    SELECT account_id FROM public.profiles WHERE user_id = auth.uid()
  ));
CREATE POLICY "owner insert webhooks" ON public.custom_followup_webhooks
  FOR INSERT WITH CHECK (auth.uid() = user_id AND account_id IN (
    SELECT account_id FROM public.profiles WHERE user_id = auth.uid()
  ));
CREATE POLICY "owner update webhooks" ON public.custom_followup_webhooks
  FOR UPDATE USING (account_id IN (
    SELECT account_id FROM public.profiles WHERE user_id = auth.uid()
  ));
CREATE POLICY "owner delete webhooks" ON public.custom_followup_webhooks
  FOR DELETE USING (account_id IN (
    SELECT account_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE TRIGGER cfw_set_updated_at BEFORE UPDATE ON public.custom_followup_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
