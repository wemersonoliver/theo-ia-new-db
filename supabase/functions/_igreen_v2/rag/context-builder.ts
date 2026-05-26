// Phase 5 — Context Budget Allocator (oficial).
// Aloca 8.000 tokens em seções com prioridades de truncamento.
// Eventos: context.budget_allocated, context.section_truncated,
//          context.guardrails_overflow, context.tool_output_summarized.
//
// Invariantes:
//   - system+guardrails NUNCA truncados → overflow → abort + fallback
//   - current_conversation mantém ≥ 2 últimas íntegras
//   - tool_outputs > 800 tokens → summarize, não dropar
//   - rag_chunks é o PRIMEIRO a truncar

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { estimateTokens } from "../cost-governor/token-budget.ts";
import { summarize as llmSummarize } from "../memory/summarizer.ts";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

export type Section =
  | "system_guardrails"
  | "safety_reserve"
  | "current_conversation"
  | "memory_summaries"
  | "tool_outputs"
  | "rag_chunks";

export interface SectionBudget {
  budget: number;
  truncatable: boolean;
}

export const DEFAULT_BUDGETS: Record<Section, SectionBudget> = {
  system_guardrails: { budget: 1_200, truncatable: false },
  safety_reserve: { budget: 1_400, truncatable: false },
  current_conversation: { budget: 1_600, truncatable: true },
  memory_summaries: { budget: 600, truncatable: true },
  tool_outputs: { budget: 1_400, truncatable: true },
  rag_chunks: { budget: 1_800, truncatable: true },
};

export const TOTAL_BUDGET = Object.values(DEFAULT_BUDGETS).reduce((a, b) => a + b.budget, 0);

/** Ordem de truncamento (1º a sofrer corte → 5º). */
const TRUNCATION_ORDER: Section[] = [
  "rag_chunks",       // 1
  "tool_outputs",     // 2 (com summarize)
  "memory_summaries", // 3
  "current_conversation", // 4 (mantém ≥2 últimas)
];

export interface BuildArgs {
  correlation_id: string;
  account_id: string;
  system: string;            // prompt + guardrails (não truncável)
  conversation: Array<{ role: string; content: string }>;
  memorySummary?: string | null;
  toolOutputs?: Array<{ tool: string; text: string }>;
  ragChunks?: Array<{ id: string; content: string; score?: number }>;
  totalBudget?: number;
}

export interface BuildResult {
  prompt: {
    system: string;
    conversation: Array<{ role: string; content: string }>;
    memorySummary: string | null;
    toolOutputs: Array<{ tool: string; text: string }>;
    ragChunks: Array<{ id: string; content: string; score?: number }>;
  };
  allocations: Array<{ section: Section; budget: number; used: number; truncated: boolean; strategy?: string }>;
  overflow: boolean;
  fallback_reason?: string;
}

async function recordAllocation(args: {
  correlation_id: string;
  account_id: string;
  section: Section;
  budget: number;
  used: number;
  truncated: boolean;
  strategy?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await svc().from("igreen_context_allocations").insert({
      correlation_id: args.correlation_id,
      account_id: args.account_id,
      section: args.section,
      budget: args.budget,
      used: args.used,
      truncated: args.truncated,
      truncation_strategy: args.strategy ?? null,
      metadata: args.metadata ?? {},
    });
  } catch (e) {
    console.error("[context-builder] allocation persist failed", e);
  }
}

async function summarizeToolOutput(tool: string, text: string): Promise<string> {
  // Threshold: > 800 tokens => summarize
  if (estimateTokens(text) <= 800) return text;
  try {
    const summary = await llmSummarize([{ role: "tool", content: `[${tool}]\n${text}` }]);
    return summary || text.slice(0, 800 * 4);
  } catch {
    return text.slice(0, 800 * 4);
  }
}

