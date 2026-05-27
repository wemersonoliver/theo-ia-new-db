
-- Reset stuck handoff state for the Thays test contact (account 2cf994fc-4a1b-440c-be8b-c91a5c25fd32 / phone 5594981091975)
UPDATE public.igreen_conversation_state
   SET handoff_ativo = false,
       specialist = NULL,
       updated_at = now()
 WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
   AND phone = '5594981091975';

-- Garante que a IA volte a poder rodar (lock liberado e IA ativa)
UPDATE public.whatsapp_conversations
   SET ai_processing_until = NULL,
       ai_active = true,
       updated_at = now()
 WHERE account_id = '2cf994fc-4a1b-440c-be8b-c91a5c25fd32'
   AND phone = '5594981091975';
