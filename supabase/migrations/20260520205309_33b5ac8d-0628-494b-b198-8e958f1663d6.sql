
CREATE TABLE IF NOT EXISTS public.igreen_default_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  custom_prompt text NOT NULL,
  business_description text,
  business_niche text,
  agent_name text NOT NULL DEFAULT 'Assistente Virtual',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.igreen_default_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manage igreen default ai"
  ON public.igreen_default_ai_config
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_igreen_default_ai_updated_at
  BEFORE UPDATE ON public.igreen_default_ai_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.igreen_default_ai_config (singleton, custom_prompt, business_description, business_niche, agent_name)
SELECT true, custom_prompt, business_description, business_niche, COALESCE(agent_name, 'Assistente Virtual')
FROM public.whatsapp_ai_config
WHERE user_id = 'fbc9254d-6577-468d-adba-5d639ed0e759'
ON CONFLICT (singleton) DO UPDATE
SET custom_prompt = EXCLUDED.custom_prompt,
    business_description = EXCLUDED.business_description,
    business_niche = EXCLUDED.business_niche,
    agent_name = EXCLUDED.agent_name,
    updated_at = now();
