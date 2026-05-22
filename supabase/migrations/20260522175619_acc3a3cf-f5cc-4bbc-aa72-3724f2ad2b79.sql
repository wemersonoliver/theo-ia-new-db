ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS initial_sync_completed_at timestamptz;