
-- Add is_igreen flag to accounts (gates Igreen-specific AI prompt injection)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_igreen boolean NOT NULL DEFAULT false;

-- Backfill: any account that has (or had) an Igreen subscription is flagged
UPDATE public.accounts a
   SET is_igreen = true
  FROM public.subscriptions s
 WHERE s.account_id = a.id
   AND (s.plan_type ILIKE 'igreen%' OR s.product_name ILIKE '%igreen%');

-- Also flag accounts created via igreen-trial-register heuristic: those with rows
-- in igreen_lead_data or igreen_scenarios linked to them (safer over-include).
UPDATE public.accounts a
   SET is_igreen = true
 WHERE EXISTS (SELECT 1 FROM public.igreen_lead_data l WHERE l.account_id = a.id)
    OR EXISTS (SELECT 1 FROM public.igreen_scenarios sc WHERE sc.account_id = a.id);

-- Stop auto-seeding Igreen products on every new account
DROP TRIGGER IF EXISTS trg_seed_igreen_products_on_account ON public.accounts;

-- Clean up: remove auto-seeded Igreen products for accounts that are NOT Igreen.
-- This prevents the agent from leaking Igreen context into unrelated businesses.
DELETE FROM public.igreen_account_products p
 USING public.accounts a
 WHERE p.account_id = a.id
   AND a.is_igreen = false;
