-- Tabela de metas por conta
CREATE TABLE public.user_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  leads_goal INTEGER NOT NULL DEFAULT 0,
  services_goal INTEGER NOT NULL DEFAULT 0,
  appointments_goal INTEGER NOT NULL DEFAULT 0,
  sales_goal INTEGER NOT NULL DEFAULT 0,
  sales_value_cents_goal BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (account_id, period_type)
);

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members manage user goals"
ON public.user_goals
FOR ALL
USING (is_account_member(account_id) AND has_account_permission(account_id, 'settings'))
WITH CHECK (is_account_member(account_id) AND has_account_permission(account_id, 'settings'));

CREATE POLICY "Users manage own user goals"
ON public.user_goals
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins manage all user goals"
ON public.user_goals
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_user_goals_updated_at
BEFORE UPDATE ON public.user_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();