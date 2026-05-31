-- Reset iGreen flow state for test phone 5547989118695 (account 2cf994fc-...)
-- so the next test starts the journey from scratch (without erasing the visual chat history).

DELETE FROM public.igreen_conversation_state
WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
  AND phone = '5547989118695';

DELETE FROM public.igreen_lead_data
WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
  AND phone = '5547989118695';

DELETE FROM public.igreen_document_validations
WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
  AND phone = '5547989118695';

DELETE FROM public.igreen_state_events
WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
  AND phone = '5547989118695';

DELETE FROM public.igreen_transport_events
WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
  AND phone = '5547989118695';

DELETE FROM public.igreen_automation_executions
WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
  AND phone = '5547989118695';
