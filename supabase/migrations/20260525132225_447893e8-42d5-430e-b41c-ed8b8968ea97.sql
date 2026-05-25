UPDATE public.accounts SET is_igreen = false WHERE id = '3f304fb6-fd4e-46d0-9831-b23fabd37b7a';
DELETE FROM public.igreen_account_products WHERE account_id = '3f304fb6-fd4e-46d0-9831-b23fabd37b7a';
DELETE FROM public.igreen_scenarios WHERE account_id = '3f304fb6-fd4e-46d0-9831-b23fabd37b7a';
DELETE FROM public.whatsapp_ai_sessions WHERE account_id = '3f304fb6-fd4e-46d0-9831-b23fabd37b7a';