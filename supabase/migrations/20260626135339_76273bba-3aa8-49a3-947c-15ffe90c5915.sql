
-- 1) Tabela
CREATE TABLE public.igreen_default_greeting_audios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot int NOT NULL UNIQUE CHECK (slot IN (1, 2)),
  storage_path text,
  transcript text NOT NULL DEFAULT '',
  delay_after_ms int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Grants
GRANT SELECT ON public.igreen_default_greeting_audios TO authenticated;
GRANT ALL ON public.igreen_default_greeting_audios TO service_role;

-- 3) RLS
ALTER TABLE public.igreen_default_greeting_audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "greeting_audios_read_authenticated"
  ON public.igreen_default_greeting_audios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "greeting_audios_write_super_admin"
  ON public.igreen_default_greeting_audios FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 4) Trigger updated_at
CREATE TRIGGER trg_greeting_audios_updated_at
  BEFORE UPDATE ON public.igreen_default_greeting_audios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Seed dos 2 slots
INSERT INTO public.igreen_default_greeting_audios (slot, transcript, delay_after_ms, enabled) VALUES
  (1, 'Oi, tudo bem? Olha só, por causa da Lei 14.300, que regulamentou a geração compartilhada de energia no Brasil, um benefício que antes era aproveitado principalmente por grandes empresas agora também está disponível para pessoas comuns e pequenos negócios. E funciona de um jeito bem simples, tá? Você continua recebendo energia normalmente da sua distribuidora, mas passa a utilizar créditos de energia gerados por usinas parceiras e, com isso, consegue pagar menos na conta de luz. E o melhor: sem instalar placas solares, sem obras e sem mudar nada no seu imóvel.', 0, true),
  (2, 'Agora, me fala rapidinho em qual estado você mora. Com essa informação, eu consigo fazer uma simulação personalizada e te mostrar uma estimativa da sua economia mensal e anual.', 10000, true);

-- 6) Storage policies no bucket igreen-audios
CREATE POLICY "igreen_audios_read_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'igreen-audios');

CREATE POLICY "igreen_audios_insert_super_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'igreen-audios' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "igreen_audios_update_super_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'igreen-audios' AND public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (bucket_id = 'igreen-audios' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "igreen_audios_delete_super_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'igreen-audios' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));
