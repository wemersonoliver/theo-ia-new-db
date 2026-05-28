
CREATE TABLE IF NOT EXISTS public.igreen_behavior_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text,
  account_id uuid,
  phone text,
  specialist_before text,
  specialist_after text,
  intent text,
  confidence numeric,
  decision_source text,
  trigger_reason text,
  conversation_snapshot jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.igreen_behavior_audits TO authenticated;
GRANT ALL ON public.igreen_behavior_audits TO service_role;

ALTER TABLE public.igreen_behavior_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin can read behavior audits"
ON public.igreen_behavior_audits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_igreen_behavior_audits_corr
  ON public.igreen_behavior_audits(correlation_id);
CREATE INDEX IF NOT EXISTS idx_igreen_behavior_audits_phone_created
  ON public.igreen_behavior_audits(phone, created_at DESC);
