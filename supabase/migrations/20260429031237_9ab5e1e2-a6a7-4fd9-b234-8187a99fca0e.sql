CREATE TABLE public.ai_pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gemini_text_input_per_1k_cents numeric(12,4) NOT NULL DEFAULT 0.075,
  gemini_text_output_per_1k_cents numeric(12,4) NOT NULL DEFAULT 0.30,
  gemini_vision_per_image_cents numeric(12,4) NOT NULL DEFAULT 1.5,
  groq_audio_per_minute_cents numeric(12,4) NOT NULL DEFAULT 0.5,
  suggested_margin_percent numeric(6,2) NOT NULL DEFAULT 200,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.ai_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pricing"
ON public.ai_pricing_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins manage pricing"
ON public.ai_pricing_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.ai_pricing_config DEFAULT VALUES;

CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text','audio','image')),
  source text,
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  audio_seconds integer NOT NULL DEFAULT 0,
  image_count integer NOT NULL DEFAULT 0,
  cost_cents numeric(12,4) NOT NULL DEFAULT 0,
  reference_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_user_created ON public.ai_usage_log(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_created ON public.ai_usage_log(created_at DESC);
CREATE INDEX idx_ai_usage_log_kind ON public.ai_usage_log(kind);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own usage"
ON public.ai_usage_log FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins manage usage"
ON public.ai_usage_log FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed retroativo a partir do array jsonb messages[] em whatsapp_conversations.
-- Estima tokens = chars/4. direction (sender/from): 'user'/'contact' => input; 'ai'/'assistant'/'bot'/'me' => output.
DO $$
DECLARE
  pin numeric; pout numeric;
BEGIN
  SELECT gemini_text_input_per_1k_cents, gemini_text_output_per_1k_cents
    INTO pin, pout
  FROM public.ai_pricing_config LIMIT 1;

  INSERT INTO public.ai_usage_log
    (user_id, kind, source, tokens_input, tokens_output, cost_cents, reference_id, created_at, metadata)
  SELECT
    c.user_id,
    'text',
    'historical-seed',
    CASE WHEN is_input THEN GREATEST(1, CEIL(LENGTH(msg_text)::numeric / 4))::int ELSE 0 END,
    CASE WHEN is_input THEN 0 ELSE GREATEST(1, CEIL(LENGTH(msg_text)::numeric / 4))::int END,
    CASE WHEN is_input
         THEN (GREATEST(1, CEIL(LENGTH(msg_text)::numeric / 4)) / 1000.0) * pin
         ELSE (GREATEST(1, CEIL(LENGTH(msg_text)::numeric / 4)) / 1000.0) * pout
    END,
    c.phone,
    COALESCE(msg_ts, c.created_at),
    jsonb_build_object('historical', true, 'sender', sender_val)
  FROM public.whatsapp_conversations c
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.messages, '[]'::jsonb)) AS m(elem)
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(elem->>'text', elem->>'message', elem->>'content', '') AS msg_text,
      LOWER(COALESCE(elem->>'sender', elem->>'from', elem->>'role', elem->>'direction', '')) AS sender_val,
      NULLIF(elem->>'timestamp','')::timestamptz AS msg_ts
  ) AS parsed
  CROSS JOIN LATERAL (
    SELECT (sender_val IN ('user','contact','client','customer','in','received','recebida')) AS is_input
  ) AS dir
  WHERE c.user_id IS NOT NULL
    AND LENGTH(msg_text) > 0
    AND LENGTH(msg_text) < 50000;
END $$;
