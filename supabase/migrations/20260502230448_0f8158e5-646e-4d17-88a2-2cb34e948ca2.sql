CREATE OR REPLACE FUNCTION public.enforce_wa_instance_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_n int;
  current_n int;
  tier text;
BEGIN
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  tier := public.account_plan_tier(NEW.account_id);
  max_n := CASE WHEN tier IN ('pro','tester') THEN 3 ELSE 1 END;

  SELECT count(*) INTO current_n
    FROM public.whatsapp_instances
   WHERE account_id = NEW.account_id;

  IF current_n >= max_n THEN
    RAISE EXCEPTION 'Limite de % instância(s) WhatsApp atingido para o plano atual', max_n
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- Atualiza account_plan_tier para mapear plan_type 'tester' como tier 'tester'
CREATE OR REPLACE FUNCTION public.account_plan_tier(_account_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT CASE
              WHEN lower(COALESCE(s.plan_type, '')) LIKE '%tester%' THEN 'tester'
              WHEN p.tier IS NOT NULL THEN p.tier
              WHEN lower(COALESCE(s.plan_type, '')) LIKE '%pro%' THEN 'pro'
              WHEN lower(COALESCE(s.plan_type, '')) LIKE '%basic%' THEN 'basic'
              ELSE 'trial'
            END
       FROM public.subscriptions s
       LEFT JOIN public.plans p ON p.id = s.plan_id
      WHERE s.account_id = _account_id
        AND s.status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > now())
      ORDER BY s.created_at DESC
      LIMIT 1),
    'trial'
  );
$function$;