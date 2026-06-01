## Diagnóstico — conversa 5547989118695 (Wemerson, 01/06)

Linha do tempo + logs (`igreen_state_events`):

1. **13:16–14:10** — fluxo de descoberta funcionou (saudação → menu → escolha 1 → vídeo → engajamento → consumo → estado → distribuidora → simulação concreta). OK.
2. **14:11:49** — cliente pergunta: *"Como funciona esse cashback"*.
   - Supervisor classifica intent=`other` (confidence 0, sticky) → mantém specialist green.
   - Green specialist decide stage=`request_invoice` e responde re-pedindo a fatura, **ignorando completamente a pergunta sobre cashback**.
3. **14:13:21** — cliente envia o PDF da fatura.
   - Supervisor reconhece `send_invoice` (confidence 0.95). Tool `validate_green_invoice` é chamada.
   - Evento: `media_rejected` com `reason: "missing_size"`.
   - O `media-guard` exige `byte_size > 0`. O caller (`process-pending-ai/index.ts` linhas 208–218) envia `byte_size: 0` hard-coded. Por isso o validator nunca roda.
   - Estado fica em `etapa_funil=fatura_enviada`, `document_status=rejected`, **mas nenhuma mensagem é enviada ao cliente** — silêncio total.
4. **14:22:28** — cliente manda *"Ok"* sem entender o silêncio. Stage volta a `waiting_invoice` e o AI responde *"Que bom que você tá animado… assim que puder, é só mandar a sua fatura"* — ignorando que a fatura já foi enviada e rejeitada.

## Causas-raiz

| # | Bug | Arquivo |
|---|-----|---------|
| 1 | `byte_size: 0` hard-coded no encaminhamento ao agente v2 → media-guard sempre rejeita com `missing_size` | `supabase/functions/process-pending-ai/index.ts` (208–234) |
| 2 | Rejeição de mídia não gera mensagem de retorno ao cliente (silêncio) | `supabase/functions/_igreen_v2/agents/green/run.ts` (stage `validate_invoice`) e/ou `stages.ts` |
| 3 | Green specialist não trata FAQ rápida (`cashback`, `como funciona…`) antes de re-pedir a fatura | `supabase/functions/_igreen_v2/agents/green/stages.ts` + `run.ts` |
| 4 | Webhook nunca persiste `byte_size` da mídia → mesmo com fix em (1) não temos a fonte real do tamanho | `supabase/functions/whatsapp-webhook/index.ts` (~345, 872 — `persistedMedia`) |

## Plano de correção

### Etapa 1 — Corrigir contrato de mídia (byte_size real)
- **whatsapp-webhook/index.ts**: ao persistir mídia (`persistedMedia`), capturar o `fileLength` que a Evolution API envia em `imageMessage/documentMessage/videoMessage` e salvar em `newMessage.media_size` (novo campo do JSON da mensagem). Fallback: `Content-Length` da resposta ao baixar.
- **process-pending-ai/index.ts**: usar `m.media_size` real ao montar `mediaPayload` em vez de `byte_size: 0`.
- **validate-green-invoice.ts**: como segurança extra, se `byte_size <= 0` fazer `fetch(media_url, { method: "HEAD" })` para ler `Content-Length` antes de chamar o guard. Evita regressões e cobre faturas antigas.

### Etapa 2 — Falar com o cliente quando a fatura é rejeitada
- Em `agents/green/stages.ts`, expor um stage `invoice_rejected_reply` quando `document_status === "rejected"` e o último turno teve mídia (ou logo após o evento `invoice_rejected`/`media_rejected`).
- Em `agents/green/run.ts`, montar mensagem deterministica por motivo:
  - `missing_size` / `too_small` → "Não consegui abrir o arquivo. Pode reenviar a fatura em PDF ou foto nítida?"
  - `invalid_mime` → "Esse formato não abre aqui. Pode mandar como PDF ou foto?"
  - `reject_unreadable` / `reject_low_confidence` → "A imagem ficou um pouco baixa. Pode mandar uma foto mais nítida da fatura, mostrando o nome e o consumo?"
  - `reject_holder_mismatch` → fluxo existente de autorização de terceiros.
- Resetar `document_status` para `null` depois de pedir reenvio, para destravar próxima validação.

### Etapa 3 — Mini-FAQ no Green specialist (cashback e dúvidas comuns)
- Em `stages.ts`, adicionar regex/handler `isFaqQuestion(msg)` que detecta:
  - `cashback`, `indica(ção|cao)`, `zerar (a )?conta`, `como funciona`, `seguro`, `prazo`, `cancel(ar|amento)`.
- Antes de cair em `request_invoice`/`waiting_invoice`, se a pergunta bate em um padrão de FAQ e o cliente já está em `qualificacao`/`fatura_enviada`, devolver stage `faq_answer` com resposta curta determinística (1–2 frases) **e** repetir o CTA atual (ex.: "…por isso, assim que me mandar a fatura eu já calculo seu desconto exato 😉").
- Conteúdo do cashback: "Cada novo assinante que entrar pela sua indicação te devolve uma parte da fatura dele em cashback. Quanto mais indicações, mais sua conta vai pra perto de zero."

### Etapa 4 — Reset e teste do número
- Migration para limpar estado/eventos/locks/transport/lead do `5547989118695` e voltar o card CRM ao primeiro estágio (mesmo padrão da migration anterior).
- Smoke test manual: enviar "Oi" → "Wemerson" → "1" → "Sim" → "500" → "SC" → "Sim" → perguntar "como funciona o cashback" → enviar fatura PDF.
- Verificar em `igreen_state_events`:
  - sem `media_rejected: missing_size`;
  - presença de `document_validated` com `final=approve|soft_confirm`;
  - resposta determinística após FAQ.

## Detalhes técnicos

- `media-guard` permanece como guardião — só relaxamos a obrigatoriedade de tamanho quando conseguimos derivá-lo via HEAD.
- A mensagem de fallback de rejeição deve passar pelo pipeline normal de chunking (220 chars) e ser registrada em `whatsapp_conversations.messages` como `sent_by:ai`.
- Mini-FAQ não muda `etapa_funil` nem extras de qualificação — apenas responde e mantém o CTA pendente.
- Nenhuma alteração de schema necessária além de aceitar `media_size` opcional dentro do JSON `messages` (já é jsonb).
