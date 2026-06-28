## Problema diagnosticado

Conversa do lead `5519988331972` (usuário `marcioevandrocosta@hotmail.com`):

1. Cliente passou por toda qualificação (SP → Elektro → conta R$ 300).
2. IA simulou desconto e perguntou: *"Quer que eu já comece seu cadastro agora?"*.
3. Cliente respondeu: **"E o que eu tenho que pagar"** (objeção legítima de custo — quer entender o modelo).
4. IA interpretou como recusa, caiu em `soft_close`, marcou `lead_frio` e respondeu *"Tranquilo! Fico à disposição..."* — efetivamente descartando o cliente.
5. Cliente repetiu *"O que eu tenho que pagar"* — IA repetiu o mesmo descarte.
6. Marcio (humano) precisou intervir manualmente para explicar que não há cobrança extra.

Causa raiz: o estágio `confirm_signup` em `run.ts` trata qualquer mensagem não-afirmativa após o pitch como declínio. Não existe nenhuma detecção de pergunta sobre custo/pagamento/mensalidade/taxa antes desse fallback.

## Solução

Adicionar **detecção determinística de objeção de custo** em `stages.ts` e um novo estágio `objection_cost` em `run.ts` que responde com a verdade sobre o modelo iGreen: zero adesão, zero mensalidade extra, sem instalação, sem fidelidade, sem multa — o cliente paga apenas a fatura iGreen (já com desconto) no lugar/complemento da fatura da distribuidora.

### 1. `supabase/functions/_igreen_v2/agents/green/stages.ts`

- Adicionar `COST_QUESTION_RX` cobrindo variações:
  - "o que (eu) tenho que pagar", "tem que pagar", "vou pagar", "preciso pagar"
  - "tem taxa", "tem mensalidade", "tem custo", "tem cobrança", "tem adesão"
  - "qual o valor", "qual o custo", "quanto custa", "quanto vou pagar"
  - "tem fidelidade", "tem multa", "tem contrato", "preciso instalar"
  - "é grátis?", "é gratuito?", "tem alguma cobrança"
- Exportar `isCostQuestion(msg)`.
- Adicionar `"objection_cost"` ao type `GreenStage`.
- Em `decideGreenStage` (prioridade ~0.55, antes do `soft_close` e antes do `confirm_signup` else-branch): se `isCostQuestion(message)` e `!extras.cost_clarified`, retornar `"objection_cost"`.

### 2. `supabase/functions/_igreen_v2/agents/green/run.ts`

- Adicionar bloco de handler para `stage === "objection_cost"` com texto determinístico (2 chunks):
  1. *"{nome}, ótima pergunta! Com a iGreen você **não paga nenhuma taxa extra, mensalidade ou adesão**. Não tem instalação, não tem obra, não tem fidelidade nem multa."*
  2. *"O que muda é só isso: no lugar (ou junto) da sua fatura da distribuidora, você passa a receber a fatura da iGreen **já com o desconto aplicado**. Ou seja, você só paga sua energia — só que mais barato. 💡"*
  3. Fecha com CTA suave: *"Posso seguir com seu cadastro agora?"*
- Setar `extras.cost_clarified = true`, `cost_clarified_at`.
- **Limpar** flags indevidas de declínio: `signup_declined_at: null`, `soft_closed: false`, `soft_closed_at: null`.
- **Não** adicionar tag `lead_frio`.
- Se houver tag `lead_frio` já aplicada (turno anterior), adicionar `remove_contact_tag` (se a tool existir) — senão, apenas registrar evento.

### 3. Reset do lead atual

SQL para destravar a conversa `a255ebbe-d51d-4b4e-8efd-5363f61f6dcc`:
- `UPDATE igreen_conversation_state` zerando `soft_closed`, `signup_declined_at`, `handoff_ativo`, `etapa_funil` voltando para `confirm_signup`.
- Cliente já está em atendimento humano (Marcio interveio), então **não** reativar IA automaticamente — apenas garantir que, se o humano devolver para IA, o estado esteja limpo.

## Detalhes técnicos

- A regex `COST_QUESTION_RX` deve ter prioridade **maior** que `isSoftDecline` (a frase "o que eu tenho que pagar" não bate em soft decline, mas garantia extra: testar `isCostQuestion` antes).
- Manter consistência: o estágio `objection_cost` não deve disparar mais de uma vez por conversa (`cost_clarified` flag). Se cliente reperguntar, cair em fluxo normal com confiança de que já foi explicado.
- Não mexer em prompt LLM — toda a resposta é determinística para evitar alucinação sobre preço.
