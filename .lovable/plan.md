
## Novo comportamento da IA Green

Duas mudanças combinadas: (1) **validação de documentos vira só checagem de tipo** e (2) **a IA segue o fluxo de forma inteligente**, sabendo aliviar tensão quando o cliente já chega perguntando desconto.

---

### 1. Documentos — só checagem de tipo

**Fatura:** a IA só precisa confirmar que é uma fatura de energia. Sem comparar nome do cliente vs. nome da fatura, sem "soft_confirm de titular", sem "autorização familiar".
- Aprovada → segue. Rejeitada → só se não for fatura ou estiver ilegível.

**RG/CNH:** só precisa confirmar que é um documento de identidade.
- Ao pedir, a IA fala: *"Agora me envia uma foto do RG ou CNH **do titular da fatura**."* — a responsabilidade fica com o cliente.
- Aprovado se for RG/CNH legível. Rejeitado só se não for documento.

**Documentos só são pedidos depois que o cliente confirma que quer fazer o cadastro.** Se ele mandar fatura espontaneamente antes, a IA aceita e segue normalmente (não rejeita por timing).

---

### 2. Fluxo consultivo inteligente

A IA tem um **roteiro padrão** que tenta seguir, mas com inteligência para responder objeções e perguntas diretas sem travar:

**Roteiro padrão (happy path):**
1. Saudação + nome
2. Explicar o produto em 1-2 frases
3. Mandar o vídeo curto
4. Check de engajamento ("fez sentido?")
5. Perguntar **estado** (UF)
6. Perguntar **valor médio da fatura**
7. Consultar tabela oficial (`get_distributor_discount`) e apresentar simulação concreta
8. Perguntar: *"Quer que eu já comece seu cadastro?"*
9. Só com "sim" → pedir fatura → pedir RG/CNH → nome completo + CPF → handoff

**Atalhos inteligentes (quando o cliente força o ritmo):**

- **Cliente já chega perguntando desconto** ("quanto é o desconto?", "qual a economia?"):
  IA responde algo como: *"A média costuma ficar entre 10% e 20%, depende do seu estado e da distribuidora. Em qual estado você está?"* — e em seguida pergunta o valor médio da fatura para fazer a simulação real.

- **Cliente manda fatura antes da hora:** aceita, valida o tipo, e pula direto para "quer começar o cadastro?".

- **Cliente faz pergunta no meio do fluxo** (cashback, prazo, segurança, "como funciona"): IA responde a pergunta primeiro, depois retoma o passo onde estava.

- **Cliente traz objeção** (caro, aluguel, conta baixa): trata a objeção antes de avançar (já existe, mantém).

- **Antes de simular**, IA **sempre confirma estado + valor médio**. Se faltar qualquer um, pergunta antes de simular. Nunca inventa percentual fora da faixa 10–20% padrão se a tabela oficial não tiver retorno.

---

### Arquivos que vou alterar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_igreen_v2/document-rules-engine/invoice-rules.ts` | Remover `reject_holder_mismatch` e a dimensão `holder_match` da decisão. |
| `supabase/functions/_igreen_v2/tools/validate-green-invoice.ts` | Remover holder-match, soft_confirm de titular e flags `invoice_match_third_party`/`invoice_holder_*`. Aprovado → `fatura_validada`; rejeitado → `fatura_rejeitada` (`not_invoice`/`unreadable`/`low_confidence`). |
| `supabase/functions/_igreen_v2/tools/validate-green-identity.ts` | Remover comparação nome titular×documento. Aprovar se classification = RG/CNH legível. |
| `supabase/functions/_igreen_v2/agents/green/stages.ts` | • Remover `family_authorization_check`, `soft_confirm_ask`, `holderMismatchPending`. • Adicionar stage `early_discount_tease` quando o cliente perguntar desconto antes de ter estado/valor. • Adicionar stage `confirm_signup` (após `simulate_discount_concreto`). • Só sair de `confirm_signup` → `request_invoice` com afirmação explícita. • Garantir que `simulate_discount_concreto` só roda com `extras.estado` **e** `extras.valor_fatura` preenchidos. |
| `supabase/functions/_igreen_v2/agents/green/prompt.ts` | • Atualizar `request_identity` para "RG ou CNH do titular da fatura". • Remover `HOLDER_GUARD`. • Adicionar molde `early_discount_tease` (frase pronta: "média entre 10% e 20%, depende do estado/distribuidora — em qual estado você está?"). • Adicionar molde `confirm_signup` ("quer que eu já comece seu cadastro?"). |
| `supabase/functions/_igreen_v2/agents/green/run.ts` | • Detectar pergunta direta de desconto → `early_discount_tease`. • Resposta afirmativa em `confirm_signup` → `request_invoice`. • Remover ramos de family/holder. |
| `supabase/functions/_igreen_v2/state-engine/transitions.ts` | Simplificar transições: remover ramos derivados de mismatch de titular. Manter `fatura_validada → documento_enviado → documento_validado → handoff`. |

### O que **não** muda

Detecção de handoff humano, soft decline, objeção de segurança, FAQ, fora de escopo, outros specialists (telecom/expansão/qualifier), cenários de follow-up, UI, RLS, webhooks.

### Como vou validar

1. Reler `decideGreenStage` simulando: "qual o desconto?" como primeira mensagem → deve cair em `early_discount_tease`, não em pedido de fatura.
2. Simular fatura recebida sem `nome_cliente` no lead → deve aprovar.
3. Simular RG recebido com nome diferente do da fatura → deve aprovar.
4. Conferir que documentos só são solicitados após `confirm_signup = sim`.

Posso seguir com essa implementação?
