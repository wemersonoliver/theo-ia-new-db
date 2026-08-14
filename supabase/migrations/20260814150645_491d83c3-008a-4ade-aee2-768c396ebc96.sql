CREATE TABLE public.appointment_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'Bloqueado',
  all_day boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  recurrence text NOT NULL DEFAULT 'none',
  days_of_week integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blocks TO authenticated;
GRANT ALL ON public.appointment_blocks TO service_role;

ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage appointment blocks"
ON public.appointment_blocks FOR ALL TO authenticated
USING (public.is_account_member(account_id))
WITH CHECK (public.is_account_member(account_id));

CREATE INDEX idx_appointment_blocks_account ON public.appointment_blocks(account_id, start_date);

CREATE TRIGGER update_appointment_blocks_updated_at
BEFORE UPDATE ON public.appointment_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();