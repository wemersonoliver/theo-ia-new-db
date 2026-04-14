-- Add voice columns to system_ai_config
ALTER TABLE public.system_ai_config
  ADD COLUMN IF NOT EXISTS voice_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_id text DEFAULT null;

-- Create ai_voice_usage table
CREATE TABLE IF NOT EXISTS public.ai_voice_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone text NOT NULL,
  characters_count integer NOT NULL,
  cost_cents integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'support',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_voice_usage ENABLE ROW LEVEL SECURITY;

-- Super admins can read all
CREATE POLICY "Super admins can read all voice usage"
  ON public.ai_voice_usage
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can insert (from edge functions via service role this is bypassed, but just in case)
CREATE POLICY "Super admins can insert voice usage"
  ON public.ai_voice_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Users can read their own
CREATE POLICY "Users can read own voice usage"
  ON public.ai_voice_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for queries
CREATE INDEX idx_ai_voice_usage_created_at ON public.ai_voice_usage (created_at DESC);
CREATE INDEX idx_ai_voice_usage_user_id ON public.ai_voice_usage (user_id);
CREATE INDEX idx_ai_voice_usage_source ON public.ai_voice_usage (source);