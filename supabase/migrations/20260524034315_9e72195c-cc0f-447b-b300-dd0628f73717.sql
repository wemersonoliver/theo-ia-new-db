-- Tornar Thays (account 2cf994fc) usuária do plano Igreen + copiar prompt padrão
UPDATE public.accounts SET is_igreen = true WHERE id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32';

UPDATE public.subscriptions
   SET plan_type = 'igreen',
       plan_id   = 'a084a55a-c7c8-4b38-aef1-eb9ffb698ed7',
       product_name = 'Plano Igreen Energy (Mensal)',
       status = 'active',
       updated_at = now()
 WHERE id = '989eb7cf-9308-4df4-afb7-f3cfce880258';

UPDATE public.whatsapp_ai_config w
   SET custom_prompt        = t.custom_prompt,
       business_description = t.business_description,
       business_niche       = t.business_niche,
       agent_name           = COALESCE(t.agent_name, 'Assistente Virtual'),
       active               = true,
       updated_at           = now()
  FROM public.igreen_default_ai_config t
 WHERE t.singleton = true
   AND w.user_id = '734f3e5b-aeab-477e-b582-654359bee34b';

INSERT INTO public.igreen_account_products (account_id, key, name, description, position) VALUES
  ('2cf994fc-4a1b-440c-be8b-c91a5c25fd32','green',   'Conexão Green',    'Energia por assinatura', 1),
  ('2cf994fc-4a1b-440c-be8b-c91a5c25fd32','telecom', 'Conexão Telecom',  'Telecomunicações',       2),
  ('2cf994fc-4a1b-440c-be8b-c91a5c25fd32','expansao','Conexão Expansão', 'Expansão de negócios',   3)
ON CONFLICT (account_id, key) DO NOTHING;

INSERT INTO public.igreen_scenarios (account_id, scenario_key, product_key, trigger_tag, name, enabled) VALUES
  ('2cf994fc-4a1b-440c-be8b-c91a5c25fd32','CENARIO1','green','CENARIO1','Cenário 1', true),
  ('2cf994fc-4a1b-440c-be8b-c91a5c25fd32','CENARIO2','green','CENARIO2','Cenário 2', true),
  ('2cf994fc-4a1b-440c-be8b-c91a5c25fd32','CENARIO3','green','CENARIO3','Cenário 3', true)
ON CONFLICT (account_id, scenario_key) DO NOTHING;