
ALTER TABLE public.igreen_conversation_state
  ADD COLUMN IF NOT EXISTS document_status text,
  ADD COLUMN IF NOT EXISTS document_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS holder_match_status text,
  ADD COLUMN IF NOT EXISTS validation_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_version int NOT NULL DEFAULT 1;

ALTER TABLE public.igreen_traces                ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.igreen_state_events          ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.igreen_automation_executions ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.igreen_document_validations
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS pipeline_version int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_igreen_traces_corr     ON public.igreen_traces(correlation_id);
CREATE INDEX IF NOT EXISTS idx_igreen_events_corr     ON public.igreen_state_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_igreen_autom_corr      ON public.igreen_automation_executions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_igreen_doc_val_corr    ON public.igreen_document_validations(correlation_id);
