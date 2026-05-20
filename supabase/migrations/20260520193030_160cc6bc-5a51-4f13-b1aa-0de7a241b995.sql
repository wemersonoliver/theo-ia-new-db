
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_tier_check;
ALTER TABLE public.plans ADD CONSTRAINT plans_tier_check CHECK (tier = ANY (ARRAY['basic'::text, 'pro'::text, 'igreen'::text]));

INSERT INTO public.plans (slug, name, tier, billing_period, price_cents, checkout_url, description, features, limits, is_active, position)
VALUES
('igreen-monthly','Plano Igreen Energy (Mensal)','igreen','monthly',14700,'https://pay.kiwify.com.br/krlmNAg',
 'Plano dedicado para parceiros Igreen Energy com cenários e tema personalizados',
 '["Fluxos personalizados","3 Cenários Igreen (CENARIO1/2/3)","Simulador de atendimento","Base de conhecimento","Até 2 instâncias WhatsApp"]'::jsonb,
 '{"whatsapp_instances":2}'::jsonb, true, 10),
('igreen-annual','Plano Igreen Energy (Anual)','igreen','annual',149900,'https://pay.kiwify.com.br/nxY8qSd',
 'Plano dedicado para parceiros Igreen Energy — anual',
 '["Fluxos personalizados","3 Cenários Igreen (CENARIO1/2/3)","Simulador de atendimento","Base de conhecimento","Até 2 instâncias WhatsApp"]'::jsonb,
 '{"whatsapp_instances":2}'::jsonb, true, 11)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, tier = EXCLUDED.tier, checkout_url = EXCLUDED.checkout_url,
  description = EXCLUDED.description, features = EXCLUDED.features, limits = EXCLUDED.limits,
  is_active = true, updated_at = now();
