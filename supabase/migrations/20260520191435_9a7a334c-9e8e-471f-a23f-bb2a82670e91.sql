
-- ============================================================
-- Plano Igreen Energy — schema dos cenários
-- ============================================================

-- 1. Cenários (3 por conta: CENARIO1, CENARIO2, CENARIO3)
CREATE TABLE public.igreen_scenarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  scenario_key  text NOT NULL CHECK (scenario_key IN ('CENARIO1','CENARIO2','CENARIO3')),
  name          text NOT NULL,
  description   text,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, scenario_key)
);

CREATE INDEX idx_igreen_scenarios_account ON public.igreen_scenarios(account_id);

ALTER TABLE public.igreen_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenarios_account_members"
  ON public.igreen_scenarios
  FOR ALL
  TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE TRIGGER trg_igreen_scenarios_updated_at
  BEFORE UPDATE ON public.igreen_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Dias do cenário
CREATE TABLE public.igreen_scenario_days (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id  uuid NOT NULL REFERENCES public.igreen_scenarios(id) ON DELETE CASCADE,
  day_number   int NOT NULL CHECK (day_number >= 1),
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, day_number)
);

CREATE INDEX idx_igreen_days_scenario ON public.igreen_scenario_days(scenario_id);

ALTER TABLE public.igreen_scenario_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "days_account_members"
  ON public.igreen_scenario_days
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.igreen_scenarios s
    WHERE s.id = scenario_id AND public.is_account_member(s.account_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.igreen_scenarios s
    WHERE s.id = scenario_id AND public.is_account_member(s.account_id)
  ));

CREATE TRIGGER trg_igreen_days_updated_at
  BEFORE UPDATE ON public.igreen_scenario_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Mensagens (manhã / tarde) por dia
CREATE TABLE public.igreen_scenario_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id      uuid NOT NULL REFERENCES public.igreen_scenario_days(id) ON DELETE CASCADE,
  period      text NOT NULL CHECK (period IN ('morning','evening')),
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day_id, period)
);

CREATE INDEX idx_igreen_messages_day ON public.igreen_scenario_messages(day_id);

ALTER TABLE public.igreen_scenario_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_account_members"
  ON public.igreen_scenario_messages
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.igreen_scenario_days d
    JOIN public.igreen_scenarios s ON s.id = d.scenario_id
    WHERE d.id = day_id AND public.is_account_member(s.account_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.igreen_scenario_days d
    JOIN public.igreen_scenarios s ON s.id = d.scenario_id
    WHERE d.id = day_id AND public.is_account_member(s.account_id)
  ));

CREATE TRIGGER trg_igreen_messages_updated_at
  BEFORE UPDATE ON public.igreen_scenario_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Itens (sequência texto/áudio/vídeo/imagem/documento)
CREATE TABLE public.igreen_scenario_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES public.igreen_scenario_messages(id) ON DELETE CASCADE,
  position        int NOT NULL DEFAULT 0,
  type            text NOT NULL CHECK (type IN ('text','audio','video','image','document')),
  content         text,
  caption         text,
  media_url       text,
  media_mime      text,
  media_filename  text,
  delay_value     int NOT NULL DEFAULT 0,
  delay_unit      text NOT NULL DEFAULT 'seconds' CHECK (delay_unit IN ('seconds','minutes')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_igreen_items_message ON public.igreen_scenario_items(message_id, position);

ALTER TABLE public.igreen_scenario_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_account_members"
  ON public.igreen_scenario_items
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.igreen_scenario_messages m
    JOIN public.igreen_scenario_days d ON d.id = m.day_id
    JOIN public.igreen_scenarios s ON s.id = d.scenario_id
    WHERE m.id = message_id AND public.is_account_member(s.account_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.igreen_scenario_messages m
    JOIN public.igreen_scenario_days d ON d.id = m.day_id
    JOIN public.igreen_scenarios s ON s.id = d.scenario_id
    WHERE m.id = message_id AND public.is_account_member(s.account_id)
  ));

CREATE TRIGGER trg_igreen_items_updated_at
  BEFORE UPDATE ON public.igreen_scenario_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enrollments (contato → cenário)
CREATE TABLE public.igreen_scenario_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  scenario_id     uuid NOT NULL REFERENCES public.igreen_scenarios(id) ON DELETE CASCADE,
  scenario_key    text NOT NULL,
  contact_phone   text NOT NULL,
  contact_id      uuid,
  current_day     int NOT NULL DEFAULT 1,
  current_period  text NOT NULL DEFAULT 'morning' CHECK (current_period IN ('morning','evening')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped')),
  stop_reason     text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  last_sent_at    timestamptz,
  next_run_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Exclusividade: um contato só pode estar em um cenário ATIVO por conta
CREATE UNIQUE INDEX idx_igreen_enroll_active_phone
  ON public.igreen_scenario_enrollments(account_id, contact_phone)
  WHERE status = 'active';

CREATE INDEX idx_igreen_enroll_due
  ON public.igreen_scenario_enrollments(next_run_at)
  WHERE status = 'active';

CREATE INDEX idx_igreen_enroll_account ON public.igreen_scenario_enrollments(account_id);

ALTER TABLE public.igreen_scenario_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments_account_members"
  ON public.igreen_scenario_enrollments
  FOR ALL
  TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE TRIGGER trg_igreen_enroll_updated_at
  BEFORE UPDATE ON public.igreen_scenario_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Eventos (log de envios)
CREATE TABLE public.igreen_scenario_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id  uuid NOT NULL REFERENCES public.igreen_scenario_enrollments(id) ON DELETE CASCADE,
  day_number     int NOT NULL,
  period         text NOT NULL,
  message_id     uuid,
  status         text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  error          text,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_igreen_events_enroll ON public.igreen_scenario_events(enrollment_id);

ALTER TABLE public.igreen_scenario_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_account_members"
  ON public.igreen_scenario_events
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.igreen_scenario_enrollments e
    WHERE e.id = enrollment_id AND public.is_account_member(e.account_id)
  ));

-- 7. RPC para parar cadências de cenário ao receber resposta
CREATE OR REPLACE FUNCTION public.igreen_stop_for_phone(
  p_account_id uuid,
  p_phone text,
  p_reason text
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected int := 0;
BEGIN
  UPDATE public.igreen_scenario_enrollments
     SET status = 'stopped',
         stop_reason = COALESCE(p_reason, 'replied'),
         updated_at = now()
   WHERE account_id = p_account_id
     AND contact_phone = p_phone
     AND status = 'active';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 8. Atualiza enforce_wa_instance_limit para incluir tier 'igreen' (2 instâncias)
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
  max_n := CASE
    WHEN tier IN ('pro','tester') THEN 3
    WHEN tier = 'igreen' THEN 2
    ELSE 1
  END;

  SELECT count(*) INTO current_n
    FROM public.whatsapp_instances
   WHERE account_id = NEW.account_id
     AND id IS DISTINCT FROM NEW.id;

  IF current_n >= max_n THEN
    RAISE EXCEPTION 'Limite de % instância(s) WhatsApp atingido para o plano atual', max_n
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;
