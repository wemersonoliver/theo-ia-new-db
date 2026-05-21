
-- 1) Catálogo global de produtos
CREATE TABLE IF NOT EXISTS public.igreen_products (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.igreen_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "igreen_products read for authenticated" ON public.igreen_products;
CREATE POLICY "igreen_products read for authenticated"
  ON public.igreen_products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "igreen_products super admin write" ON public.igreen_products;
CREATE POLICY "igreen_products super admin write"
  ON public.igreen_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_igreen_products_updated_at ON public.igreen_products;
CREATE TRIGGER trg_igreen_products_updated_at
  BEFORE UPDATE ON public.igreen_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.igreen_products (key, name, description, position) VALUES
  ('green',   'Conexão Green',    'Energia por assinatura', 1),
  ('telecom', 'Conexão Telecom',  'Telecomunicações',       2),
  ('expansao','Conexão Expansão', 'Expansão de negócios',   3)
ON CONFLICT (key) DO NOTHING;

-- 2) Ajustes em igreen_scenarios
ALTER TABLE public.igreen_scenarios
  ADD COLUMN IF NOT EXISTS product_key text NOT NULL DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS trigger_tag text;

-- Remove restrição antiga que limitava aos 3 cenários fixos
ALTER TABLE public.igreen_scenarios
  DROP CONSTRAINT IF EXISTS igreen_scenarios_scenario_key_check;

-- scenario_key agora pode ser nulo (cenários novos não precisam dele)
ALTER TABLE public.igreen_scenarios
  ALTER COLUMN scenario_key DROP NOT NULL;

-- Backfill: cenários existentes (CENARIO1/2/3) recebem trigger_tag = scenario_key
UPDATE public.igreen_scenarios
   SET trigger_tag = scenario_key
 WHERE trigger_tag IS NULL AND scenario_key IS NOT NULL;

UPDATE public.igreen_scenarios
   SET product_key = 'green'
 WHERE product_key IS NULL OR product_key = '';

-- FK lógica (produto deve existir)
ALTER TABLE public.igreen_scenarios
  DROP CONSTRAINT IF EXISTS igreen_scenarios_product_key_fkey;
ALTER TABLE public.igreen_scenarios
  ADD CONSTRAINT igreen_scenarios_product_key_fkey
  FOREIGN KEY (product_key) REFERENCES public.igreen_products(key) ON UPDATE CASCADE;

-- Unicidade: (account, product, trigger_tag) — duas configurações na mesma conta não podem ter mesma tag de gatilho dentro do produto
CREATE UNIQUE INDEX IF NOT EXISTS igreen_scenarios_account_product_trigger_uq
  ON public.igreen_scenarios (account_id, product_key, lower(trigger_tag))
  WHERE trigger_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS igreen_scenarios_account_product_idx
  ON public.igreen_scenarios (account_id, product_key);
