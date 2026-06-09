## Objetivo
Alterar a assinatura ativa do usuário `marcioevandrocosta@hotmail.com` (atualmente no plano **Basic Mensal**) para o plano **Plano Igreen Energy (Mensal)**, para que ele passe a ter o tier `igreen` na plataforma (cenários Igreen, simulador, até 2 instâncias WhatsApp, tema personalizado).

## Dados identificados
- **Usuário:** `fbc9254d-6577-468d-adba-5d639ed0e759`
- **Assinatura atual:** `eebce9ae-0fc7-4e61-82b4-885fb8c20f09` — status `active`, `plan_type = NULL`, `plan_id = NULL` (hoje resolve como Basic via raw_data Kiwify)
- **Plano destino:** `a084a55a-c7c8-4b38-aef1-eb9ffb698ed7` (slug `igreen-monthly`, tier `igreen`)

## Ação (1 UPDATE na tabela `subscriptions`)
Atualizar a linha da assinatura ativa do usuário definindo:
- `plan_id` = id do Igreen Mensal
- `plan_type` = `igreen-monthly` (o hook `useAccountPlan` detecta o tier pela substring `igreen`)
- `updated_at` = `now()`

```sql
UPDATE public.subscriptions
SET plan_id    = 'a084a55a-c7c8-4b38-aef1-eb9ffb698ed7',
    plan_type  = 'igreen-monthly',
    updated_at = now()
WHERE id = 'eebce9ae-0fc7-4e61-82b4-885fb8c20f09';
```

## Efeitos esperados
- Tier passa a `igreen` em todo o app (CenarioS Igreen, simulador, tema, limite de 2 instâncias WhatsApp).
- Nada muda no Kiwify — a cobrança recorrente original (R$ 97/mês) continua válida; estamos apenas reclassificando o plano internamente no Theo IA.
- Nenhuma outra tabela é afetada; sem impacto em demais usuários.

## Observação
Se no futuro o Kiwify enviar um novo webhook desta mesma assinatura, ele pode sobrescrever `plan_type` de volta para Basic (pois o `kiwify_product_id` do pedido aponta para o produto Basic). Caso isso aconteça, basta reaplicar o UPDATE — ou, se preferir uma solução permanente, criamos uma regra no webhook para respeitar override manual.
