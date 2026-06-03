# Plano: Fallback OpenAI (ChatGPT) para Gemini

## Objetivo
Adicionar OpenAI como **fallback automático** sempre que uma chamada ao Gemini falhar (timeout, 429, 5xx, JSON inválido, safety block). Sem mudar comportamento padrão — Gemini continua sendo o provider primário.

## Princípio central
Criar **uma única camada** (`_shared/ai-provider`) que todas as edge functions passam a usar. Nada de duplicar lógica de retry/fallback em cada função.

---

## Etapa 1 — Secret
- Adicionar secret `OPENAI_API_KEY` (via tool de secrets, usuário cola a chave).
- Opcional: `OPENAI_FALLBACK_MODEL` (default: `gpt-4o-mini` para texto, `gpt-4o` para vision).

## Etapa 2 — Camada compartilhada
Criar `supabase/functions/_shared/ai-provider/`:

- `gemini.ts` — wrapper atual do Gemini (texto, vision, JSON mode, tool calling).
- `openai.ts` — wrapper equivalente OpenAI (Chat Completions API, vision via `image_url` base64, JSON mode, function calling traduzido).
- `index.ts` — função `callAI({ task, messages, tools?, json?, image? })` que:
  1. Tenta Gemini (com retry exponencial já existente para 429).
  2. Se falhar após N tentativas OU classificar como "erro permanente" → chama OpenAI.
  3. Loga em `igreen_model_routing` (ou tabela equivalente) com `provider`, `fallback_reason`, `latency_ms`.
- `translate-tools.ts` — converte schemas de tools Gemini ↔ OpenAI (formato `function` vs `functionDeclarations`).

## Etapa 3 — Mapeamento de modelos
| Tarefa | Gemini (primário) | OpenAI (fallback) |
|---|---|---|
| Texto rápido / classificação | gemini-2.5-flash-lite | gpt-4o-mini |
| Texto balanceado | gemini-2.5-flash | gpt-4o-mini |
| Reasoning pesado | gemini-2.5-pro | gpt-4o |
| Vision (OCR fatura) | gemini-2.5-flash (vision) | gpt-4o (vision) |
| Tool calling (supervisor / agents) | gemini-2.5-flash | gpt-4o-mini |

## Etapa 4 — Critérios de fallback
Disparar OpenAI quando Gemini retornar:
- HTTP 429 após esgotar retries (3x backoff).
- HTTP 5xx.
- Timeout (>8s supervisor, >15s specialist, >30s vision).
- Resposta vazia / `finishReason: SAFETY` / JSON malformado em modo estruturado.
- Circuit breaker já existente (`provider-health/circuit-breaker.ts`) em estado `open` para o modelo Gemini.

Integrar com o `model-router/selector.ts` existente: adicionar OpenAI como próximo elo na `FALLBACK_CHAIN` quando todos os Gemini estiverem degradados.

## Etapa 5 — Funções a migrar (ordem)
Prioridade alta (caminho crítico iGreen):
1. `_igreen_v2/supervisor/decide.ts`
2. `_igreen_v2/agents/green/*` (run/stages)
3. `igreen-document-validator` (vision da fatura)
4. `whatsapp-ai-agent` (SaaS genérico)

Prioridade média:
5. `process-image-ocr`
6. `transcribe-audio` (já usa Groq — manter, não precisa fallback aqui)
7. `interview-ai-agent`, `prompt-generator-ai`, `test-ai-prompt`

Prioridade baixa:
8. Funções de geração de texto pontual (`support-ai-agent`, etc.)

Em cada função: trocar `fetch(generativelanguage.googleapis.com...)` por `callAI(...)`.

## Etapa 6 — Observabilidade
- Trace `ai_provider.fallback_triggered` com `{ from: "gemini-x", to: "openai-y", reason, attempts }`.
- Painel em `/admin/ai-costs`: contador de fallbacks por dia + custo OpenAI.
- Alerta no admin se taxa de fallback > 10% (sinal de Gemini degradado).

## Etapa 7 — Custos
Registrar uso OpenAI em `ai_usage` (já existente) com `provider: "openai"`. Reusar `logTextUsage` / `logImageUsage` adicionando campo provider.

## Etapa 8 — Testes
- Teste manual: setar `GOOGLE_GEMINI_API_KEY` inválido temporariamente em uma função → verificar fallback.
- Teste unitário Deno em `_shared/ai-provider/index_test.ts` mockando 429.
- Validar fluxo iGreen real com o número 5547989118695 após deploy.

## Detalhes técnicos
- **JSON mode OpenAI**: usar `response_format: { type: "json_object" }` (requer "json" no prompt).
- **Tool calling**: schema OpenAI usa `{ type: "function", function: { name, description, parameters } }`; Gemini usa `functionDeclarations`. O tradutor cuida disso.
- **Vision OpenAI**: enviar imagem como `{ type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }` (precisa do prefixo `data:` — oposto da Evolution API).
- **Streaming**: nenhuma função atual precisa, ignorar.
- **Não tocar** no Groq (Whisper) nem no ElevenLabs.

## Entregáveis
- 1 secret novo.
- 1 pasta `_shared/ai-provider/` com 4 arquivos.
- ~8 funções refatoradas (substituição de chamadas).
- 1 migração: coluna `provider` em `ai_usage` e `igreen_model_routing`.
- Painel admin com métrica de fallback.

Tempo estimado: 2 sessões. Posso começar pela Etapa 1+2 (camada + supervisor + igreen-document-validator) que já cobre 80% do risco atual.
