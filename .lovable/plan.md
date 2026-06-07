## Ajustes no fluxo Igreen — Conexão Green

### Ajuste 1 — Menu de opções sem quebra na frase final

**Problema:** `buildMenuText()` em `supabase/functions/_igreen_v2/agents/qualifier/prompt.ts` retorna uma única string longa (~240 chars). O chunker (`prepare.ts` / `humanize.ts`, limite 220 chars) não acha pontuação intermediária e faz hard-split no meio de "Qual dessas opções faz mais sentido para você?", deixando algo como ".../ Qual dessas opções" + "faz mais sentido para você?".

**Solução:** alterar `buildMenuText()` para retornar um array de strings já pré-chunkadas, garantindo que a pergunta final fique inteira em um único bloco. Atualizar o consumidor em `agents/qualifier/run.ts` para emitir essas strings como mensagens separadas em `messages`.

Pré-chunks propostos:
1. `"Prazer em falar com você, {nome}. Para eu te direcionar da melhor forma, me conta: você está buscando?"` (ou versão sem nome)
2. `"1 - Economia na conta de luz sem instalar nada\n2 - Planos de telefonia e internet para seu telefone\n3 - Como se tornar um Licenciado da iGreen e ganhar dinheiro vendendo assinaturas e placas solares"`
3. `"Qual dessas opções faz mais sentido para você?"`

Mesma técnica aplicada em `MENU_SHORT_TEXT` se necessário (atualmente já cabe em 220, mas vou validar).

### Ajuste 2 — Remover engage_check e ir direto pro valor da fatura

**Problema:** depois do vídeo, a IA pergunta "faz sentido pra você, quer que eu te mostre quanto dá pra economizar?" e só no próximo turno pergunta o consumo. São duas trocas desnecessárias.

**Solução:**

1. Em `agents/green/stages.ts`, na função `decideGreenStage`, remover/pular o stage `engage_check`:
   - Marcar `engaged=true` automaticamente quando o cliente respondeu após `video_sent` (no próprio handler de etapa `qualificacao`).
   - Substituir os dois retornos `return "engage_check"` por uma transição direta pra próxima etapa de coleta.
2. Substituir `ask_consumo` por `ask_valor_fatura` como primeiro pedido de dado (o consumo já era convertido pra valor; o stage `ask_consumo` deixa de ser pedido — fica apenas o valor da fatura).
3. Em `agents/green/prompt.ts`, atualizar o stage `ask_valor_fatura` para que a IA primeiro reconheça/responda à mensagem do cliente (objeção, dúvida, etc.) e em seguida pergunte:
   > "Qual o valor médio da sua fatura mensal? Assim posso te mostrar quanto seria sua economia."
4. Atualizar `fallbackText` correspondente em `agents/green/run.ts`.
5. Ajustar testes que referenciam `engage_check` (`testing/scenarios/index.ts`, `testing/assertions.ts`, `testing/conversation-runner.ts`) — remover a asserção de presença obrigatória do stage.

### Ajuste 3 — Pular confirmação quando há uma única distribuidora

**Problema:** em `agents/green/run.ts` (stages `present_distributors` e o ramo de redecide), quando `list.length === 1` a IA pergunta "Essa é a sua distribuidora atual?" — desnecessário, podemos assumir e seguir direto pra simulação.

**Solução:** quando `list.length === 1` no stage `present_distributors`:
- Setar `extras.distribuidora = list[0].distributor` e disparar `save_green_lead_field`.
- Marcar `distributors_presented = true`.
- Redecidir o stage imediatamente → cairá em `simulate_discount_concreto` se `valor_fatura` já existir, ou em `ask_valor_fatura` se ainda não.
- Não emitir o texto "Essa é a sua distribuidora atual?". O texto deve ser apenas algo curto como "No seu estado trabalhamos com a {distribuidora}, vou usar ela na simulação." OU já gerar direto o texto da simulação se possível.

Mesma lógica replicada no bloco de redecide (linhas ~469-485 do `run.ts`).

### Arquivos a alterar

- `supabase/functions/_igreen_v2/agents/qualifier/prompt.ts`
- `supabase/functions/_igreen_v2/agents/qualifier/run.ts`
- `supabase/functions/_igreen_v2/agents/green/stages.ts`
- `supabase/functions/_igreen_v2/agents/green/run.ts`
- `supabase/functions/_igreen_v2/agents/green/prompt.ts`
- `supabase/functions/_igreen_v2/testing/conversation-runner.ts`
- `supabase/functions/_igreen_v2/testing/scenarios/index.ts`
- `supabase/functions/_igreen_v2/testing/assertions.ts`

Nenhuma mudança de schema/migration necessária.
