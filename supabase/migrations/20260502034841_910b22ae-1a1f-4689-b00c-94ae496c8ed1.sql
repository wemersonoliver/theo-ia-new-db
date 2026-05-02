
-- 1. Campos de outcome em whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_reason text,
  ADD COLUMN IF NOT EXISTS outcome_value_cents integer,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_outcome_check;
ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('won','lost','abandoned'));

CREATE INDEX IF NOT EXISTS idx_wa_conv_account_closed_at ON public.whatsapp_conversations(account_id, closed_at);
CREATE INDEX IF NOT EXISTS idx_wa_conv_account_outcome  ON public.whatsapp_conversations(account_id, outcome);

-- 2. Garantir etapas Ganho e Perdido em cada pipeline existente
DO $$
DECLARE
  p RECORD;
  next_pos integer;
BEGIN
  FOR p IN SELECT id, account_id, user_id FROM public.crm_pipelines LOOP
    SELECT COALESCE(MAX(position), -1) + 1 INTO next_pos FROM public.crm_stages WHERE pipeline_id = p.id;
    IF NOT EXISTS (
      SELECT 1 FROM public.crm_stages
      WHERE pipeline_id = p.id AND lower(name) IN ('ganho','fechado/ganho','won','venda')
    ) THEN
      INSERT INTO public.crm_stages (pipeline_id, user_id, account_id, name, color, position)
      VALUES (p.id, p.user_id, p.account_id, 'Ganho', '#10b981', next_pos);
      next_pos := next_pos + 1;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.crm_stages
      WHERE pipeline_id = p.id AND lower(name) IN ('perdido','lost')
    ) THEN
      INSERT INTO public.crm_stages (pipeline_id, user_id, account_id, name, color, position)
      VALUES (p.id, p.user_id, p.account_id, 'Perdido', '#ef4444', next_pos);
    END IF;
  END LOOP;
END $$;

-- 3. RPC para finalizar atendimento atomicamente
CREATE OR REPLACE FUNCTION public.finalize_conversation(
  _conversation_id uuid,
  _outcome text,
  _reason text DEFAULT NULL,
  _value_cents integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv RECORD;
  contact_rec RECORD;
  deal_rec RECORD;
  target_stage_id uuid;
  target_stage_name text;
  caller_role public.account_role;
BEGIN
  IF _outcome NOT IN ('won','lost','abandoned') THEN
    RAISE EXCEPTION 'Classificação inválida (use won, lost ou abandoned)';
  END IF;

  IF _outcome = 'lost' AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN
    RAISE EXCEPTION 'Motivo é obrigatório para atendimentos perdidos';
  END IF;

  SELECT * INTO conv FROM public.whatsapp_conversations WHERE id = _conversation_id;
  IF conv IS NULL THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  -- Permissão: assigned_to OU owner/manager OU super_admin
  SELECT role INTO caller_role FROM public.account_members
   WHERE account_id = conv.account_id AND user_id = auth.uid() AND status = 'active'
   LIMIT 1;

  IF NOT (
    conv.assigned_to = auth.uid()
    OR caller_role IN ('owner','manager')
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar este atendimento';
  END IF;

  -- Atualiza a conversa
  UPDATE public.whatsapp_conversations
     SET outcome = _outcome,
         outcome_reason = NULLIF(trim(coalesce(_reason,'')), ''),
         outcome_value_cents = CASE WHEN _outcome = 'won' THEN _value_cents ELSE NULL END,
         closed_at = now(),
         closed_by = auth.uid(),
         ai_active = false,
         updated_at = now()
   WHERE id = _conversation_id;

  -- Localiza contato + deal ativo
  SELECT * INTO contact_rec
    FROM public.contacts
   WHERE account_id = conv.account_id AND phone = conv.phone
   ORDER BY updated_at DESC
   LIMIT 1;

  IF contact_rec.id IS NOT NULL THEN
    SELECT d.* INTO deal_rec
      FROM public.crm_deals d
     WHERE d.account_id = conv.account_id
       AND d.contact_id = contact_rec.id
       AND d.won_at IS NULL
       AND d.lost_at IS NULL
     ORDER BY d.updated_at DESC
     LIMIT 1;

    IF deal_rec.id IS NOT NULL THEN
      target_stage_name := CASE WHEN _outcome = 'won' THEN 'ganho' ELSE 'perdido' END;
      SELECT s.id INTO target_stage_id
        FROM public.crm_stages s
        JOIN public.crm_pipelines p ON p.id = s.pipeline_id
       WHERE p.account_id = conv.account_id
         AND s.pipeline_id = (SELECT pipeline_id FROM public.crm_stages WHERE id = deal_rec.stage_id)
         AND lower(s.name) = target_stage_name
       LIMIT 1;

      IF target_stage_id IS NULL THEN
        SELECT s.id INTO target_stage_id
          FROM public.crm_stages s
         WHERE s.pipeline_id = (SELECT pipeline_id FROM public.crm_stages WHERE id = deal_rec.stage_id)
           AND lower(s.name) LIKE CASE WHEN _outcome='won' THEN '%ganho%' ELSE '%perdido%' END
         LIMIT 1;
      END IF;

      IF target_stage_id IS NOT NULL THEN
        UPDATE public.crm_deals
           SET stage_id = target_stage_id,
               won_at = CASE WHEN _outcome = 'won' THEN now() ELSE won_at END,
               lost_at = CASE WHEN _outcome IN ('lost','abandoned') THEN now() ELSE lost_at END,
               lost_reason = CASE
                                WHEN _outcome = 'abandoned' THEN COALESCE('Desistência: ' || NULLIF(trim(coalesce(_reason,'')),''), 'Desistência')
                                WHEN _outcome = 'lost' THEN _reason
                                ELSE lost_reason
                             END,
               value_cents = CASE WHEN _outcome = 'won' AND _value_cents IS NOT NULL THEN _value_cents ELSE value_cents END,
               updated_at = now()
         WHERE id = deal_rec.id;
      END IF;

      INSERT INTO public.crm_activities (account_id, user_id, deal_id, type, content, metadata)
      VALUES (
        conv.account_id,
        auth.uid(),
        deal_rec.id,
        'outcome',
        'Atendimento finalizado como ' || _outcome || COALESCE(' — ' || _reason, ''),
        jsonb_build_object('outcome', _outcome, 'value_cents', _value_cents, 'conversation_id', _conversation_id)
      );
    END IF;
  END IF;

  -- Cancela follow-up
  PERFORM public.cancel_followup_sequence(conv.user_id, conv.phone, 'handoff');

  RETURN _conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_conversation(uuid, text, text, integer) TO authenticated;

-- RPC para reabrir (somente owner/manager/super_admin)
CREATE OR REPLACE FUNCTION public.reopen_conversation(_conversation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv RECORD;
  caller_role public.account_role;
BEGIN
  SELECT * INTO conv FROM public.whatsapp_conversations WHERE id = _conversation_id;
  IF conv IS NULL THEN RAISE EXCEPTION 'Conversa não encontrada'; END IF;

  SELECT role INTO caller_role FROM public.account_members
   WHERE account_id = conv.account_id AND user_id = auth.uid() AND status = 'active'
   LIMIT 1;

  IF NOT (caller_role IN ('owner','manager') OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para reabrir';
  END IF;

  UPDATE public.whatsapp_conversations
     SET outcome = NULL, outcome_reason = NULL, outcome_value_cents = NULL,
         closed_at = NULL, closed_by = NULL, updated_at = now()
   WHERE id = _conversation_id;

  RETURN _conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_conversation(uuid) TO authenticated;
