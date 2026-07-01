
-- 1) Colunas por instância
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS waha_session_name text;

ALTER TABLE public.whatsapp_instances
  DROP CONSTRAINT IF EXISTS whatsapp_instances_provider_check;
ALTER TABLE public.whatsapp_instances
  ADD CONSTRAINT whatsapp_instances_provider_check
  CHECK (provider IN ('evolution','waha'));

ALTER TABLE public.system_whatsapp_instance
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS waha_session_name text;

ALTER TABLE public.system_whatsapp_instance
  DROP CONSTRAINT IF EXISTS system_whatsapp_instance_provider_check;
ALTER TABLE public.system_whatsapp_instance
  ADD CONSTRAINT system_whatsapp_instance_provider_check
  CHECK (provider IN ('evolution','waha'));

-- 2) Provider padrão global (para novos cadastros)
CREATE TABLE IF NOT EXISTS public.system_wa_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_provider text NOT NULL DEFAULT 'evolution' CHECK (default_provider IN ('evolution','waha')),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_wa_provider TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_wa_provider TO service_role;
GRANT ALL ON public.system_wa_provider TO service_role;

ALTER TABLE public.system_wa_provider ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_provider_read_authenticated" ON public.system_wa_provider;
CREATE POLICY "wa_provider_read_authenticated"
  ON public.system_wa_provider FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "wa_provider_super_admin_write" ON public.system_wa_provider;
CREATE POLICY "wa_provider_super_admin_write"
  ON public.system_wa_provider FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Seed default row if empty
INSERT INTO public.system_wa_provider (default_provider)
SELECT 'evolution'
WHERE NOT EXISTS (SELECT 1 FROM public.system_wa_provider);
