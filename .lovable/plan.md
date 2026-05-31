
# Plano — Ajustes no Fluxo Conexão Green (iGreen v2)

Baseado nos 4 pontos levantados após o último teste com `5547989118695`.

---

## 1) Mensagem após escolher a opção 1 (Conexão Green)

**Problema:** depois do menu, a IA mandou apenas "Energia limpa é nossa praia… Quer entender melhor como funciona?" e ficou esperando outra confirmação antes de mandar o vídeo. Isso adiciona um passo extra desnecessário.

**Correção:**
- Quando o `qualifier` decide produto = `green` (cliente escolheu 1), entrar **direto** no novo stage `green_intro` (substituindo o `explain_solution` atual para o primeiro turno do Green).
- Texto fixo (sem LLM) usando o nome do cliente já capturado (`extras.client_name`):
  > Que ótimo seu interesse na Conexão Green, {nome}! 😊
  >
  > É a nossa solução de energia por assinatura, que te dá desconto na conta de luz todo mês, sem precisar de obra ou instalação.
  >
  > Vou te enviar um vídeo rápido explicando como funciona. Me avisa quando assistir, tá? 😉
- No **mesmo turno**, disparar `send_discovery_video` e marcar `extras.greeted = true`, `extras.explained = true`, `extras.solution_confirmed = true`, `extras.video_sent = true`, `etapa_funil = qualificacao`.
- Próximo turno após o "ok" do cliente: `engage_check` → `ask_consumo`.

## 2) Vídeo enviado em duplicidade

**Diagnóstico:** o lock idempotente da tool `send_discovery_video` é `video:${produto}:${phone}`, mas o gate `extras.video_sent` só é setado **depois** do envio. Quando duas mensagens chegam quase simultaneamente (cliente mandando "Sim" e algo logo em seguida), dois runs do agente disparam a tool em paralelo, ambos passam pelo check `if (extras.video_sent)` antes do primeiro persistir, e o vídeo sai duas vezes.

**Correção:**
- Em `send-discovery-video.ts`, **antes** de chamar a Evolution API, fazer um insert "claim" em `igreen_transport_events` com `kind = video`, `status = sending` e unique constraint em (`account_id`, `phone`, `kind`, `correlation_id_root`) — usar o `phone+produto` como chave anti-duplicação. Se o insert violar unique, retornar `skipped: already_sent`.
- Alternativa mais simples (e que vou priorizar): consultar `igreen_transport_events` no início da tool por `account_id+phone+kind='video'+status='sent'` nos últimos 10 minutos; se já existe → `skipped`.
- Reforçar o lock do tool-router para `send_discovery_video` com TTL maior (60s) por `phone` (não só `phone+produto`).

## 3) IA ignorou "vou procurar a fatura" e pediu de novo

**Diagnóstico:** o regex `INTENT_SEND_INVOICE_RX` exige "fatura/conta/boleto/luz" próximo do verbo. Mensagens como "vou procurar", "deixa eu pegar", "só um minuto" não casam → cai no fluxo padrão e repete `request_invoice`. Além disso, sem agregação, cada mensagem dispara um run independente.

**Correção:**
- Expandir `INTENT_SEND_INVOICE_RX` (e criar `INTENT_SEARCHING_INVOICE_RX`) para cobrir: "vou procurar", "deixa eu (ver|achar|pegar|buscar)", "só um minuto/momento", "já já", "to procurando", "tô vendo aqui", mesmo sem citar "fatura" — desde que o `etapa_funil` esteja em `qualificacao`/`fatura_enviada` e o último stage da IA tenha sido `request_invoice`.
- Quando casar, ir para `intent_send_invoice_ack` e marcar `extras.invoice_search_ack = true` com **cooldown de 5 min**: enquanto esse flag estiver setado, NUNCA voltar para `request_invoice`; cair em `waiting_invoice` (resposta curta "tranquilo, fico no aguardo") ou silenciar.
- Confirmar com você se o debouncer (`whatsapp_pending_responses`) já está respeitando os 20s configurados — vou logar isso e validar.

## 4) Distribuidoras por estado + simulação de desconto com valor real

**Hoje:** `ask_distribuidora` pergunta abertamente "qual é a sua distribuidora?" sem oferecer opções e o `simulate_discount` é proibido de citar números antes da fatura.

**Correção em duas partes:**

**4a — Apresentar distribuidoras do estado:**
- Após capturar `extras.estado`, antes de perguntar a distribuidora, chamar uma nova tool `list_distributors_by_state` que faz `select distributor from igreen_distributor_discounts where state = ? and enabled = true`.
- Se vier **1**: mensagem "No seu estado trabalhamos com a {Distribuidora}, essa é sua distribuidora atual?" — espera sim/não.
- Se vierem **N>1**: mensagem "No seu estado trabalhamos com:\n1 - A\n2 - B\n…\nQual é a sua?" — aceitar resposta por número OU nome.
- Persistir `extras.distribuidora` quando o cliente confirmar/escolher.

**4b — Simulação com valor real:**
- Mover a pergunta de `ask_valor_fatura` para **antes** de pedir a fatura: ordem nova vira `ask_consumo` (kWh opcional) → `ask_estado` → `ask_distribuidora` (lista) → `ask_valor_fatura` (R$) → `simulate_discount_concreto` → `request_invoice`.
- Novo stage `simulate_discount_concreto`: usa `discount_min_percent` e `discount_max_percent` da `get_distributor_discount` + `extras.valor_fatura` capturado e devolve texto determinístico (sem LLM) no formato:
  > Olha só, {nome}! Pra {Distribuidora} a média de desconto fica entre {min}% e {max}%. Numa conta de R$ {valor}, seu desconto pode chegar a R$ {valor*max/100} todo mês.
  >
  > E não é só isso: depois do cadastro, você ainda pode chegar a zerar sua conta indicando novos assinantes pelo nosso programa de cashback.
  >
  > Bora fazer seu cadastro agora? Só preciso de uma foto ou PDF da sua fatura pra iniciar.
- Esse texto libera a regra atual "PROIBIDO citar percentuais" porque os números vêm direto do banco (não da IA).

---

## Detalhes técnicos (arquivos)

- `supabase/functions/_igreen_v2/agents/green/stages.ts` — adicionar stages `green_intro`, `simulate_discount_concreto`; ajustar `decideGreenStage` para nova ordem; ampliar `INTENT_SEND_INVOICE_RX`; adicionar `invoice_search_ack` gate.
- `supabase/functions/_igreen_v2/agents/green/run.ts` — wiring dos novos stages, captura de `valor_fatura`, chamada da nova tool `list_distributors_by_state`, textos determinísticos para `green_intro` e `simulate_discount_concreto`.
- `supabase/functions/_igreen_v2/agents/green/prompt.ts` — remover stage `simulate_discount` antigo (ou marcar deprecado), adicionar molde para os novos stages quando LLM precisar.
- `supabase/functions/_igreen_v2/tools/list-distributors-by-state.ts` (novo) — consulta `igreen_distributor_discounts`.
- `supabase/functions/_igreen_v2/tools/_register-all.ts` — registrar a nova tool.
- `supabase/functions/_igreen_v2/tools/send-discovery-video.ts` — check anti-dupe via `igreen_transport_events`.
- Migração: reset do estado de teste para `5547989118695` ao final, pra você testar do zero.

Aprova esse plano? Posso aplicar todas as mudanças de uma vez.
