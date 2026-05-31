
# Igreen — Realinhamento ao Fluxo Comercial Validado (sem refactor)

## Diagnóstico (conversa Thays `5547989118695` × roteiro antigo)

O fluxo atual roda na nova arquitetura (state-engine, supervisor, specialists, tools, regression suite), mas o comportamento comercial divergiu do roteiro validado das 6 etapas. Sintomas reais e onde nascem:

| # | Sintoma observado | Causa estrutural |
|---|---|---|
| 1 | Não pergunta o nome antes de qualquer coisa | qualifier vai direto pra `greet_open → present_menu`, sem `ask_name` |
| 2 | Não simula economia com tabela oficial | sem tool `get_distributor_discount` no v2 |
| 3 | Pula identidade do titular após fatura | sem tool `validate_green_identity` |
| 4 | Sem ramo família/autorização quando fatura é de terceiro | inexistente no green |
| 5 | Sem objeção “é golpe?” + auto-cadastro | inexistente no green |
| 6 | Não move card no CRM por etapa | sem tool `add_contact_tag` |
| 7 | Não transfere humano em pedido explícito | sem tool `request_human_handoff` |
| 8 | Salva dados só em `extras` (efêmero por turno) | sem tool `save_green_lead_field` persistindo em `igreen_lead_data` |
| 9 | Pergunta consumo/estado antes de respiro humano | OK pós `engage_check`, mas falta ordem distribuidora→estado→simulação→consumo |
| 10 | Tom às vezes informal demais (“show”, “beleza”) | system prompt do green permite gírias |
| 11 | Risca anti-loop ao receber “vou mandar a fatura” | sem flag de “intent_send_invoice” vs mídia real |

## Princípio

Manter 100% da arquitetura atual (state-engine, supervisor, specialist-router, sticky, locks, transport, regression suite). Só refinar:

1. Stages e prompts do `qualifier` e do `green`.
2. Adicionar 5 tools faltantes ao `tool-router` (sem mudar a engine de tools).
3. Adicionar 4 assertions e 6 cenários novos à suíte.

Nada novo em fases/módulos. Sem mexer em `state-engine/transitions.ts`, `decide.ts`, sticky, supervisor `decide`.

## Mudanças concretas

### 1. Qualifier — capturar nome antes do menu
`agents/qualifier/stages.ts` + `run.ts` + `prompt.ts`.

Novo micro-fluxo:

```text
greet_open → ask_name → present_menu → await_choice → route_to_specialist
```

- `greet_open`: saudação BRT (`bom dia/boa tarde/boa noite`) + nome do agente + pergunta com quem fala. Marca `extras.greeted=true`.
- `ask_name`: roda quando `greeted && !client_name`. Extrai primeiro nome (regra de captura de nome do roteiro: descartar saudações, áudio, push name). Salva via tool nova `save_green_lead_field(field="nome_cliente", value=...)` e em `extras.client_name`.
- `present_menu`: roda quando `client_name && !menu_presented`. Envia EXATAMENTE o menu numerado 1/2/3 do roteiro.
- `await_choice`/`route_*`: já existe — apenas continua, com `set_product` + sticky.
- Se cliente já citou produto no turno 1 (detect_product_mention), pula direto para `route_*` mas ANTES insere uma fala curta reconhecendo + pedindo o nome (igual roteiro: “Que ótimo seu interesse… Antes de te explicar, com quem eu tenho o prazer de falar?”).

### 2. Green — adequar às 6 etapas
`agents/green/stages.ts` + `run.ts` + `prompt.ts`.

Nova ordem (substitui a atual):

```text
present_solution_short      (ETAPA 2 abertura: 1-2 frases curtas)
send_video                  (ETAPA 2 mídia, tool send_discovery_video)
engage_check                (respiro pós-vídeo + tag "em atendimento")
ask_distribuidora_estado    (ETAPA 3 — pergunta os dois juntos em 1 frase)
simulate_discount           (ETAPA 3 — chama get_distributor_discount)
ask_valor_fatura            (ETAPA 3 — valor médio R$)
request_invoice             (ETAPA 4)
validate_invoice            (ETAPA 5 — chama validate_green_invoice quando chega mídia)
family_authorization_check  (ETAPA 5b — só se match=false)
request_identity            (ETAPA 6 — pede RG/CNH do titular)
validate_identity           (ETAPA 6 — chama validate_green_identity; em match=true a IA SILENCIA)
idle
```

