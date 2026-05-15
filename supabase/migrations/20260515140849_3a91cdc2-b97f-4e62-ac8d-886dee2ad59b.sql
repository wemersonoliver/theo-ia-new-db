CREATE TABLE public.custom_followup_media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('audio','video','image','document','sticker')),
  url text NOT NULL,
  mime text,
  filename text,
  size_bytes bigint,
  tags text[] DEFAULT '{}',
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cfml_account ON public.custom_followup_media_library(account_id);
CREATE INDEX idx_cfml_type ON public.custom_followup_media_library(type);
CREATE INDEX idx_cfml_tags ON public.custom_followup_media_library USING GIN(tags);

ALTER TABLE public.custom_followup_media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select media library"
  ON public.custom_followup_media_library FOR SELECT
  USING (public.is_account_member(account_id));

CREATE POLICY "members insert media library"
  ON public.custom_followup_media_library FOR INSERT
  WITH CHECK (public.is_account_member(account_id) AND auth.uid() = user_id);

CREATE POLICY "members update media library"
  ON public.custom_followup_media_library FOR UPDATE
  USING (public.is_account_member(account_id));

CREATE POLICY "members delete media library"
  ON public.custom_followup_media_library FOR DELETE
  USING (public.is_account_member(account_id));

CREATE TRIGGER trg_cfml_updated_at
  BEFORE UPDATE ON public.custom_followup_media_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();