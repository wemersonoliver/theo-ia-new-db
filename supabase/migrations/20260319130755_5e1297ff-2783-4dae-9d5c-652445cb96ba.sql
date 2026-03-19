ALTER TABLE public.whatsapp_ai_config
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS business_latitude double precision,
  ADD COLUMN IF NOT EXISTS business_longitude double precision,
  ADD COLUMN IF NOT EXISTS business_location_name text;