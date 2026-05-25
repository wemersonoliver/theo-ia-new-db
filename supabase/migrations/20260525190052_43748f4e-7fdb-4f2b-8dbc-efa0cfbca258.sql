
-- ============================================================
-- IGREEN V2 — FASE 1 (FUNDAÇÃO)
-- 9 tabelas + retenção via pg_cron
-- Isoladas, sem impacto no SaaS genérico
-- ============================================================

-- 1) State vivo (fonte da verdade) ---------------------------
CREATE TABLE IF NOT EXISTS public.igreen_conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  produto text,                    -- green | telecom | expansao
  etapa_funil text,                -- descoberta, video_enviado, qualificacao, ...
  specialist text,
  intent text,
  handoff_ativo boolean NOT NULL DEFAULT false,
  fatura_valida boolean,
  identidade_validada boolean,
  holder_match boolean,
  lead_score integer NOT NULL DEFAULT 0,
  lead_temperature text,           -- cold | warm | hot
  extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_igreen_state_account_phone ON public.igreen_conversation_state(account_id, phone);
CREATE INDEX IF NOT EXISTS idx_igreen_state_etapa ON public.igreen_conversation_state(etapa_funil);

-- 2) Snapshots estratégicos ----------------------------------
CREATE TABLE IF NOT EXISTS public.igreen_state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  reason text NOT NULL,            -- before_document_validation, after_handoff, etc.
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_igreen_snapshots_account_phone ON public.igreen_state_snapshots(account_id, phone, created_at DESC);

-- 3) Event sourcing com prioridade ---------------------------
CREATE TABLE IF NOT EXISTS public.igreen_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  event_type text NOT NULL,
  event_priority text NOT NULL DEFAULT 'medium' CHECK (event_priority IN ('low','medium','high','critical')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,                     -- supervisor | specialist | tool | automation | fast_path
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_igreen_events_account_phone ON public.igreen_state_events(account_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_igreen_events_priority ON public.igreen_state_events(event_priority, created_at DESC);

-- 4) Traces com nível ----------------------------------------
CREATE TABLE IF NOT EXISTS public.igreen_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text,
  trace_level text NOT NULL DEFAULT 'standard' CHECK (trace_level IN ('minimal','standard','debug')),
  step text NOT NULL,              -- load_state, fast_path, supervisor, specialist, tool, automation, send
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_igreen_traces_account_phone ON public.igreen_traces(account_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_igreen_traces_level ON public.igreen_traces(trace_level, created_at DESC);

-- 5) Validações documentais ---------------------------------
CREATE TABLE IF NOT EXISTS public.igreen_document_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  kind text NOT NULL,              -- invoice | identity
  provider text NOT NULL DEFAULT 'gemini',
  classification text,
  confidence numeric(4,3),
  threshold_decision text,         -- auto_approve | request_soft_confirmation | reject_resend
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid boolean,
  reject_reason text,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_igreen_docval_account_phone ON public.igreen_document_validations(account_id, phone, created_at DESC);

-- 6) Timeouts agendados --------------------------------------
CREATE TABLE IF NOT EXISTS public.igreen_timeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  etapa text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  executed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_igreen_timeouts_due ON public.igreen_timeouts(scheduled_at) WHERE executed_at IS NULL AND cancelled_at IS NULL;

-- 7) Tool execution guard (D4) -------------------------------
CREATE TABLE IF NOT EXISTS public.igreen_tool_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  tool text NOT NULL,
  lock_key text NOT NULL DEFAULT 'default',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, phone, tool, lock_key)
);
CREATE INDEX IF NOT EXISTS idx_igreen_tool_locks_expires ON public.igreen_tool_locks(expires_at);

-- 8) Observability config por account ------------------------
CREATE TABLE IF NOT EXISTS public.igreen_observability_config (
  account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  trace_level text NOT NULL DEFAULT 'standard' CHECK (trace_level IN ('minimal','standard','debug')),
  retention_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9) Automation executions (D15 — idempotência) --------------
CREATE TABLE IF NOT EXISTS public.igreen_automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone text,
  automation text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS idx_igreen_autoexec_account ON public.igreen_automation_executions(account_id, automation, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_igreen_autoexec_expires ON public.igreen_automation_executions(expires_at);

-- ============================================================
-- RLS — todas as tabelas (acesso só via service role + members)
-- ============================================================
ALTER TABLE public.igreen_conversation_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.igreen_state_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.igreen_state_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.igreen_traces                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.igreen_document_validations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.igreen_timeouts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.igreen_tool_locks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.igreen_observability_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.igreen_automation_executions ENABLE ROW LEVEL SECURITY;

-- Policy padrão: membros da account leem; super_admin lê tudo; escrita só via service role
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'igreen_conversation_state','igreen_state_snapshots','igreen_state_events',
    'igreen_traces','igreen_document_validations','igreen_timeouts',
    'igreen_tool_locks','igreen_observability_config','igreen_automation_executions'
  ]) LOOP
    EXECUTE format($f$
      CREATE POLICY "members read %1$I"
      ON public.%1$I FOR SELECT
      USING (
        public.is_account_member(account_id)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      );
    $f$, t);
  END LOOP;
END $$;

-- ============================================================
-- RETENÇÃO via pg_cron
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Traces
SELECT cron.schedule(
  'igreen_v2_cleanup_traces',
  '17 3 * * *',
  $$
    DELETE FROM public.igreen_traces
     WHERE (trace_level = 'debug'    AND created_at < now() - interval '7 days')
        OR (trace_level = 'standard' AND created_at < now() - interval '30 days')
        OR (trace_level = 'minimal'  AND created_at < now() - interval '90 days');
  $$
);

-- Events (critical permanente)
SELECT cron.schedule(
  'igreen_v2_cleanup_events',
  '23 3 * * *',
  $$
    DELETE FROM public.igreen_state_events
     WHERE (event_priority = 'high'   AND created_at < now() - interval '180 days')
        OR (event_priority = 'medium' AND created_at < now() - interval '60 days')
        OR (event_priority = 'low'    AND created_at < now() - interval '14 days');
  $$
);

-- Tool locks expirados (a cada 15 min)
SELECT cron.schedule(
  'igreen_v2_cleanup_tool_locks',
  '*/15 * * * *',
  $$ DELETE FROM public.igreen_tool_locks WHERE expires_at < now(); $$
);

-- Automation executions expirados
SELECT cron.schedule(
  'igreen_v2_cleanup_autoexec',
  '41 3 * * *',
  $$ DELETE FROM public.igreen_automation_executions WHERE expires_at < now(); $$
);

-- updated_at trigger no state
CREATE TRIGGER trg_igreen_state_updated_at
BEFORE UPDATE ON public.igreen_conversation_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
