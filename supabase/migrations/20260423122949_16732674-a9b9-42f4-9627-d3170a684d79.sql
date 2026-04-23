-- Recreate auth.users triggers (they were missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

DROP TRIGGER IF EXISTS on_auth_user_created_account ON auth.users;
CREATE TRIGGER on_auth_user_created_account
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_account();

DROP TRIGGER IF EXISTS on_auth_user_created_admin_deal ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_deal
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin_deal();

-- Welcome message queue trigger on profiles
DROP TRIGGER IF EXISTS on_profile_enqueue_welcome ON public.profiles;
CREATE TRIGGER on_profile_enqueue_welcome
AFTER INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enqueue_welcome_message();

-- Profile-driven CRM advance triggers
DROP TRIGGER IF EXISTS trg_profile_advance_deal ON public.profiles;
CREATE TRIGGER trg_profile_advance_deal
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_advance_deal_from_profile();

DROP TRIGGER IF EXISTS trg_ai_config_advance_deal ON public.whatsapp_ai_config;
CREATE TRIGGER trg_ai_config_advance_deal
AFTER INSERT OR UPDATE ON public.whatsapp_ai_config
FOR EACH ROW EXECUTE FUNCTION public.trg_advance_deal_from_ai_config();

DROP TRIGGER IF EXISTS trg_whatsapp_advance_deal ON public.whatsapp_instances;
CREATE TRIGGER trg_whatsapp_advance_deal
AFTER INSERT OR UPDATE ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.trg_advance_deal_from_whatsapp_instance();

-- Notify admins on new user via WhatsApp (calls notify-new-user edge function)
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
$$;

DROP TRIGGER IF EXISTS on_profile_notify_admins ON public.profiles;
CREATE TRIGGER on_profile_notify_admins
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_user();