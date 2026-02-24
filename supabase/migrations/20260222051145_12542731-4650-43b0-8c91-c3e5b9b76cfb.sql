
CREATE TABLE public.notification_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  notify_appointments BOOLEAN NOT NULL DEFAULT true,
  notify_handoffs BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, phone)
);

ALTER TABLE public.notification_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification contacts"
  ON public.notification_contacts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_notification_contacts_updated_at
  BEFORE UPDATE ON public.notification_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
