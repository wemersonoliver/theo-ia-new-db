ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill: assume existing ones were user-created (safest default)
UPDATE public.appointments SET created_by = user_id WHERE created_by IS NULL;

COMMENT ON COLUMN public.appointments.created_via IS 'Origem: ai | user | system';
COMMENT ON COLUMN public.appointments.created_by IS 'Usuario que criou (null quando IA/system)';