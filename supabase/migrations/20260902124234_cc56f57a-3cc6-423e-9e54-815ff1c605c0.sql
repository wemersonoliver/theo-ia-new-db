CREATE TABLE public.catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  keywords text[] NOT NULL DEFAULT '{}',
  file_url text NOT NULL,
  file_path text,
  file_type text NOT NULL DEFAULT 'document',
  mime_type text,
  file_name text,
  caption text,
  enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogs TO authenticated;
GRANT ALL ON public.catalogs TO service_role;

ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view account catalogs"
ON public.catalogs FOR SELECT TO authenticated
USING (public.is_account_member(account_id));

CREATE POLICY "Members can create account catalogs"
ON public.catalogs FOR INSERT TO authenticated
WITH CHECK (public.is_account_member(account_id) AND user_id = auth.uid());

CREATE POLICY "Members can update account catalogs"
ON public.catalogs FOR UPDATE TO authenticated
USING (public.is_account_member(account_id))
WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Members can delete account catalogs"
ON public.catalogs FOR DELETE TO authenticated
USING (public.is_account_member(account_id));

CREATE INDEX idx_catalogs_account ON public.catalogs (account_id, position);

CREATE TRIGGER update_catalogs_updated_at
BEFORE UPDATE ON public.catalogs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();