CREATE POLICY "Super admins manage all deal tasks"
ON public.crm_deal_tasks
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));