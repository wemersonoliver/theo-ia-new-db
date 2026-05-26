-- ============================================================
-- Phase 5 v2 — Transport / Memory / RAG / Cost Governor
-- 12 tables + 1 view + GRANT + RLS + indices
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- 1. igreen_transport_events
-- ------------------------------------------------------------
CREATE TABLE public.igreen_transport_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correlation_id text NOT NULL,
  account_id uuid,
  phone text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT igreen_transport_events_unique UNIQUE (correlation_id, chunk_index)
);
GRANT ALL ON public.igreen_transport_events TO service_role;
ALTER TABLE public.igreen_transport_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_transport_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_transport_events_phone ON public.igreen_transport_events (phone, created_at DESC);
CREATE INDEX idx_igreen_transport_events_corr ON public.igreen_transport_events (correlation_id);

-- ------------------------------------------------------------
-- 2. igreen_memory_window
-- ------------------------------------------------------------
CREATE TABLE public.igreen_memory_window (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  phone text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  correlation_id text,
  token_count integer DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
GRANT ALL ON public.igreen_memory_window TO service_role;
ALTER TABLE public.igreen_memory_window ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_memory_window
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_memory_window_phone ON public.igreen_memory_window (account_id, phone, created_at DESC);
CREATE INDEX idx_igreen_memory_window_expires ON public.igreen_memory_window (expires_at) WHERE expires_at IS NOT NULL;

-- ------------------------------------------------------------
-- 3. igreen_memory_summaries
-- ------------------------------------------------------------
CREATE TABLE public.igreen_memory_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  phone text NOT NULL,
  summary text NOT NULL,
  token_count integer DEFAULT 0,
  source_message_count integer DEFAULT 0,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_memory_summaries TO service_role;
ALTER TABLE public.igreen_memory_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_memory_summaries
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_memory_summaries_phone ON public.igreen_memory_summaries (account_id, phone, created_at DESC);

-- ------------------------------------------------------------
-- 4. igreen_knowledge_chunks
-- ------------------------------------------------------------
CREATE TABLE public.igreen_knowledge_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid,
  source_id text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(1536),
  token_count integer DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_knowledge_chunks TO service_role;
ALTER TABLE public.igreen_knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_knowledge_chunks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_knowledge_chunks_source ON public.igreen_knowledge_chunks (account_id, source_id);
CREATE INDEX idx_igreen_knowledge_chunks_embedding
  ON public.igreen_knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------
-- 5. igreen_rag_cache
-- ------------------------------------------------------------
CREATE TABLE public.igreen_rag_cache (
  query_hash text NOT NULL PRIMARY KEY,
  account_id uuid,
  query_preview text,
  result jsonb NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);
GRANT ALL ON public.igreen_rag_cache TO service_role;
ALTER TABLE public.igreen_rag_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_rag_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_rag_cache_expires ON public.igreen_rag_cache (expires_at) WHERE expires_at IS NOT NULL;

-- ------------------------------------------------------------
-- 6. igreen_rag_traces
-- ------------------------------------------------------------
CREATE TABLE public.igreen_rag_traces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correlation_id text NOT NULL,
  account_id uuid,
  query text NOT NULL,
  query_hash text,
  cache_hit boolean NOT NULL DEFAULT false,
  chunks_returned integer NOT NULL DEFAULT 0,
  top_score numeric,
  latency_ms integer,
  tokens_used integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_rag_traces TO service_role;
ALTER TABLE public.igreen_rag_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_rag_traces
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_rag_traces_corr ON public.igreen_rag_traces (correlation_id);
CREATE INDEX idx_igreen_rag_traces_created ON public.igreen_rag_traces (created_at DESC);

-- ------------------------------------------------------------
-- 7. igreen_account_limits
-- ------------------------------------------------------------
CREATE TABLE public.igreen_account_limits (
  account_id uuid NOT NULL PRIMARY KEY,
  daily_input_tokens integer NOT NULL DEFAULT 400000,
  daily_output_tokens integer NOT NULL DEFAULT 80000,
  per_turn_input_tokens integer NOT NULL DEFAULT 6000,
  per_turn_output_tokens integer NOT NULL DEFAULT 1200,
  rate_per_phone_per_min integer NOT NULL DEFAULT 8,
  rate_per_account_per_min integer NOT NULL DEFAULT 120,
  context_total_budget integer NOT NULL DEFAULT 8000,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_account_limits TO service_role;
ALTER TABLE public.igreen_account_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_account_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 8. igreen_rate_buckets (token-bucket atômico, Postgres-only)
-- ------------------------------------------------------------
CREATE TABLE public.igreen_rate_buckets (
  bucket_key text NOT NULL PRIMARY KEY,
  tokens numeric NOT NULL DEFAULT 0,
  capacity numeric NOT NULL DEFAULT 0,
  refill_rate numeric NOT NULL DEFAULT 0,
  last_refill_at timestamptz NOT NULL DEFAULT now(),
  scope text NOT NULL DEFAULT 'phone',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_rate_buckets TO service_role;
ALTER TABLE public.igreen_rate_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_rate_buckets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 9. igreen_cancellations
-- ------------------------------------------------------------
CREATE TABLE public.igreen_cancellations (
  correlation_id text NOT NULL PRIMARY KEY,
  account_id uuid,
  phone text,
  reason text NOT NULL DEFAULT 'lead_replied',
  cancelled_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_cancellations TO service_role;
ALTER TABLE public.igreen_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_cancellations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_cancellations_phone ON public.igreen_cancellations (phone, cancelled_at DESC);

-- ------------------------------------------------------------
-- 10. igreen_token_usage
-- ------------------------------------------------------------
CREATE TABLE public.igreen_token_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  correlation_id text,
  phone text,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_token_usage TO service_role;
ALTER TABLE public.igreen_token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_token_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_token_usage_account ON public.igreen_token_usage (account_id, created_at DESC);
CREATE INDEX idx_igreen_token_usage_corr ON public.igreen_token_usage (correlation_id);

-- ------------------------------------------------------------
-- 11. igreen_context_allocations
-- ------------------------------------------------------------
CREATE TABLE public.igreen_context_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correlation_id text NOT NULL,
  account_id uuid,
  section text NOT NULL,
  budget integer NOT NULL,
  used integer NOT NULL,
  truncated boolean NOT NULL DEFAULT false,
  truncation_strategy text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.igreen_context_allocations TO service_role;
ALTER TABLE public.igreen_context_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_context_allocations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_context_allocations_corr ON public.igreen_context_allocations (correlation_id, section);

-- ------------------------------------------------------------
-- 12. igreen_tool_output_cache
-- ------------------------------------------------------------
CREATE TABLE public.igreen_tool_output_cache (
  output_hash text NOT NULL PRIMARY KEY,
  tool_name text NOT NULL,
  original_tokens integer NOT NULL,
  summary text NOT NULL,
  summary_tokens integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours')
);
GRANT ALL ON public.igreen_tool_output_cache TO service_role;
ALTER TABLE public.igreen_tool_output_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.igreen_tool_output_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_igreen_tool_output_cache_expires ON public.igreen_tool_output_cache (expires_at) WHERE expires_at IS NOT NULL;

-- ------------------------------------------------------------
-- View: igreen_phase5_metrics
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.igreen_phase5_metrics AS
SELECT
  (SELECT count(*) FROM public.igreen_rag_traces WHERE created_at > now() - interval '24 hours') AS rag_calls_24h,
  (SELECT count(*) FROM public.igreen_rag_traces WHERE cache_hit = true AND created_at > now() - interval '24 hours') AS rag_cache_hits_24h,
  CASE WHEN (SELECT count(*) FROM public.igreen_rag_traces WHERE created_at > now() - interval '24 hours') > 0
       THEN ROUND(100.0 * (SELECT count(*) FROM public.igreen_rag_traces WHERE cache_hit = true AND created_at > now() - interval '24 hours')
                       / (SELECT count(*) FROM public.igreen_rag_traces WHERE created_at > now() - interval '24 hours'), 2)
       ELSE 0 END AS rag_cache_hit_rate_pct,
  (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FROM public.igreen_rag_traces WHERE created_at > now() - interval '24 hours') AS rag_latency_p50_ms,
  (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FROM public.igreen_rag_traces WHERE created_at > now() - interval '24 hours') AS rag_latency_p95_ms,
  (SELECT coalesce(sum(input_tokens), 0) FROM public.igreen_token_usage WHERE created_at > now() - interval '24 hours') AS input_tokens_24h,
  (SELECT coalesce(sum(output_tokens), 0) FROM public.igreen_token_usage WHERE created_at > now() - interval '24 hours') AS output_tokens_24h,
  (SELECT count(*) FROM public.igreen_transport_events WHERE created_at > now() - interval '24 hours') AS transport_events_24h,
  (SELECT count(*) FROM public.igreen_context_allocations WHERE truncated = true AND created_at > now() - interval '24 hours') AS context_truncations_24h;

GRANT SELECT ON public.igreen_phase5_metrics TO service_role;