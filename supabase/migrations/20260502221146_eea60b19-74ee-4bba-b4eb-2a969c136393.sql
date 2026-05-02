
-- 1) Add new columns to whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS department_slug text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_message text,
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS followup_enabled boolean NOT NULL DEFAULT true;

-- 2) Backfill existing rows: mark each existing instance as primary "Principal"
UPDATE public.whatsapp_instances
   SET is_primary = true,
       display_name = COALESCE(display_name, 'Principal'),
       department_slug = COALESCE(department_slug, 'principal')
 WHERE display_name IS NULL OR department_slug IS NULL;

-- 3) Drop old uniqueness on user_id (one-instance-per-user) if it exists
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.whatsapp_instances'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) ILIKE '%(user_id)%'
  LOOP
    EXECUTE 'ALTER TABLE public.whatsapp_instances DROP CONSTRAINT ' || quote_ident(c.conname);
  END LOOP;
END $$;

-- 4) Drop unique indexes on (user_id) too
DO $$
DECLARE i record;
BEGIN
  FOR i IN
    SELECT indexname FROM pg_indexes
     WHERE schemaname='public' AND tablename='whatsapp_instances'
       AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(user_id)%'
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(i.indexname);
  END LOOP;
END $$;

-- 5) New uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_instance_account_name
  ON public.whatsapp_instances(account_id, instance_name);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_instance_account_slug
  ON public.whatsapp_instances(account_id, department_slug);
-- Only one primary per account
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_instance_account_primary
  ON public.whatsapp_instances(account_id) WHERE is_primary = true;

-- 6) Add instance_id to dependent tables (nullable for backward compat)
ALTER TABLE public.whatsapp_ai_config       ADD COLUMN IF NOT EXISTS instance_id uuid;
ALTER TABLE public.followup_config          ADD COLUMN IF NOT EXISTS instance_id uuid;
ALTER TABLE public.whatsapp_conversations   ADD COLUMN IF NOT EXISTS instance_id uuid;
ALTER TABLE public.whatsapp_ai_sessions     ADD COLUMN IF NOT EXISTS instance_id uuid;
ALTER TABLE public.whatsapp_pending_responses ADD COLUMN IF NOT EXISTS instance_id uuid;

-- Backfill instance_id with the primary instance of the account
UPDATE public.whatsapp_ai_config c
   SET instance_id = wi.id
  FROM public.whatsapp_instances wi
 WHERE wi.account_id = c.account_id AND wi.is_primary = true AND c.instance_id IS NULL;

UPDATE public.followup_config c
   SET instance_id = wi.id
  FROM public.whatsapp_instances wi
 WHERE wi.account_id = c.account_id AND wi.is_primary = true AND c.instance_id IS NULL;

UPDATE public.whatsapp_conversations c
   SET instance_id = wi.id
  FROM public.whatsapp_instances wi
 WHERE wi.account_id = c.account_id AND wi.is_primary = true AND c.instance_id IS NULL;

UPDATE public.whatsapp_ai_sessions s
   SET instance_id = wi.id
  FROM public.whatsapp_instances wi
 WHERE wi.user_id = s.user_id AND wi.is_primary = true AND s.instance_id IS NULL;

UPDATE public.whatsapp_pending_responses p
   SET instance_id = wi.id
  FROM public.whatsapp_instances wi
 WHERE wi.account_id = p.account_id AND wi.is_primary = true AND p.instance_id IS NULL;

-- 7) Plan tier helper
CREATE OR REPLACE FUNCTION public.account_plan_tier(_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT p.tier
       FROM public.subscriptions s
       LEFT JOIN public.plans p ON p.id = s.plan_id
      WHERE s.account_id = _account_id
        AND s.status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > now())
      ORDER BY s.created_at DESC
      LIMIT 1),
    'trial'
  );
$$;

-- 8) Limit trigger
CREATE OR REPLACE FUNCTION public.enforce_wa_instance_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_n int;
  current_n int;
  tier text;
BEGIN
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  tier := public.account_plan_tier(NEW.account_id);
  max_n := CASE WHEN tier = 'pro' THEN 3 ELSE 1 END;

  SELECT count(*) INTO current_n
    FROM public.whatsapp_instances
   WHERE account_id = NEW.account_id;

  IF current_n >= max_n THEN
    RAISE EXCEPTION 'Limite de % instância(s) WhatsApp atingido para o plano atual', max_n
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_wa_instance_limit ON public.whatsapp_instances;
CREATE TRIGGER trg_enforce_wa_instance_limit
BEFORE INSERT ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.enforce_wa_instance_limit();

-- 9) RLS: ensure account members can read all instances of their account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='whatsapp_instances'
      AND policyname='Account members read instances'
  ) THEN
    CREATE POLICY "Account members read instances"
    ON public.whatsapp_instances
    FOR SELECT
    TO authenticated
    USING (public.is_account_member(account_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));
  END IF;
END $$;
