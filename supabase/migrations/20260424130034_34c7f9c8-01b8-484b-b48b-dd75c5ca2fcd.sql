-- Permitir que membros da mesma conta vejam o profile uns dos outros
CREATE POLICY "Account members can read each other profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.account_members am1
    JOIN public.account_members am2 ON am2.account_id = am1.account_id
    WHERE am1.user_id = auth.uid()
      AND am1.status = 'active'
      AND am2.user_id = profiles.user_id
      AND am2.status != 'removed'
  )
);