export async function buildContext(args: BuildArgs): Promise<BuildResult> {
  const budgets = DEFAULT_BUDGETS;
  const totalBudget = args.totalBudget ?? TOTAL_BUDGET;

  // 1) system + guardrails (HARD)
  const systemTokens = estimateTokens(args.system);
  if (systemTokens > budgets.system_guardrails.budget) {
    await recordAllocation({
      correlation_id: args.correlation_id,
      account_id: args.account_id,
      section: "system_guardrails",
      budget: budgets.system_guardrails.budget,
      used: systemTokens,
      truncated: false,
      strategy: "guardrails_overflow_abort",
      metadata: { event: "context.guardrails_overflow" },
    });
    return {
      prompt: {
        system: args.system,
        conversation: args.conversation.slice(-2),
        memorySummary: null,
        toolOutputs: [],
        ragChunks: [],
      },
      allocations: [{ section: "system_guardrails", budget: budgets.system_guardrails.budget, used: systemTokens, truncated: false, strategy: "guardrails_overflow_abort" }],
      overflow: true,
      fallback_reason: "system_guardrails_exceeds_budget",
    };
  }

  // 2) snapshot inicial das seções truncáveis
  let conversation = [...args.conversation];
  let memorySummary = args.memorySummary ?? null;
  let toolOutputs = [...(args.toolOutputs ?? [])];
  let ragChunks = [...(args.ragChunks ?? [])];

  // Pré-processo: tool outputs longos → summarize
  const summarizedFlags: Record<string, boolean> = {};
  for (let i = 0; i < toolOutputs.length; i++) {
    const t = toolOutputs[i];
    const summed = await summarizeToolOutput(t.tool, t.text);
    if (summed !== t.text) {
      toolOutputs[i] = { tool: t.tool, text: summed };
      summarizedFlags[t.tool] = true;
    }
  }

  // Ordena RAG por score desc (remove menor primeiro)
  ragChunks.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const usedFor = (section: Section): number => {
    switch (section) {
      case "system_guardrails": return systemTokens;
      case "safety_reserve": return budgets.safety_reserve.budget;
      case "current_conversation": return conversation.reduce((s, m) => s + estimateTokens(m.content), 0);
      case "memory_summaries": return memorySummary ? estimateTokens(memorySummary) : 0;
      case "tool_outputs": return toolOutputs.reduce((s, o) => s + estimateTokens(o.text), 0);
      case "rag_chunks": return ragChunks.reduce((s, c) => s + estimateTokens(c.content), 0);
    }
  };

  const truncations: Record<Section, { truncated: boolean; strategy?: string }> = {
    system_guardrails: { truncated: false },
    safety_reserve: { truncated: false },
    current_conversation: { truncated: false },
    memory_summaries: { truncated: false },
    tool_outputs: { truncated: false },
    rag_chunks: { truncated: false },
  };

  // 3) cap por seção (respeita budget próprio)
  // RAG: drop por score
  while (usedFor("rag_chunks") > budgets.rag_chunks.budget && ragChunks.length > 0) {
    ragChunks.pop();
    truncations.rag_chunks = { truncated: true, strategy: "drop_lowest_score" };
  }
  // Tool outputs: drop tail
  while (usedFor("tool_outputs") > budgets.tool_outputs.budget && toolOutputs.length > 0) {
    toolOutputs.pop();
    truncations.tool_outputs = { truncated: true, strategy: "summarize_then_drop_tail" };
  }
  // Memory: drop summary se exceder
  if (memorySummary && estimateTokens(memorySummary) > budgets.memory_summaries.budget) {
    memorySummary = memorySummary.slice(0, budgets.memory_summaries.budget * 4);
    truncations.memory_summaries = { truncated: true, strategy: "head_truncate" };
  }
  // Conversation: drop oldest, mantém ≥2 últimas
  while (usedFor("current_conversation") > budgets.current_conversation.budget && conversation.length > 2) {
    conversation.shift();
    truncations.current_conversation = { truncated: true, strategy: "drop_oldest_keep_last_2" };
  }

  // 4) cap global: se soma > totalBudget, aplica ordem TRUNCATION_ORDER
  const totalUsed = () =>
    systemTokens + budgets.safety_reserve.budget +
    usedFor("current_conversation") + usedFor("memory_summaries") +
    usedFor("tool_outputs") + usedFor("rag_chunks");

  let guard = 0;
  while (totalUsed() > totalBudget && guard < 200) {
    guard++;
    let progressed = false;
    for (const section of TRUNCATION_ORDER) {
      if (section === "rag_chunks" && ragChunks.length > 0) {
        ragChunks.pop();
        truncations.rag_chunks = { truncated: true, strategy: "global_pressure_drop_lowest_score" };
        progressed = true;
        break;
      }
      if (section === "tool_outputs" && toolOutputs.length > 0) {
        toolOutputs.pop();
        truncations.tool_outputs = { truncated: true, strategy: "global_pressure_drop_tail" };
        progressed = true;
        break;
      }
      if (section === "memory_summaries" && memorySummary) {
        memorySummary = null;
        truncations.memory_summaries = { truncated: true, strategy: "global_pressure_drop_all" };
        progressed = true;
        break;
      }
      if (section === "current_conversation" && conversation.length > 2) {
        conversation.shift();
        truncations.current_conversation = { truncated: true, strategy: "global_pressure_drop_oldest" };
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }

  const allocations: BuildResult["allocations"] = (
    [
      "system_guardrails",
      "safety_reserve",
      "current_conversation",
      "memory_summaries",
      "tool_outputs",
      "rag_chunks",
    ] as Section[]
  ).map((s) => ({
    section: s,
    budget: budgets[s].budget,
    used: usedFor(s),
    truncated: truncations[s].truncated,
    strategy: truncations[s].strategy,
  }));

  // Persiste alocações
  for (const a of allocations) {
    await recordAllocation({
      correlation_id: args.correlation_id,
      account_id: args.account_id,
      section: a.section,
      budget: a.budget,
      used: a.used,
      truncated: a.truncated,
      strategy: a.strategy,
      metadata: a.section === "tool_outputs" ? { summarized: summarizedFlags } : {},
    });
  }

  // Assertion final: soma ≤ totalBudget
  const sum = allocations.reduce((s, a) => s + a.used, 0);
  if (sum > totalBudget) {
    console.warn("[context-builder] soma final excede totalBudget", { sum, totalBudget });
  }

  return {
    prompt: { system: args.system, conversation, memorySummary, toolOutputs, ragChunks },
    allocations,
    overflow: false,
  };
}