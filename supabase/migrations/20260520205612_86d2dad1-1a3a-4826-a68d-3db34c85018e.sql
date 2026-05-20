
-- Active Igreen subscription (no expiry)
INSERT INTO public.subscriptions (
  user_id, account_id, plan_id, plan_type, product_name,
  status, started_at, expires_at, customer_email, amount_cents, currency, raw_data
)
SELECT
  'd88231dd-dc8c-4b1b-a650-2b5c0ca3a322',
  '1aae0245-dbe0-4c9f-9050-8572ac1d894f',
  'a084a55a-c7c8-4b38-aef1-eb9ffb698ed7',
  'igreen-monthly',
  'Plano Igreen Energy (Mensal)',
  'active',
  now(),
  NULL,
  'projetoswemerson.tw@gmail.com',
  0,
  'BRL',
  jsonb_build_object('source','manual-admin-grant')
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions
  WHERE account_id = '1aae0245-dbe0-4c9f-9050-8572ac1d894f'
    AND status = 'active'
);

-- Provision the 3 Igreen scenarios (idempotent)
INSERT INTO public.igreen_scenarios (account_id, scenario_key, name, enabled)
VALUES
  ('1aae0245-dbe0-4c9f-9050-8572ac1d894f','CENARIO1','Cenário 1', true),
  ('1aae0245-dbe0-4c9f-9050-8572ac1d894f','CENARIO2','Cenário 2', true),
  ('1aae0245-dbe0-4c9f-9050-8572ac1d894f','CENARIO3','Cenário 3', true)
ON CONFLICT (account_id, scenario_key) DO NOTHING;

-- Apply default Igreen prompt to the user's whatsapp_ai_config
INSERT INTO public.whatsapp_ai_config (user_id, custom_prompt, business_description, business_niche, agent_name, active)
SELECT 'd88231dd-dc8c-4b1b-a650-2b5c0ca3a322',
       t.custom_prompt, t.business_description, t.business_niche,
       COALESCE(t.agent_name, 'Assistente Virtual'), true
FROM public.igreen_default_ai_config t
WHERE t.singleton = true
ON CONFLICT (user_id) DO UPDATE
SET custom_prompt = EXCLUDED.custom_prompt,
    business_description = EXCLUDED.business_description,
    business_niche = EXCLUDED.business_niche,
    agent_name = EXCLUDED.agent_name,
    active = true,
    updated_at = now();
