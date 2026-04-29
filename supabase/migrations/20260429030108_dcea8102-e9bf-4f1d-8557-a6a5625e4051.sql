-- Tabela de planos
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tier text NOT NULL,
  billing_period text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  checkout_url text,
  description text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_recommended boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_tier_check CHECK (tier IN ('basic','pro')),
  CONSTRAINT plans_billing_period_check CHECK (billing_period IN ('monthly','annual'))
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active plans"
ON public.plans FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage plans"
ON public.plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincula assinatura a plano
ALTER TABLE public.subscriptions
ADD COLUMN plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;

CREATE INDEX idx_subscriptions_plan_id ON public.subscriptions(plan_id);

-- Seed dos 4 planos
INSERT INTO public.plans (slug, name, tier, billing_period, price_cents, checkout_url, is_recommended, position, features) VALUES
('basic-monthly','Basic Mensal','basic','monthly',9700,'https://pay.kiwify.com.br/AdpFbz3',false,1,
  '["Atendimento IA 24/7","Agendamento automático","Base de conhecimento","Lembretes automáticos","Suporte padrão"]'::jsonb),
('basic-annual','Basic Anual','basic','annual',99700,'https://pay.kiwify.com.br/bpNMdQ0',false,2,
  '["Tudo do Basic Mensal","Economia anual","Preço garantido por 12 meses"]'::jsonb),
('pro-monthly','Pro Mensal','pro','monthly',14700,'https://pay.kiwify.com.br/yEubqi0',true,3,
  '["Tudo do Basic","Recursos avançados de IA","Suporte prioritário","Prioridade em novidades"]'::jsonb),
('pro-annual','Pro Anual','pro','annual',149900,'https://pay.kiwify.com.br/XDGIcIi',true,4,
  '["Tudo do Pro Mensal","Economia anual","Suporte VIP","Preço garantido por 12 meses"]'::jsonb);
