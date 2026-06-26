
-- Coluna toggle por conta
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS igreen_greeting_audio_enabled boolean NOT NULL DEFAULT false;

-- Tabela de áudios por conta
CREATE TABLE IF NOT EXISTS public.igreen_account_greeting_audios (
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot IN (1,2)),
  storage_path text,
  transcript text NOT NULL DEFAULT '',
  delay_after_ms integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.igreen_account_greeting_audios TO authenticated;
GRANT ALL ON public.igreen_account_greeting_audios TO service_role;

ALTER TABLE public.igreen_account_greeting_audios ENABLE ROW LEVEL SECURITY;

-- Membros da conta podem ler/escrever; super_admin idem.
CREATE POLICY "members read greeting audios"
  ON public.igreen_account_greeting_audios FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.account_members m
      WHERE m.account_id = igreen_account_greeting_audios.account_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = igreen_account_greeting_audios.account_id
        AND a.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "members write greeting audios"
  ON public.igreen_account_greeting_audios FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.account_members m
      WHERE m.account_id = igreen_account_greeting_audios.account_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = igreen_account_greeting_audios.account_id
        AND a.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.account_members m
      WHERE m.account_id = igreen_account_greeting_audios.account_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = igreen_account_greeting_audios.account_id
        AND a.owner_user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_igreen_account_greeting_audios_updated_at
  ON public.igreen_account_greeting_audios;
CREATE TRIGGER trg_igreen_account_greeting_audios_updated_at
  BEFORE UPDATE ON public.igreen_account_greeting_audios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS no Storage: bucket igreen-audios sob prefixo "{account_id}/..."
DROP POLICY IF EXISTS "igreen audios members read" ON storage.objects;
DROP POLICY IF EXISTS "igreen audios members write" ON storage.objects;
DROP POLICY IF EXISTS "igreen audios members update" ON storage.objects;
DROP POLICY IF EXISTS "igreen audios members delete" ON storage.objects;

CREATE POLICY "igreen audios members read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'igreen-audios' AND (
      public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.account_members m
        WHERE m.user_id = auth.uid()
          AND m.account_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.owner_user_id = auth.uid()
          AND a.id::text = split_part(name, '/', 1)
      )
    )
  );

CREATE POLICY "igreen audios members write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'igreen-audios' AND (
      public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.account_members m
        WHERE m.user_id = auth.uid()
          AND m.account_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.owner_user_id = auth.uid()
          AND a.id::text = split_part(name, '/', 1)
      )
    )
  );

CREATE POLICY "igreen audios members update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'igreen-audios' AND (
      public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.account_members m
        WHERE m.user_id = auth.uid()
          AND m.account_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.owner_user_id = auth.uid()
          AND a.id::text = split_part(name, '/', 1)
      )
    )
  );

CREATE POLICY "igreen audios members delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'igreen-audios' AND (
      public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.account_members m
        WHERE m.user_id = auth.uid()
          AND m.account_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.owner_user_id = auth.uid()
          AND a.id::text = split_part(name, '/', 1)
      )
    )
  );
