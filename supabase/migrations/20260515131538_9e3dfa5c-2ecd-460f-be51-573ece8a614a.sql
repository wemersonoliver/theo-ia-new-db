
-- =========================================================
-- CUSTOM FOLLOW-UP MODULE
-- =========================================================

-- Flows
CREATE TABLE IF NOT EXISTS public.custom_followup_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  trigger_type text NOT NULL DEFAULT 'inactivity',
    -- inactivity | manual | crm_stage | tag | conversation_outcome
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- inactivity: { value:int, unit:'minutes'|'hours'|'days' }
    -- crm_stage:  { stage_id:uuid }
    -- tag:        { tag:text }
    -- outcome:    { outcome:'won'|'lost'|'abandoned' }
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- { tags?:text[], exclude_tags?:text[], require_contact?:bool }
  window_config jsonb NOT NULL DEFAULT
    '{"morning_start":"08:00","evening_end":"19:00","skip_sundays":true}'::jsonb,
  exclude_handoff boolean NOT NULL DEFAULT true,
  stop_on_reply boolean NOT NULL DEFAULT true,
  throttle_seconds integer NOT NULL DEFAULT 7,
  max_per_hour integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfu_flows_account ON public.custom_followup_flows(account_id);
CREATE INDEX IF NOT EXISTS idx_cfu_flows_enabled ON public.custom_followup_flows(account_id, enabled);

-- Steps
CREATE TABLE IF NOT EXISTS public.custom_followup_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.custom_followup_flows(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  position integer NOT NULL,
  type text NOT NULL DEFAULT 'text',
    -- text | audio | video | image | document | sticker
  content text,
  caption text,
  media_url text,
  media_mime text,
  media_filename text,
  delay_value integer NOT NULL DEFAULT 0,
  delay_unit text NOT NULL DEFAULT 'minutes',  -- minutes|hours|days
  variants jsonb NOT NULL DEFAULT '[]'::jsonb, -- A/B (future)
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_id, position)
);
CREATE INDEX IF NOT EXISTS idx_cfu_steps_flow ON public.custom_followup_steps(flow_id, position);

-- Enrollments
CREATE TABLE IF NOT EXISTS public.custom_followup_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.custom_followup_flows(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  phone text NOT NULL,
  contact_id uuid,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
    -- active | completed | stopped | paused | failed
  stop_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  next_scheduled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by text DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cfu_enroll_account ON public.custom_followup_enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_cfu_enroll_phone ON public.custom_followup_enrollments(account_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cfu_enroll_active
  ON public.custom_followup_enrollments(flow_id, phone)
  WHERE status = 'active';

-- Dispatch queue
CREATE TABLE IF NOT EXISTS public.custom_followup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  flow_id uuid NOT NULL REFERENCES public.custom_followup_flows(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.custom_followup_enrollments(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.custom_followup_steps(id) ON DELETE CASCADE,
  step_position integer NOT NULL,
  instance_id uuid,
  phone text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
    -- pending | sending | sent | failed | skipped
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cfu_queue_due
  ON public.custom_followup_queue(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cfu_queue_account
  ON public.custom_followup_queue(account_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_cfu_queue_enroll
  ON public.custom_followup_queue(enrollment_id);

-- updated_at triggers
CREATE TRIGGER cfu_flows_set_updated
  BEFORE UPDATE ON public.custom_followup_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER cfu_steps_set_updated
  BEFORE UPDATE ON public.custom_followup_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER cfu_enroll_set_updated
  BEFORE UPDATE ON public.custom_followup_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.custom_followup_flows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_followup_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_followup_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_followup_queue       ENABLE ROW LEVEL SECURITY;

-- Flows
CREATE POLICY "cfu_flows_select" ON public.custom_followup_flows
  FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY "cfu_flows_insert" ON public.custom_followup_flows
  FOR INSERT WITH CHECK (public.is_account_member(account_id) AND user_id = auth.uid());
CREATE POLICY "cfu_flows_update" ON public.custom_followup_flows
  FOR UPDATE USING (public.is_account_member(account_id));
CREATE POLICY "cfu_flows_delete" ON public.custom_followup_flows
  FOR DELETE USING (public.is_account_member(account_id));

-- Steps
CREATE POLICY "cfu_steps_select" ON public.custom_followup_steps
  FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY "cfu_steps_insert" ON public.custom_followup_steps
  FOR INSERT WITH CHECK (public.is_account_member(account_id));
CREATE POLICY "cfu_steps_update" ON public.custom_followup_steps
  FOR UPDATE USING (public.is_account_member(account_id));
CREATE POLICY "cfu_steps_delete" ON public.custom_followup_steps
  FOR DELETE USING (public.is_account_member(account_id));

-- Enrollments
CREATE POLICY "cfu_enroll_select" ON public.custom_followup_enrollments
  FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY "cfu_enroll_insert" ON public.custom_followup_enrollments
  FOR INSERT WITH CHECK (public.is_account_member(account_id));
CREATE POLICY "cfu_enroll_update" ON public.custom_followup_enrollments
  FOR UPDATE USING (public.is_account_member(account_id));
CREATE POLICY "cfu_enroll_delete" ON public.custom_followup_enrollments
  FOR DELETE USING (public.is_account_member(account_id));

-- Queue (read-only for users; writes happen via service role)
CREATE POLICY "cfu_queue_select" ON public.custom_followup_queue
  FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY "cfu_queue_insert" ON public.custom_followup_queue
  FOR INSERT WITH CHECK (public.is_account_member(account_id));
CREATE POLICY "cfu_queue_update" ON public.custom_followup_queue
  FOR UPDATE USING (public.is_account_member(account_id));
CREATE POLICY "cfu_queue_delete" ON public.custom_followup_queue
  FOR DELETE USING (public.is_account_member(account_id));

-- =========================================================
-- STORAGE bucket for followup media
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('followup-media', 'followup-media', false)
ON CONFLICT (id) DO NOTHING;

-- Path layout: <account_id>/<flow_id>/<filename>
CREATE POLICY "cfu_media_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'followup-media'
    AND public.is_account_member( ((storage.foldername(name))[1])::uuid )
  );

CREATE POLICY "cfu_media_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'followup-media'
    AND public.is_account_member( ((storage.foldername(name))[1])::uuid )
  );

CREATE POLICY "cfu_media_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'followup-media'
    AND public.is_account_member( ((storage.foldername(name))[1])::uuid )
  );

CREATE POLICY "cfu_media_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'followup-media'
    AND public.is_account_member( ((storage.foldername(name))[1])::uuid )
  );

-- =========================================================
-- Helper: cancel active enrollments when contact replies / handoff
-- =========================================================
CREATE OR REPLACE FUNCTION public.custom_followup_stop_for_phone(
  _account_id uuid, _phone text, _reason text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected int := 0;
BEGIN
  UPDATE public.custom_followup_enrollments
     SET status = 'stopped', stop_reason = _reason, updated_at = now()
   WHERE account_id = _account_id
     AND phone = _phone
     AND status = 'active';
  GET DIAGNOSTICS affected = ROW_COUNT;

  DELETE FROM public.custom_followup_queue q
   USING public.custom_followup_enrollments e
   WHERE q.enrollment_id = e.id
     AND e.account_id = _account_id
     AND e.phone = _phone
     AND q.status = 'pending';

  RETURN affected;
END;
$$;
