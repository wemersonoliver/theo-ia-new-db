## Objetivo

Adicionar suporte à API **WAHA** como alternativa à **Evolution API**, com toggle por cliente (instância). Fase inicial: opt-in por instância. Fase futura: WAHA como padrão para novos usuários. Fase final: descontinuar Evolution.

---

## Estratégia geral

Criar uma **camada de abstração de provedor** (`_wa_provider.ts`) que unifica as operações usadas hoje pela Evolution. Todas as ~40 edge functions passam a chamar essa camada em vez de `evolutionRequest` direto. A camada decide, por instância, se roteia para Evolution ou WAHA.

```text
Edge Functions (ai-agent, send-message, dispatchers, etc.)
        │
        ▼
  _wa_provider.ts  ── resolve provider da instância
     │        │
     ▼        ▼
_evolution.ts   _waha.ts   (adapters — mesma interface)
     │            │
     ▼            ▼
Evolution API   WAHA API
```

---

## Fase 1 — Infraestrutura (opt-in por instância)

### 1.1 Banco de dados

Migration com:

- `whatsapp_instances.provider text NOT NULL DEFAULT 'evolution'` (`'evolution' | 'waha'`)
- `whatsapp_instances.waha_session_name text` (WAHA usa "session" no lugar de "instance")
- `system_whatsapp_instance.provider text NOT NULL DEFAULT 'evolution'`
- `accounts.default_wa_provider text` (para override por conta — nulo = usa global)
- `system_ai_provider`-style: nova linha em `platform_settings` (ou tabela `system_wa_provider`) para o **provedor padrão de novos cadastros** (`evolution` por enquanto).

### 1.2 Secrets

- `WAHA_API_URL` (base URL do servidor WAHA)
- `WAHA_API_KEY` (X-Api-Key global)
- Evolution atual permanece intacta.

### 1.3 Nova abstração `supabase/functions/_wa_provider.ts`

Interface única cobrindo todas as operações usadas hoje:

```text
createInstance / deleteInstance / getInstanceStatus
getQrCode / getPairingCode / logout
sendText / sendMedia / sendAudio / sendPresence (composing, recording)
setWebhook / getProfilePicture / checkNumberExists (resolveJid)
downloadMediaBase64  (usado por transcribe-audio, process-image-ocr)
```

Cada operação recebe `{ provider, instance, credentials, ... }` e delega para `_evolution.ts` ou o novo `_waha.ts`. Retorno normalizado (`{ ok, status, data, text }`) igual ao atual, para minimizar mudanças nos callers.

### 1.4 Novo adapter `supabase/functions/_waha.ts`

Implementa a mesma interface acima chamando os endpoints WAHA (`POST /api/sendText`, `/api/sendImage`, `/api/sessions/{name}/...`, `/api/{session}/chats/{chatId}/messages`, webhook config via `/api/sessions`). Inclui:

- Header `X-Api-Key: WAHA_API_KEY`
- Normalização de JID (WAHA usa `5547...@c.us`)
- Fallback e tratamento de erros equivalente ao `evolutionRequest` (com `reportApiFailure` / `reportApiSuccess` já existentes)
- Suporte a áudio base64 (WAHA aceita `file.url` ou `file.data`)
- Presença "composing" e "recording" (WAHA: `POST /api/startTyping`, `POST /api/stopTyping`; áudio: `sendSeen`/presença "recording" via `/api/sendPresence`)

### 1.5 Refactor incremental dos callers

Substituir `evolutionRequest(...)` por `waProvider.sendText(...)` (etc.) em todas as edge functions listadas. Para minimizar risco, primeiro refatoramos as **críticas de envio** (ordem):

1. `send-whatsapp-message`, `send-whatsapp-media`
2. `whatsapp-ai-agent`, `whatsapp-igreen-agent-v2`, `process-pending-ai`
3. `create-whatsapp-instance`, `disconnect-whatsapp-instance`, `refresh-whatsapp-qrcode`, `repair-whatsapp-webhook`
4. Todos os dispatchers de follow-up, cenários iGreen, lembretes, etc.
5. `whatsapp-webhook` — passa a aceitar payloads dos **dois formatos** (Evolution flat e WAHA event-based).

### 1.6 Webhook unificado

`whatsapp-webhook` detecta o formato:

- Evolution: `{ event: 'messages.upsert', instance, data: { key, message, ... } }`
- WAHA: `{ event: 'message', session, payload: { from, body, hasMedia, ... } }`

Normaliza para o formato interno já usado antes de gravar em `whatsapp_conversations`.

### 1.7 UI — toggle por instância

- Em `src/pages/WhatsApp.tsx` (e admin equivalente), adicionar seletor **Provedor: Evolution | WAHA (beta)**. Só aparece se o secret WAHA estiver configurado.
- Ao trocar o provider de uma instância existente: exigir reconexão (deleta a sessão antiga do provider anterior, cria nova no novo provider, mostra novo QR).
- Painel Admin (`/admin`) — nova tela **Provedor WhatsApp** análoga a `AdminAIProvider.tsx`, para:
  - Definir provedor padrão de **novos cadastros**
  - Migrar clientes específicos em lote

---

## Fase 2 — WAHA padrão para novos usuários

Depois de validação em produção (métricas de entrega, estabilidade, custo):

- Mudar o default de `provider` em `whatsapp_instances` para `'waha'`.
- Atualizar `create-whatsapp-instance` para respeitar `system_wa_provider.default_provider`.
- Clientes antigos permanecem em Evolution até migração manual.

## Fase 3 — Descontinuação da Evolution

- Ferramenta admin de migração em lote (desconecta Evolution → cria sessão WAHA → notifica cliente para escanear QR).
- Remover `_evolution.ts` e código morto após 100% migrado.

---

## Detalhes técnicos importantes

- **Nenhuma mudança para o cliente final** enquanto estiver em Evolution — a abstração preserva assinaturas e payloads salvos.
- **JID / normalização de telefone**: já centralizada em `_phone.ts` — WAHA usa `@c.us`, Evolution usa `@s.whatsapp.net`. A conversão fica no adapter, o resto do sistema continua usando o telefone puro.
- **Base64 de mídia**: WAHA aceita URL pública OU base64 sem prefixo `data:` — igual à regra já documentada da Evolution.
- **Health monitoring**: reaproveitar `_health.ts` (`reportApiFailure`/`Success`) marcando o `provider` no log para separar métricas.
- **Rollback**: como o campo `provider` é por instância, basta alterar de volta para `'evolution'` em qualquer cliente com problema.

---

## Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Diferença de payload no webhook quebrar histórico | Testar com instância de laboratório antes de expor UI |
| WAHA sem paridade em algum recurso (ex.: pairing code, presence "recording") | Mapear gaps no adapter; retornar `notSupported` e degradar suavemente |
| Custo de refatorar ~40 functions | Fazer em PRs pequenos por grupo (envio → agente → dispatchers → sync) |
| Instâncias legadas ficarem órfãs na Evolution | Botão admin "desconectar do provedor antigo" ao trocar |

---

## Entregáveis da Fase 1 (o que vou implementar quando aprovar)

1. Migration com novas colunas + secrets `WAHA_API_URL` / `WAHA_API_KEY`.
2. `_wa_provider.ts` + `_waha.ts` (adapters completos).
3. Refactor dos 4 grupos de edge functions acima.
4. `whatsapp-webhook` dual-format.
5. Toggle na UI da página WhatsApp + tela admin **Provedor WhatsApp**.
6. Documentação curta no README interno de como trocar um cliente.

Confirma que posso seguir com **apenas a Fase 1** (opt-in por cliente, Evolution segue padrão)?