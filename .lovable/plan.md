
## Diagnóstico das 2 conversas

**Marizele (5531971376154)** — A IA seguiu o fluxo tecnicamente certo, mas:
- Quando ela disse **"Não quero por enquanto"**, a IA ignorou e respondeu *"Para a gente dar uma olhada no seu cadastro na CEMIG, você pode me mandar a sua última fatura..."* — empurrou de novo.
- Quando ela disse **"Pode deixar só queria saber como funciona obgda"** (claramente encerrando), a IA explicou em 1 frase e voltou a pedir a fatura.
- Faltou: reconhecer o "não", oferecer ficar à disposição, encerrar com leveza (sem pedir fatura de novo).

**Marina (5577999494889)** — Problema mais grave:
- Cliente disse **"Eu queria fazer um empréstimo na conta de energia"** — isso é **crédito consignado em conta de luz, NÃO é o produto Igreen**.
- A IA respondeu *"Que legal que você quer saber mais sobre isso"* e mandou o vídeo de assinatura solar como se fosse a mesma coisa.
- Depois insistiu *"Que legal que você quer fazer o empréstimo, Marina! Qual o valor médio da sua fatura..."* — fingindo que vende empréstimo.
- O dono teve que intervir manualmente várias vezes pra esclarecer.
- Faltou: detectar intenção fora de escopo e esclarecer o produto logo no primeiro turno.

**Causa raiz no código (`_igreen_v2/agents/green/`)**:
1. `decideGreenStage` em `stages.ts` só conhece duas objeções: handoff explícito e medo de golpe. Qualquer outro "não", "não agora", "só queria saber", "depois eu vejo" passa direto e cai no próximo stage rígido.
2. Nenhum detector de **intenção fora de escopo** (empréstimo, financiamento, placa solar própria, segunda via de fatura, troca de titularidade, religar luz, etc.).
3. O prompt em `prompt.ts` exige "referenciar em 1 frase a resposta anterior", mas como o stage já foi decidido como `request_invoice`/`ask_valor_fatura`, a IA acaba só colando uma desculpa curta e empurrando a mesma pergunta.
4. `engage_check` existe mas nunca é escolhido após o vídeo — `decideGreenStage` pula direto pra `ask_valor_fatura` quando `video_sent=true`.

---

## Plano de mudanças

Tudo concentrado em `supabase/functions/_igreen_v2/agents/green/` — sem mexer em outros agentes, banco ou frontend.

### 1. Novos detectores em `stages.ts`

- `isSoftDecline(msg)` — captura "não quero", "agora não", "depois eu vejo", "só queria saber", "fica pra depois", "vou pensar", "obrigado(a)" como fechamento, "tá bom assim", "deixa pra lá".
- `detectOutOfScope(msg)` → retorna `"emprestimo" | "placa_propria" | "segunda_via" | "religar" | "troca_titular" | null`. Regex específicas por categoria (empréstimo: `\b(empr[eé]stimo|consignado|cr[eé]dito.{0,15}(conta|luz|energia))\b`, etc.).
- `isQuestionAboutHow(msg)` — pergunta genuína de "como funciona", "o que é isso", separando de afirmação de interesse.

### 2. Novos stages

Adicionar ao enum `GreenStage` e ao `prompt.ts`:

- `soft_close` — cliente declinou educadamente. Reconhece, agradece, diz que fica à disposição, **não pede fatura, não faz pergunta de qualificação**. Marca `extras.soft_closed=true` e adiciona tag CRM "lead frio".
- `out_of_scope_clarify` — esclarece em 2 frases que a Igreen é **assinatura de energia limpa com desconto na fatura, não é empréstimo / não vende placa / não resolve segunda via**, e pergunta se mesmo assim quer entender a economia. Marca `extras.out_of_scope_topic` pra não repetir.
- `objection_reply` — stage genérico de objeção quando o cliente responde algo que **não é confirmação nem dado pedido** (ex: "tá caro", "não confio", "minha conta é baixa", "moro de aluguel"). A IA primeiro responde a objeção em 1-2 frases curtas baseadas em uma mini knowledge base inline (aluguel: pode contratar; conta baixa: mostra valor mínimo; preço: explica que é desconto, não cobra a mais), depois faz **uma** pergunta leve pra reengajar — não repete o último pedido.

### 3. Prioridades no `decideGreenStage`

Nova ordem de prioridade no topo, antes da lógica atual:

```
-1  handoff explícito       (já existe)
 0  objeção de segurança     (já existe)
 0.5 detectOutOfScope && !extras.out_of_scope_handled  → out_of_scope_clarify
 0.6 isSoftDecline && extras.greeted && !extras.soft_closed → soft_close
 0.7 stage atual ia pedir fatura/dado E mensagem do cliente é objeção/dúvida não relacionada → objection_reply
```

Também: **reativar `engage_check` 1 vez** logo após `send_video`, antes de `ask_valor_fatura`, pra dar respiro e captar reação real ao vídeo (objeção, dúvida, "não tenho interesse") em vez de já cobrar dado.

### 4. Ajustes no `run.ts`

- Implementar os 3 novos stages com `deterministicText` (textos curtos, sem números inventados, seguindo as regras hard do `GREEN_SYSTEM`).
- Em `soft_close`: `tool_calls` adiciona `add_contact_tag` "lead_frio" e **não** chama `request_invoice` / `set_stage`.
- Em `out_of_scope_clarify`: `add_contact_tag` com o tópico detectado (ex: "interesse_emprestimo") para o dono ver no CRM.
- Em `objection_reply`: salva `extras.last_objection` pra não responder a mesma objeção 2x seguidas.

### 5. Reforço no `GREEN_SYSTEM` (prompt.ts)

Adicionar regras hard:
- "Se o cliente disser explicitamente que NÃO quer agora, NUNCA repita o pedido de fatura/dado no mesmo turno. Agradeça e fique à disposição."
- "Se o cliente pedir um produto que a Igreen não vende (empréstimo, placa própria, segunda via, religar luz), NUNCA finja que vende. Esclareça em 1 frase e pergunte se ainda assim quer conhecer a assinatura de energia."
- "Antes de qualquer próxima pergunta, primeiro responda em 1 frase ao que o cliente acabou de dizer. Se ele fez uma objeção, trate a objeção antes de avançar."

### 6. Sem migração de banco

Tudo vive em `extras` (jsonb já existente em `igreen_conversation_state`). Sem novas colunas, sem novas tabelas, sem mudança de RLS.

---

## Resultado esperado nas mesmas conversas

- **Marizele** diz "Não quero por enquanto" → IA: *"Tranquilo, Marizele! Fico à disposição quando quiser dar uma olhada. Qualquer dúvida é só me chamar 😊"* — e para.
- **Marina** diz "queria fazer um empréstimo na conta de energia" → IA: *"Entendi, Marina! A Igreen não trabalha com empréstimo — a gente dá desconto direto na sua conta de luz, todo mês, sem trocar de distribuidora. Quer que eu te mostre como funciona a economia mesmo assim?"* — sem mandar vídeo nem pedir fatura até ter um "sim" real.

## Arquivos a alterar

- `supabase/functions/_igreen_v2/agents/green/stages.ts` (detectores + enum + prioridades)
- `supabase/functions/_igreen_v2/agents/green/prompt.ts` (regras hard + 3 novos cases)
- `supabase/functions/_igreen_v2/agents/green/run.ts` (handlers dos 3 novos stages)