Removidos: `ask_consumo` (substituído por `ask_valor_fatura`), `ask_estado` separado, `ask_name` (movido para qualifier), `ask_full_name_cpf` (não faz parte do roteiro Green — quem fecha é o sistema/equipe).

Branches críticos:
- Se cliente disser “vou mandar / já te envio / agora mando” SEM mídia → seta `extras.intent_send_invoice=true` e responde curto “Combinado, fico no aguardo 😊”. Não chama validate.
- Se `validate_green_invoice` retornar `is_energy_invoice=false` → volta para `request_invoice` com mensagem explicando que precisa ser conta de luz.
- Se `distributor_mismatch` ou `state_mismatch` → atualiza `extras.distribuidora/estado` com o que veio da fatura + re-chama `get_distributor_discount` + comenta com o cliente antes de pedir identidade.
- Se objeção de golpe detectada (regex em `["golpe","seguro","fraude","medo","não gosto de mandar","por que precisam"]`) → stage `objection_security`: tranquiliza + envia link de auto-cadastro (vindo de `igreen_account_settings.self_signup_url`, sem inventar). Se cliente pedir humano → tool `request_human_handoff`.

### 3. Prompts — tom do roteiro validado
`agents/green/prompt.ts` e `agents/qualifier/prompt.ts`.

System hard rules:
- Tom respeitoso e levemente formal (público mais velho). Trata por “você”.
- Proibido gírias: “show, bacana, tranquilo, blz, rapidinho, bora, top, massa, de boa”.
- Proibido travessão `—`/`–`. Usar vírgula, ponto, dois-pontos, quebra de linha.
- Máx 1 emoji (`😊`), só quando fizer sentido.
- 2 a 3 blocos curtos separados por linha em branco. Cada bloco ≤ 220 chars.
- 1 pergunta por turno. Nome do cliente no máximo a cada 3-4 trocas.
- Nunca cumprimentar 2x. Nunca repetir dado já em `extras`. Nunca perguntar cidade. Nunca pedir CPF.
- Templates de fallbackText reescritos no tom “consultora cordial”.

Injeção no user prompt: `last_ai_question`, `extras` resumido (nome, distribuidora, estado, valor_fatura, intent_send_invoice, video_sent, engaged, discount_min, discount_max, invoice_match), `turn_index`.

### 4. Tools novas no `tool-router`
Criar em `supabase/functions/_igreen_v2/tools/`:

- `save-green-lead-field.ts`: upsert em `igreen_lead_data` (account_id, phone, field, value). Idempotente por (phone, field, value).
- `get-distributor-discount.ts`: SELECT em `igreen_distributor_discounts` por (state, distributor + aliases). Retorna `{found, discount_min_percent, discount_max_percent, modalidade, observacoes}`. Sem inventar — `found=false` quando não existir.
- `validate-green-identity.ts`: análoga à `validate-green-invoice`. Recebe mídia, retorna `{is_id_document, match, extracted_name}` cruzando com `extras.client_name` ou titular salvo.
- `add-contact-tag.ts`: insert na tabela de tags da conversa (mesma tabela já usada hoje pelo CRM). Idempotente por (phone, tag).
- `request-human-handoff.ts`: marca conversa com `ai_paused=true` + dispara notificação (reusa `send-whatsapp-message` para notificadores). IA não envia mais texto nesse turno.

Registrar todas em `tools/_register-all.ts`. Schemas validados via Zod.

### 5. Persistência real do lead
Toda captura no green dispara `save_green_lead_field` em paralelo a salvar em `extras`. Campos: `nome_cliente`, `distribuidora`, `estado`, `valor_fatura`, `titular_fatura`, `objection_security`, `auto_cadastro_enviado`. Sem isso, o lead some entre conversas.

### 6. Supervisor — sem mudança de código, só prompt
`supervisor/prompt.ts`: adicionar regra de que pedido explícito de humano (“quero falar com atendente”, “me passa pra alguém”, “humano”) força `specialist=failsafe` com `intent=handoff_request` — failsafe chama `request_human_handoff` direto.

### 7. Regression suite — cenários e assertions novos
`testing/scenarios/index.ts` + `testing/assertions.ts`.

