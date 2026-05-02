
-- Roleta de Atendimento (round-robin entre membros da account no handoff)
CREATE TABLE IF NOT EXISTS public.roulette_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  last_assigned_user_id uuid,
  last_assigned_at timestamptz,
  -- Lista opcional de user_ids participantes; se vazio/null, usa todos os membros ativos
  participant_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roulette_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read roulette config"
  ON public.roulette_config FOR SELECT
  USING (public.is_account_member(account_id));

CREATE POLICY "Owner manages roulette config"
  ON public.roulette_config FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER trg_roulette_config_updated_at
  BEFORE UPDATE ON public.roulette_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função round-robin: retorna o próximo user_id a receber atendimento
CREATE OR REPLACE FUNCTION public.roulette_pick_next(_account_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  candidates uuid[];
  next_user uuid;
  last_idx int;
BEGIN
  SELECT * INTO cfg FROM public.roulette_config WHERE account_id = _account_id;
  IF cfg IS NULL OR cfg.enabled IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  IF cfg.participant_user_ids IS NOT NULL AND array_length(cfg.participant_user_ids, 1) > 0 THEN
    -- Filtra apenas os que continuam ativos na conta
    SELECT COALESCE(array_agg(am.user_id ORDER BY am.invited_at), '{}'::uuid[])
      INTO candidates
      FROM public.account_members am
      WHERE am.account_id = _account_id
        AND am.status = 'active'
        AND am.user_id = ANY(cfg.participant_user_ids);
  ELSE
    SELECT COALESCE(array_agg(am.user_id ORDER BY am.invited_at), '{}'::uuid[])
      INTO candidates
      FROM public.account_members am
      WHERE am.account_id = _account_id
        AND am.status = 'active';
  END IF;

  IF candidates IS NULL OR array_length(candidates, 1) IS NULL OR array_length(candidates, 1) < 1 THEN
    RETURN NULL;
  END IF;

  -- Apenas um candidato: retorna ele
  IF array_length(candidates, 1) = 1 THEN
    next_user := candidates[1];
  ELSE
    -- Round-robin baseado no último atribuído
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
$$;
