-- 1) Atualiza a função de enfileiramento para usar o formato canônico (com 9)
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
BEGIN
  IF NEW.phone IS NULL OR length(trim(NEW.phone)) = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.phone IS NOT NULL AND length(trim(OLD.phone)) > 0 THEN
      RETURN NEW;
    END IF;
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

  -- Normalização canônica brasileira (sempre com o "9" do celular):
  -- 10 dígitos (DDD + 8): adiciona 55 + insere 9
  -- 11 dígitos (DDD + 9 + 8): prefixa 55
  -- 12 dígitos (55 + DDD + 8): insere 9 após o DDD
  -- 13 dígitos canônicos: mantém
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

-- 2) Funde as duas conversas duplicadas do Marcos Vinicius
DO $$
DECLARE
  short_msgs jsonb;
  long_msgs jsonb;
  merged jsonb;
  long_id uuid;
BEGIN
  SELECT messages INTO short_msgs FROM public.system_whatsapp_conversations WHERE phone = '558597627354';
  SELECT id, messages INTO long_id, long_msgs FROM public.system_whatsapp_conversations WHERE phone = '5585997627354';

  IF short_msgs IS NULL OR long_msgs IS NULL THEN
    RETURN;
  END IF;

  -- Mescla e ordena por timestamp
  SELECT jsonb_agg(m ORDER BY (m->>'timestamp')::timestamptz)
  INTO merged
  FROM (
    SELECT jsonb_array_elements(short_msgs) AS m
    UNION ALL
    SELECT jsonb_array_elements(long_msgs) AS m
  ) sub;

  UPDATE public.system_whatsapp_conversations
  SET messages = merged,
      total_messages = jsonb_array_length(merged),
      last_message_at = (SELECT max((m->>'timestamp')::timestamptz) FROM jsonb_array_elements(merged) m),
      contact_name = COALESCE(contact_name, 'MV'),
      updated_at = now()
  WHERE id = long_id;

  DELETE FROM public.system_whatsapp_conversations WHERE phone = '558597627354';
END $$;