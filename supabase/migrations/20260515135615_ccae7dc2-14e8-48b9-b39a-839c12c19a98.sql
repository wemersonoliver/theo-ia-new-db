
CREATE TABLE IF NOT EXISTS public.custom_followup_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  date date NOT NULL,
  name text NOT NULL,
  recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, date, name)
);

CREATE INDEX IF NOT EXISTS idx_cf_holidays_account_date
  ON public.custom_followup_holidays (account_id, date);

ALTER TABLE public.custom_followup_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage holidays"
  ON public.custom_followup_holidays
  FOR ALL
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE TRIGGER trg_cf_holidays_updated_at
  BEFORE UPDATE ON public.custom_followup_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
