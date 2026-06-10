
## Diagnóstico — conversa com Walther (5584987859366)

Timeline:

| Hora | Quem | Mensagem |
| --- | --- | --- |
| 01:47:23 | cliente | "Olá! Quero saber..." |
| 01:48:07 | IA | "como posso te chamar?" ✅ |
| 01:49:14 | cliente | "Walther" |
| 01:49:34 | cliente | "Gostaria de saber como funciona." |
| 01:50:04 | cliente | "Qual percentual de economia" |
| **01:50:16** | **IA** | **"como posso te chamar?"** ← ignorou Walther |
| **01:50:45** | **IA** | **"qual seu primeiro nome?"** ← perguntou o nome de novo |

**Duas respostas seguidas** (correlation_ids diferentes em 01:49:57 e 01:50:27), nenhuma reconheceu o nome "Walther" e nem as 2 perguntas que vieram depois.

### O que o código realmente faz hoje

1. `whatsapp-webhook` → `triggerAIResponse()` → upsert em `whatsapp_pending_responses` com `scheduled_at = now + 20s` (config do usuário) **e** dispara um `fetch` pra `process-pending-ai`. Cada mensagem nova reseta `scheduled_at` (debounce ✅) mas **também spawn de um worker novo** que dorme 20s.
2. `process-pending-ai` dorme 20s, checa se `scheduled_at` venceu, se sim **claim atômico** (`processed=true`) e chama a IA.
3. **AQUI O PROBLEMA**: em `process-pending-ai` linhas 188-193, o que vai pra IA é só **`latestIncoming`** — a ÚLTIMA mensagem do cliente. Tem até um comentário explicando "sending the last 5 user messages as one text makes the Green flow confuse 'Oi' with the client's name".

Resultado: o cliente manda "Walther" → "Gostaria de saber..." → "Qual percentual...", o debounce dispara, a IA recebe **só** "Qual percentual de economia". O stage decision é `ask_name` (porque `extras.client_name` está vazio, etapa=novo), e a LLM gera "como posso te chamar?". Walther foi perdido.

Por que **duas** respostas? Cada upsert no webhook spawn um worker novo. Com `delay=20s` e mensagens espaçadas ~20-30s, há momentos em que o `scheduled_at` já venceu quando um worker novo acorda → ele claim e responde, mesmo se outro worker já tinha respondido segundos antes. O lock de conversa (`ai_processing_until=90s`) só serializa — não cancela rodadas redundantes.

### Conclusão

- O debounce **funciona em parte**: ele atrasa, mas só passa a última mensagem.
- O agente nunca vê a rajada completa, então parece "burro" e ignora dados que o cliente acabou de dar.
- Workers concorrentes geram respostas duplicadas porque cada um roda isolado depois do lock liberar.

---

## Plano de correção

Tudo concentrado em **`supabase/functions/process-pending-ai/index.ts`** + uma adição no schema de extras de `igreen_conversation_state` (sem migração — usa `extras` jsonb que já existe). Sem mudança em `whatsapp-webhook`.

### 1. Coalescer toda a rajada do cliente em UMA chamada à IA

Em vez de pegar só `latestIncoming`, juntar **todas as mensagens do cliente recebidas desde a última resposta da IA** (ou nos últimos N minutos, o que vier primeiro):

- Encontra `lastAssistantTs` = timestamp da última mensagem com `from_me=true` em `messages`.
- Filtra `inboundSinceLastAi` = todas `!from_me` com `timestamp > lastAssistantTs` (fallback: últimos 5 min se não houver assistente).
- Se houver só 1 → comportamento atual.
- Se houver 2+ → monta o `latestIncomingText` como:
  ```
  [O cliente enviou várias mensagens em sequência:]
  1) Walther
  2) Gostaria de saber como funciona.
  3) Qual percentual de economia
  ```
  Esse formato evita o problema antigo do "Oi" virar nome, porque o agente Green tem detector de nome **em texto livre** (`extractFirstName`) que ignora termos comuns ("oi", "ok", "sim"), e o stage decision usa toda a `extras` + a mensagem completa pra escolher o próximo passo. O número curto inicial (`Walther`) ainda é capturado pelo regex de single-token.

### 2. Captura de nome resiliente a múltiplas linhas

Atualizar `extractFirstName` em `_igreen_v2/agents/green/run.ts` pra:
- Quebrar input por `\n` ou por padrão `^\d+\)\s+`.
- Tentar extrair nome de **cada linha** na ordem, retornando o primeiro válido.
- Assim, "1) Walther\n2) Gostaria…" devolve "Walther".

### 3. Detector de "pergunta solta" no meio da rajada

Quando o agente Green captura nome **E** detecta na mesma rajada uma pergunta tipo "como funciona" / "qual o percentual", o run deve:
- Salvar o nome.
- Avançar pra `explain_solution` (em vez de pedir nome de novo) e incluir uma frase curta respondendo a pergunta antes do CTA do próximo passo.
- Já existe `detectFaqTopic` — usar pra adicionar uma frase do tipo "Funciona simples: a Igreen aplica desconto da faixa oficial da sua distribuidora direto na fatura" antes de pedir o próximo dado.

### 4. Evitar resposta duplicada por workers concorrentes

Em `process-pending-ai`, depois de adquirir o lock (`ai_processing_until`), **revalidar**:
- Reler o `scheduled_at` atual de `whatsapp_pending_responses` pra essa conversa.
- Se foi atualizado por um upsert novo do webhook nos últimos 5s (cliente continuou digitando), **abrir mão do lock, re-enfileirar** e sair sem chamar a IA. Isso garante que só o worker que pegar a janela "estável" responde.
- Adicional: comparar `latestIncoming.timestamp` com `lastAssistantTs` — se já houve resposta da IA depois de qualquer inbound não respondido **e** não chegou nada novo, sair com `skipped: stale`.

### 5. Aumentar delay padrão e teto mínimo

O usuário configurou 20s. Em rajadas humanas reais isso é curto. Sugestão (sem mexer em config do user — só piso aplicado em código):
- Em `process-pending-ai`, depois do sleep inicial, se houve qualquer mensagem nova nos últimos 8s, dormir mais 8s extras (até no máx 3x) e revalidar. Isso "aguenta" o cliente que digita em rajadas curtas.

### 6. Sem migração de banco

Reaproveitamos `whatsapp_pending_responses` (já existe) e `whatsapp_conversations.messages` (jsonb com timestamps). Nada novo no schema.

---

## Resultado esperado na mesma conversa

Cliente manda em rajada: "Walther" → "Gostaria de saber como funciona." → "Qual percentual de economia".

Debounce coalesce os 3 → IA recebe tudo junto → captura `client_name=Walther`, detecta FAQ "como funciona" + pergunta sobre %, responde **uma vez só** algo como:

> "Prazer, Walther! Funciona simples: a Igreen aplica um desconto da faixa oficial da sua distribuidora direto na sua fatura, sem obra. O percentual varia por distribuidora (geralmente entre 10% e 20%). Em qual estado você está? 😊"

Em vez de duas perguntas robóticas "como posso te chamar?".

## Arquivos a alterar

- `supabase/functions/process-pending-ai/index.ts` — coalescer rajada, revalidar antes de chamar IA, sleep adaptativo.
- `supabase/functions/_igreen_v2/agents/green/run.ts` — `extractFirstName` multilinha; lógica em `ask_name`/`explain_solution` para responder pergunta detectada na mesma rajada.
- (Opcional) `supabase/functions/_igreen_v2/agents/green/stages.ts` — pequena adição: se acabamos de capturar nome E há FAQ detectada na msg, escolher stage que responde antes de seguir.
