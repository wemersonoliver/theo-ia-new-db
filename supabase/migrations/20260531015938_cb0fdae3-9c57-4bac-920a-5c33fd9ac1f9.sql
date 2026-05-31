-- Reset apenas do estado interno do fluxo iGreen para o número de teste,
-- para que o próximo teste comece do zero (saudação + pedido de nome).
-- NÃO apaga histórico de conversa nem mensagens visíveis.

DELETE FROM public.igreen_state_events
WHERE phone = '5547989118695';

DELETE FROM public.igreen_state_snapshots
WHERE phone = '5547989118695';

DELETE FROM public.igreen_conversation_state
WHERE phone = '5547989118695';

-- Também limpa a memória curta do agente (whatsapp_ai_sessions),
-- para evitar que respostas antigas contaminem o próximo turno.
DELETE FROM public.whatsapp_ai_sessions
WHERE phone = '5547989118695';