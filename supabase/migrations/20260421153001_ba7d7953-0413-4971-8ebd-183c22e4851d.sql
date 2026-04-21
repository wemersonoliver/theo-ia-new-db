CREATE POLICY "Super admins can view all whatsapp instances"
ON public.whatsapp_instances
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));