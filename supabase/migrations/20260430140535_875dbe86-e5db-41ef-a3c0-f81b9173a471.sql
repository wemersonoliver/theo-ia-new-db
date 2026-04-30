
-- ============================================================
-- 1) Colunas auxiliares em followup_tracking e system_followup_tracking
-- ============================================================
ALTER TABLE public.followup_tracking
  ADD COLUMN IF NOT EXISTS sequence_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.system_followup_tracking
  ADD COLUMN IF NOT EXISTS sequence_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- ============================================================
-- 2) Tabela followup_messages (módulo cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.followup_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES public.followup_tracking(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  account_id uuid,
  phone text NOT NULL,
  step int NOT NULL,
  hook_used text,
  content text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followup_messages_tracking
  ON public.followup_messages(tracking_id);

CREATE INDEX IF NOT EXISTS idx_followup_messages_due
  ON public.followup_messages(scheduled_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_followup_messages_user_phone
  ON public.followup_messages(user_id, phone);

ALTER TABLE public.followup_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own followup messages" ON public.followup_messages;
CREATE POLICY "Users manage own followup messages"
  ON public.followup_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins manage all followup messages" ON public.followup_messages;
CREATE POLICY "Super admins manage all followup messages"
  ON public.followup_messages
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- ============================================================
-- 3) Tabela system_followup_messages (módulo suporte)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_followup_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES public.system_followup_tracking(id) ON DELETE CASCADE,
  phone text NOT NULL,
  step int NOT NULL,
  hook_used text,
  content text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_followup_messages_tracking
  ON public.system_followup_messages(tracking_id);

CREATE INDEX IF NOT EXISTS idx_system_followup_messages_due
  ON public.system_followup_messages(scheduled_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_followup_messages_phone
  ON public.system_followup_messages(phone);

ALTER TABLE public.system_followup_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage system followup messages" ON public.system_followup_messages;
CREATE POLICY "Super admins manage system followup messages"
  ON public.system_followup_messages
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- ============================================================
-- 4) Função: cancela a sequência atomicamente (módulo cliente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_followup_sequence(
  p_user_id uuid,
  p_phone text,
  p_reason text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int := 0;
BEGIN
  -- Marca trackings ativos como engaged/handoff
  UPDATE public.followup_tracking
     SET status = CASE
                    WHEN p_reason = 'handoff' THEN 'declined'
                    ELSE 'engaged'
                  END,
         cancellation_reason = p_reason,
         updated_at = now()
   WHERE user_id = p_user_id
     AND phone = p_phone
     AND status IN ('pending', 'scheduled');

  -- Apaga mensagens futuras ainda não enviadas
  WITH deleted AS (
    DELETE FROM public.followup_messages m
     USING public.followup_tracking t
     WHERE m.tracking_id = t.id
       AND t.user_id = p_user_id
       AND t.phone = p_phone
       AND m.sent_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

-- ============================================================
-- 5) Função: cancela sequência do módulo suporte
-- ============================================================
CREATE OR REPLACE FUNCTION public.system_cancel_followup_sequence(
  p_phone text,
  p_reason text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int := 0;
BEGIN
  UPDATE public.system_followup_tracking
     SET status = CASE
                    WHEN p_reason = 'handoff' THEN 'declined'
                    ELSE 'engaged'
                  END,
         cancellation_reason = p_reason,
         updated_at = now()
   WHERE phone = p_phone
     AND status IN ('pending', 'scheduled');

  WITH deleted AS (
    DELETE FROM public.system_followup_messages m
     USING public.system_followup_tracking t
     WHERE m.tracking_id = t.id
       AND t.phone = p_phone
       AND m.sent_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;
