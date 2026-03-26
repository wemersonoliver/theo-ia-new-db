
-- Add user_code column to profiles with a sequence starting at 100
CREATE SEQUENCE IF NOT EXISTS profiles_user_code_seq START WITH 100;

ALTER TABLE public.profiles 
ADD COLUMN user_code integer UNIQUE DEFAULT nextval('profiles_user_code_seq');

-- Backfill existing profiles that don't have a user_code
UPDATE public.profiles SET user_code = nextval('profiles_user_code_seq') WHERE user_code IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN user_code SET NOT NULL;
