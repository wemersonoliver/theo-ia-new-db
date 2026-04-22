-- Backfill contact_id em crm_deals abertos: vincula deals órfãos ao contato existente (mesmo user_id e telefone igual ao da conversa de mesmo título)
WITH deal_phone AS (
  SELECT
    d.id AS deal_id,
    d.user_id,
    COALESCE(
      (SELECT wc.phone FROM public.whatsapp_conversations wc
        WHERE wc.user_id = d.user_id
          AND (wc.contact_name = d.title OR wc.phone = d.title)
        ORDER BY wc.last_message_at DESC NULLS LAST
        LIMIT 1),
      d.title
    ) AS phone_guess
  FROM public.crm_deals d
  WHERE d.contact_id IS NULL
    AND d.won_at IS NULL
    AND d.lost_at IS NULL
)
UPDATE public.crm_deals d
SET contact_id = c.id, updated_at = now()
FROM deal_phone dp
JOIN public.contacts c ON c.user_id = dp.user_id AND c.phone = dp.phone_guess
WHERE d.id = dp.deal_id;

-- Para os que ainda restarem (sem contato existente), criar contato a partir da conversa correspondente e vincular
WITH orphan AS (
  SELECT
    d.id AS deal_id,
    d.user_id,
    d.account_id,
    wc.phone,
    wc.contact_name
  FROM public.crm_deals d
  JOIN public.whatsapp_conversations wc
    ON wc.user_id = d.user_id
   AND (wc.contact_name = d.title OR wc.phone = d.title)
  WHERE d.contact_id IS NULL
    AND d.won_at IS NULL
    AND d.lost_at IS NULL
),
inserted_contacts AS (
  INSERT INTO public.contacts (user_id, account_id, assigned_to, phone, name, tags)
  SELECT DISTINCT ON (o.user_id, o.phone)
    o.user_id, o.account_id, o.user_id, o.phone, o.contact_name, ARRAY['whatsapp']::text[]
  FROM orphan o
  ON CONFLICT (user_id, phone) DO UPDATE SET name = COALESCE(public.contacts.name, EXCLUDED.name)
  RETURNING id, user_id, phone
)
UPDATE public.crm_deals d
SET contact_id = ic.id, updated_at = now()
FROM orphan o
JOIN inserted_contacts ic ON ic.user_id = o.user_id AND ic.phone = o.phone
WHERE d.id = o.deal_id AND d.contact_id IS NULL;