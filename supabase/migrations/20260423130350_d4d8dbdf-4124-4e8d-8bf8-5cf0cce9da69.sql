CREATE OR REPLACE FUNCTION public.notify_admins_on_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_account_owner boolean;
BEGIN
  -- Pula membros de equipe (email placeholder do team-manage)
  IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%.theoia.local' THEN
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