ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS person_name text,
  ADD COLUMN IF NOT EXISTS person_name_checked_at timestamptz;