
-- Step 1: Create unified conversation with all messages sorted by timestamp
WITH all_messages AS (
  SELECT jsonb_array_elements(messages) as msg
  FROM system_whatsapp_conversations
  WHERE phone IN ('65981039030', '556581039030')
),
sorted_messages AS (
  SELECT msg
  FROM all_messages
  ORDER BY (msg->>'timestamp')::text ASC
),
merged AS (
  SELECT jsonb_agg(msg) as messages, count(*) as total
  FROM sorted_messages
)
INSERT INTO system_whatsapp_conversations (phone, contact_name, messages, total_messages, ai_active, last_message_at)
SELECT 
  '5565981039030',
  'Baba Design Comunicação Visual',
  m.messages,
  m.total::int,
  false,
  (SELECT MAX((msg->>'timestamp')::text) FROM sorted_messages msg)::timestamptz
FROM merged m;

-- Step 2: Delete the two old duplicates
DELETE FROM system_whatsapp_conversations WHERE phone IN ('65981039030', '556581039030');
