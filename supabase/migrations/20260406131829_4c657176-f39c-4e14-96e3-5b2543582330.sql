
ALTER TABLE public.system_ai_config 
ADD COLUMN response_delay_seconds integer NOT NULL DEFAULT 35;

CREATE TABLE public.system_pending_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(phone)
);

ALTER TABLE public.system_pending_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage system pending responses"
ON public.system_pending_responses
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_system_pending_responses_updated_at
BEFORE UPDATE ON public.system_pending_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
