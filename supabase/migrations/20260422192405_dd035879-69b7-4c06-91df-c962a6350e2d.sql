-- Add profile picture columns
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS profile_picture_url text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS profile_picture_updated_at timestamptz;

ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS profile_picture_url text;
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS profile_picture_updated_at timestamptz;

-- Index for finding stale pictures in cron job
CREATE INDEX IF NOT EXISTS idx_contacts_picture_updated ON public.contacts(profile_picture_updated_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_conversations_picture_updated ON public.whatsapp_conversations(profile_picture_updated_at NULLS FIRST);