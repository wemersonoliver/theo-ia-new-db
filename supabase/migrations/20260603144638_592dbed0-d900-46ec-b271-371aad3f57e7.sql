-- Conserta estado do lead Wemerson (5547989118695) após bug de transição
-- qualificacao -> fatura_validada que havia sido rejeitado pelo state-engine.
UPDATE public.igreen_conversation_state
   SET etapa_funil    = 'fatura_validada',
       document_status = 'validated',
       extras = COALESCE(extras, '{}'::jsonb)
                || jsonb_build_object(
                     'invoice_validated_match', true,
                     'invoice_match_third_party', false,
                     'invoice_rejected_notified', false,
                     'last_media_reject_reason', NULL,
                     'identity_requested', true
                   ),
       version = version + 1,
       updated_at = now()
 WHERE phone = '5547989118695'
   AND etapa_funil = 'qualificacao'
   AND fatura_valida = true;