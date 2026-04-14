-- Credits balance per user
CREATE TABLE IF NOT EXISTS public.ai_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance_cents integer NOT NULL DEFAULT 0,
  total_added_cents integer NOT NULL DEFAULT 0,
  total_consumed_cents integer NOT NULL DEFAULT 0,
  voice_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all credits"
  ON public.ai_credits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users read own credits"
  ON public.ai_credits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Credit transactions history
CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'debit',
  amount_cents integer NOT NULL,
  balance_after_cents integer NOT NULL DEFAULT 0,
  description text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all credit transactions"
  ON public.ai_credit_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users read own credit transactions"
  ON public.ai_credit_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_ai_credits_user_id ON public.ai_credits (user_id);
CREATE INDEX idx_ai_credit_transactions_user_id ON public.ai_credit_transactions (user_id);
CREATE INDEX idx_ai_credit_transactions_created_at ON public.ai_credit_transactions (created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_ai_credits_updated_at
  BEFORE UPDATE ON public.ai_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();