-- Tabela de monitoramento de saúde das APIs externas
CREATE TABLE IF NOT EXISTS public.system_api_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unknown', -- 'ok' | 'down' | 'unknown'
  last_ok_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_alert_sent_at timestamptz,
  recovery_alert_sent boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_api_health ENABLE ROW LEVEL SECURITY;

-- Apenas super_admins podem ler/gerenciar
CREATE POLICY "Super admins can view api health"
ON public.system_api_health
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins can manage api health"
ON public.system_api_health
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE TRIGGER update_system_api_health_updated_at
BEFORE UPDATE ON public.system_api_health
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed das APIs monitoradas
INSERT INTO public.system_api_health (api_name, status) VALUES
  ('evolution_api', 'unknown'),
  ('gemini', 'unknown'),
  ('groq', 'unknown'),
  ('elevenlabs', 'unknown')
ON CONFLICT (api_name) DO NOTHING;