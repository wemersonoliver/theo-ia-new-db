-- 1) Novas colunas em roulette_config
ALTER TABLE public.roulette_config
  ADD COLUMN IF NOT EXISTS require_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_timeout_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS online_threshold_seconds integer NOT NULL DEFAULT 120;

-- 2) Tabela de atribuições
CREATE TABLE IF NOT EXISTS public.roulette_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  contact_name text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 1,
  skipped_user_ids uuid[] NOT NULL DEFAULT '{}',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roulette_assignments_pending
  ON public.roulette_assignments (status, expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_roulette_assignments_account_phone
  ON public.roulette_assignments (account_id, phone);

ALTER TABLE public.roulette_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members read roulette assignments" ON public.roulette_assignments;
CREATE POLICY "Account members read roulette assignments"
  ON public.roulette_assignments FOR SELECT
  USING (public.is_account_member(account_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admin manages roulette assignments" ON public.roulette_assignments;
CREATE POLICY "Super admin manages roulette assignments"
  ON public.roulette_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_roulette_assignments_updated_at ON public.roulette_assignments;
CREATE TRIGGER trg_roulette_assignments_updated_at
  BEFORE UPDATE ON public.roulette_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Atualiza roulette_pick_next com filtros opcionais
CREATE OR REPLACE FUNCTION public.roulette_pick_next(
  _account_id uuid,
  _exclude_user_ids uuid[] DEFAULT '{}',
  _only_online boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD;
  candidates uuid[];
  next_user uuid;
  last_idx int;
  online_threshold int;
  enforce_online boolean;
BEGIN
  SELECT * INTO cfg FROM public.roulette_config WHERE account_id = _account_id;
  IF cfg IS NULL OR cfg.enabled IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  online_threshold := COALESCE(cfg.online_threshold_seconds, 120);
  enforce_online := COALESCE(_only_online, cfg.require_online, false);

  IF cfg.participant_user_ids IS NOT NULL AND array_length(cfg.participant_user_ids, 1) > 0 THEN
    SELECT COALESCE(array_agg(am.user_id ORDER BY am.invited_at), '{}'::uuid[])
      INTO candidates
      FROM public.account_members am
      WHERE am.account_id = _account_id
        AND am.status = 'active'
        AND am.user_id = ANY(cfg.participant_user_ids)
        AND (_exclude_user_ids IS NULL OR NOT (am.user_id = ANY(_exclude_user_ids)))
        AND (
          NOT enforce_online
          OR (am.last_seen_at IS NOT NULL
              AND am.last_seen_at > now() - make_interval(secs => online_threshold))
        );
  ELSE
    SELECT COALESCE(array_agg(am.user_id ORDER BY am.invited_at), '{}'::uuid[])
      INTO candidates
      FROM public.account_members am
      WHERE am.account_id = _account_id
        AND am.status = 'active'
        AND (_exclude_user_ids IS NULL OR NOT (am.user_id = ANY(_exclude_user_ids)))
        AND (
          NOT enforce_online
          OR (am.last_seen_at IS NOT NULL
              AND am.last_seen_at > now() - make_interval(secs => online_threshold))
        );
  END IF;

  IF candidates IS NULL OR array_length(candidates, 1) IS NULL OR array_length(candidates, 1) < 1 THEN
    RETURN NULL;
  END IF;

  IF array_length(candidates, 1) = 1 THEN
    next_user := candidates[1];
  ELSE
    IF cfg.last_assigned_user_id IS NULL THEN
      next_user := candidates[1];
    ELSE
      last_idx := array_position(candidates, cfg.last_assigned_user_id);
      IF last_idx IS NULL OR last_idx >= array_length(candidates, 1) THEN
        next_user := candidates[1];
      ELSE
        next_user := candidates[last_idx + 1];
      END IF;
    END IF;
  END IF;

  UPDATE public.roulette_config
     SET last_assigned_user_id = next_user,
         last_assigned_at = now(),
         updated_at = now()
   WHERE account_id = _account_id;

  RETURN next_user;
END;
$function$;

-- 4) Função para aceitar atribuição (chamada quando atendente envia mensagem)
CREATE OR REPLACE FUNCTION public.accept_roulette_assignment(_phone text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assignment_id uuid;
BEGIN
  UPDATE public.roulette_assignments
     SET status = 'accepted',
         accepted_at = now(),
         updated_at = now()
   WHERE phone = _phone
     AND user_id = _user_id
     AND status = 'pending'
   RETURNING id INTO assignment_id;

  RETURN assignment_id;
END;
$function$;
