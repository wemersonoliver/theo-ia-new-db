ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS series_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;

CREATE INDEX IF NOT EXISTS idx_appointments_series_id ON public.appointments (series_id);