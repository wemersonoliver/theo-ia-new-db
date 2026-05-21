
-- 1) Tabela de produtos por conta
CREATE TABLE IF NOT EXISTS public.igreen_account_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, key)
);

CREATE INDEX IF NOT EXISTS igreen_account_products_account_idx
  ON public.igreen_account_products (account_id, position);

ALTER TABLE public.igreen_account_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "igreen_account_products read members" ON public.igreen_account_products;
CREATE POLICY "igreen_account_products read members"
  ON public.igreen_account_products FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "igreen_account_products write owners" ON public.igreen_account_products;
CREATE POLICY "igreen_account_products write owners"
  ON public.igreen_account_products FOR ALL
  TO authenticated
  USING (
    public.get_account_role(account_id) IN ('owner','manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.get_account_role(account_id) IN ('owner','manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP TRIGGER IF EXISTS trg_igreen_account_products_updated_at ON public.igreen_account_products;
CREATE TRIGGER trg_igreen_account_products_updated_at
  BEFORE UPDATE ON public.igreen_account_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Backfill: 3 produtos padrão para todas as contas existentes
INSERT INTO public.igreen_account_products (account_id, key, name, description, position)
SELECT a.id, p.key, p.name, p.description, p.position
  FROM public.accounts a
 CROSS JOIN (VALUES
   ('green',   'Conexão Green',    'Energia por assinatura', 1),
   ('telecom', 'Conexão Telecom',  'Telecomunicações',       2),
   ('expansao','Conexão Expansão', 'Expansão de negócios',   3)
 ) AS p(key, name, description, position)
ON CONFLICT (account_id, key) DO NOTHING;

-- 3) Função + trigger para auto-seed em novas contas
CREATE OR REPLACE FUNCTION public.seed_igreen_account_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.igreen_account_products (account_id, key, name, description, position)
  VALUES
    (NEW.id, 'green',   'Conexão Green',    'Energia por assinatura', 1),
    (NEW.id, 'telecom', 'Conexão Telecom',  'Telecomunicações',       2),
    (NEW.id, 'expansao','Conexão Expansão', 'Expansão de negócios',   3)
  ON CONFLICT (account_id, key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_igreen_products_on_account ON public.accounts;
CREATE TRIGGER trg_seed_igreen_products_on_account
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.seed_igreen_account_products();

-- 4) Substitui FK global por FK por conta em igreen_scenarios
ALTER TABLE public.igreen_scenarios
  DROP CONSTRAINT IF EXISTS igreen_scenarios_product_key_fkey;

ALTER TABLE public.igreen_scenarios
  ADD CONSTRAINT igreen_scenarios_account_product_fkey
  FOREIGN KEY (account_id, product_key)
  REFERENCES public.igreen_account_products(account_id, key)
  ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- 5) Vínculo opcional entre documentos da base de conhecimento e produto Igreen
ALTER TABLE public.knowledge_base_documents
  ADD COLUMN IF NOT EXISTS igreen_product_id uuid
  REFERENCES public.igreen_account_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS knowledge_base_documents_igreen_product_idx
  ON public.knowledge_base_documents (igreen_product_id);
