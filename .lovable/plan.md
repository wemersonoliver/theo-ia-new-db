# Behavior + Sales Flow Refinement v2

Refinamento puramente **comportamental** sobre a base estável atual. Sem nova fase, sem novos módulos, sem mexer em state-engine, transport, supervisor sticky, locks, D13–D15. Só stages, prompts, supervisor de roteamento e regression suite. Validação obrigatória contra a conversa real da Thays (`5547989118695`).

---

## 1. Diagnóstico do caso Thays

Da conversa real, mapeamos os defeitos comportamentais que o plano precisa resolver:

| # | Sintoma | Causa comportamental | Onde atacar |
|---|---|---|---|
| 1 | Repete "quanto vem sua conta de luz" duas vezes | sem memória de "última pergunta feita" no prompt do specialist | `agents/green/prompt.ts` + `extras.last_ai_question` |
| 2 | Mini-saudação "Opa, tudo bem?" em quase todo turno | template do prompt cumprimenta sempre | proibição explícita no system prompt + flag `extras.greeted` já cobre |
| 3 | Pula direto para Green sem oferecer menu | supervisor escolhe `green` em mensagens genéricas | `supervisor/prompt.ts` + qualifier vira default |
| 4 | Pergunta cidade ("Balneário Camboriú") | `ask_cidade` ainda existe na máquina | remover stage do green |
| 5 | Sequência consumo→cidade→nome→fatura sem respiro | sem `engage_check`, sem confirmação de interesse | novo stage `engage_check` |
| 6 | Pede nome ("Como posso te chamar?") antes da fatura | `ask_name` no meio da qualificação | mover nome para `ask_full_name_cpf` |
| 7 | Sente formulário | múltiplas perguntas por turno e zero continuidade | regra "1 pergunta por turno" + referência à resposta anterior |

---

## 2. Mudanças concretas

### 2.1 Supervisor — roteamento conservador
`supabase/functions/_igreen_v2/supervisor/prompt.ts` (só prompt, sem mexer em `decide.ts`/sticky).

- Sem `current_specialist` definido + mensagem genérica ("oi", "boa noite", "quero saber", "como funciona", "tenho interesse", "me explica", "quero economizar") → specialist = **`qualifier`**, nunca `green`.
- Só roteia direto para `green`/`telecom`/`expansao` quando o cliente cita explicitamente o produto / palavras-chave fortes ("energia por assinatura", "fatura de luz", "conta de luz", "solar", "telecom", "chip", "celular", "licenciado", "franquia", "vender placa").
- Sticky continua valendo: se já existe specialist, mantém.

### 2.2 Qualifier — menu humano (formato exato aprovado)
`supabase/functions/_igreen_v2/agents/qualifier/` (run + prompt + stages mínimos).

Micro-fluxo determinístico:

```text
greet → present_menu → await_choice → route_to_specialist
```

`present_menu` envia **exatamente** este texto:

> Perfeito 😊
> Hoje temos algumas soluções aqui na iGreen.
>
> Você está buscando:
>
> 1 - Economia na conta de luz sem instalar nada
>
> 2 - Planos de telefonia e internet para seu telefone
>
> 3 - Como se tornar um Licenciado da iGreen e ganhar dinheiro vendendo assinaturas e placas solares
>
> Qual dessas opções faz mais sentido para você?

`await_choice` aceita:
- "1", "um", "primeiro", "energia", "luz", "assinatura", "economia" → `green`
- "2", "dois", "segundo", "telefonia", "internet", "celular", "chip", "telecom" → `telecom`
- "3", "três", "terceiro", "licenciado", "ganhar dinheiro", "vender", "franquia", "expansao", "expansão" → `expansao`

Emite `product_chosen` + `set_product`; sticky leva ao specialist no próximo turno. Flags em `extras`: `menu_presented`, `product_choice`.

Se resposta ambígua, repete menu **uma única vez** mais curto; depois só roteia se a pista for clara — senão pede esclarecimento curto, sem voltar a default em `green`.

### 2.3 Green — sem cidade, com engage_check, sem formulário
`supabase/functions/_igreen_v2/agents/green/stages.ts` + `run.ts`.

Nova ordem de qualificação:

```text
greet → explain_solution → send_video → engage_check
      → ask_consumo → ask_estado → ask_distribuidora
      → request_invoice → validate_invoice → ask_full_name_cpf
```

