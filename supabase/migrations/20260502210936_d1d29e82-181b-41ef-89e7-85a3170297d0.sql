DROP POLICY IF EXISTS "Team members view subscriptions" ON public.subscriptions;

CREATE POLICY "Team members view subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (is_account_member(account_id));