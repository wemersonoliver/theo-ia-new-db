-- Pula enfileiramento de mensagem de boas-vindas para membros de equipe
-- (identificados pelo email placeholder @theoia.local gerado pelo team-manage)
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

  -- Pula membros de equipe (email placeholder gerado pelo team-manage)
  IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%.theoia.local' THEN
    RETURN NEW;
  END IF;

  -- Pula qualquer usuário que NÃO seja owner da própria account
  -- (membros de equipe não possuem account própria após team-manage)
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

-- Limpeza: cancelar mensagens de boas-vindas pendentes para membros de equipe já cadastrados
UPDATE public.system_welcome_queue swq
SET processed = true,
    processed_at = now(),
    skipped_reason = 'team_member'
WHERE processed = false
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = swq.user_id
      AND (
        p.email LIKE '%@%.theoia.local'
        OR NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.owner_user_id = p.user_id)
      )
  );
