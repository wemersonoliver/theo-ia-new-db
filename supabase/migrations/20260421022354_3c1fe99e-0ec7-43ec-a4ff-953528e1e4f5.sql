-- Trigger para enfileirar boas-vindas automaticamente quando profile tem telefone válido
CREATE OR REPLACE FUNCTION public.enqueue_welcome_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cfg_enabled boolean;
  cfg_delay int;
  digits text;
  normalized_phone text;
  scheduled timestamptz;
BEGIN
  -- Só prossegue se tem telefone novo/atualizado
  IF NEW.phone IS NULL OR length(trim(NEW.phone)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só dispara se phone mudou de vazio para preenchido
  IF TG_OP = 'UPDATE' THEN
    IF OLD.phone IS NOT NULL AND length(trim(OLD.phone)) > 0 THEN
      RETURN NEW; -- já tinha telefone antes; ignora
    END IF;
  END IF;

  -- Lê config global
  SELECT welcome_sequence_enabled, welcome_delay_minutes
    INTO cfg_enabled, cfg_delay
    FROM public.system_ai_config
    LIMIT 1;

  IF cfg_enabled IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF cfg_delay IS NULL THEN cfg_delay := 3; END IF;

  -- Normaliza telefone (10-11 dígitos -> prefixa 55)
  digits := regexp_replace(NEW.phone, '\D', '', 'g');
  IF length(digits) = 10 OR length(digits) = 11 THEN
    normalized_phone := '55' || digits;
  ELSE
    normalized_phone := digits;
  END IF;

  IF length(normalized_phone) < 10 THEN
    RETURN NEW; -- telefone inválido
  END IF;

  -- Evita duplicidade: só insere se não há registro pendente para esse user
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
$$;

DROP TRIGGER IF EXISTS trg_enqueue_welcome_on_profile_insert ON public.profiles;
DROP TRIGGER IF EXISTS trg_enqueue_welcome_on_profile_update ON public.profiles;

CREATE TRIGGER trg_enqueue_welcome_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_welcome_message();

CREATE TRIGGER trg_enqueue_welcome_on_profile_update
AFTER UPDATE OF phone ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_welcome_message();

-- Backfill: enfileira boas-vindas para usuários cadastrados nas últimas 7 dias
-- que tem telefone e ainda não receberam (não estão na fila)
INSERT INTO public.system_welcome_queue (user_id, phone, full_name, scheduled_at)
SELECT
  p.user_id,
  CASE
    WHEN length(regexp_replace(p.phone, '\D', '', 'g')) IN (10, 11)
      THEN '55' || regexp_replace(p.phone, '\D', '', 'g')
    ELSE regexp_replace(p.phone, '\D', '', 'g')
  END AS phone,
  p.full_name,
  now() + interval '1 minute'
FROM public.profiles p
WHERE p.phone IS NOT NULL
  AND length(regexp_replace(p.phone, '\D', '', 'g')) >= 10
  AND p.created_at >= now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.system_welcome_queue q WHERE q.user_id = p.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.system_whatsapp_conversations c
    WHERE c.phone = (
      CASE
        WHEN length(regexp_replace(p.phone, '\D', '', 'g')) IN (10, 11)
          THEN '55' || regexp_replace(p.phone, '\D', '', 'g')
        ELSE regexp_replace(p.phone, '\D', '', 'g')
      END
    )
    AND c.total_messages > 0
  );