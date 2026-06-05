## Objetivo

Quando a IA do André (`andre.fonseca.silva@gmail.com`) finalizar a **ETAPA 7 — OUTRA CIDADE** (cliente fora de Gravataí/Viamão que aceitou o curso EAD e enviou o nome), a IA deve disparar automaticamente o card promocional do Instituto Educando (imagem anexada) para o cliente via WhatsApp — substituindo o placeholder `🖼️ [midia]` que já existe no prompt dele.

## Passos

### 1. Hospedar a imagem
- Upload da imagem anexada para o bucket público `whatsapp-media` em `andre-fonseca/curso-ead-instituto-educando.jpg`.
- Resultado: URL pública fixa (`https://gljsifkjwkubxaqgxxul.supabase.co/storage/v1/object/public/whatsapp-media/andre-fonseca/curso-ead-instituto-educando.jpg`).

### 2. Nova tool no agente de IA: `send_promotional_image`
Em `supabase/functions/whatsapp-ai-agent/index.ts`:
- Adicionar declaração de tool `send_promotional_image` com 1 parâmetro: `caption` (texto curto opcional para acompanhar a imagem).
- A tool fica **restrita** ao `user_id` do André (`c753d23b-7f23-4d56-a867-6639897b6767`). Se outro user_id chamar, retorna `{ success: false, error: "not_allowed" }` sem enviar nada (segurança e isolamento multi-tenant).
- Execução: chama o endpoint Evolution `sendMedia` da instância do usuário enviando a URL pública da imagem (mesmo padrão já usado em `send-whatsapp-media`/`send-discovery-video`).
- Após envio, retorna `instruction` orientando a IA a NÃO escrever mais nada e encerrar o turno (mesmo padrão do `sendDiscoveryVideo`), evitando duplicar mensagem.

### 3. Atualizar o prompt do André (`whatsapp_ai_config.custom_prompt`)
- Trocar o trecho da ETAPA 7 onde aparece `🖼️ [midia]` por instrução explícita:
  > "Depois de receber o nome completo, **chame OBRIGATORIAMENTE a tool `send_promotional_image`** com uma `caption` curta (ex.: "Segue o passo a passo para acessar seu curso EAD 👊🎁"). Após a tool, não envie outra mensagem — o card já contém todas as instruções (site, cupom, polo)."

### 4. Validação
- Deploy da edge function `whatsapp-ai-agent`.
- Teste manual simulando cliente "de outra cidade" no número de teste do André até a ETAPA 7 e confirmar:
  - Imagem chega no WhatsApp do cliente.
  - Nenhum outro usuário do sistema consegue acionar a tool (retorno `not_allowed` nos logs).

## Detalhes técnicos

- **Bucket**: reutilizar `whatsapp-media` (já público) — sem necessidade de migração ou nova policy.
- **Gating por usuário**: feito em código dentro do `executeFunction`/branch da tool, comparando `userId` recebido no contexto da chamada com o UUID do André. Mantemos a tool declarada globalmente (Gemini precisa do schema) mas inerte para os demais — abordagem mais simples que prompts dinâmicos por usuário.
- **Caption**: imagem enviada via `sendMedia` com `mediatype: "image"` e `caption` opcional. Sem prefixo de atendente (mensagem da IA, não humana).
- **Idempotência**: registramos no log de mensagens da conversa (`whatsapp_conversations.messages`) com `sent_by: "ai"` e `type: "image"`, igual ao fluxo do vídeo de descoberta Igreen.
- **Sem migration de banco** — toda a mudança é em edge function + 1 update no `whatsapp_ai_config` do André + upload do arquivo no Storage.

## Arquivos afetados
- `supabase/functions/whatsapp-ai-agent/index.ts` (nova tool + executor)
- Storage: `whatsapp-media/andre-fonseca/curso-ead-instituto-educando.jpg` (novo)
- Tabela `whatsapp_ai_config` (UPDATE no `custom_prompt` do André)
