
-- Trial notification config (singleton)
CREATE TABLE public.trial_notification_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  morning_window_start text NOT NULL DEFAULT '09:00',
  morning_window_end text NOT NULL DEFAULT '12:00',
  evening_window_start text NOT NULL DEFAULT '14:00',
  evening_window_end text NOT NULL DEFAULT '20:00',
  discount_coupon_code text NOT NULL DEFAULT 'VOLTA20',
  discount_percent int NOT NULL DEFAULT 20,
  step_offsets jsonb NOT NULL DEFAULT '[-3,-2,-1,2,4,6,7,9,11]'::jsonb,
  step_1_template text NOT NULL DEFAULT '{nome}, faltam *3 dias* do seu teste. Nesse tempo, vi que clientes que ativam o agente IA economizam em média 4h/dia de atendimento. Posso te ajudar a deixar tudo redondo antes de acabar?',
  step_2_template text NOT NULL DEFAULT '{nome}, faltam *2 dias* ⏰ Quem assina agora não perde nenhuma conversa nem agendamento — o Theo segue atendendo no piloto automático 24/7. Quer garantir? {link_checkout}',
  step_3_template text NOT NULL DEFAULT '{nome}, último dia. Não quero te ver perder o que já configurou — IA, contatos, agendamentos. Renova em 1 clique: {link_checkout}',
  step_4_template text NOT NULL DEFAULT 'Oi {nome}, aqui é o Theo. Seu teste encerrou anteontem e percebi que você não assinou. Sem cobrança, juro 🙏 Mas queria muito te ouvir: *o que faltou pra você seguir com a gente?* Foi preço, alguma função, dificuldade na configuração? Sua resposta me ajuda a melhorar a plataforma.',
  step_5_template text NOT NULL DEFAULT '{nome}, sabia que 7 em cada 10 clientes que testam o Theo voltam depois? Não é mágica — é porque o problema de "responder cliente fora do horário" não some sozinho. {link_checkout}',
  step_6_template text NOT NULL DEFAULT '{nome}, vi aqui que você atua com *{business_context}*. Especificamente pra esse modelo, o Theo costuma resolver: triagem inicial, envio de orçamento, confirmação de horário — sem você levantar o dedo. Vale uma segunda chance? {link_checkout}',
  step_7_template text NOT NULL DEFAULT '{nome}, presta atenção: esta é minha 4ª mensagem. Você ainda não bloqueou, ainda não respondeu "para" — então alguma parte de você quer voltar. Estatística real: *metade das pessoas que recebem essa mensagem volta a conversar comigo*. E é exatamente isso que o Theo faz com seus leads parados. {link_checkout}',
  step_8_template text NOT NULL DEFAULT '{nome}, última cartada generosa: cupom de *{desconto}% off* no primeiro mês se assinar até amanhã. Código: *{cupom}*. {link_checkout}',
  step_9_template text NOT NULL DEFAULT 'Beleza {nome}, vou parar de te incomodar um pouco 😄. Mas deixo registrado: enquanto seu concorrente automatiza, você responde no braço. Se mudar de ideia: {link_checkout} 🤝',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage trial notification config"
  ON public.trial_notification_config FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_trial_notif_config_updated
  BEFORE UPDATE ON public.trial_notification_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.trial_notification_config (id) VALUES (gen_random_uuid());

-- Tracking
CREATE TABLE public.trial_notification_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL,
  phone text NOT NULL,
  trial_ends_at timestamptz NOT NULL,
  current_step int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled',
  last_sent_at timestamptz,
  next_scheduled_at timestamptz,
  business_context text,
  engagement_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trial_notif_tracking_status ON public.trial_notification_tracking(status);
CREATE INDEX idx_trial_notif_tracking_phone ON public.trial_notification_tracking(phone);

ALTER TABLE public.trial_notification_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read trial notification tracking"
  ON public.trial_notification_tracking FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins update trial notification tracking"
  ON public.trial_notification_tracking FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_trial_notif_tracking_updated
  BEFORE UPDATE ON public.trial_notification_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages
CREATE TABLE public.trial_notification_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES public.trial_notification_tracking(id) ON DELETE CASCADE,
  phone text NOT NULL,
  step int NOT NULL,
  phase text NOT NULL,
  content text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trial_notif_msg_due ON public.trial_notification_messages(scheduled_at) WHERE sent_at IS NULL;
CREATE INDEX idx_trial_notif_msg_tracking ON public.trial_notification_messages(tracking_id);

ALTER TABLE public.trial_notification_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read trial notification messages"
  ON public.trial_notification_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- RPC: cancel flow on conversion or handoff
CREATE OR REPLACE FUNCTION public.cancel_trial_notification(p_account_id uuid, p_reason text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected int := 0;
BEGIN
  UPDATE public.trial_notification_tracking
     SET status = CASE WHEN p_reason = 'converted' THEN 'converted'
                       WHEN p_reason = 'handoff' THEN 'handoff'
                       ELSE 'paused_engaged' END,
         updated_at = now()
   WHERE account_id = p_account_id
     AND status IN ('scheduled','paused_engaged');
  GET DIAGNOSTICS affected = ROW_COUNT;

  DELETE FROM public.trial_notification_messages m
   USING public.trial_notification_tracking t
   WHERE m.tracking_id = t.id
     AND t.account_id = p_account_id
     AND m.sent_at IS NULL;

  RETURN affected;
END;
$$;

-- RPC variant by phone (used by whatsapp-webhook hook)
CREATE OR REPLACE FUNCTION public.pause_trial_notification_by_phone(p_phone text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected int := 0;
BEGIN
  UPDATE public.trial_notification_tracking
     SET status = 'paused_engaged',
         engagement_data = engagement_data || jsonb_build_object('replied_at', now()),
         updated_at = now()
   WHERE phone = p_phone
     AND status = 'scheduled';
  GET DIAGNOSTICS affected = ROW_COUNT;

  DELETE FROM public.trial_notification_messages m
   USING public.trial_notification_tracking t
   WHERE m.tracking_id = t.id
     AND t.phone = p_phone
     AND m.sent_at IS NULL;

  RETURN affected;
END;
$$;
