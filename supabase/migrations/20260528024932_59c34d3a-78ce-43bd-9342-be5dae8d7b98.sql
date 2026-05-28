UPDATE public.igreen_conversation_state
SET handoff_ativo = false,
    specialist = NULL,
    intent = NULL,
    updated_at = now()
WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
  AND phone = '5547989118695';