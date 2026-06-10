## Diagnóstico da conversa (thays.chavess / 5547989118695)

Mensagens reais salvas no banco:

```
13:28:44  cliente: "Quero saber mais sobre energia solar por assinatura"
13:29:26  IA    : "...como posso te chamar?"
13:30:17  cliente: "Walter"
13:30:21  cliente: "Qual percentual de economia"
13:31:05  IA    : "Que legal seu interesse na energia limpa, Walter! 😊
                   Pra gente começar, como você prefere ser chamado?"
```

A coalescência funcionou (logs mostram `[coalesce] inbound count=4`). O texto enviado ao agente foi:

```
[O cliente enviou várias mensagens em sequência, considere todas juntas:]
1) Walter
2) Qual percentual de economia
```

O ajuste anterior só corrigiu o `extractFirstName` do **qualifier** (`_igreen_v2/agents/qualifier/stages.ts`). Mas a conversa estava no especialista **green**, que tem o seu **próprio** `extractFirstName` local em `supabase/functions/_igreen_v2/agents/green/run.ts` (linha 742) — e essa cópia:

- não remove o cabeçalho `[O cliente enviou várias mensagens…]`
- não remove os prefixos `1)`, `2)` etc.
- só aceita nome quando `tokens.length === 1` (uma única palavra no texto todo)

Resultado: `client_name` nunca é salvo → o estágio `ask_name` cai no LLM, que ad-libba o nome a partir do histórico mas reabre a mesma pergunta. Idem para outros extratores (`extractConsumo`, `parseValor`, `extractEstado`, `extractDistribuidora`, detectores de FAQ/objeção) — todos rodam sobre o texto bruto da rajada e podem falhar pelo mesmo motivo.

Por isso o comportamento parece "não ter sido aplicado": foi aplicado, mas só num dos dois caminhos.

## O que entregar

Mudanças isoladas em `supabase/functions/_igreen_v2/agents/green/run.ts` (e helpers internos). Sem migrações de banco, sem mudança de fluxo, sem novos templates.

### 1. Helper `splitBurstLines(msg)`

Normaliza qualquer entrada (rajada coalescida ou mensagem única) para uma lista de linhas limpas:

- separa por `\n`
- remove cabeçalho `[O cliente enviou…]` (qualquer texto entre `[ ]` no início)
- remove prefixos numerados (`1)`, `2.`, `3-`, `4:`)
- faz `trim` e descarta vazios
- se não houver `\n`, devolve `[msg.trim()]`

### 2. `extractFirstName` ciente de rajada

Reescrever a função local do green/run.ts para:

1. Aplicar `splitBurstLines` na entrada.
2. Para cada linha, rodar a lógica atual (padrões "meu nome é…", "sou o…", "me chamo…", fallback de palavra única).
3. Retornar o primeiro nome válido encontrado.

Mantém o `NAME_BLOCKLIST` e a normalização atuais. Alinha o comportamento com a versão do qualifier.

### 3. Extratores e detectores rodando linha-a-linha

Os seguintes pontos do `runGreen` hoje recebem `ctx.message` cru. Substituir por uma varredura `splitBurstLines(ctx.message)` que retorna o primeiro hit:

- `extractConsumo`, `parseValor` (estágio `ask_consumo` / `ask_valor_fatura`)
- `extractEstado` (estágio `ask_estado`)
- `extractDistribuidora` e match numérico/texto (estágio `ask_distribuidora`)
- `isAffirmation` (estágios `explain_solution`, `ask_distribuidora`)
- `detectFaqTopic`, `detectOutOfScope`, `isGenericObjection` usados em `decideGreenStage`

Cada extrator vira: "rode sobre cada linha em ordem; devolva o primeiro resultado válido". Sem alterar a assinatura — só a implementação no call site (helper local `firstMatch(msg, fn)`).

### 4. FAQ detectada na mesma rajada que o nome

Quando `ask_name` captura o nome **e** alguma outra linha da rajada bate em `detectFaqTopic` (ex.: "qual percentual de economia"), trocar o texto determinístico de:

```
Prazer, Walter! Com a Igreen você economiza… Quer saber como funciona?
```

para:

```
Prazer, Walter! Sobre o desconto: a faixa varia por estado/distribuidora,
geralmente entre X% e Y%. Pra te dar o número exato, em qual estado você está?
```

(Mensagem curta + avança para `ask_estado` no mesmo turno marcando `explained: true` e `engaged: true`.) Isso cumpre a regra "responder objeção / FAQ em vez de repetir pergunta".

### 5. Sem mudanças no `process-pending-ai`

A coalescência atual está correta (confirmada nos logs). O bug não estava lá.

## Por que isso resolve para TODOS os usuários iGreen

O fluxo `accounts.is_igreen = true → whatsapp-igreen-agent-v2 → _igreen_v2/agents/green/run.ts` é compartilhado por todas as contas iGreen. Corrigir o `extractFirstName` local e os extratores neste arquivo aplica o ajuste para todos automaticamente, sem migração nem configuração por conta.

## Resultado esperado (mesma simulação de hoje)

Cliente envia em rajada: "Walter" → "Qual percentual de economia".
IA responde uma única vez: "Prazer, Walter! O desconto fica entre X% e Y% dependendo do estado/distribuidora. Em qual estado você está?" — sem repetir "como posso te chamar".

## Detalhes técnicos (referência)

Arquivos tocados:
- `supabase/functions/_igreen_v2/agents/green/run.ts` — novo `splitBurstLines`, novo `extractFirstName`, wrappers `firstMatch` para os extratores existentes, ajuste do branch `ask_name` para detectar FAQ na mesma rajada.

Não toca:
- `process-pending-ai/index.ts`
- `_igreen_v2/agents/qualifier/*`
- templates em `green/prompt.ts`
- schema de banco
