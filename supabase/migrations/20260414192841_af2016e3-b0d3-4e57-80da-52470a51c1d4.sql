ALTER TABLE public.system_ai_config 
  ADD COLUMN IF NOT EXISTS voice_speed numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS voice_stability numeric DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS voice_similarity_boost numeric DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS voice_style numeric DEFAULT 0.3;