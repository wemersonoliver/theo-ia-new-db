-- Corrige conversas apontando para instância antiga (recriada)
UPDATE public.whatsapp_conversations c
SET instance_id = i.id
FROM public.whatsapp_instances i
WHERE c.account_id = i.account_id
  AND c.instance_id IS NOT NULL
  AND c.instance_id NOT IN (SELECT id FROM public.whatsapp_instances);

-- Coluna de lock usada pelo process-pending-ai (erro 42703 nos logs)
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_processing_until timestamptz;