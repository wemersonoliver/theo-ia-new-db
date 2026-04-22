-- Tabela de tarefas dos negócios do CRM
CREATE TABLE public.crm_deal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  user_id uuid NOT NULL,
  account_id uuid,
  assigned_to uuid,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_crm_deal_tasks_deal_id ON public.crm_deal_tasks(deal_id);
CREATE INDEX idx_crm_deal_tasks_account_id ON public.crm_deal_tasks(account_id);
CREATE INDEX idx_crm_deal_tasks_assigned_to ON public.crm_deal_tasks(assigned_to);
CREATE INDEX idx_crm_deal_tasks_due_date ON public.crm_deal_tasks(due_date) WHERE completed = false;

-- Habilita RLS
ALTER TABLE public.crm_deal_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users manage own deal tasks"
ON public.crm_deal_tasks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team members manage deal tasks"
ON public.crm_deal_tasks
FOR ALL
USING (
  is_account_member(account_id)
  AND has_account_permission(account_id, 'crm')
)
WITH CHECK (
  is_account_member(account_id)
  AND has_account_permission(account_id, 'crm')
);

-- Trigger updated_at
CREATE TRIGGER trg_crm_deal_tasks_updated_at
BEFORE UPDATE ON public.crm_deal_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();