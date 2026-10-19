-- 1. Criar o perfil já com o telefone vindo do cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (user_id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 2. Notificar também quando o telefone é preenchido depois (ex.: cadastro via Google)
--    e nunca enviar notificação sem telefone ou duplicada
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_account_owner boolean;
  is_invited_member boolean;
BEGIN
  IF NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.phone IS NOT NULL THEN
    RETURN NEW;
  END IF;

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
$$;

DROP TRIGGER IF EXISTS on_profile_notify_admins ON public.profiles;
CREATE TRIGGER on_profile_notify_admins
AFTER INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_user();