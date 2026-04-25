CREATE TABLE IF NOT EXISTS public.team_invite_markers (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_invite_markers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to team invite markers" ON public.team_invite_markers;
CREATE POLICY "No direct access to team invite markers"
ON public.team_invite_markers
FOR ALL
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.is_team_invite_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_invite_markers
    WHERE email = lower(trim(_email))
      AND created_at > now() - interval '30 minutes'
  );
$function$;

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_account_owner boolean;
  is_invited_member boolean;
BEGIN
  -- Pula membros de equipe marcados antes da criação no Auth
  IF NEW.email IS NOT NULL AND public.is_team_invite_email(NEW.email) THEN
    RETURN NEW;
  END IF;

  -- Pula membros de equipe (email placeholder do team-manage - legado)
  IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%.theoia.local' THEN
    RETURN NEW;
  END IF;

  -- Pula membros convidados já vinculados
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = NEW.user_id AND invited_by IS NOT NULL
  ) INTO is_invited_member;

  IF is_invited_member THEN
    RETURN NEW;
  END IF;

  -- Notifica somente quando o usuário é owner de uma conta nova
  SELECT EXISTS (
    SELECT 1 FROM public.accounts WHERE owner_user_id = NEW.user_id
  ) INTO is_account_owner;

  IF NOT is_account_owner THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/notify-new-user',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'full_name', NEW.full_name,
      'email', NEW.email
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_admins_on_new_user error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_welcome_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg_enabled boolean;
  cfg_delay int;
  digits text;
  normalized_phone text;
  ddd text;
  rest text;
  scheduled timestamptz;
  is_team_member boolean;
BEGIN
  IF NEW.phone IS NULL OR length(trim(NEW.phone)) = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.phone IS NOT NULL AND length(trim(OLD.phone)) > 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Pula membros de equipe marcados antes da criação no Auth
  IF NEW.email IS NOT NULL AND public.is_team_invite_email(NEW.email) THEN
    RETURN NEW;
  END IF;

  -- Pula membros de equipe (email placeholder gerado pelo team-manage)
  IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%.theoia.local' THEN
    RETURN NEW;
  END IF;

  -- Pula qualquer usuário que NÃO seja owner da própria account
  SELECT NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE owner_user_id = NEW.user_id
  ) INTO is_team_member;

  IF is_team_member THEN
    RETURN NEW;
  END IF;

  SELECT welcome_sequence_enabled, welcome_delay_minutes
    INTO cfg_enabled, cfg_delay
    FROM public.system_ai_config
    LIMIT 1;

  IF cfg_enabled IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF cfg_delay IS NULL THEN cfg_delay := 3; END IF;

  digits := regexp_replace(NEW.phone, '\D', '', 'g');

  IF length(digits) = 10 THEN
    ddd := substring(digits, 1, 2);
    rest := substring(digits, 3);
    normalized_phone := '55' || ddd || '9' || rest;
  ELSIF length(digits) = 11 THEN
    normalized_phone := '55' || digits;
  ELSIF length(digits) = 12 AND substring(digits, 1, 2) = '55' THEN
    ddd := substring(digits, 3, 2);
    rest := substring(digits, 5);
    normalized_phone := '55' || ddd || '9' || rest;
  ELSIF length(digits) = 13 AND substring(digits, 1, 2) = '55' THEN
    normalized_phone := digits;
  ELSE
    normalized_phone := digits;
  END IF;

  IF length(normalized_phone) < 12 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.system_welcome_queue
    WHERE user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  scheduled := now() + (cfg_delay || ' minutes')::interval;

  INSERT INTO public.system_welcome_queue (user_id, phone, full_name, scheduled_at)
  VALUES (NEW.user_id, normalized_phone, NEW.full_name, scheduled);

  RETURN NEW;
END;
$function$;