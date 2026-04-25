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
  -- Pula membros de equipe (email placeholder do team-manage - legado)
  IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%.theoia.local' THEN
    RETURN NEW;
  END IF;

  -- Pula membros convidados (qualquer membership com invited_by definido)
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

  -- Aguarda 5 segundos antes de notificar para dar tempo do team-manage limpar accounts criadas pelo trigger
  PERFORM pg_sleep(5);

  -- Re-checa: se nesse intervalo virou membro convidado, pula
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = NEW.user_id AND invited_by IS NOT NULL
  ) INTO is_invited_member;

  IF is_invited_member THEN
    RETURN NEW;
  END IF;

  -- Re-checa se ainda é owner de conta (team-manage pode ter removido)
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