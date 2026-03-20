
-- Tabela de tipos de agendamento (serviços)
CREATE TABLE public.appointment_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own appointment types"
  ON public.appointment_types
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_appointment_types_updated_at
  BEFORE UPDATE ON public.appointment_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar referência na tabela appointments
ALTER TABLE public.appointments
  ADD COLUMN appointment_type_id uuid REFERENCES public.appointment_types(id) ON DELETE SET NULL;
