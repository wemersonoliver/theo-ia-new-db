-- 1. Adicionar colunas de boas-vindas em system_ai_config
ALTER TABLE public.system_ai_config
  ADD COLUMN IF NOT EXISTS welcome_sequence_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_delay_minutes integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS welcome_message_delay_seconds integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS welcome_messages jsonb NOT NULL DEFAULT '[
    "Oi {primeiro_nome}! 👋",
    "Eu sou o *Theo*, seu assistente virtual aqui da plataforma 🤖✨",
    "Vi que você acabou de criar sua conta — seja muito bem-vindo(a)! 🎉",
    "Estou aqui pra te ajudar em qualquer dúvida ou dificuldade na configuração.",
    "Se preferir, posso até agendar uma *call rápida com nosso time* pra te ajudar na implementação 😉",
    "Posso te ajudar com algo agora?"
  ]'::jsonb;

-- 2. Tabela system_welcome_queue
CREATE TABLE IF NOT EXISTS public.system_welcome_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  full_name text,
  scheduled_at timestamptz NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  skipped_reason text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welcome_queue_pending
  ON public.system_welcome_queue (scheduled_at)
  WHERE processed = false;

ALTER TABLE public.system_welcome_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage welcome queue"
  ON public.system_welcome_queue
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Tabela support_appointment_types
CREATE TABLE IF NOT EXISTS public.support_appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30,
  days_of_week integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  max_appointments_per_slot integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_appointment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage support appointment types"
  ON public.support_appointment_types
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated read active support appointment types"
  ON public.support_appointment_types
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TRIGGER trg_support_appointment_types_updated_at
  BEFORE UPDATE ON public.support_appointment_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tabela support_appointments
CREATE TABLE IF NOT EXISTS public.support_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id uuid REFERENCES public.support_appointment_types(id) ON DELETE SET NULL,
  user_ref_id uuid,
  phone text NOT NULL,
  contact_name text,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  reminder_sent boolean NOT NULL DEFAULT false,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_appointments_date
  ON public.support_appointments (appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_support_appointments_phone
  ON public.support_appointments (phone);
CREATE INDEX IF NOT EXISTS idx_support_appointments_user_ref
  ON public.support_appointments (user_ref_id);

ALTER TABLE public.support_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage support appointments"
  ON public.support_appointments
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users read own support appointments"
  ON public.support_appointments
  FOR SELECT
  TO authenticated
  USING (user_ref_id = auth.uid());

CREATE TRIGGER trg_support_appointments_updated_at
  BEFORE UPDATE ON public.support_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Garantir extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;