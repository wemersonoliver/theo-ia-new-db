## Passo 1 — Fallback Gemini ↔ OpenAI no Agente Green + WhatsApp genérico

### Objetivo
Estender o fallback já criado (`_shared/ai-fallback/`) para os agentes principais de texto, e adicionar **erro de créditos (402)** como gatilho de troca de provedor (bidirecional: Gemini → OpenAI e OpenAI → Gemini).

---

### 1. Ampliar gatilhos de fallback no `_shared/ai-fallback/index.ts`
Hoje o wrapper troca apenas em: 429, 5xx, timeout, resposta vazia, SAFETY, JSON inválido.

Adicionar:
- **402 Payment Required / "insufficient_quota" / "credits"** → marca provedor atual como "sem crédito" por 5 min (circuit breaker em memória) e usa o outro.
- **Bidirecional**: se OpenAI também retornar 402/429, tenta voltar para Gemini imediatamente (em vez de falhar).
- Log estruturado: `ai_provider.switched` com `{ from, to, reason: "credits_exhausted" | "rate_limit" | ... }`.

### 2. Agente Green (`_igreen_v2/agents/green/run.ts`)
Hoje chama Gemini diretamente em `run.ts` (geração de resposta + tool calling).
- Envolver chamada Gemini com `callWithFallback()` do `_shared/ai-fallback`.
- Mapear tools do formato Gemini (`functionDeclarations`) para formato OpenAI (`tools: [{type:"function", function:{...}}]`) dentro do wrapper OpenAI.
- Preservar histórico de conversa e system prompt.
- Quando fallback for acionado, registrar `source: "openai_fallback"` em `ai_usage` e no log da conversa.

### 3. WhatsApp AI genérico (`whatsapp-ai-agent`)
Mesmo padrão do Green:
- Substituir chamada direta Gemini pelo `callWithFallback()`.
- Manter chunking de 220 chars e lógica de áudio inalterados.
- Preservar function calling (check_available_slots, create_appointment, etc.) traduzindo schema para OpenAI quando necessário.

### 4. Tradução de tool/function schemas
Criar helper `_shared/ai-fallback/tool-adapter.ts`:
- `geminiToOpenAI(functionDeclarations)` → `tools[]` OpenAI.
- `openAIToGemini(tools)` → `functionDeclarations` Gemini.
- Normalizar resposta: ambas retornam `{ text, toolCalls: [{name, args}] }`.

### 5. Registro de uso e custo
- Em `ai_usage`, adicionar coluna `provider` (`gemini` | `openai`) via migration se ainda não existir.
- Gravar tokens/modelo correto conforme provedor usado.

### 6. Observabilidade
- Endpoint admin `/admin/ai-fallback-stats` (já planejado) recebe contadores: total chamadas, fallbacks acionados, motivo, por agente.
- Por ora apenas logs estruturados; UI fica para passo posterior.

### 7. Testes manuais
- Forçar 402 simulado no Gemini (header override) → confirmar Green responde via OpenAI.
- Forçar 402 no OpenAI → confirmar volta para Gemini.
- Testar tool calling (agendamento) funcionando em ambos provedores.

---

### Arquivos a alterar
- `supabase/functions/_shared/ai-fallback/index.ts` — adicionar 402 + circuit breaker bidirecional
- `supabase/functions/_shared/ai-fallback/tool-adapter.ts` — **novo**
- `supabase/functions/_shared/ai-fallback/openai.ts` — suporte a tools
- `supabase/functions/_igreen_v2/agents/green/run.ts` — usar wrapper
- `supabase/functions/whatsapp-ai-agent/index.ts` — usar wrapper
- Migration: `ai_usage.provider` (se faltar)

### Fora do escopo deste passo
- UI admin de estatísticas de fallback
- Migração de OCR de imagem, transcrição de áudio, geração de prompts/entrevistas (passo 2)
- ElevenLabs e Groq (mantêm-se como estão)
