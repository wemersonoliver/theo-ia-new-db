## Diagnóstico

Conferi a conversa (`5519997437978` da conta `marcioevandrocosta@hotmail.com`) e o estado do cenário no banco.

### Problema 1 — IA descartou a cliente em uma dúvida legítima
Sequência registrada:
- IA: "...desconto entre 10% e 14%. Numa conta de R$ 650,00, seu desconto pode chegar a R$ 91,00 todo mês."
- Cliente: **"Nessa conta o desconto é esse R$ 91,00 ?"** (pedindo confirmação)
- IA: "Tranquilo! Fico à disposição quando quiser dar uma olhada..." → despediu e marcou tag de descarte.

O specialist Green tratou a pergunta como "não tenho interesse / desistência". Faltam duas coisas no fluxo:
1. Reconhecer perguntas de confirmação sobre o valor simulado como `ask_clarification_discount`.
2. Resposta determinística explicando que o valor é uma **estimativa**, que o desconto real **depende do consumo** e que fica **dentro da faixa da distribuidora** (no caso da Elektro, entre 10% e 14%), e em seguida retomar o convite ao cadastro — sem despedir.

### Problema 2 — Follow-up disparou ~2h depois (devia ser 24h)
Enrollment atual: `started_at=11:00, current_day=1, current_period=evening, next_run_at=19:27` do **mesmo dia** da conversa (09:15-09:25). O conteúdo já enviado às 11:04/11:11 ("Bom dia Mariza"/"Imagino que ontem possa ter sido corrido") confirma o disparo precoce.

Causa em `supabase/functions/igreen-scenario-enroll/index.ts` → função `nextSlot("morning")`: se a hora atual ainda está dentro da janela 08-12 BRT, agenda **para o próprio dia** (`agora + 1-3 min`). Por isso, contatos que entram pela manhã recebem o "Dia 1" no mesmo dia em que conversaram.

Além disso, não há proteção contra disparo quando houve atividade humana recente (a cliente havia respondido 1h35min antes do primeiro item).

---

## Plano

### 1. Specialist Green — tratar dúvida sobre o desconto

Arquivo: `supabase/functions/_igreen_v2/agents/green/run.ts` e `prompt.ts`.

- Adicionar detecção determinística (regex/heurística no `run.ts`, antes do LLM) para perguntas do tipo:
  - "esse desconto é certo?", "é fixo?", "vai ser esse valor mesmo?", "é garantido?", "esse R$ X é o desconto?", "é sempre esse valor?"
  - Disparo só após a IA já ter enviado a simulação (etapa `simulou_economia` / extras com `discount_min_percent` e `discount_max_percent` preenchidos).
- Resposta determinística (sem LLM, evita risco de desvio), em 2 chunks:
  1. "Esse valor é uma **estimativa**, viu? O desconto real **depende do seu consumo no mês** e da modalidade da distribuidora."
  2. "Pra **{distribuidora}** a faixa fica entre **{min}% e {max}%**. No seu caso (R$ {fatura}), normalmente cai entre R$ {fatura*min} e R$ {fatura*max} por mês. Quer que eu já comece seu cadastro pra você travar esse desconto?"
- Bloquear a transição para "despedida / descarte" enquanto a etapa for `simulou_economia` e a última mensagem do cliente for uma pergunta (`?`) — mantém o lead em conversa.
- Atualizar `prompt.ts` do Green: incluir regra explícita "Se o cliente pedir confirmação do valor do desconto, NUNCA despeça nem aplique tag de descarte. Explique que é estimativa, reforce a faixa da distribuidora atual e convide ao cadastro."

### 2. Supervisor — nova intent `ask_clarification`

Arquivo: `supabase/functions/_igreen_v2/supervisor/prompt.ts`.

- Adicionar intent `ask_clarification` com regra: respostas curtas com `?` logo após a IA enviar valores/simulação são esclarecimento, nunca `off_topic` nem motivo de handoff/descarte. Mantém `current_specialist` e confidence ≥ 0.85.

### 3. Enroll — garantir intervalo mínimo de 24h

Arquivo: `supabase/functions/igreen-scenario-enroll/index.ts`.

- Em `nextSlot("morning")`, **sempre agendar para o dia seguinte** (remover o ramo "envio imediato dentro da janela"). O Day 1 do cenário passa a sair ~24h após a conversa, na janela 08-12 BRT sorteada.
- Adicionar guarda antes do `insert`: se existir mensagem humana (`sent_by='human'`) nas **últimas 12h** na conversa, recuar o `next_run_at` para `agora + 24h` (clamp na janela). Evita "Bom dia, imagino que ontem você teve um dia corrido" enquanto o cliente acabou de responder.

### 4. Dispatcher — barrar envio quando há atividade humana recente

Arquivo: `supabase/functions/igreen-scenario-dispatcher/index.ts`.

- Antes de enviar qualquer item, checar `whatsapp_conversations.messages` do contato: se houve mensagem `sent_by='human'` nas últimas 6h, **adiar** o `next_run_at` em +24h (clamp na janela) e não enviar. Funciona como fail-safe se o enroll for chamado durante conversa ativa.

### 5. Limpeza imediata do estado atual

- Cancelar (`status='stopped', stop_reason='manual_fix_clarification'`) o enrollment ativo `efd4fe32-c410-476a-99f1-365e2a30332e` para esta cliente, para que ela não receba mais o item das 19:27 de hoje.
- Listar e reagendar para **amanhã 08-12 BRT** os enrollments ativos da conta `marcioevandrocosta@hotmail.com` criados hoje cujo `next_run_at` ainda esteja para hoje (mesma causa raiz; evita o mesmo follow-up precoce em outros leads que entraram hoje).

### 6. Validação

- Re-simular pelo Simulador V2 a sequência: estado → SP, valor → R$ 650, distribuidora → 4 (Elektro), aguardar simulação, perguntar "Nessa conta o desconto é esse R$ 91,00?" → IA deve responder com a faixa (10-14% / R$ 65-R$ 91) e oferecer cadastro, sem despedir.
- Consultar enrollments criados após o deploy: `next_run_at` deve ser sempre ≥ 24h após `started_at`.

---

### Detalhes técnicos

- Cálculo do valor exibido: `fatura * (min/100)` e `fatura * (max/100)`, arredondado para inteiro. Buscar `discount_min_percent` / `discount_max_percent` de `igreen_distributor_discounts` (já existe tool `get_distributor_discount`) ou do `extras` do state se já resolvido.
- Para a guarda "atividade humana recente" no enroll/dispatcher, ler `messages` da `whatsapp_conversations` e filtrar `sent_by='human'` por `timestamp` — não há tabela separada de mensagens.
- Manter `verify_jwt = false` das functions afetadas (não muda config.toml).
- Sem alterações de schema; sem nova migration.