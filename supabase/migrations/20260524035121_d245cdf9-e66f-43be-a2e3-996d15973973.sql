-- 1) Campos de vídeo / follow-up nos produtos globais Igreen
ALTER TABLE public.igreen_products
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS followup_after_video_seconds integer,
  ADD COLUMN IF NOT EXISTS followup_after_video_message text;

-- 2) Garante que existam os 3 produtos padrão
INSERT INTO public.igreen_products (key, name, description, enabled, position) VALUES
  ('green',   'Conexão Green',    'Energia por assinatura', true, 1),
  ('telecom', 'Conexão Telecom',  'Telecomunicações',       true, 2),
  ('expansao','Conexão Expansão', 'Expansão de negócios',   true, 3)
ON CONFLICT (key) DO NOTHING;

-- 3) RLS em igreen_products (leitura para autenticados, escrita só super_admin)
ALTER TABLE public.igreen_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "igreen_products_select_auth" ON public.igreen_products;
CREATE POLICY "igreen_products_select_auth" ON public.igreen_products
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "igreen_products_admin_all" ON public.igreen_products;
CREATE POLICY "igreen_products_admin_all" ON public.igreen_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 4) Marca documentos globais Igreen na base de conhecimento
ALTER TABLE public.knowledge_base_documents
  ADD COLUMN IF NOT EXISTS is_igreen_global boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS igreen_global_product_key text;

CREATE INDEX IF NOT EXISTS idx_kb_docs_igreen_global
  ON public.knowledge_base_documents (is_igreen_global) WHERE is_igreen_global = true;

-- 5) Permite que qualquer conta Igreen leia documentos globais Igreen;
--    super_admin pode criar/atualizar/apagar esses documentos.
DROP POLICY IF EXISTS "kb_docs_igreen_global_read" ON public.knowledge_base_documents;
CREATE POLICY "kb_docs_igreen_global_read" ON public.knowledge_base_documents
  FOR SELECT TO authenticated
  USING (is_igreen_global = true);

DROP POLICY IF EXISTS "kb_docs_igreen_global_admin_all" ON public.knowledge_base_documents;
CREATE POLICY "kb_docs_igreen_global_admin_all" ON public.knowledge_base_documents
  FOR ALL TO authenticated
  USING (is_igreen_global = true AND public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 6) igreen_default_ai_config — garante que super_admin pode atualizar (leitura já está aberta hoje)
ALTER TABLE public.igreen_default_ai_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "igreen_default_ai_select_auth" ON public.igreen_default_ai_config;
CREATE POLICY "igreen_default_ai_select_auth" ON public.igreen_default_ai_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "igreen_default_ai_admin_all" ON public.igreen_default_ai_config;
CREATE POLICY "igreen_default_ai_admin_all" ON public.igreen_default_ai_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 7) igreen_distributor_discounts — leitura aberta, escrita super_admin
ALTER TABLE public.igreen_distributor_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "igreen_disc_select_auth" ON public.igreen_distributor_discounts;
CREATE POLICY "igreen_disc_select_auth" ON public.igreen_distributor_discounts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "igreen_disc_admin_all" ON public.igreen_distributor_discounts;
CREATE POLICY "igreen_disc_admin_all" ON public.igreen_distributor_discounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));