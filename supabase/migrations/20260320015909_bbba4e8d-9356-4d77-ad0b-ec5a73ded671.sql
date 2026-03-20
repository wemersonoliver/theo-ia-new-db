
-- Adicionar campos de horário/dias na tabela appointment_types
ALTER TABLE public.appointment_types
  ADD COLUMN IF NOT EXISTS days_of_week integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS start_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS end_time time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS max_appointments_per_slot integer NOT NULL DEFAULT 1;
