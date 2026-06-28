UPDATE public.igreen_conversation_state
SET extras = COALESCE(extras,'{}'::jsonb) - 'soft_closed' - 'soft_closed_at' - 'signup_declined_at'
            || jsonb_build_object('cost_clarified', false),
    etapa_funil = 'confirm_signup',
    updated_at = now()
WHERE phone='5519988331972'
  AND account_id = (SELECT account_id FROM public.accounts WHERE owner_user_id='fbc9254d-6577-468d-adba-5d639ed0e759' LIMIT 1);