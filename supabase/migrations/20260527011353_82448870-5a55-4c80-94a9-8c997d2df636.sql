
-- ============================================================
-- Fase 6 v2 — Optimization, Scalability & Operational Intelligence
-- ============================================================

-- 1) igreen_provider_health
CREATE TABLE public.igreen_provider_health (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  timeout_count INTEGER NOT NULL DEFAULT 0,
  latency_p50_ms INTEGER NOT NULL DEFAULT 0,
  latency_p95_ms INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, model)
);
GRANT ALL ON public.igreen_provider_health TO service_role;
ALTER TABLE public.igreen_provider_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full provider_health"
  ON public.igreen_provider_health FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) igreen_provider_circuit_breakers
CREATE TABLE public.igreen_provider_circuit_breakers (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, model)
);
GRANT ALL ON public.igreen_provider_circuit_breakers TO service_role;
ALTER TABLE public.igreen_provider_circuit_breakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full circuit_breakers"
  ON public.igreen_provider_circuit_breakers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) igreen_model_routing
CREATE TABLE public.igreen_model_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  account_id UUID NOT NULL,
  phone TEXT,
  selected_model TEXT NOT NULL,
  task_type TEXT NOT NULL,
  reason TEXT,
  escalated_from TEXT,
  estimated_cost_cents NUMERIC(10,4) NOT NULL DEFAULT 0,
  estimated_savings_cents NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_routing_corr ON public.igreen_model_routing (correlation_id);
CREATE INDEX idx_model_routing_acct ON public.igreen_model_routing (account_id, created_at DESC);
GRANT ALL ON public.igreen_model_routing TO service_role;
ALTER TABLE public.igreen_model_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full model_routing"
  ON public.igreen_model_routing FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) igreen_prompt_compression
CREATE TABLE public.igreen_prompt_compression (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  account_id UUID NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  ratio NUMERIC(5,4) NOT NULL,
  sections_collapsed JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prompt_comp_corr ON public.igreen_prompt_compression (correlation_id);
CREATE INDEX idx_prompt_comp_acct ON public.igreen_prompt_compression (account_id, created_at DESC);
GRANT ALL ON public.igreen_prompt_compression TO service_role;
ALTER TABLE public.igreen_prompt_compression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full prompt_compression"
  ON public.igreen_prompt_compression FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5) igreen_queue_pressure
CREATE TABLE public.igreen_queue_pressure (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  pressure_level TEXT NOT NULL CHECK (pressure_level IN ('low','medium','high','critical')),
  in_flight INTEGER NOT NULL DEFAULT 0,
  queued INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal','degraded','shed_load')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_queue_pressure_acct ON public.igreen_queue_pressure (account_id, created_at DESC);
GRANT ALL ON public.igreen_queue_pressure TO service_role;
ALTER TABLE public.igreen_queue_pressure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full queue_pressure"
  ON public.igreen_queue_pressure FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6) igreen_conversation_priority
CREATE TABLE public.igreen_conversation_priority (
  account_id UUID NOT NULL,
  phone TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'warm' CHECK (tier IN ('hot','warm','cold')),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, phone)
);
CREATE INDEX idx_conv_prio_tier ON public.igreen_conversation_priority (account_id, tier, score DESC);
GRANT ALL ON public.igreen_conversation_priority TO service_role;
ALTER TABLE public.igreen_conversation_priority ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full conv_priority"
  ON public.igreen_conversation_priority FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7) igreen_cost_profiles
CREATE TABLE public.igreen_cost_profiles (
  account_id UUID NOT NULL PRIMARY KEY,
  profile TEXT NOT NULL DEFAULT 'balanced' CHECK (profile IN ('balanced','economy','performance')),
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  daily_budget_cents NUMERIC(10,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_cost_profiles TO service_role;
ALTER TABLE public.igreen_cost_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full cost_profiles"
  ON public.igreen_cost_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8) igreen_operational_metrics
CREATE TABLE public.igreen_operational_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID,
  correlation_id TEXT,
  metric TEXT NOT NULL,
  value NUMERIC NOT NULL,
  dims JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_op_metrics_acct ON public.igreen_operational_metrics (account_id, metric, created_at DESC);
CREATE INDEX idx_op_metrics_corr ON public.igreen_operational_metrics (correlation_id);
GRANT ALL ON public.igreen_operational_metrics TO service_role;
ALTER TABLE public.igreen_operational_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full op_metrics"
  ON public.igreen_operational_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9) View igreen_phase6_metrics
CREATE OR REPLACE VIEW public.igreen_phase6_metrics AS
SELECT
  m.account_id,
  m.metric,
  date_trunc('hour', m.created_at) AS bucket_hour,
  COUNT(*) AS samples,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY m.value) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY m.value) AS p95,
  AVG(m.value) AS avg_value,
  SUM(m.value) AS sum_value
FROM public.igreen_operational_metrics m
WHERE m.created_at > now() - interval '7 days'
GROUP BY m.account_id, m.metric, date_trunc('hour', m.created_at);

GRANT SELECT ON public.igreen_phase6_metrics TO service_role;
