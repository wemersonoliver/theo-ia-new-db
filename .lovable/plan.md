

## Visualizar mídias (imagem, áudio, vídeo, documento) direto nas conversas

Hoje quando um cliente envia uma mídia pelo WhatsApp, o sistema baixa o arquivo apenas para transcrever (áudio) ou fazer OCR (imagem/documento), mas **não guarda o arquivo em lugar nenhum**. Por isso a interface só mostra o texto extraído — você tem que abrir o celular para ver o arquivo original.

A solução é salvar cada mídia recebida no **Supabase Storage** e gravar a URL pública na própria mensagem. Aí o frontend exibe imagem, player de áudio, player de vídeo ou link de download direto na bolha do chat.

---

### O que será feito

**1. Novo bucket de armazenamento `whatsapp-media` (público para leitura)**
   - Salva imagens, áudios, vídeos, stickers e documentos recebidos/enviados pelo WhatsApp.
   - Caminho organizado por usuário: `{user_id}/{phone}/{timestamp}_{id}.{ext}`.
   - Política RLS: leitura pública via URL (necessário para `<img>`, `<audio>`, `<video>` no navegador), escrita só pelo service role das edge functions.

**2. Atualização da edge function `whatsapp-webhook`**
   - Quando chegar imagem/áudio/vídeo/documento/sticker, baixa o base64 da Evolution API **uma única vez** e:
     - Faz upload para o bucket `whatsapp-media`.
     - Guarda no objeto da mensagem três campos novos: `media_url`, `media_mime` e `media_filename`.
   - Continua chamando OCR/transcrição em paralelo para alimentar o contexto da IA (sem afetar o que já funciona).
   - Adiciona suporte a **vídeo** (`videoMessage`), que hoje cai como `[Mídia]` genérica.

**3. Atualização da `ChatMessages` em `src/pages/Conversations.tsx`**
   - **Imagem/sticker**: renderiza `<img>` clicável que abre em tela cheia + legenda/OCR abaixo.
   - **Áudio**: player nativo `<audio controls>` + transcrição abaixo.
   - **Vídeo**: player nativo `<video controls>` + legenda.
   - **Documento**: ícone + nome do arquivo + botão "Baixar" que abre a URL.
   - Mantém a transcrição/OCR visível como texto auxiliar.

**4. Mesma melhoria no painel admin (`AdminConversations`) e no chat de suporte (`system_whatsapp_conversations`)**
   - Aplica a mesma renderização para que o time de suporte também veja as mídias dos tickets via WhatsApp.

**5. Backfill opcional (não automático)**
   - Mensagens antigas continuarão mostrando só o texto (`[Imagem] Conteúdo extraído: ...`) porque o arquivo original já não está mais disponível na Evolution API depois de alguns dias. **Apenas mensagens novas** terão mídia visível. Isso será informado na interface com um aviso discreto quando faltar `media_url`.

---

### Detalhes técnicos

- **Migration SQL**:
  - `insert into storage.buckets (id, name, public) values ('whatsapp-media', 'whatsapp-media', true);`
  - Policy `Service role manages whatsapp media` (INSERT/UPDATE/DELETE) e `Public read whatsapp media` (SELECT) na `storage.objects`.
- **Estrutura da mensagem (JSONB em `whatsapp_conversations.messages`)**:
  ```json
  {
    "id": "...", "timestamp": "...", "from_me": false,
    "type": "image", "content": "[Imagem] Conteúdo extraído: ...",
    "sent_by": "human",
    "media_url": "https://.../storage/v1/object/public/whatsapp-media/...",
    "media_mime": "image/jpeg",
    "media_filename": "foto.jpg"
  }
  ```
  Como o campo é JSONB, **não precisa alterar o schema da tabela** — só passar a popular os campos novos.
- **Upload na edge function**: usa `supabase.storage.from('whatsapp-media').uploadToSignedUrl` ou `upload(path, bytes, { contentType })` com `service_role`. Decodifica base64 com `atob` → `Uint8Array`.
- **Tipo TS `Message`** em `src/hooks/useConversations.ts` e `useSystemConversations.ts` ganha os 3 campos opcionais.
- **Sem custo extra de banda** porque a Evolution API já era chamada — só passamos a salvar o resultado em vez de descartar.

---

### Resultado final

Conversas mostram bolhas com imagem/vídeo/áudio/documento exatamente como no WhatsApp Web, mantendo embaixo a transcrição/OCR para a IA continuar entendendo o conteúdo. Você não precisa mais abrir o celular para ver o que o cliente mandou.

