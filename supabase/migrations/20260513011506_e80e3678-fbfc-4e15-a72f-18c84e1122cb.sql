ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_processing_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_ai_processing_until
  ON public.whatsapp_conversations (ai_processing_until)
  WHERE ai_processing_until IS NOT NULL;

ALTER TABLE public.system_whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_processing_until timestamptz;