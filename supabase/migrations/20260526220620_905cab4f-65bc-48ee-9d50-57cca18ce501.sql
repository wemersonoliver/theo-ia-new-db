CREATE OR REPLACE FUNCTION public.match_igreen_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 5,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_id text,
  content text,
  token_count integer,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.source_id,
    c.content,
    c.token_count,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.igreen_knowledge_chunks c
  WHERE c.embedding IS NOT NULL
    AND (p_account_id IS NULL OR c.account_id IS NULL OR c.account_id = p_account_id)
    AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_igreen_chunks(vector, float, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_igreen_chunks(vector, float, int, uuid) TO service_role;