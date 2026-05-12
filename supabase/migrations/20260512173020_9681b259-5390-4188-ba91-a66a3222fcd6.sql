CREATE TABLE public.whatsapp_ai_config_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id uuid NOT NULL,
  user_id uuid NOT NULL,
  custom_prompt text,
  business_description text,
  business_niche text,
  agent_name text,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  change_source text
);

CREATE INDEX idx_wa_ai_config_history_user ON public.whatsapp_ai_config_history(user_id, changed_at DESC);
CREATE INDEX idx_wa_ai_config_history_config ON public.whatsapp_ai_config_history(config_id, changed_at DESC);

ALTER TABLE public.whatsapp_ai_config_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ai config history"
ON public.whatsapp_ai_config_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Super admins read all ai config history"
ON public.whatsapp_ai_config_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.trg_snapshot_ai_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.custom_prompt IS NOT DISTINCT FROM NEW.custom_prompt
       AND OLD.business_description IS NOT DISTINCT FROM NEW.business_description
       AND OLD.business_niche IS NOT DISTINCT FROM NEW.business_niche
       AND OLD.agent_name IS NOT DISTINCT FROM NEW.agent_name THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.whatsapp_ai_config_history (
      config_id, user_id, custom_prompt, business_description, business_niche, agent_name, changed_by, change_source
    ) VALUES (
      OLD.id, OLD.user_id, OLD.custom_prompt, OLD.business_description, OLD.business_niche, OLD.agent_name, auth.uid(), 'update'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER snapshot_ai_config_on_update
BEFORE UPDATE ON public.whatsapp_ai_config
FOR EACH ROW
EXECUTE FUNCTION public.trg_snapshot_ai_config();