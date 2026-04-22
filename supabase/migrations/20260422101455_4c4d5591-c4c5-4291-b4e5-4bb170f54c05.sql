-- Corrige valor da assinatura do Marcelo Gonçalves Bento (estava 970000 = R$9.700, valor real R$97,00 = 9700 centavos)
UPDATE public.subscriptions
SET amount_cents = 9700
WHERE id = '84e0b39d-c9c2-44aa-a543-60f727d12177'
  AND amount_cents = 970000;