- **Remover** `ask_cidade` da decisão (extractor vira no-op para não quebrar dados antigos).
- **Adicionar** `ask_estado` (aceita UF ou nome de estado, normaliza para sigla; salva em `extras.estado`).
- **Adicionar** `ask_distribuidora` (texto livre + sugestões por UF; salva em `extras.distribuidora`).
- **Adicionar** `engage_check` entre `send_video` e `ask_consumo`: pergunta leve do tipo "Faz sentido pra você? Quer que eu te mostre quanto dá pra economizar?". Só avança quando há afirmação. Se dúvida/negativa, reforça benefício sem repetir literal (já coberto por anti-loop).
- **Remover** `ask_name` do meio da qualificação. Nome só em `ask_full_name_cpf`, na fase de contrato. Captura espontânea continua salvando em `extras.client_name`.
- Ritmo: **máximo 1 pergunta por turno** (regra hard no system prompt + assertion).

### 2.4 Prompts — tom de consultor, com memória explícita
`agents/green/prompt.ts`, `agents/qualifier/prompt.ts`.

Regras hard no system:
- Você é **consultor comercial humano**, não atendente de formulário.
- **Nunca** comece um turno com "Opa, tudo bem?", "Olá!", "Oi!" se `extras.greeted = true`. Continue a conversa naturalmente.
- **Nunca** repita uma pergunta cujo conteúdo já está em `extras` (consumo, estado, distribuidora, client_name). Se o valor está lá, agradeça e avance.
- **Nunca** pergunte cidade. Em hipótese alguma.
- **Nunca** peça CPF ou nome completo antes do stage `ask_full_name_cpf`.
- **1 pergunta por mensagem.** Sem listas de perguntas.
- Sempre referencie a resposta anterior em 1 frase curta antes da próxima pergunta (continuidade contextual).
- Frases curtas, emoji ocasional, zero linguagem corporativa.

Templates de `fallbackText` reescritos no mesmo tom (sem mini-saudação se `greeted`).

Injeção de contexto no user prompt: `last_ai_question`, `extras` resumidos (consumo, estado, distribuidora, nome), `turn_index`, para a IA "saber" o que já perguntou e o que já tem.

### 2.5 Estado e transições
`_igreen_v2/state-engine/transitions.ts` — **sem mudança**. Novos stages vivem dentro de `qualificacao` via `extras` (`engaged`, `consumo_medio`, `estado`, `distribuidora`), padrão já em uso.

### 2.6 Regression suite — cenários novos + replay da Thays
`_igreen_v2/testing/scenarios/index.ts` + `assertions.ts`.

**Ajustar** 02, 06, 07 para esperar menu quando cliente não cita produto.

**Novos cenários:**
- `16-menu-on-generic-greeting` — "Boa noite" → menu exato, sem ir para green.
- `17-menu-on-interest` — "Tenho interesse" → menu, não ask_name.
- `18-menu-choice-1-green` — após menu, "1" → roteia para green.
- `19-menu-choice-2-telecom` — após menu, "2" → roteia para telecom.
- `20-menu-choice-3-expansao` — após menu, "3" → roteia para expansao.
- `21-no-city-ever` — qualificação completa sem nenhum turno citando "cidade".
- `22-estado-distribuidora-order` — ordem consumo → estado → distribuidora.
- `23-engage-before-data` — turno pós-vídeo é `engage_check`, não `ask_consumo`.
- `24-no-repeat-greeting` — depois do primeiro turno, IA não começa com "Opa", "Olá", "Oi", "tudo bem?".
- `25-no-repeated-question` — se cliente respondeu consumo, IA não pergunta consumo de novo.
- `26-one-question-per-turn` — cada turno da IA tem no máximo 1 "?".
- `27-thays-replay` — **replay literal** dos turnos do usuário Thays:
  1. "Boa noite"
  2. "Quero saber como funciona a energia por assinatura"
  3. "Sim"
  4. "Ok"
  5. "500"
  6. "500"
  7. (resposta livre — estado)
  8. "SC"
  9. (distribuidora)
  
  Asserts: sem repetição, sem cidade, sem mini-saudação repetida, progressão correta, menu **não** aparece (porque ela cita produto no turno 2), engage_check entre vídeo e consumo, fatura pedida só após distribuidora.
