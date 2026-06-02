## Diagnóstico da conversa `5547989118695`

Cruzei `igreen_traces`, `igreen_document_validations` e `whatsapp_conversations`. Três problemas independentes, todos no fluxo iGreen.

### Problema 1 — IA ficou muda após o PDF (o "parou após fatura")

Sequência às 19:15:
1. Cliente envia PDF da fatura Celesc (PDF perfeito, OCR completo no `ai_content`).
2. Supervisor decide `send_document → green` (ok).
3. Specialist green chama `validate_green_invoice` — `specialist_completed messages_count: 0` (já não gerou texto nessa passada).
4. Tool retorna **rejected/unreadable** (problema 2 abaixo).
5. State-engine: `apply_patch.invalid_transition_dropped from: qualificacao to: fatura_rejeitada` — transição derrubada.
6. `behavior_chunks_generated count: 0` → **nenhum chunk de fala foi enviado**.

**Causa:** quando uma fatura é rejeitada o specialist depende de uma segunda passada para falar com o cliente, mas a transição de `etapa_funil` é bloqueada pelo state-machine e o specialist não compõe mensagem nesse turno → silêncio total. Já existe a flag `invoice_rejected_notified: false` em `extras`, mas nada lê isso pra disparar a fala.

### Problema 2 — Validator retornou `unreadable` mesmo com OCR completo

O `ai_content` da mensagem do PDF tem o conteúdo inteiro da fatura Celesc (titular, CPF mascarado, kWh, Total a Pagar). A rodada anterior já tinha implementado o "fast-path" em `igreen-document-validator` para reconhecer esse caso e retornar `green_invoice` confidence 0.92 sem depender do Gemini Vision.

**Mas o validator devolveu `classification: unreadable, confidence: 0`.** Não há **nenhum log** da função `igreen-document-validator` para essa execução (consultei `function_edge_logs`). Indícios fortes de que:
- ou a última versão do código do validator **não foi efetivamente publicada**, e o cliente está rodando a versão antiga (sem fast-path), ou
- o `extracted_text` não está chegando até o validator (a busca em `whatsapp_conversations.messages` falhou silenciosamente).

A ação aqui é (a) forçar redeploy do `igreen-document-validator`, (b) instrumentar logs explícitos quando entra/sai do fast-path, (c) endurecer a busca do `extracted_text` em `tools/validate-green-invoice.ts` (procurar também `m.content`, casar por `media_filename` ou pelas últimas 3 mensagens com mídia, não apenas exact-match em `media_url`).

### Problema 3 — Pedidos duplicados de consumo / dados perguntados várias vezes

Entre 18:50 e 19:10 o agent ficou repetindo perguntas. Trace mostra:
- 18:55:07 `consumo_medio: 500` já salvo.
- 18:56:09 IA repete pergunta de distribuidora (mesmo já tendo `distributors_options: [Celesc]`).
- 19:09:53 IA pergunta distribuidora outra vez (já tinha `distribuidora: Celesc`).
- 19:10:57 valor da fatura salvo como `valor_fatura: 50000` (provavelmente cliente disse "500" e ferramenta multiplicou por 100 esperando centavos) — depois corrigido para `500`.

**Causa:** o prompt do specialist green não está checando `extras.consumo_medio`, `extras.distribuidora`, `extras.valor_fatura` antes de perguntar. Também a normalização do `valor_fatura` em `save_green_lead_field` está inconsistente (às vezes em reais, às vezes em centavos).

---

## Plano de correção (apenas vertical iGreen, sem mexer no plano comum)

### 1. Garantir que o specialist green SEMPRE fale após rejeição de fatura
Arquivo: `supabase/functions/_igreen_v2/agents/green/run.ts`

- Após `validate_green_invoice` retornar com `document_status: rejected` (ou evento `invoice_rejected`), adicionar lógica determinística: se `extras.invoice_rejected_notified !== true`, **forçar** uma mensagem de fala no mesmo turno (não depender de segunda passada do LLM) com o motivo (`reject_unreadable` → "Não consegui ler a fatura, pode reenviar uma foto mais nítida ou outro PDF?"; `reject_holder_mismatch` → mensagem específica; `reject_not_invoice` → idem).
- Marcar `extras.invoice_rejected_notified: true` no mesmo patch.
- Não tocar o state-machine de `etapa_funil` quando a transição for inválida (apenas atualizar `extras` + `document_status`).

### 2. Corrigir o state-engine para não engolir o turno
Arquivo: `supabase/functions/_igreen_v2/state-engine/apply.ts` (ou similar)

- Quando `apply_patch.invalid_transition_dropped` ocorrer, ainda assim **aplicar** os campos válidos do patch (já faz) **e emitir um warning trace** (já faz) — adicionar guard no orquestrador para garantir que se o specialist devolveu 0 mensagens E o tool foi terminal (rejection/approval), dispara um fallback de fala (reuso do failsafe).

### 3. Validator — garantir fast-path funcional
Arquivos: `supabase/functions/igreen-document-validator/index.ts`, `supabase/functions/_igreen_v2/tools/validate-green-invoice.ts`

- Adicionar `console.log` explícitos no validator: "fast-path hit" / "fast-path miss reason=<...>" para diagnóstico futuro.
- Em `validate-green-invoice.ts`, robustecer a busca do texto OCR:
  - Procurar a mensagem por `media_url` exato OU por `media_filename` OU pela última mensagem com `media_type IN ('document','image')` nas últimas 5 mensagens recebidas (`from_me=false`).
  - Adicionar trace `validate_green_invoice.extracted_text_found` com `length` para confirmar que o OCR está passando.
- Forçar redeploy do `igreen-document-validator` (a ausência total de logs sugere que a versão atual não está sendo executada).

### 4. Evitar repetição de perguntas no specialist green
Arquivo: `supabase/functions/_igreen_v2/agents/green/prompt.ts` (ou onde monta o contexto)

- Adicionar no prompt do green um bloco "DADOS JÁ COLETADOS" listando explicitamente `client_name`, `estado`, `distribuidora`, `consumo_medio`, `valor_fatura` quando preenchidos, com instrução: "NÃO pergunte novamente esses campos".
- Em `save_green_lead_field`, normalizar `valor_fatura` para sempre reais (number, sem multiplicação por 100). Hoje a IA passa 500 e às vezes vira 50000.

### 5. Reset do número de teste após o deploy
Migration para limpar `igreen_traces`, `igreen_transport_events`, `igreen_document_validations`, `igreen_conversation_state`, `whatsapp_pending_responses` e zerar `messages` da conversa de `5547989118695`. Reaproveita o template das rodadas anteriores.

---

## Validação

- Reenviar a fatura Celesc → validator deve retornar `green_invoice` confidence 0.92 (fast-path), e logs do validator devem mostrar "fast-path hit".
- Forçar uma fatura ruim (foto borrada) → IA deve responder pedindo reenvio em ≤ 1 turno, nunca ficar muda.
- Mandar "minha conta vem uns 500 reais" → `valor_fatura` deve ficar `500`, e a IA não deve perguntar valor de novo na próxima mensagem.

---

## Pergunta pra você antes de implementar

**Posso prosseguir com este plano?** E sim, se você anexar uma foto borrada / má qualidade da fatura, consigo simular o caminho "rejeitado" e validar o fix #1 com mais segurança — mas não é obrigatório, o reset + reenvio do PDF Celesc atual já cobre o caminho feliz.