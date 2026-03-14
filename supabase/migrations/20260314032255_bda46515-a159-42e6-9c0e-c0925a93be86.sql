
-- CRM Pipelines
CREATE TABLE public.crm_pipelines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Vendas',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pipelines" ON public.crm_pipelines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_crm_pipelines_updated_at BEFORE UPDATE ON public.crm_pipelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CRM Stages
CREATE TABLE public.crm_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stages" ON public.crm_stages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_crm_stages_updated_at BEFORE UPDATE ON public.crm_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CRM Deals
CREATE TABLE public.crm_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  value_cents integer,
  priority text NOT NULL DEFAULT 'medium',
  expected_close_date date,
  description text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  position integer NOT NULL DEFAULT 0,
  won_at timestamp with time zone,
  lost_at timestamp with time zone,
  lost_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deals" ON public.crm_deals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_crm_deals_updated_at BEFORE UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CRM Activities
CREATE TABLE public.crm_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own activities" ON public.crm_activities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
