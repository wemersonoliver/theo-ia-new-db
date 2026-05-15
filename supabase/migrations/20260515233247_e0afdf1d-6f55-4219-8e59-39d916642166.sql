
-- Função principal: recalcula stage do deal com base no estado real do usuário
CREATE OR REPLACE FUNCTION public.recalc_admin_deal_stage(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deal_rec RECORD;
  pipeline_id_v uuid;
  has_active_sub boolean;
  wa_connected boolean;
  onboarding_ok boolean;
  target_stage_name text;
  target_stage_id uuid;
  current_stage_name text;
  new_position int;
BEGIN
  -- Localiza deal do usuário
  SELECT d.id, d.stage_id, s.pipeline_id, s.name AS stage_name
  INTO deal_rec
  FROM public.admin_crm_deals d
  JOIN public.admin_crm_stages s ON s.id = d.stage_id
  WHERE d.user_ref_id = _user_id
  LIMIT 1;

  IF deal_rec.id IS NULL THEN RETURN; END IF;

  current_stage_name := lower(deal_rec.stage_name);

  -- Não mexe se já está em estados manuais/finais
  IF current_stage_name IN ('cancelado', 'cancelada', 'churn', 'perdido') THEN
    RETURN;
  END IF;

  -- Coleta estados
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO has_active_sub;

  SELECT EXISTS(
    SELECT 1 FROM public.whatsapp_instances
    WHERE user_id = _user_id AND status IN ('connected','open')
  ) INTO wa_connected;

  SELECT COALESCE(onboarding_completed, false) INTO onboarding_ok
  FROM public.profiles WHERE user_id = _user_id;

  -- Decide etapa alvo
  IF has_active_sub THEN
    target_stage_name := 'assinante ativo';
  ELSIF wa_connected THEN
    target_stage_name := 'trial';
  ELSIF onboarding_ok THEN
    target_stage_name := 'onboarding concluído';
  ELSE
    target_stage_name := 'novo cadastro';
  END IF;

  -- Já está na etapa correta?
  IF current_stage_name = target_stage_name THEN
    RETURN;
  END IF;

  -- Localiza id da etapa alvo no mesmo pipeline (match exato ou por LIKE)
  SELECT id INTO target_stage_id
  FROM public.admin_crm_stages
  WHERE pipeline_id = deal_rec.pipeline_id
    AND lower(name) = target_stage_name
  LIMIT 1;

  IF target_stage_id IS NULL THEN
    SELECT id INTO target_stage_id
    FROM public.admin_crm_stages
    WHERE pipeline_id = deal_rec.pipeline_id
      AND lower(name) LIKE '%' || split_part(target_stage_name,' ',1) || '%'
    LIMIT 1;
  END IF;

  IF target_stage_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(position), -1) + 1 INTO new_position
  FROM public.admin_crm_deals WHERE stage_id = target_stage_id;

  UPDATE public.admin_crm_deals
  SET stage_id = target_stage_id,
      position = new_position,
      onboarding_completed = onboarding_ok,
      subscription_status = CASE WHEN has_active_sub THEN 'active' ELSE subscription_status END,
      updated_at = now()
  WHERE id = deal_rec.id;
END;
$$;

-- Triggers wrappers
CREATE OR REPLACE FUNCTION public.trg_recalc_deal_from_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recalc_admin_deal_stage(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_deal_from_wa_instance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recalc_admin_deal_stage(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_deal_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recalc_admin_deal_stage(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_recalc_admin_deal ON public.subscriptions;
CREATE TRIGGER subscriptions_recalc_admin_deal
AFTER INSERT OR UPDATE OF status, expires_at OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_deal_from_subscription();

DROP TRIGGER IF EXISTS whatsapp_instances_recalc_admin_deal ON public.whatsapp_instances;
CREATE TRIGGER whatsapp_instances_recalc_admin_deal
AFTER INSERT OR UPDATE OF status OR DELETE ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_deal_from_wa_instance();

DROP TRIGGER IF EXISTS profiles_recalc_admin_deal ON public.profiles;
CREATE TRIGGER profiles_recalc_admin_deal
AFTER UPDATE OF onboarding_completed ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_deal_from_profile();

-- Backfill: recalcula todos os deals existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_ref_id FROM public.admin_crm_deals WHERE user_ref_id IS NOT NULL LOOP
    PERFORM public.recalc_admin_deal_stage(r.user_ref_id);
  END LOOP;
END $$;
