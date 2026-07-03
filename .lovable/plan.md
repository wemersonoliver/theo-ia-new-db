## Contexto adicional
A Evolution API entrega mensagens do próprio aparelho com um marcador diferente (`source`) e nós usávamos isso para saber quando o cliente respondeu pelo celular e pausar a IA. O WAHA **não faz essa distinção**: toda mensagem saindo do seu número vem com `fromMe: true`, seja ela:

1. Enviada pela IA (via nossa edge function)
2. Enviada pelo atendente no painel (via nossa edge function)
3. Enviada manualmente pelo aparelho/WhatsApp Web do cliente

Precisamos recriar essa distinção para poder pausar a IA quando o dono do número intervém pelo aparelho.

---

## Estratégia (baseada na doc oficial WAHA)

O `POST /api/sendText` e `POST /api/sendImage/…` **retornam o `id` da mensagem criada** (formato `true_<chatId>_<messageId>`). Toda mensagem que sai por nossos endpoints WAHA vai gerar um webhook `message.any` com `fromMe: true` — usando o **mesmo id**.

**Regra:** se o id que chega no webhook está registrado como "enviado por nós" → é IA ou atendente pelo painel. Se **não está** → foi digitado no aparelho → pausar IA.

---

## Plano completo (juntando com o anterior)

### 1. Padrão de identificadores WAHA (do plano anterior)
- Respeitar `@c.us`, `@lid`, `@g.us`, `@newsletter`, `@broadcast` no parser.
- LID → resolver via `GET /api/{session}/lids/{lid}`; se falhar, ignorar.
- Guardar `wa_chat_id` original e reusar no envio.
- Para envio novo, usar `GET /api/contacts/check-exists` (regra oficial BR).
- Baixar mídia com header `X-Api-Key`.

### 2. Rastreamento de mensagens enviadas por nós (novo)

**Nova tabela `wa_outgoing_messages`:**
```sql
CREATE TABLE public.wa_outgoing_messages (
  message_id text PRIMARY KEY,        -- id retornado pelo WAHA
  instance_id uuid,
  account_id uuid,
  user_id uuid,
  phone text NOT NULL,
  origin text NOT NULL,               -- 'ai' | 'panel' | 'system'
  sender_user_id uuid,                -- quem clicou "enviar" no painel (null p/ IA)
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.wa_outgoing_messages (phone, created_at DESC);
GRANT SELECT, INSERT ON public.wa_outgoing_messages TO authenticated;
GRANT ALL ON public.wa_outgoing_messages TO service_role;
ALTER TABLE public.wa_outgoing_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.wa_outgoing_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```
Purga automática após 7 dias por `pg_cron` (não precisa histórico longo).

### 3. Toda edge function que envia registra o id

Alterar `_wa_provider.ts → sendWhatsAppText/Media` para **retornar `messageId`**. Nas funções que enviam (`send-whatsapp-message`, `send-whatsapp-media`, `whatsapp-ai-agent`, `send-appointment-reminders`, follow-ups, etc.), após envio bem-sucedido:

```ts
await supabaseAdmin.from("wa_outgoing_messages").insert({
  message_id: sendResult.messageId,
  instance_id: ctx.instanceId,
  account_id: accountId,
  user_id: userId,
  phone: normalizedPhone,
  origin: isAI ? "ai" : (system ? "system" : "panel"),
  sender_user_id: isAI ? null : userId,
});
```

### 4. Webhook decide o que fazer quando `fromMe: true`

Em `whatsapp-webhook`, para todo evento com `fromMe: true` (só WAHA):

```
1. lookup na tabela wa_outgoing_messages pelo message_id
2. se ACHOU → é IA ou painel → apenas grava/atualiza a msg (já foi salva no envio, marcar como entregue), NÃO pausa IA
3. se NÃO ACHOU → foi pelo aparelho → 
     - grava a mensagem na conversa com sent_by: "human_phone"
     - marca whatsapp_ai_sessions como handed_off (pausa IA)
     - remove enrollment de follow-up automático
     - notifica handoff
```

Retry: se o webhook chegar antes do INSERT ser commitado (raro), a msg cai como "phone" e pausaria IA erradamente. Solução: aguardar 500ms e re-consultar antes de decidir pelo handoff.

### 5. Botão manual "Pausar IA" continua existindo

Independente do detector automático, o botão do painel em `/conversations` continua marcando `ai_active = false`.

---

## Arquivos alterados

**Backend / migrations:**
1. `supabase/functions/_wa_provider.ts` — parser respeitando sufixos; `sendWhatsAppText/Media` retornam `{ ok, messageId }`
2. `supabase/functions/_waha.ts` — helpers `wahaResolveLid()`, `wahaCheckExists()`, `wahaDownloadMediaBase64()`
3. `supabase/functions/whatsapp-webhook/index.ts` — lookup em `wa_outgoing_messages`; handoff automático se `fromMe` sem match
4. `supabase/functions/send-whatsapp-message/index.ts` — registrar id, usar `wa_chat_id`
5. `supabase/functions/send-whatsapp-media/index.ts` — idem
6. `supabase/functions/whatsapp-ai-agent/index.ts` — registrar id com `origin: 'ai'`
7. Demais funções de envio (reminders, followups, welcome) — registrar id
8. Migration: tabela `wa_outgoing_messages` + coluna `wa_chat_id` em `whatsapp_conversations` + cron de purga + limpeza das 2 conversas fantasma do 1053

**Sem mudança de UI.**

---

## Como validar depois de implementar

1. Contato manda msg nova → banco grava telefone real (13 dígitos) e `wa_chat_id`.
2. IA responde → id registrado em `wa_outgoing_messages`. Webhook `fromMe:true` chega, encontra match, IA continua ativa.
3. Você responde do painel → mesmo comportamento.
4. Você abre o WhatsApp no celular e digita uma resposta → webhook `fromMe:true` chega **sem match** → IA pausa automaticamente, aparece no painel como "atendente assumiu pelo aparelho".
5. Envio de mídia (imagem/áudio) recebida e enviada funcionando com `X-Api-Key`.

Aprove para eu implementar tudo em uma leva só.