# Igreen V2 — módulo compartilhado

Módulo isolado, usado **apenas** pela vertical Igreen (`accounts.is_igreen = true`).
Não pode ser importado pelo `whatsapp-ai-agent` genérico.

## Diretrizes operacionais permanentes (15)

1. LLM nunca controla fluxo.
2. Regras críticas estão em código, não em prompt.
3. Prompts são pequenos e modulares.
4. Toda tool é idempotente (tool-execution-guard).
5. Observabilidade obrigatória (traces + events com priority/level).
6. Evitar overengineering.
7. Implementar por camadas (fases sequenciais).
8. Fast Path é prioridade.
9. State é a fonte da verdade (`igreen_conversation_state`).
10. Failsafe é obrigatório.
11. RAG é controlado (top-K + token-budget).
12. Primeiro funcionar, depois sofisticar.
13. SaaS genérico é sagrado (roteamento estrito por `is_igreen`).
14. **Nenhuma tool altera estado diretamente — único writer = `state-engine/update.ts`.**
15. **Toda automação é idempotente — passa por `automations/_idempotency.ts`.**

## Estrutura (cresce por fase)

- `state-engine/update.ts` — ÚNICO writer de `igreen_conversation_state` (D14)
- `automations/_idempotency.ts` — helper de idempotência (D15)
- `observability/trace.ts` — emissão de traces e events
- `routing/is-igreen.ts` — checagem de roteamento por conta

Próximas fases adicionarão: `supervisor/`, `fast-path/`, `agents/`, `tool-router/`,
`tool-execution-guard/`, `token-budget/`, `rag/`, `document-rules-engine/`,
`vision-provider/`, `lead-scoring/`, `humanization/`, `guardrails/`,
`timeout-engine/`, `failsafe/`, `flows/`.