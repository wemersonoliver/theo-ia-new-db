CREATE TABLE public.account_wa_provider (
  account_id uuid PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('evolution','waha')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.account_wa_provider TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.account_wa_provider TO authenticated;
GRANT ALL ON public.account_wa_provider TO service_role;
ALTER TABLE public.account_wa_provider ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read wa provider override"
ON public.account_wa_provider FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage wa provider override"
ON public.account_wa_provider FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Fixa o usuário 1053 no WAHA de forma permanente (sobrevive a desconexões)
INSERT INTO public.account_wa_provider (account_id, provider)
SELECT account_id, 'waha' FROM public.whatsapp_instances
WHERE instance_name = 'biz1053_principal' AND account_id IS NOT NULL
ON CONFLICT (account_id) DO UPDATE SET provider = 'waha', updated_at = now();

-- Corrige a instância atual (que foi recriada como evolution)
UPDATE public.whatsapp_instances
SET provider = 'waha', status = 'disconnected', qr_code_base64 = NULL, pairing_code = NULL, updated_at = now()
WHERE instance_name = 'biz1053_principal';