-- Função para adicionar/remover tags reservadas em contatos e cancelar follow-up automaticamente
CREATE OR REPLACE FUNCTION public.tag_contact_reserved(
  _account_id uuid,
  _phone text,
  _tag text,
  _add boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected int := 0;
  contact_user_id uuid;
BEGIN
  IF _account_id IS NULL OR _phone IS NULL OR _tag IS NULL THEN
    RETURN 0;
  END IF;

  IF _add THEN
    UPDATE public.contacts
       SET tags = (
             SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags, '{}'::text[]) || ARRAY[_tag]))
           ),
           updated_at = now()
     WHERE account_id = _account_id
       AND phone = _phone
       AND NOT (_tag = ANY(COALESCE(tags, '{}'::text[])));
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Cancela follow-up ativo desse telefone para todos os usuários da account
    FOR contact_user_id IN
      SELECT DISTINCT am.user_id
        FROM public.account_members am
       WHERE am.account_id = _account_id
         AND am.status = 'active'
    LOOP
      PERFORM public.cancel_followup_sequence(contact_user_id, _phone, 'handoff');
    END LOOP;
  ELSE
    UPDATE public.contacts
       SET tags = ARRAY(SELECT t FROM unnest(COALESCE(tags, '{}'::text[])) t WHERE t <> _tag),
           updated_at = now()
     WHERE account_id = _account_id
       AND phone = _phone
       AND _tag = ANY(COALESCE(tags, '{}'::text[]));
    GET DIAGNOSTICS affected = ROW_COUNT;
  END IF;

  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.tag_contact_reserved IS
'Tags reservadas do sistema: "agendamento" (lead com appointment ativo) e "sem-interesse" (lead pediu para parar). Ambas impedem novos follow-ups em followup-check-inactive.';