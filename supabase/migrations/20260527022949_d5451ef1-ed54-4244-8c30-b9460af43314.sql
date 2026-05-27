DO $$
DECLARE
  acc uuid := '2cf994fc-4a1b-440c-be8b-c91a5c25fd32';
  ph text := '5594981091975';
BEGIN
  DELETE FROM public.igreen_conversation_state WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_conversation_priority WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_state_events WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_state_snapshots WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_traces WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_transport_events WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_memory_window WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_memory_summaries WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_tool_locks WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_timeouts WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_token_usage WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_model_routing WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_automation_executions WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_document_validations WHERE account_id = acc AND phone = ph;
  DELETE FROM public.igreen_cancellations WHERE account_id = acc AND phone = ph;
END $$;