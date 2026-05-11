
-- ATTENDANCE FLOWS (campanhas estilo Typebot no WhatsApp do sistema)

CREATE TABLE public.attendance_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_text text NOT NULL,
  trigger_match_mode text NOT NULL DEFAULT 'exact' CHECK (trigger_match_mode IN ('exact','contains')),
  is_active boolean NOT NULL DEFAULT true,
  pause_support_ai boolean NOT NULL DEFAULT true,
  only_first_contact boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_flow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.attendance_flows(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('text','audio','video','image','link','delay')),
  content text,
  caption text,
  media_path text,
  media_url text,
  delay_before_seconds integer NOT NULL DEFAULT 0,
  typing_indicator boolean NOT NULL DEFAULT true,
  recording_indicator boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flow_steps_flow ON public.attendance_flow_steps(flow_id, position);

CREATE TABLE public.attendance_flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.attendance_flows(id) ON DELETE CASCADE,
  phone text NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','canceled','error')),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger_message text
);
CREATE INDEX idx_flow_runs_due ON public.attendance_flow_runs(status, next_run_at);
CREATE UNIQUE INDEX idx_flow_runs_unique_running ON public.attendance_flow_runs(flow_id, phone) WHERE status = 'running';

-- RLS
ALTER TABLE public.attendance_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_flow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage flows" ON public.attendance_flows
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins manage flow steps" ON public.attendance_flow_steps
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins manage flow runs" ON public.attendance_flow_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Triggers updated_at
CREATE TRIGGER trg_flows_updated BEFORE UPDATE ON public.attendance_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_flow_steps_updated BEFORE UPDATE ON public.attendance_flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-flow-media', 'attendance-flow-media', false);

CREATE POLICY "Super admins read flow media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-flow-media' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins upload flow media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance-flow-media' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins update flow media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attendance-flow-media' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins delete flow media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attendance-flow-media' AND public.has_role(auth.uid(), 'super_admin'::app_role));

-- Cron: a cada 30s processa fila
SELECT cron.schedule(
  'attendance-flow-tick',
  '30 seconds',
  $$
  select net.http_post(
    url := 'https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/attendance-flow-dispatch',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );
  $$
);
