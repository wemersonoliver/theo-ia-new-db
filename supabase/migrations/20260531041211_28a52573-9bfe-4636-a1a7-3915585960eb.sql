DO $$
DECLARE
  v_account uuid := '2cf994fc-4a1b-440c-be8b-c91a5c25fd32';
  v_phone text := '5547989118695';
BEGIN
  DELETE FROM public.igreen_conversation_state WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM public.igreen_lead_data WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM public.igreen_document_validations WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM public.igreen_state_events WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM public.igreen_transport_events WHERE account_id = v_account AND phone = v_phone;
  DELETE FROM public.igreen_automation_executions WHERE account_id = v_account AND phone = v_phone;
END $$;