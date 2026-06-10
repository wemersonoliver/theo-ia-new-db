
## Diagnóstico da conversa (5547989118695)

Linha do tempo real, com o bug em destaque:

```text
Cliente: "Walter" + "Como funciona" + "Qual percentual de economia"
IA: "Prazer Walter! desconto 10–20%... em qual estado você está?"   ← ask_name + FAQ
Cliente: "Estou em SC"
IA: "Vou te mandar um vídeo... me avisa quando assistir"            ← send_video
       ⚠️ "SC" foi IGNORADO — extras.estado nunca foi salvo
Cliente: "Já vi. Qual meu percentual?"
IA: "Quer que eu te mostre quanto dá pra economizar?"               ← engage_check (fraco)
Cliente: "Sim"
IA: "Qual o valor médio da sua fatura?"                             ← ask_valor_fatura
Cliente: "Média de 500"
IA: "E em qual estado você está?"                                   ← ❌ ask_estado DE NOVO
Cliente: "Sc"
IA: "Pra Celesc o desconto fica entre 10% e 14%..."                 ← finalmente calcula
```

## Causa raiz

Em `_igreen_v2/agents/green/run.ts`, a captura de campos (`estado`, `valor_fatura`, `distribuidora`, `consumo_medio`) só acontece **quando o stage ativo é o `ask_*` correspondente**. Se o cliente entrega o dado em outro stage (ex.: diz "Estou em SC" durante `send_video`, ou já no `ask_name`), o valor é jogado fora e a IA volta a pedir depois.

Também: o `engage_check` após "qual meu percentual?" ignora que a IA já tinha estado/distribuidora prováveis e responde com pergunta vazia em vez de avançar.

## Plano de correção

Tudo em `supabase/functions/_igreen_v2/agents/green/run.ts` (continua valendo para todos os usuários iGreen, pois o V2 é compartilhado).

### 1. Captura oportunista global (toda mensagem, antes do switch de stages)

Adicionar um bloco no início do `runGreen`, logo após calcular `burstLines`, que sempre tenta extrair dos `burstLines` e salvar no `patch.extras` se o campo ainda estiver vazio:

- `estado` — via `firstHit(burstLines, extractEstado)`
- `valor_fatura` — via `firstHit(burstLines, parseValor)`
- `distribuidora` — via `firstHit(burstLines, extractDistribuidora)`
- `consumo_medio` — via `firstHit(burstLines, extractConsumo)`

Para cada captura nova, emitir o `tool_calls` `save_green_lead_field` correspondente (mantém compat com o pipeline de gravação no DB).

Salvaguardas:
- só sobrescreve se o slot estiver vazio (`!hasValue(currentExtras.<campo>)`);
- só extrai estado/distribuidora se o cliente NÃO estiver enviando mídia neste turno (evita ruído de OCR);
- não dispara em `validate_invoice` / `validate_identity` / `handoff_human` / `objection_security` (já têm fluxo próprio).

### 2. Reaproveitar essas capturas no decideGreenStage

Como o `decideGreenStage` é chamado ANTES do bloco de captura, após capturar opotunisticamente reexecutar `decideGreenStage(mergedState, ...)` para escolher o stage correto no mesmo turno (mesma técnica já usada em `STAGES_REDECIDABLE`). Isso garante que se o cliente entregar `valor_fatura + estado + distribuidora` numa só burst, o fluxo pula direto para `simulate_discount_concreto`.

### 3. Atalho determinístico para "qual meu desconto?" pós-vídeo

No branch `engage_check` (e também quando `stage === "ask_valor_fatura"` mas a mensagem do cliente é uma pergunta de desconto sem número):

- Se `extras.estado` já existe, responder direto: "Pra calcular seu desconto exato em [estado], me diz só o valor médio da sua conta de luz." (uma pergunta só, focada).
- Marcar `extras.engaged = true` no mesmo turno para não travar.

### 4. Detector de pergunta de desconto

Adicionar regex utilitário `isDiscountQuestion(msg)` matchando: `qual.*(percentual|desconto|economia)`, `quanto.*(economiz|desconto)`, `qual.*minha.*economia`. Usado pelo item 3 e para evitar que essa mensagem caia em `objection_reply`.

### Detalhes técnicos

- Arquivo único alterado: `supabase/functions/_igreen_v2/agents/green/run.ts`
- Sem mudança em `stages.ts`, `prompt.ts`, `process-pending-ai`, banco ou prompts.
- Sem alteração de schema.
- Helpers `extractEstado`, `parseValor`, `extractDistribuidora`, `extractConsumo`, `firstHit`, `splitBurstLines` já existem no arquivo.
- Após implementar, simular novamente com o mesmo cenário (Walter → "Estou em SC" → vídeo → "qual meu percentual" → "Sim" → "Média de 500") e confirmar que a IA NÃO repete a pergunta de estado e responde já com Celesc/SC.

### Riscos

- Falso positivo em `extractEstado` (ex.: "SP" dentro de uma palavra) — `firstHit` + regex atual já valida UF como token isolado. Manter blocklist atual.
- `parseValor` capturando número errado (ex.: "tenho 2 filhos") — restringir captura oportunista de `valor_fatura` para casos com indicador de dinheiro (`r$`, `reais`, `conta`, `fatura`, `mês`) OU quando o `etapa_funil` já é `qualificacao` (cliente está claramente discutindo conta).
