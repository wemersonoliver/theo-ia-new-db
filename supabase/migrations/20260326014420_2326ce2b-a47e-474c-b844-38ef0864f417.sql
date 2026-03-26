-- Support tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tickets"
  ON public.support_tickets FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins manage all tickets"
  ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Ticket messages table
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own ticket messages"
  ON public.support_ticket_messages FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users insert own ticket messages"
  ON public.support_ticket_messages FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND user_id = auth.uid()
  ));

CREATE POLICY "Super admins manage all ticket messages"
  ON public.support_ticket_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- System AI config (for support bot)
CREATE TABLE public.system_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_prompt text,
  agent_name text DEFAULT 'Suporte Theo IA',
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage system ai config"
  ON public.system_ai_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_ai_config_updated_at
  BEFORE UPDATE ON public.system_ai_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- System conversations table
CREATE TABLE public.system_whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  contact_name text,
  messages jsonb DEFAULT '[]'::jsonb,
  last_message_at timestamptz,
  total_messages integer DEFAULT 0,
  ai_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage system conversations"
  ON public.system_whatsapp_conversations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_system_conversations_updated_at
  BEFORE UPDATE ON public.system_whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();