ALTER TABLE public.roulette_config
  ADD COLUMN IF NOT EXISTS require_acceptance boolean NOT NULL DEFAULT false;