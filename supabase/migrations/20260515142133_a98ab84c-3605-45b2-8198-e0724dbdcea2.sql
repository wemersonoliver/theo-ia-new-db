
DROP POLICY IF EXISTS "owner select events" ON public.custom_followup_events;
DROP POLICY IF EXISTS "owner select webhooks" ON public.custom_followup_webhooks;
DROP POLICY IF EXISTS "owner insert webhooks" ON public.custom_followup_webhooks;
DROP POLICY IF EXISTS "owner update webhooks" ON public.custom_followup_webhooks;
DROP POLICY IF EXISTS "owner delete webhooks" ON public.custom_followup_webhooks;

CREATE POLICY "cfe_select" ON public.custom_followup_events
  FOR SELECT USING (public.is_account_member(account_id));

CREATE POLICY "cfw_select" ON public.custom_followup_webhooks
  FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY "cfw_insert" ON public.custom_followup_webhooks
  FOR INSERT WITH CHECK (public.is_account_member(account_id) AND auth.uid() = user_id);
CREATE POLICY "cfw_update" ON public.custom_followup_webhooks
  FOR UPDATE USING (public.is_account_member(account_id));
CREATE POLICY "cfw_delete" ON public.custom_followup_webhooks
  FOR DELETE USING (public.is_account_member(account_id));
