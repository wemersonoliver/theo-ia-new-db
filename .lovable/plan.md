## Diagnóstico — conversa 5547989118695 (Wemerson, 01/06 — 2ª rodada)

Cronologia + logs (`igreen_state_events` + `igreen_document_validations`):

1. **14:58** — IA pergunta consumo "em **reais ou kWh**". Cliente não entende kWh e responde "500 reais".
2. **15:10 / 15:18 / 15:22** — IA repete CTA "**pra eu calcular sua economia exata**, me manda a fatura". O foco deveria ser **iniciar a verificação do cadastro**, não recalcular economia (a economia já foi simulada em 15:10).
3. **15:25:08** — Cliente envia **PDF de 733KB**, perfeito (FATURA WEMERSON.pdf, Celesc, titular WEMERSON LEITE OLIVEIRA, 616 kWh). O webhook extraiu OCR completo em `ai_content`.
4. **15:25:39 → 15:25:55** — `validate_green_invoice` roda em 10s. O **Gemini 2.5 Flash** (em `igreen-document-validator`) devolveu `classification: "unreadable"`, `confidence: 0`, `extracted: {}` — mesmo com PDF nítido. PDF inline no Gemini Flash falha intermitentemente.
5. **15:26:04** — IA manda "Recebi sua fatura e já tô dando uma olhada" (mensagem `validate_invoice` do prompt). **Não envia mensagem de rejeição.** Cliente fica esperando >1h.
6. **16:31** — Cliente manda "Ok" sem entender o silêncio. Só agora dispara `invoice_rejected_reply` ("A foto da fatura ficou um pouco baixa…").

## Causas-raiz

| # | Bug | Onde |
|---|-----|------|
| 1 | Pergunta de consumo aceita kWh — confunde cliente | `agents/green/prompt.ts:54` (ask_consumo) |
| 2 | CTA de fatura fala "calcular economia exata" em vez de "iniciar verificação do cadastro" | `prompt.ts:68`, `run.ts:222,224,371,458,460,601`, `testing/conversation-runner.ts:38` |
| 3 | Após receber documento, IA manda "tô dando uma olhada" e só responde rejeição/aprovação no próximo turno do cliente (silêncio de 1h+) | `prompt.ts:71-72` (validate_invoice prompt) + `agents/green/run.ts` (não encadeia próxima ação após tool) |
| 4 | Validator marca PDF nítido como `unreadable` (Gemini Flash falha com PDF inline) e nunca usa o OCR já extraído pelo webhook (`message.ai_content`) | `tools/validate-green-invoice.ts` + `igreen-document-validator/index.ts` |

## Plano de correção

### Etapa 1 — Texto da pergunta de consumo (somente reais)
- `agents/green/prompt.ts:54` (`ask_consumo`): trocar "(R$ ou kWh)" por "em reais".
- `run.ts:601` fallback do `ask_consumo` continua perguntando apenas em reais (já está).
- Manter o regex `extractConsumo` em `run.ts:493` aceitando kWh **só** como fallback defensivo (se cliente mandar mesmo assim).

### Etapa 2 — CTA: fatura para iniciar verificação do cadastro
Trocar em todos os pontos abaixo "calcular sua economia exata / calcular a economia exata / calcular o valor exato" por "**iniciar a verificação do seu cadastro**":
- `agents/green/prompt.ts:68` (request_invoice)
- `agents/green/run.ts:222` (deterministicText pós-simulação)
- `agents/green/run.ts:224` (fallback simulate)
- `agents/green/run.ts:371` (CTA FAQ)
- `agents/green/run.ts:458,460` (mensagens determinísticas equivalentes)
- `agents/green/run.ts:601` (request_invoice fallback)
- `testing/conversation-runner.ts:38` (mock)
Texto-padrão: "Pra **iniciar a verificação do seu cadastro**, me manda uma foto ou PDF da sua última fatura, pode ser? 😊"

### Etapa 3 — Eliminar "tô dando uma olhada" e encadear próxima ação
Objetivo: ao receber o documento, **não enviar mensagem de stalling**. Rodar `validate_green_invoice` e, no mesmo turno, emitir a próxima fala determinística com base no resultado.

