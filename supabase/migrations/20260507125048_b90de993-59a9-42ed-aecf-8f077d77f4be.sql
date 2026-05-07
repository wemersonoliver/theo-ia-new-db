-- Add business data fields to admin_crm_deals
ALTER TABLE public.admin_crm_deals
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_segment text,
  ADD COLUMN IF NOT EXISTS business_summary text,
  ADD COLUMN IF NOT EXISTS business_data_updated_at timestamptz;

-- admin_crm_activities (timeline)
CREATE TABLE IF NOT EXISTS public.admin_crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_crm_activities_deal ON public.admin_crm_activities(deal_id, created_at DESC);
ALTER TABLE public.admin_crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins manage admin activities" ON public.admin_crm_activities;
CREATE POLICY "Super admins manage admin activities" ON public.admin_crm_activities
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- admin_crm_deal_tasks
CREATE TABLE IF NOT EXISTS public.admin_crm_deal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  assigned_to uuid,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  reminder_sent boolean NOT NULL DEFAULT false,
  reminder_sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_crm_deal_tasks_deal ON public.admin_crm_deal_tasks(deal_id, due_date);
ALTER TABLE public.admin_crm_deal_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins manage admin deal tasks" ON public.admin_crm_deal_tasks;
CREATE POLICY "Super admins manage admin deal tasks" ON public.admin_crm_deal_tasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP TRIGGER IF EXISTS trg_admin_crm_deal_tasks_updated_at ON public.admin_crm_deal_tasks;
CREATE TRIGGER trg_admin_crm_deal_tasks_updated_at
  BEFORE UPDATE ON public.admin_crm_deal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-log stage changes / won / lost on admin_crm_deals
CREATE OR REPLACE FUNCTION public.trg_admin_crm_deal_log_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_stage_name text;
  new_stage_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT name INTO old_stage_name FROM public.admin_crm_stages WHERE id = OLD.stage_id;
    SELECT name INTO new_stage_name FROM public.admin_crm_stages WHERE id = NEW.stage_id;
    INSERT INTO public.admin_crm_activities (deal_id, type, content, metadata, created_by)
    VALUES (NEW.id, 'stage_change',
      'Etapa alterada de "' || COALESCE(old_stage_name,'?') || '" para "' || COALESCE(new_stage_name,'?') || '"',
      jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id),
      auth.uid());
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.won_at IS NOT NULL AND OLD.won_at IS NULL THEN
    INSERT INTO public.admin_crm_activities (deal_id, type, content, created_by)
    VALUES (NEW.id, 'won', 'Negócio marcado como Ganho 🎉', auth.uid());
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.lost_at IS NOT NULL AND OLD.lost_at IS NULL THEN
    INSERT INTO public.admin_crm_activities (deal_id, type, content, created_by)
    VALUES (NEW.id, 'lost', 'Negócio perdido' || COALESCE('. Motivo: ' || NEW.lost_reason, ''), auth.uid());
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.business_name IS DISTINCT FROM OLD.business_name
       OR NEW.business_segment IS DISTINCT FROM OLD.business_segment
       OR NEW.business_summary IS DISTINCT FROM OLD.business_summary) THEN
    INSERT INTO public.admin_crm_activities (deal_id, type, content, created_by)
    VALUES (NEW.id, 'business_update', 'Dados do negócio atualizados', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_crm_deal_log ON public.admin_crm_deals;
CREATE TRIGGER trg_admin_crm_deal_log
  AFTER UPDATE ON public.admin_crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_admin_crm_deal_log_changes();