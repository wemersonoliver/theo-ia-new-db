
-- =====================================================
-- 1) crm_tag_automations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.crm_tag_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  tag text NOT NULL,
  target_stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, pipeline_id, tag)
);

ALTER TABLE public.crm_tag_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage tag automations"
ON public.crm_tag_automations
FOR ALL TO authenticated
USING (public.is_account_member(account_id) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
WITH CHECK (public.is_account_member(account_id) OR public.has_role(auth.uid(),'super_admin'::public.app_role));

CREATE TRIGGER trg_tag_automations_updated
BEFORE UPDATE ON public.crm_tag_automations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tag_automations_account_tag
  ON public.crm_tag_automations(account_id, lower(tag));

-- =====================================================
-- 2) igreen_lead_data
-- =====================================================
CREATE TABLE IF NOT EXISTS public.igreen_lead_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  estado text,
  distribuidora text,
  tipo_conta text,
  nome_cliente text,
  nome_titular_fatura text,
  cpf_titular_fatura_masked text,
  valor_fatura_cents integer,
  nome_documento text,
  cpf_documento_masked text,
  fatura_url text,
  documento_url text,
  titular_confirmado boolean DEFAULT false,
  nomes_conferem boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, phone)
);

ALTER TABLE public.igreen_lead_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage igreen lead data"
ON public.igreen_lead_data
FOR ALL TO authenticated
USING (public.is_account_member(account_id) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
WITH CHECK (public.is_account_member(account_id) OR public.has_role(auth.uid(),'super_admin'::public.app_role));

CREATE TRIGGER trg_igreen_lead_data_updated
BEFORE UPDATE ON public.igreen_lead_data
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3) Função aplicar automações por tag
-- =====================================================
CREATE OR REPLACE FUNCTION public.apply_tag_automation_for_contact(
  _account_id uuid,
  _contact_id uuid,
  _new_tags text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tag_lower text;
  auto_rec RECORD;
  deal_rec RECORD;
  current_pos int;
  target_pos int;
  new_position int;
BEGIN
  IF _new_tags IS NULL OR array_length(_new_tags,1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH tag_lower IN ARRAY (SELECT array_agg(lower(t)) FROM unnest(_new_tags) t) LOOP
    FOR auto_rec IN
      SELECT a.target_stage_id, s.position AS target_position, s.pipeline_id
        FROM public.crm_tag_automations a
        JOIN public.crm_stages s ON s.id = a.target_stage_id
       WHERE a.account_id = _account_id
         AND a.enabled = true
         AND lower(a.tag) = tag_lower
    LOOP
      -- Localiza deal ativo do contato no pipeline da automação
      SELECT d.id, d.stage_id, st.position
        INTO deal_rec
        FROM public.crm_deals d
        JOIN public.crm_stages st ON st.id = d.stage_id
       WHERE d.contact_id = _contact_id
         AND d.account_id = _account_id
         AND d.won_at IS NULL
         AND d.lost_at IS NULL
         AND st.pipeline_id = auto_rec.pipeline_id
       ORDER BY d.updated_at DESC
       LIMIT 1;

      IF deal_rec.id IS NULL THEN CONTINUE; END IF;
      IF deal_rec.position >= auto_rec.target_position THEN CONTINUE; END IF;

      SELECT COALESCE(MAX(position),-1)+1 INTO new_position
        FROM public.crm_deals WHERE stage_id = auto_rec.target_stage_id;

      UPDATE public.crm_deals
         SET stage_id = auto_rec.target_stage_id,
             position = new_position,
             updated_at = now()
       WHERE id = deal_rec.id;

      INSERT INTO public.crm_activities (account_id, user_id, deal_id, type, content, metadata)
      SELECT d.account_id, d.assigned_to, d.id, 'stage_change',
             'Movido automaticamente pela tag "' || tag_lower || '"',
             jsonb_build_object('tag', tag_lower, 'automation', true)
        FROM public.crm_deals d WHERE d.id = deal_rec.id;
    END LOOP;
  END LOOP;
END;
$$;

-- Trigger em contacts: dispara quando tags muda
CREATE OR REPLACE FUNCTION public.trg_contacts_tag_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  added text[];
BEGIN
  IF NEW.tags IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    added := NEW.tags;
  ELSE
    SELECT COALESCE(array_agg(t), '{}'::text[])
      INTO added
      FROM unnest(NEW.tags) t
     WHERE NOT (t = ANY(COALESCE(OLD.tags,'{}'::text[])));
  END IF;

  IF added IS NULL OR array_length(added,1) IS NULL THEN RETURN NEW; END IF;
  PERFORM public.apply_tag_automation_for_contact(NEW.account_id, NEW.id, added);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_apply_tag_automation ON public.contacts;
CREATE TRIGGER trg_contacts_apply_tag_automation
AFTER INSERT OR UPDATE OF tags ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.trg_contacts_tag_automation();

-- =====================================================
-- 4) Seed das 3 automações padrão para contas existentes
-- =====================================================
INSERT INTO public.crm_tag_automations (account_id, pipeline_id, tag, target_stage_id)
SELECT s.account_id, s.pipeline_id, 'em atendimento', s.id
  FROM public.crm_stages s
 WHERE lower(s.name) = 'iniciou atendimento'
ON CONFLICT (account_id, pipeline_id, tag) DO NOTHING;

INSERT INTO public.crm_tag_automations (account_id, pipeline_id, tag, target_stage_id)
SELECT s.account_id, s.pipeline_id, 'enviou fatura', s.id
  FROM public.crm_stages s
 WHERE lower(s.name) IN ('enviou fatura', 'enviou fatura de energia')
ON CONFLICT (account_id, pipeline_id, tag) DO NOTHING;

INSERT INTO public.crm_tag_automations (account_id, pipeline_id, tag, target_stage_id)
SELECT s.account_id, s.pipeline_id, 'enviou documento', s.id
  FROM public.crm_stages s
 WHERE lower(s.name) IN ('enviou documento', 'enviou documento do titular', 'enviou documento de identificação')
ON CONFLICT (account_id, pipeline_id, tag) DO NOTHING;
