UPDATE public.accounts SET is_igreen = false WHERE id = '9f9b5baf-17ab-45ae-b78b-7f12fa745567';

-- Clear igreen products and scenarios for this account so the iGreen menu/flow is no longer injected
DELETE FROM public.igreen_account_products WHERE account_id = '9f9b5baf-17ab-45ae-b78b-7f12fa745567';
DELETE FROM public.igreen_scenarios WHERE account_id = '9f9b5baf-17ab-45ae-b78b-7f12fa745567';

-- Reset AI sessions so the new (correct) prompt is reloaded immediately on next message
DELETE FROM public.whatsapp_ai_sessions WHERE account_id = '9f9b5baf-17ab-45ae-b78b-7f12fa745567';