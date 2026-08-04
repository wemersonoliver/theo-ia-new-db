UPDATE public.whatsapp_conversations
SET ai_active = true,
    updated_at = now()
WHERE id = 'a155c8ba-3c5a-4b0e-a528-b413ce28b7eb'
  AND user_id = '744e33a8-3b85-4593-948e-bcaf81f8397b'
  AND phone = '5547991293662';

UPDATE public.whatsapp_ai_sessions
SET status = 'active',
    handed_off_at = NULL,
    updated_at = now()
WHERE user_id = '744e33a8-3b85-4593-948e-bcaf81f8397b'
  AND phone = '5547991293662';