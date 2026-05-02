ALTER TABLE public.system_whatsapp_conversations 
ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
ADD COLUMN IF NOT EXISTS finalized_by uuid;