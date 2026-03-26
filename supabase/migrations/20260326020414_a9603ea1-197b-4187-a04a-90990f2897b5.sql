
CREATE TABLE public.admin_notification_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notification_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage admin notification contacts"
  ON public.admin_notification_contacts
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_admin_notification_contacts_updated_at
  BEFORE UPDATE ON public.admin_notification_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
