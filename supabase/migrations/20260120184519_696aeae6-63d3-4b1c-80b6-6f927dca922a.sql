-- Add columns for keyword-based AI activation
ALTER TABLE public.whatsapp_ai_config 
ADD COLUMN trigger_keywords text[] DEFAULT '{}',
ADD COLUMN keyword_activation_enabled boolean DEFAULT false;