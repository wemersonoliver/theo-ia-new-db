ALTER TABLE public.whatsapp_ai_config
ADD COLUMN IF NOT EXISTS business_niche text,
ADD COLUMN IF NOT EXISTS business_description text;