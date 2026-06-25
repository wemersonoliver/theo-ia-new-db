
CREATE TABLE public.igreen_default_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position integer NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  automation_tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position)
);

GRANT SELECT ON public.igreen_default_pipeline_stages TO authenticated;
GRANT ALL ON public.igreen_default_pipeline_stages TO service_role;

ALTER TABLE public.igreen_default_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read igreen pipeline template"
  ON public.igreen_default_pipeline_stages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Super admins manage igreen pipeline template"
  ON public.igreen_default_pipeline_stages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER igreen_default_pipeline_stages_updated_at
  BEFORE UPDATE ON public.igreen_default_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.igreen_default_pipeline_stages (name, position, color, automation_tag) VALUES
  ('Novo Lead',                   0, '#94a3b8', NULL),
  ('Iniciou atendimento',         1, '#60a5fa', 'em atendimento'),
  ('Enviou fatura de energia',    2, '#fbbf24', 'enviou fatura'),
  ('Enviou documento do titular', 3, '#f59e0b', 'enviou documento'),
  ('Atendimento humano',          4, '#a78bfa', 'atendimento humano'),
  ('Assinou contrato',            5, '#22c55e', 'assinou contrato'),
  ('Perdido',                     6, '#ef4444', NULL);

CREATE OR REPLACE FUNCTION public.provision_igreen_pipeline(_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pipe_id uuid;
  owner_id uuid;
  tpl record;
  stage_id uuid;
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

  FOR tpl IN
    SELECT name, position, color, automation_tag
      FROM public.igreen_default_pipeline_stages
     ORDER BY position
  LOOP
    SELECT id INTO stage_id
      FROM public.crm_stages
     WHERE pipeline_id = pipe_id AND lower(name) = lower(tpl.name)
     LIMIT 1;

    IF stage_id IS NULL THEN
      INSERT INTO public.crm_stages (pipeline_id, account_id, user_id, name, position, color)
      VALUES (pipe_id, _account_id, owner_id, tpl.name, tpl.position, tpl.color)
      RETURNING id INTO stage_id;
    ELSE
      UPDATE public.crm_stages
         SET position = tpl.position, color = tpl.color
       WHERE id = stage_id;
    END IF;

    IF tpl.automation_tag IS NOT NULL THEN
      INSERT INTO public.crm_tag_automations (account_id, pipeline_id, tag, target_stage_id, enabled)
      VALUES (_account_id, pipe_id, tpl.automation_tag, stage_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Remove etapas legadas vazias que não fazem parte do template
  DELETE FROM public.crm_stages s
   WHERE s.pipeline_id = pipe_id
     AND lower(s.name) NOT IN (SELECT lower(name) FROM public.igreen_default_pipeline_stages)
     AND NOT EXISTS (SELECT 1 FROM public.crm_deals d WHERE d.stage_id = s.id);
END;
$function$;
