---
name: Context Budget Allocator
description: Phase 5 v2 — 8000 token cap split per-section with explicit truncation order. Guardrails never truncated, RAG first to cut.
type: feature
---
Phase 5 v2 oficial. Total 8000 tokens, divididos em 6 seções:

- system_guardrails : 1200 (HARD — overflow ⇒ abort + fallback determinístico)
- safety_reserve   : 1400 (HARD)
- current_conversation : 1600 (mín. 2 últimas mensagens preservadas)
- memory_summaries : 600  (head_truncate)
- tool_outputs     : 1400 (summarize via Lovable AI quando >800 tokens, NUNCA dropar antes de tentar resumir)
- rag_chunks       : 1800 (primeiro a truncar; drop_lowest_score por score desc)

Ordem de truncamento sob pressão global:
  1) rag_chunks  2) tool_outputs  3) memory_summaries  4) current_conversation (preserva ≥2)

Persistência: tabela `igreen_context_allocations` (uma linha por seção, por correlation_id). Eventos: context.budget_allocated, context.section_truncated, context.guardrails_overflow, context.tool_output_summarized.

Implementação: `supabase/functions/_igreen_v2/rag/context-builder.ts`.
Integrado em `whatsapp-igreen-agent-v2` após retrieval do RAG + memory window/summary.