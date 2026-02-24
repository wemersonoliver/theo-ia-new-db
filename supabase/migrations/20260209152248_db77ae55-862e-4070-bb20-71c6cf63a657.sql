
-- Add reminder columns to whatsapp_ai_config
ALTER TABLE public.whatsapp_ai_config
ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_hours_before integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS reminder_message_template text DEFAULT 'Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.';

-- Add reminder/tags columns to appointments
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS confirmed_by_client boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
