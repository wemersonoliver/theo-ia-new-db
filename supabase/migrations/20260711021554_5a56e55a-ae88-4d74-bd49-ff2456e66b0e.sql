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
  IF NEW.email IS NOT NULL AND public.is_team_invite_email(NEW.email) THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%.theoia.local' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = NEW.user_id AND invited_by IS NOT NULL
  ) INTO is_invited_member;

  IF is_invited_member THEN
    RETURN NEW;
  END IF;

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
      'email', NEW.email,
      'phone', NEW.phone
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_admins_on_new_user error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;