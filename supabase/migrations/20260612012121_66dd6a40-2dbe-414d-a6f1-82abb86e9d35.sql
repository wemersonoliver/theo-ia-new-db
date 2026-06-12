ALTER TABLE public.igreen_account_products ADD COLUMN IF NOT EXISTS signup_url text;
ALTER TABLE public.igreen_products ADD COLUMN IF NOT EXISTS signup_url text;