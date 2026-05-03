ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS pro_trial_activated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_trial_activated_at timestamptz;