
CREATE TABLE public.system_ai_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_provider text NOT NULL DEFAULT 'gemini' CHECK (primary_provider IN ('gemini','openai')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_ai_provider TO authenticated;
GRANT ALL ON public.system_ai_provider TO service_role;

ALTER TABLE public.system_ai_provider ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_ai_provider_select_auth"
ON public.system_ai_provider FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "system_ai_provider_admin_insert"
ON public.system_ai_provider FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "system_ai_provider_admin_update"
ON public.system_ai_provider FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_system_ai_provider_updated_at
BEFORE UPDATE ON public.system_ai_provider
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_ai_provider (primary_provider) VALUES ('gemini');
