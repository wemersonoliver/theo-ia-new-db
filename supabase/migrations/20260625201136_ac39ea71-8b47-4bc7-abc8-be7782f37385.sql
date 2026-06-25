
-- 1) Audit columns
ALTER TABLE public.whatsapp_ai_config_history
  ADD COLUMN IF NOT EXISTS changed_by_email text,
  ADD COLUMN IF NOT EXISTS change_method text;

-- 2) RPC chamado pelo frontend após confirmação de senha
CREATE OR REPLACE FUNCTION public.save_ai_prompt_with_audit(
  p_config_id uuid,
  p_custom_prompt text,
  p_business_description text,
  p_business_niche text,
  p_agent_name text,
  p_method text DEFAULT 'password_confirmed'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_old RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE user_id = v_user_id;

  SELECT * INTO v_old FROM public.whatsapp_ai_config WHERE id = p_config_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Configuração não encontrada';
  END IF;

  -- Snapshot manual com autor identificado (substitui o trigger automático para este caminho)
  INSERT INTO public.whatsapp_ai_config_history (
    config_id, user_id, custom_prompt, business_description, business_niche, agent_name,
    changed_by, changed_by_email, change_source, change_method
  ) VALUES (
    v_old.id, v_old.user_id, v_old.custom_prompt, v_old.business_description, v_old.business_niche, v_old.agent_name,
    v_user_id, v_email, 'update', p_method
  );

  -- Desativa trigger nesta transação para evitar snapshot duplicado
  PERFORM set_config('theo.skip_ai_snapshot', '1', true);

  UPDATE public.whatsapp_ai_config
     SET custom_prompt = p_custom_prompt,
         business_description = p_business_description,
         business_niche = p_business_niche,
         agent_name = p_agent_name,
         updated_at = now()
   WHERE id = p_config_id;

  PERFORM set_config('theo.skip_ai_snapshot', '', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_ai_prompt_with_audit(uuid, text, text, text, text, text) TO authenticated;

-- 3) Atualiza trigger para respeitar a flag e capturar email
CREATE OR REPLACE FUNCTION public.trg_snapshot_ai_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_skip text;
  v_email text;
BEGIN
  BEGIN
    v_skip := current_setting('theo.skip_ai_snapshot', true);
  EXCEPTION WHEN OTHERS THEN
    v_skip := '';
  END;
  IF v_skip = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.custom_prompt IS NOT DISTINCT FROM NEW.custom_prompt
       AND OLD.business_description IS NOT DISTINCT FROM NEW.business_description
       AND OLD.business_niche IS NOT DISTINCT FROM NEW.business_niche
       AND OLD.agent_name IS NOT DISTINCT FROM NEW.agent_name THEN
      RETURN NEW;
    END IF;

    IF auth.uid() IS NOT NULL THEN
      SELECT email INTO v_email FROM public.profiles WHERE user_id = auth.uid();
    END IF;

    INSERT INTO public.whatsapp_ai_config_history (
      config_id, user_id, custom_prompt, business_description, business_niche, agent_name,
      changed_by, changed_by_email, change_source, change_method
    ) VALUES (
      OLD.id, OLD.user_id, OLD.custom_prompt, OLD.business_description, OLD.business_niche, OLD.agent_name,
      auth.uid(), v_email, 'update', 'direct_update'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Restaurar prompt de consultoriafontoura@gmail.com para versão de 25/06 16:08 BRT (4908 chars)
UPDATE public.whatsapp_ai_config c
   SET custom_prompt = h.custom_prompt,
       updated_at = now()
  FROM public.whatsapp_ai_config_history h
  JOIN public.profiles p ON p.user_id = h.user_id
 WHERE p.email = 'consultoriafontoura@gmail.com'
   AND c.user_id = p.user_id
   AND h.id = 'ca1d323f-df39-48e5-99d2-62616b9e54a3';
