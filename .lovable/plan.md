## Problema

Na conversa com `5569992264209`, o cliente mandou áudio dizendo "conversa comigo por um vídeo, como eu estou falando com vocês". A IA respondeu que "é só consultor de energia" e seguiu pedindo valor da fatura, ignorando o pedido de canal diferente.

A regra correta: **sempre que o cliente pedir áudio, vídeo ou ligação, a IA deve avisar que vai chamar um atendente humano e disparar o handoff** — não improvisar.

## Mudanças

### 1. Detecção de pedido de canal humano (`agents/green/stages.ts`)

Criar nova heurística `isVoiceVideoCallRequest(msg)` que casa frases como:
- "manda áudio", "me responde por áudio", "responde em áudio"
- "vídeo", "videochamada", "chamada de vídeo", "video call"
- "me liga", "ligação", "pode ligar", "ligar pra mim", "atende no telefone"
- "chamar no whatsapp" / "chamada de voz"

Importante: NÃO casar quando o cliente fala "vou te mandar um áudio" ou descreve o próprio envio — só quando ele PEDE para a IA usar áudio/vídeo/ligação.

### 2. Roteamento prioritário para handoff (`agents/green/stages.ts`)

Em `decideStage`, adicionar regra antes de qualquer outra (prioridade -2, acima do `handoff_human` por palavra-chave):

```text
se isVoiceVideoCallRequest(message) && !extras.handoff_done:
    retorna "handoff_voice_video"
```

Criar o novo stage `handoff_voice_video` no union de `GreenStage`.

### 3. Resposta determinística + handoff (`agents/green/run.ts`)

Adicionar bloco para `stage === "handoff_voice_video"`:
- Detecta no texto qual canal o cliente pediu (áudio / vídeo / ligação) para personalizar a mensagem.
- Envia 2 mensagens curtas:
  1. "Entendi! Eu sou uma assistente virtual e só consigo te atender por mensagens de texto aqui no WhatsApp. 🤖"
  2. "Mas sem problema — já estou chamando um(a) atendente humano(a) da equipe pra continuar com você por [áudio/vídeo/ligação], tudo bem? Em instantes alguém te responde. 🙌"
- Dispara `request_human_handoff` com `reason: "voice_video_call_requested"` e `add_contact_tag` com `tag: "pediu_canal_humano"`.
- Marca `extras.handoff_done = true` e `patch.handoff_ativo = true` (mesmo padrão do `handoff_human`).

### 4. Prompt (`agents/green/prompt.ts`)

- Adicionar `case "handoff_voice_video": return "";` (texto determinístico).
- Reforçar no system prompt uma regra: "Se o cliente pedir áudio, vídeo ou ligação, NUNCA tente convencer a seguir por texto — o stage handoff_voice_video assume e transfere para humano."

### 5. Limpeza da conversa atual

Executar SQL para esta lead específica:
- `request_human_handoff` manual: setar `igreen_conversation_state.handoff_ativo = true` e `etapa_funil = 'handoff'` para a conversa `5569992264209` da conta `3f304fb6-...`, evitando que a IA continue respondendo enquanto o atendente entra.
- Adicionar tag `pediu_canal_humano` ao contato.

## Detalhes técnicos

Arquivos tocados:
- `supabase/functions/_igreen_v2/agents/green/stages.ts` — nova função `isVoiceVideoCallRequest` + branch em `decideStage` + novo stage no union.
- `supabase/functions/_igreen_v2/agents/green/run.ts` — bloco `handoff_voice_video` espelhando o `handoff_human` mas com mensagem ao cliente.
- `supabase/functions/_igreen_v2/agents/green/prompt.ts` — case para silenciar a LLM nesse stage + regra no prompt base.
- SQL pontual de cleanup na lead atual.

Sem mudanças em outras contas: a regra vive dentro do specialist Green (iGreen V2), que é o pipeline usado pelo `marcioevandrocosta@hotmail.com` e demais contas iGreen.
