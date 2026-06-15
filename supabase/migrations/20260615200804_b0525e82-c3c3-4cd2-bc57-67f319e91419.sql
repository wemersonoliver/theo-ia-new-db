UPDATE igreen_conversation_state
SET extras = jsonb_set(
              jsonb_set(
                COALESCE(extras, '{}'::jsonb),
                '{greeted}', 'true'::jsonb, true
              ),
              '{explained}', 'true'::jsonb, true
            ),
    etapa_funil = 'qualificacao'
WHERE produto = 'green'
  AND (etapa_funil IS NULL OR etapa_funil IN ('novo','qualificacao'))
  AND COALESCE(extras->>'intro_sent','false') <> 'true'
  AND (extras->>'estado') IS NULL;