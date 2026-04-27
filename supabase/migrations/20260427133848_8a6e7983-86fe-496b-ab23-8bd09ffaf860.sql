ALTER TABLE public.followup_config
ADD COLUMN IF NOT EXISTS inactivity_unit text NOT NULL DEFAULT 'hours'
CHECK (inactivity_unit IN ('minutes', 'hours'));