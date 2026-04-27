## Objetivo

Adicionar na tela `/conversations` (desktop e mobile) um botão de anexar arquivos ao lado do input de mensagem, igual ao WhatsApp Web — permitindo enviar **imagens, vídeos, documentos e áudios** para o lead, além do texto que já existe.

## Como vai funcionar (visão do usuário)

Ao lado do campo de digitar mensagem aparece um ícone de clipe (📎). Ao clicar:

- Menu com 3 opções: **Foto/Vídeo**, **Documento**, **Áudio**.
- Após selecionar o arquivo, abre um pré-visualizador (preview da imagem/vídeo, ícone do documento ou player de áudio) com:
  - Campo de **legenda** opcional (para imagem/vídeo/documento).
  - Botões **Cancelar** e **Enviar**.
- Ao confirmar: arquivo é enviado ao WhatsApp do lead, aparece imediatamente no chat (com o mesmo `MediaBubble` já usado para mídias recebidas) e fica salvo na conversa.

Limites: **16 MB por arquivo** (limite prático da Evolution API). Tipos aceitos:
- Imagem: jpg, png, webp, gif
- Vídeo: mp4, 3gp, mov
- Áudio: ogg, mp3, m4a, wav (enviado como nota de voz quando ogg/opus)
- Documento: pdf, doc/docx, xls/xlsx, txt, csv, zip

## Mudanças técnicas

### 1. Storage
Reusar o bucket público existente `whatsapp-media`. Pasta: `{accountId|userId}/{phone}/outgoing/{timestamp}_{nome}.{ext}`.

### 2. Nova edge function `send-whatsapp-media`
Arquivo: `supabase/functions/send-whatsapp-media/index.ts` (com `verify_jwt = false` + validação manual via `auth.getUser`, mesmo padrão do `send-whatsapp-message`).

Recebe `{ phone, mediaUrl, mediaType: "image"|"video"|"audio"|"document", filename?, caption?, mimetype?, system? }` e:

1. Resolve `account_id` + instância conectada (mesma lógica do `send-whatsapp-message`).
2. Chama Evolution API:
   - `POST /message/sendMedia/{instance}` com `{ number, mediatype, mimetype, caption, media: <url>, fileName }` para imagem/vídeo/documento.
   - `POST /message/sendWhatsAppAudio/{instance}` com `{ number, audio: <url> }` para áudio (envia como voice note).
   - Faz fallback do 9º dígito (mesmo helper `getBrazilianPhoneVariant` já usado).
3. Acrescenta a mensagem em `whatsapp_conversations.messages` (ou `system_whatsapp_conversations`) com:
   ```
   { id, timestamp, from_me: true, type: "image"|"video"|"audio"|"document",
     content: caption || "", media_url, media_mime, media_filename,
     sent_by: "human", attendant_name, attendant_user_id }
   ```
4. Marca sessão de IA como `handed_off` (igual o `send-whatsapp-message`).

### 3. Hook `useConversations` / `useSystemConversations`
Adicionar mutation `sendMedia` que:
1. Faz `supabase.storage.from("whatsapp-media").upload(...)` do `File` selecionado.
2. Pega a `publicUrl`.
3. Chama `supabase.functions.invoke("send-whatsapp-media", { body: { phone, mediaUrl, mediaType, filename, caption, mimetype, system? } })`.
4. Invalida queries de conversa.

### 4. Novo componente `MediaAttachButton`
Arquivo: `src/components/MediaAttachButton.tsx`.

- Botão com ícone `Paperclip` + `DropdownMenu` (Foto/Vídeo, Documento, Áudio).
- `<input type="file" hidden>` com `accept` filtrado por tipo escolhido.
- Ao escolher arquivo, abre `Dialog` de preview com:
  - Preview da mídia (img/video/audio/ícone).
  - `Textarea` de legenda (oculto p/ áudio).
  - Validação de tamanho (≤16 MB) e tipo.
  - Botão **Enviar** chama `sendMedia.mutateAsync(...)` e fecha.

Aceita props `{ phone, system?, disabled? }` para reuso em conversas do usuário e do sistema (admin support).

### 5. Integração na UI
Em `src/pages/Conversations.tsx` (desktop **e** mobile), inserir `<MediaAttachButton phone={selectedPhone} />` à esquerda do `Input` em ambos os blocos (linhas ~432 mobile e ~644 desktop). Mesma adição em `src/pages/admin/AdminConversations.tsx` e `src/components/admin/AdminSystemFollowupTab.tsx` se também tiverem input de envio (verificar e replicar passando `system: true`).

### 6. Renderização
`MediaBubble` já trata `image/audio/video/document` quando há `media_url` — não precisa mexer.

## Pontos abertos

- **Áudio gravado pelo navegador** (ícone de microfone): hoje `AudioRecordButton` só transcreve. Mantemos o comportamento atual; o novo botão de anexos cobre upload de áudio existente. Posso unificar depois se você quiser.
- Sem compressão de mídia client-side (Evolution aceita até ~16 MB; arquivos maiores são bloqueados com mensagem amigável).

## Arquivos afetados

- **Novos**: `supabase/functions/send-whatsapp-media/index.ts`, `src/components/MediaAttachButton.tsx`
- **Editados**: `src/hooks/useConversations.ts`, `src/hooks/useSystemConversations.ts`, `src/pages/Conversations.tsx`, possivelmente `src/components/admin/AdminSystemFollowupTab.tsx` / `src/pages/admin/AdminConversations.tsx`, `supabase/config.toml` (registrar nova função com `verify_jwt = false`)