- `28-ideal-full-flow` — fluxo ideal:
  1. "Boa noite" → menu
  2. "1" → roteia green
  3. (IA explica) "quero entender" → send_video
  4. "ok" → engage_check
  5. "faz sentido" → ask_consumo
  6. "500" → ask_estado
  7. "SC" → ask_distribuidora
  8. "Celesc" → request_invoice
  
  Asserts: zero loops, zero repetição, zero mini-saudação repetida, 1 pergunta por turno, progressão monotônica de stages.

**Novas assertions:**
- `assertNoCityQuestion(turns)` — regex `\b(cidade|onde voc[eê] mora|mora em qual)\b` em qualquer mensagem da IA → fail.
- `assertMenuPresentedWhenGeneric(turns)` — se primeira user msg é genérica, alguma resposta cita as 3 opções numeradas.
- `assertNoRepeatedGreeting(turns)` — após turno 1, mensagens da IA não podem começar com "opa", "olá", "oi", "tudo bem".
- `assertNoRepeatedAnsweredQuestion(turns, state)` — IA não pergunta dado já presente em `extras`.
- `assertSingleQuestionPerTurn(turns)` — cada mensagem da IA tem no máximo 1 `?`.
- `assertNoPrematureDataCollection(turns)` — antes de `engage_check` confirmado, IA não pede consumo/estado/distribuidora.
- `assertCommercialProgression(turns)` — sequência de stages respeita: `greet|present_menu` → `explain_solution` → `send_video` → `engage_check` → `ask_consumo` → `ask_estado` → `ask_distribuidora` → `request_invoice`.

Todas as novas asserts entram no `ALL_ASSERTIONS` aplicável e nos cenários relevantes.

### 2.7 Replay runner — modo "fixture Thays"
`testing/conversation-runner.ts`:
- Adicionar suporte a `mode: "replay"` que, em vez de simular, lê turnos de uma fixture (cenário 27) e roda em modo live opcionalmente contra `account_id` + `phone` informados (Thays / `5547989118695`).
- Em modo live, exporta traces reais (decisão de supervisor, stage decidido, tool_calls, patches) para o relatório.

---

## 3. O que **não** muda
- state-engine, supervisor `decide.ts`, sticky specialist, locks, transport, outbound realtime, persistência outbound, truncamento, failsafe técnico, D13–D15.
- Whitelist de `etapa_funil` (`transitions.ts`).
- Behavior audit / observability.
- Tabela `igreen_behavior_audits`.

---

## 4. Entregáveis
1. Diffs cirúrgicos:
   - `supervisor/prompt.ts`
   - `agents/qualifier/{run,prompt,stages}.ts`
   - `agents/green/{stages,run,prompt}.ts`
   - `testing/scenarios/index.ts`
   - `testing/assertions.ts`
   - `testing/conversation-runner.ts` (modo replay)
2. Suíte regressão verde: 15 antigos + 13 novos (16–28) em modo mock.
3. Replay da Thays em modo live opcional (cenário 27) contra `account_id` da `thays.chavess@gmail.com` e phone `5547989118695`.
4. Relatório consolidado: `/mnt/documents/igreen_sales_flow_refinement_v2_validation.md` contendo:
   - diff de stages antes/depois,
   - tabela PASS/FAIL por cenário,
   - traces lado a lado (turno real Thays × turno após refinement),
   - confirmação dos 7 sintomas resolvidos.

---

## 5. Critérios de aceite
- "Boa noite" / "tenho interesse" / "como funciona" → menu exato no formato aprovado, zero coleta de dados.
- Escolha "1" / "2" / "3" do menu roteia para o specialist correto via sticky.
- Nenhum turno em nenhum cenário pergunta cidade.
- Ordem fixa: consumo → estado → distribuidora → fatura.
- Pelo menos 1 turno de `engage_check` entre vídeo e qualquer pergunta de dado.
- 1 `?` por turno em 100% dos turnos da IA.
- Após o turno 1, nenhuma mensagem da IA começa com "Opa/Olá/Oi/tudo bem".
- Nenhum dado já capturado em `extras` é perguntado de novo.
- Replay da Thays (cenário 27) passa em todas as novas asserts.
- Suíte completa: 28/28 PASS em mock.

Confirma para eu sair de plan mode e implementar?
