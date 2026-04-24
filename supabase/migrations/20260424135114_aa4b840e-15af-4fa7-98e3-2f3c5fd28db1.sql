-- Adiciona campo de controle de lembrete enviado em tarefas do CRM
ALTER TABLE public.crm_deal_tasks
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_crm_deal_tasks_reminder
  ON public.crm_deal_tasks (due_date, reminder_sent, completed)
  WHERE reminder_sent = false AND completed = false;