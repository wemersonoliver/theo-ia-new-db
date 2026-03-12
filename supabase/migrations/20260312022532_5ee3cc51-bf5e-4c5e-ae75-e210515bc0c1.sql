
-- Criar função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tabela de assinaturas Kiwify
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kiwify_order_id text UNIQUE,
  kiwify_product_id text,
  product_name text,
  customer_email text,
  customer_name text,
  customer_phone text,
  status text NOT NULL DEFAULT 'inactive',
  plan_type text,
  amount_cents integer,
  currency text DEFAULT 'BRL',
  started_at timestamp with time zone,
  expires_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  refunded_at timestamp with time zone,
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_status ON public.subscriptions (user_id, status);
CREATE INDEX idx_subscriptions_email ON public.subscriptions (customer_email);
CREATE INDEX idx_subscriptions_order ON public.subscriptions (kiwify_order_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins manage all subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
