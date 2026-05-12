UPDATE public.whatsapp_ai_config c
SET 
  custom_prompt = (
    SELECT e.generated_prompt FROM public.entrevistas_config e
    WHERE e.id = '752db57a-0a97-4ff3-839e-679b2ca8ad63'
  ) || E'\n\n---\n## REGRAS OPERACIONAIS ATUAIS (PRIORIDADE MÁXIMA)\n\n' || c.custom_prompt
  || E'\n\n## REGRA ANTI-LOOP (CRÍTICA)\n- NUNCA repita literalmente uma mensagem que você já enviou nesta conversa. Se o cliente não responder ou repetir a mesma dúvida, reformule com palavras diferentes, traga um ângulo novo (benefício, prova social, pergunta de qualificação) ou faça UMA pergunta direta para destravar.\n- Se você já apresentou um plano e o cliente não avançou, NÃO reenvie a mesma lista. Pergunte algo objetivo: frequência desejada, objetivo principal, ou ofereça uma aula experimental.\n- Evite encerrar mensagens sempre com a mesma frase. Varie o fechamento.',
  business_description = 'Academia Mexicomigo — academia e bem-estar em Santo Ângelo/RS. Metodologia própria com mais de 43 anos, foco em qualidade de vida, emagrecimento e hipertrofia. Oferece musculação, aulas, personal trainer e preparação para TAF/concursos. Planos a partir de R$ 59,90 (Light 3x/sem TER-QUI-SAB), Mensal R$ 169, Anual R$ 79/mês, dupla R$ 69/mês. Endereço: Rua 7 de Setembro, 601, Centro.',
  business_niche = COALESCE(NULLIF(c.business_niche, ''), 'Academia e Bem-estar'),
  updated_at = now()
WHERE c.user_id = '744e33a8-3b85-4593-948e-bcaf81f8397b';