
-- 1) Coluna wa_chat_id nas conversas (guarda o chatId original do WAHA, ex "5511999999999@c.us")
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS wa_chat_id text;

CREATE INDEX IF NOT EXISTS idx_wa_conv_wa_chat_id ON public.whatsapp_conversations (wa_chat_id);

ALTER TABLE public.system_whatsapp_conversations
  ADD COLUMN IF NOT EXISTS wa_chat_id text;

-- 2) Tabela de rastreamento de mensagens enviadas por nós (IA / painel / sistema).
-- Se o id vier num webhook fromMe=true e NÃO estiver aqui, foi enviada pelo aparelho.
CREATE TABLE IF NOT EXISTS public.wa_outgoing_messages (
  message_id text PRIMARY KEY,
  instance_id uuid,
  account_id uuid,
  user_id uuid,
  phone text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('ai','panel','system','followup','reminder','notification','flow')),
  sender_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_outgoing_phone_created
  ON public.wa_outgoing_messages (phone, created_at DESC);

GRANT SELECT, INSERT ON public.wa_outgoing_messages TO authenticated;
GRANT ALL ON public.wa_outgoing_messages TO service_role;

ALTER TABLE public.wa_outgoing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages wa_outgoing_messages"
  ON public.wa_outgoing_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "members read wa_outgoing_messages of their account"
  ON public.wa_outgoing_messages
  FOR SELECT
  TO authenticated
  USING (
    (account_id IS NOT NULL AND public.is_account_member(account_id))
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 3) Limpeza automática: mantém só 7 dias
CREATE OR REPLACE FUNCTION public.purge_wa_outgoing_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.wa_outgoing_messages
   WHERE created_at < now() - interval '7 days';
$$;

-- 4) Cleanup das conversas fantasma criadas com LID interpretado como telefone
-- (números com mais de 14 dígitos NÃO são telefones válidos — são LIDs).
DELETE FROM public.whatsapp_conversations
 WHERE length(regexp_replace(phone, '\D', '', 'g')) > 14;

DELETE FROM public.contacts
 WHERE length(regexp_replace(phone, '\D', '', 'g')) > 14;