- `agents/green/prompt.ts:71-72` (`validate_invoice`): substituir por `return "";` (LLM silencia).
- `agents/green/run.ts`, bloco `stage === "validate_invoice" && ctx.media`:
  - Continuar agendando a tool `validate_green_invoice`.
  - **Após** o resultado da tool no mesmo turno, em vez de devolver texto LLM stalling:
    - Se `final ∈ {approve, soft_confirm}` → enviar mensagem determinística de **`request_identity`** ("Fatura confirmada! Pra prosseguir com o cadastro, me manda uma foto do RG ou CNH do titular, por favor.") e marcar `extras.identity_requested = true`.
    - Se `final ∈ {reject_*}` ou `media_rejected` → enviar **`invoice_rejected_reply`** imediatamente (a mesma mensagem que já existe em `run.ts:341-352`) e marcar `extras.invoice_rejected_notified = true`.
  - Isto encurta o ciclo: cliente envia PDF → 1 mensagem determinística (aprovação+pede RG, ou rejeição+pede reenvio).

### Etapa 4 — Validator: usar OCR pré-extraído como reforço e fallback
Aproveitar o `ai_content` que o webhook (`process-image-ocr`/processamento de PDF) já produz, evitando 100% de dependência do Gemini Vision em PDFs.

- `tools/validate-green-invoice.ts`:
  - Buscar a última mensagem da conversa (`whatsapp_conversations.messages`) com mesmo `media_url` e ler `m.ai_content` e `m.media_filename` (best-effort).
  - Passar para o validator no body: `extracted_text` e `filename`.
- `igreen-document-validator/index.ts`:
  - Aceitar `extracted_text?: string` e `filename?: string` no body.
  - Atualizar `SYSTEM` prompt: "Você receberá uma imagem/PDF E pode receber também o TEXTO já extraído por OCR (extracted_text). Use ambos. Se o texto OCR contiver claramente dados de fatura de energia brasileira (CNPJ de distribuidora, kWh, valor, titular), classifique como `green_invoice` mesmo se a imagem inline falhar."
  - Quando montar `contents` do Gemini, anexar `{ text: "OCR pré-extraído:\n" + extracted_text }` antes do `inlineData` quando houver.
  - **Fallback puro-texto**: se `inlineData` retornar `unreadable`/`confidence<0.3` mas `extracted_text` tiver >300 chars e regex detectar `(kWh|kwh)` + distribuidora conhecida (Celesc, Enel, CPFL, Light, Equatorial, Energisa, Neoenergia, EDP, Coelba, Cemig, Copel, RGE) + nome titular plausível (≥2 palavras maiúsculas), retornar `classification: "green_invoice"`, `confidence: 0.75`, `extracted: { holder_name, distributor, energy_consumption_kwh }` derivados por regex.

### Etapa 5 — Reset do número e smoke test
- Migration: limpar `igreen_conversation_state`, `igreen_state_events`, `igreen_transport_events`, `igreen_tool_locks`, `igreen_lead_data`, `igreen_automation_executions`, `igreen_document_validations` para `5547989118695`; resetar `whatsapp_conversations.messages = '[]'`; voltar card CRM ao primeiro estágio.
- Roteiro: "Oi" → "Wemerson" → "1" → "Sim" → "500" → "SC" → "Sim" → enviar mesmo PDF da Celesc.
- Validar em `igreen_state_events`:
  - `ask_consumo` não menciona kWh;
  - CTAs falam "verificação do cadastro";
  - **Nenhum** "tô dando uma olhada" após o PDF;
  - `document_validated` com `final=approve` (via fallback OCR);
  - Próxima mensagem é `request_identity` no mesmo turno.

## Detalhes técnicos

- Nenhuma alteração de schema necessária; reaproveitamos `ai_content` que já fica no JSON `messages`.
- Mantemos `media-guard` (ainda valida mime/tamanho).
- O fallback OCR só substitui Gemini Vision quando ele falha — não relaxa segurança: ainda exige distribuidora válida + estrutura de fatura.
- `validate_invoice` deixa de gerar mensagem LLM; toda fala vira determinística (mais previsível, sem alucinação).
