-- 1. Sequence para business_code começando em 1000
CREATE SEQUENCE IF NOT EXISTS public.accounts_business_code_seq START WITH 1000;

-- 2. Adiciona coluna business_code
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS business_code integer UNIQUE DEFAULT nextval('public.accounts_business_code_seq');

-- 3. Backfill para registros existentes sem código
UPDATE public.accounts
   SET business_code = nextval('public.accounts_business_code_seq')
 WHERE business_code IS NULL;

-- 4. Tornar NOT NULL
ALTER TABLE public.accounts ALTER COLUMN business_code SET NOT NULL;

-- 5. Atualiza a trigger handle_new_user_account para aceitar business_name
CREATE OR REPLACE FUNCTION public.handle_new_user_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_account_id uuid;
  biz_name text;
BEGIN
  -- Prioridade: business_name > full_name > 'Minha Empresa'
  biz_name := COALESCE(
    NULLIF(trim(NEW.full_name), ''), -- fallback: full_name do profile
    'Minha Empresa'
  );

  -- Cria account para o novo usuário
  INSERT INTO public.accounts (owner_user_id, name)
  VALUES (NEW.user_id, biz_name)
  ON CONFLICT (owner_user_id) DO NOTHING
  RETURNING id INTO new_account_id;

  IF new_account_id IS NULL THEN
    SELECT id INTO new_account_id FROM public.accounts WHERE owner_user_id = NEW.user_id LIMIT 1;
  END IF;

  IF new_account_id IS NOT NULL THEN
    INSERT INTO public.account_members (account_id, user_id, role, status)
    VALUES (new_account_id, NEW.user_id, 'owner', 'active')
    ON CONFLICT (account_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;