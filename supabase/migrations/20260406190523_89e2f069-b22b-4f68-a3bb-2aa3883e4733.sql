
-- Admin CRM Pipelines
CREATE TABLE public.admin_crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Clientes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_crm_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage admin pipelines" ON public.admin_crm_pipelines FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin CRM Stages
CREATE TABLE public.admin_crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.admin_crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_crm_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage admin stages" ON public.admin_crm_stages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin CRM Deals
CREATE TABLE public.admin_crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.admin_crm_stages(id) ON DELETE CASCADE,
  user_ref_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  value_cents integer,
  priority text NOT NULL DEFAULT 'medium',
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  position integer NOT NULL DEFAULT 0,
  onboarding_completed boolean NOT NULL DEFAULT false,
  subscription_status text,
  subscription_plan text,
  expected_close_date date,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_crm_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage admin deals" ON public.admin_crm_deals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_admin_crm_pipelines_updated_at BEFORE UPDATE ON public.admin_crm_pipelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_crm_stages_updated_at BEFORE UPDATE ON public.admin_crm_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_crm_deals_updated_at BEFORE UPDATE ON public.admin_crm_deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default pipeline and stages
INSERT INTO public.admin_crm_pipelines (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Clientes');
INSERT INTO public.admin_crm_stages (pipeline_id, name, position, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Novo Cadastro', 0, '#6366f1'),
  ('00000000-0000-0000-0000-000000000001', 'Onboarding Concluído', 1, '#8b5cf6'),
  ('00000000-0000-0000-0000-000000000001', 'Trial', 2, '#f59e0b'),
  ('00000000-0000-0000-0000-000000000001', 'Assinante Ativo', 3, '#22c55e'),
  ('00000000-0000-0000-0000-000000000001', 'Cancelado', 4, '#ef4444');

-- Function to auto-create deal on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_admin_deal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  first_stage_id uuid;
  deal_position integer;
  user_name text;
BEGIN
  -- Get the first stage of the first pipeline
  SELECT s.id INTO first_stage_id
  FROM public.admin_crm_stages s
  JOIN public.admin_crm_pipelines p ON p.id = s.pipeline_id
  ORDER BY p.created_at ASC, s.position ASC
  LIMIT 1;

  IF first_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count existing deals in that stage for position
  SELECT COALESCE(MAX(position), -1) + 1 INTO deal_position
  FROM public.admin_crm_deals WHERE stage_id = first_stage_id;

  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.admin_crm_deals (stage_id, user_ref_id, title, position, onboarding_completed)
  VALUES (first_stage_id, NEW.id, user_name, deal_position, false);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_admin_deal
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin_deal();