Novos cenários:
- `29-qualifier-asks-name-before-menu` — “bom dia” → saudação + pergunta nome; só depois menu.
- `30-name-then-product-mention` — “oi, sou Maria, quero saber da Green” → salva nome “Maria” + roteia green; sem perguntar nome de novo.
- `31-green-discount-simulation` — após distribuidora+estado, chama `get_distributor_discount` e fala “você pode economizar até X%”.
- `32-intent-send-invoice-no-validate` — “vou te mandar a fatura” → responde curto + NÃO chama validate.
- `33-invoice-third-party-family-flow` — match=false → pergunta família → cliente autoriza → atualiza titular + tag + pede RG.
- `34-objection-golpe-autocadastro` — “é golpe?” → resposta empática + envia link de auto-cadastro do account settings.
- `35-explicit-handoff-request` — “quero falar com atendente” → chama `request_human_handoff`, sem outro texto.
- `36-thays-replay-v2` — replay literal Thays com asserts comportamentais (sem cidade, sem gírias, sem travessão, ordem correta, 1 pergunta/turno, simulação executada).

Novas assertions:
- `assertNoSlang(turns)` — regex contra gírias proibidas.
- `assertNoEmDash(turns)` — proíbe `—`/`–`.
- `assertDiscountToolCalled(turns)` — quando estado+distribuidora capturados, `get_distributor_discount` tem que ter sido chamada antes de qualquer simulação textual.
- `assertIdentityRequestedAfterInvoiceMatch(turns)` — após `validate_green_invoice` com match=true, próximo turno pede RG/CNH.
- `assertHandoffSilencesAI(turns)` — turno do `request_human_handoff` não tem `messages[]`.
- `assertLeadFieldsPersisted(state, expectedKeys)` — checa `save_green_lead_field` foi disparada para nome/distribuidora/estado/valor.

Adaptar cenários 16–28 para refletir a nova ordem (ask_name antes do menu, simulação antes da fatura).

### 8. O que NÃO muda
- `state-engine/transitions.ts`, `supervisor/decide.ts`, sticky, locks, transport, outbound, persistência, truncamento, failsafe técnico, D13–D15.
- Whitelist de `etapa_funil`.
- Tabela `igreen_behavior_audits`.
- `conversation-runner` (apenas consome stages/assertions novos).

## Entregáveis

1. Diffs cirúrgicos em:
   - `agents/qualifier/{stages,run,prompt}.ts`
   - `agents/green/{stages,run,prompt}.ts`
   - `tools/save-green-lead-field.ts` (novo)
   - `tools/get-distributor-discount.ts` (novo)
   - `tools/validate-green-identity.ts` (novo)
   - `tools/add-contact-tag.ts` (novo)
   - `tools/request-human-handoff.ts` (novo)
   - `tools/_register-all.ts`
   - `supervisor/prompt.ts`
   - `testing/scenarios/index.ts`
   - `testing/assertions.ts`
2. Suíte regressão: 28 antigos + 8 novos (29–36) em mock.
3. Replay Thays (cenário 36) em modo live opcional contra `thays.chavess@gmail.com` / `5547989118695`.
4. Relatório consolidado: `/mnt/documents/igreen_sales_flow_v3_alignment.md`
   - mapeamento dos 11 sintomas → fix → cenário,
   - tabela PASS/FAIL,
   - traces lado a lado (turno real Thays × turno após realinhamento),
   - confirmação de tools chamadas por turno.

## Critérios de aceite

- Qualifier: 1) saudação BRT, 2) pergunta nome, 3) só então menu (ou rota direta com nome capturado se já citou produto).
- Green: ordem distribuidora+estado → `get_distributor_discount` → valor → fatura → validate → (família se preciso) → RG → validate_identity → silêncio.
- Toda captura de campo dispara `save_green_lead_field`.
- Etapas movem CRM via `add_contact_tag` (`em atendimento`, `enviou fatura`, `enviou documento`).
- Objeção “golpe” dispara fluxo de auto-cadastro com link do `account_settings`.
- Pedido explícito de humano dispara `request_human_handoff` e IA silencia.
- “Vou mandar a fatura” não dispara validate.
- Zero gírias, zero travessão, máx 1 emoji.
- 36/36 cenários PASS em mock.
- Replay Thays passa todas as assertions novas.

Confirma para eu sair de plan mode e implementar?
