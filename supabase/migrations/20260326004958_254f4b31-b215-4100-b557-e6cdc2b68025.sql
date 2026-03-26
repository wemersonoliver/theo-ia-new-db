
CREATE TABLE public.system_whatsapp_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL,
  status text DEFAULT 'pending',
  qr_code_base64 text,
  phone_number text,
  profile_name text,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_whatsapp_instance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage system whatsapp"
  ON public.system_whatsapp_instance
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_system_whatsapp_updated_at
  BEFORE UPDATE ON public.system_whatsapp_instance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
