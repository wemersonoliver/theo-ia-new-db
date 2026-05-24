CREATE OR REPLACE FUNCTION public.provision_igreen_pipeline(_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pipe_id uuid;
  owner_id uuid;
  s_novo uuid;
  s_atend uuid;
  s_fatura uuid;
  s_doc uuid;
  s_humano uuid;
  s_contrato uuid;
  s_perdido uuid;
BEGIN
  SELECT owner_user_id INTO owner_id FROM public.accounts WHERE id = _account_id;
  IF owner_id IS NULL THEN RETURN; END IF;

  SELECT id INTO pipe_id FROM public.crm_pipelines
   WHERE account_id = _account_id AND lower(name) = 'vendas'
   ORDER BY created_at ASC LIMIT 1;

  IF pipe_id IS NULL THEN
    INSERT INTO public.crm_pipelines (account_id, user_id, name, position)
    VALUES (_account_id, owner_id, 'Vendas', 0)
    RETURNING id INTO pipe_id;
  END IF;

  SELECT id INTO s_novo FROM public.crm_stages WHERE pipeline_id = pipe_id AND lower(name) = 'novo lead' LIMIT 1;
  IF s_novo IS NULL THEN
    INSERT INTO public.crm_stages (pipeline_id, account_id, user_id, name, position, color)
    VALUES (pipe_id, _account_id, owner_id, 'Novo Lead', 0, '#94a3b8') RETURNING id INTO s_novo;
  ELSE
    UPDATE public.crm_stages SET position = 0 WHERE id = s_novo;
  END IF;

  SELECT id INTO s_atend FROM public.crm_stages WHERE pipeline_id = pipe_id AND lower(name) = 'iniciou atendimento' LIMIT 1;
  IF s_atend IS NULL THEN
    INSERT INTO public.crm_stages (pipeline_id, account_id, user_id, name, position, color)
    VALUES (pipe_id, _account_id, owner_id, 'Iniciou atendimento', 1, '#60a5fa') RETURNING id INTO s_atend;
  ELSE
    UPDATE public.crm_stages SET position = 1 WHERE id = s_atend;
  END IF;

  SELECT id INTO s_fatura FROM public.crm_stages WHERE pipeline_id = pipe_id AND lower(name) = 'enviou fatura de energia' LIMIT 1;
  IF s_fatura IS NULL THEN
    INSERT INTO public.crm_stages (pipeline_id, account_id, user_id, name, position, color)
    VALUES (pipe_id, _account_id, owner_id, 'Enviou fatura de energia', 2, '#fbbf24') RETURNING id INTO s_fatura;
  ELSE
    UPDATE public.crm_stages SET position = 2 WHERE id = s_fatura;
  END IF;

  SELECT id INTO s_doc FROM public.crm_stages WHERE pipeline_id = pipe_id AND lower(name) = 'enviou documento do titular' LIMIT 1;
  IF s_doc IS NULL THEN
    INSERT INTO public.crm_stages (pipeline_id, account_id, user_id, name, position, color)
    VALUES (pipe_id, _account_id, owner_id, 'Enviou documento do titular', 3, '#f59e0b') RETURNING id INTO s_doc;
  ELSE
    UPDATE public.crm_stages SET position = 3 WHERE id = s_doc;
  END IF;

  SELECT id INTO s_humano FROM public.crm_stages WHERE pipeline_id = pipe_id AND lower(name) = 'atendimento humano' LIMIT 1;
  IF s_humano IS NULL THEN
    INSERT INTO public.crm_stages (pipeline_id, account_id, user_id, name, position, color)
    VALUES (pipe_id, _account_id, owner_id, 'Atendimento Humano', 4, '#a78bfa') RETURNING id INTO s_humano;
  ELSE
    UPDATE public.crm_stages SET position = 4 WHERE id = s_humano;
  END IF;

  SELECT id INTO s_contrato FROM public.crm_stages WHERE pipeline_id = pipe_id AND lower(name) IN ('assinou contrato','fechado/ganho','ganho') LIMIT 1;
  IF s_contrato IS NULL THEN
    INSERT INTO public.crm_stages (pipeline_id, account_id, user_id, name, position, color)
    VALUES (pipe_id, _account_id, owner_id, 'Assinou contrato', 5, '#22c55e') RETURNING id INTO s_contrato;
  ELSE
    UPDATE public.crm_stages SET name = 'Assinou contrato', position = 5 WHERE id = s_contrato;
  END IF;

  SELECT id INTO s_perdido FROM public.crm_stages WHERE pipeline_id = pipe_id AND lower(name) = 'perdido' LIMIT 1;
  IF s_perdido IS NULL THEN
    INSERT INTO public.crm_stages (pipeline_id, account_id, user_id, name, position, color)
    VALUES (pipe_id, _account_id, owner_id, 'Perdido', 6, '#ef4444') RETURNING id INTO s_perdido;
  ELSE
    UPDATE public.crm_stages SET position = 6 WHERE id = s_perdido;
  END IF;

  DELETE FROM public.crm_stages
   WHERE pipeline_id = pipe_id
     AND lower(name) IN ('qualificado','proposta','negociação','negociacao','fechado/ganho')
     AND NOT EXISTS (SELECT 1 FROM public.crm_deals d WHERE d.stage_id = crm_stages.id);

  INSERT INTO public.crm_tag_automations (account_id, pipeline_id, tag, target_stage_id, enabled)
  VALUES
    (_account_id, pipe_id, 'em atendimento', s_atend, true),
    (_account_id, pipe_id, 'enviou fatura', s_fatura, true),
    (_account_id, pipe_id, 'enviou documento', s_doc, true),
    (_account_id, pipe_id, 'atendimento humano', s_humano, true),
    (_account_id, pipe_id, 'assinou contrato', s_contrato, true)
  ON CONFLICT DO NOTHING;
END;
$$;

DO $$
DECLARE acc RECORD;
BEGIN
  FOR acc IN SELECT id FROM public.accounts WHERE is_igreen = true LOOP
    PERFORM public.provision_igreen_pipeline(acc.id);
  END LOOP;
END $$;