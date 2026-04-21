-- Função que avalia se o usuário cumpriu os 3 critérios e move o card para "Trial"
CREATE OR REPLACE FUNCTION public.auto_advance_admin_deal_to_trial(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  onboarding_ok boolean;
  ai_ok boolean;
  wa_ok boolean;
  trial_stage_id uuid;
  current_stage_position integer;
  trial_stage_position integer;
  current_pipeline_id uuid;
  new_position integer;
  deal_record RECORD;
BEGIN
  -- 1. Onboarding completo
  SELECT COALESCE(onboarding_completed, false) INTO onboarding_ok
  FROM public.profiles WHERE user_id = _user_id;

  IF NOT COALESCE(onboarding_ok, false) THEN RETURN; END IF;

  -- 2. IA configurada (custom_prompt preenchido) E ativa
  SELECT (active = true AND custom_prompt IS NOT NULL AND length(trim(custom_prompt)) > 0)
  INTO ai_ok
  FROM public.whatsapp_ai_config WHERE user_id = _user_id;

  IF NOT COALESCE(ai_ok, false) THEN RETURN; END IF;

  -- 3. WhatsApp conectado
  SELECT (status = 'connected') INTO wa_ok
  FROM public.whatsapp_instances WHERE user_id = _user_id;

  IF NOT COALESCE(wa_ok, false) THEN RETURN; END IF;

  -- Busca o deal do usuário
  SELECT d.id, d.stage_id, s.position, s.pipeline_id
  INTO deal_record
  FROM public.admin_crm_deals d
  JOIN public.admin_crm_stages s ON s.id = d.stage_id
  WHERE d.user_ref_id = _user_id
  LIMIT 1;

  IF deal_record.id IS NULL THEN RETURN; END IF;

  -- Busca a etapa "Trial" no mesmo pipeline
  SELECT id, position INTO trial_stage_id, trial_stage_position
  FROM public.admin_crm_stages
  WHERE pipeline_id = deal_record.pipeline_id
    AND lower(name) = 'trial'
  LIMIT 1;

  IF trial_stage_id IS NULL THEN RETURN; END IF;

  -- Só avança (não retrocede) e ignora se já passou da etapa Trial
  IF deal_record.position >= trial_stage_position THEN RETURN; END IF;

  -- Calcula nova posição (final da coluna Trial)
  SELECT COALESCE(MAX(position), -1) + 1 INTO new_position
  FROM public.admin_crm_deals WHERE stage_id = trial_stage_id;

  UPDATE public.admin_crm_deals
  SET stage_id = trial_stage_id,
      position = new_position,
      onboarding_completed = true,
      updated_at = now()
  WHERE id = deal_record.id;
END;
$$;

-- Trigger functions para cada tabela monitorada
CREATE OR REPLACE FUNCTION public.trg_advance_deal_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.onboarding_completed = true AND (TG_OP = 'INSERT' OR OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed) THEN
    PERFORM public.auto_advance_admin_deal_to_trial(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_advance_deal_from_ai_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.auto_advance_admin_deal_to_trial(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_advance_deal_from_whatsapp_instance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'connected' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.auto_advance_admin_deal_to_trial(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Recria triggers
DROP TRIGGER IF EXISTS auto_advance_deal_on_profile ON public.profiles;
CREATE TRIGGER auto_advance_deal_on_profile
AFTER INSERT OR UPDATE OF onboarding_completed ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_advance_deal_from_profile();

DROP TRIGGER IF EXISTS auto_advance_deal_on_ai_config ON public.whatsapp_ai_config;
CREATE TRIGGER auto_advance_deal_on_ai_config
AFTER INSERT OR UPDATE OF active, custom_prompt ON public.whatsapp_ai_config
FOR EACH ROW EXECUTE FUNCTION public.trg_advance_deal_from_ai_config();

DROP TRIGGER IF EXISTS auto_advance_deal_on_whatsapp_instance ON public.whatsapp_instances;
CREATE TRIGGER auto_advance_deal_on_whatsapp_instance
AFTER INSERT OR UPDATE OF status ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.trg_advance_deal_from_whatsapp_instance();

-- Backfill: aplica nas contas existentes que já cumprem os 3 critérios
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.profiles WHERE user_id IS NOT NULL LOOP
    PERFORM public.auto_advance_admin_deal_to_trial(u.user_id);
  END LOOP;
END $$;