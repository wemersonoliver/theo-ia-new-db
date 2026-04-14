

## Plano: Integração ElevenLabs TTS no Suporte + Sistema de Creditos de IA

Este e um projeto grande com varias fases. Vamos iniciar pela Fase 1 (suporte) e deixar as fases seguintes preparadas.

---

### Fase 1 — ElevenLabs no Agente de Suporte (implementacao imediata)

**1. Adicionar secret `ELEVENLABS_API_KEY`**
- Solicitar a chave da ElevenLabs ao usuario

**2. Criar Edge Function `elevenlabs-tts`**
- Recebe `{ text, voiceId? }` e retorna audio MP3 via ElevenLabs API
- Usa modelo `eleven_multilingual_v2` (suporte em portugues)
- Voz padrao: uma voz masculina natural (Roger ou similar)

**3. Modificar `support-ai-agent/index.ts`**
- Apos gerar cada bloco de texto, chamar `elevenlabs-tts` para converter em audio
- Enviar o audio via Evolution API usando endpoint `/message/sendWhatsAppAudio/{instance}`
- Logica: enviar texto E audio apenas para mensagens curtas e importantes (saudacao, despedida, respostas-chave), ou apenas texto para mensagens informativas longas
- Adicionar flag na `system_ai_config` para ativar/desativar voz (`voice_enabled`, `voice_id`)

**4. Atualizar tabela `system_ai_config`**
- Migration: adicionar colunas `voice_enabled boolean default false`, `voice_id text default null`

**5. Atualizar painel admin - Config IA do Suporte**
- Adicionar toggle "Respostas por voz" e campo para selecionar voz
- Arquivo: pagina de config do sistema AI no admin

---

### Fase 2 — Tabela de Custos e Tracking (implementacao imediata)

**6. Criar tabela `ai_voice_usage`**
```sql
CREATE TABLE ai_voice_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,           -- null = sistema/suporte
  phone text NOT NULL,
  characters_count integer NOT NULL,
  cost_cents integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'support', -- 'support' | 'user_agent'
  created_at timestamptz DEFAULT now()
);
```
- RLS: super_admins leem tudo, users leem os proprios

**7. Registrar uso na edge function**
- Cada chamada TTS registra caracteres usados e custo estimado
- Custo ElevenLabs: ~$0.24/1000 chars no plano Creator

**8. Painel de Custos no Admin**
- Nova aba ou secao no admin dashboard mostrando:
  - Total de caracteres processados (dia/mes)
  - Custo estimado em USD e BRL
  - Breakdown por usuario vs suporte
  - Grafico de uso ao longo do tempo

---

### Fase 3 — Sistema de Creditos por Usuario (preparacao futura)

> Sera implementado depois de validar a Fase 1

- Tabela `ai_credits` com saldo por usuario
- Sistema de recarga (integracao Kiwify ou manual pelo admin)
- Flag por usuario no admin para habilitar/desabilitar voz
- Desconto de creditos por uso de TTS
- Painel do usuario mostrando saldo e historico

---

### Detalhes Tecnicos

**Fluxo do audio no WhatsApp:**
```text
support-ai-agent → texto gerado
  → POST elevenlabs-tts (texto → mp3 base64)
  → POST Evolution API /message/sendWhatsAppAudio/{instance}
  → Cliente recebe audio no WhatsApp
```

**Arquivos modificados:**
- `supabase/functions/elevenlabs-tts/index.ts` (novo)
- `supabase/functions/support-ai-agent/index.ts` (modificado)
- `supabase/config.toml` (nova funcao)
- Migration SQL (novas colunas + tabela)
- Pagina admin de config IA do suporte (modificada)
- Nova pagina/aba admin de custos de IA

**Pre-requisito:** Secret `ELEVENLABS_API_KEY` configurada pelo usuario.

