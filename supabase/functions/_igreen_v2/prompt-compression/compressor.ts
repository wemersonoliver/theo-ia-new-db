import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { trace } from "../observability/trace.ts";
import { dedupConsecutive, type Msg } from "./redundancy.ts";
import { collapseToolOutput } from "./section-collapser.ts";

const supa = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
export const approxTokens = (s: string) => Math.ceil(s.length / 4);

export interface CompressionInput {
  correlation_id: string; account_id: string;
  guardrails: string; conversation: Msg[];
  tool_outputs?: string[]; rag_chunks?: string[];
}
export interface CompressionOutput {
  guardrails: string; conversation: Msg[]; tool_outputs: string[]; rag_chunks: string[];
  tokens_in: number; tokens_out: number; ratio: number; sections_collapsed: string[];
}

export async function compressPrompt(input: CompressionInput): Promise<CompressionOutput> {
  const sections_collapsed: string[] = [];
  const tokens_in = approxTokens(input.guardrails)
    + input.conversation.reduce((a, m) => a + approxTokens(m.content), 0)
    + (input.tool_outputs ?? []).reduce((a, t) => a + approxTokens(t), 0)
    + (input.rag_chunks ?? []).reduce((a, t) => a + approxTokens(t), 0);

  let conv = input.conversation;
  if (conv.length > 2) {
    const tail = conv.slice(-2);
    const head = conv.slice(0, -2);
    const { msgs: dedup, removed } = dedupConsecutive(head);
    const shrunkHead = dedup.map(m => {
      if (m.content.length > 400) {
        sections_collapsed.push("conversation_long_msg");
        return { ...m, content: m.content.slice(0, 200) + "…[resumido]" };
      }
      return m;
    });
    if (removed > 0) sections_collapsed.push(`conversation_dedup(${removed})`);
    conv = [...shrunkHead, ...tail];
  }

  const tools = (input.tool_outputs ?? []).map((t, i) => {
    const { text, collapsed } = collapseToolOutput(t, 600);
    if (collapsed) sections_collapsed.push(`tool_output_${i}`);
    return text;
  });

  let rag = input.rag_chunks ?? [];
  if (rag.length > 3) { sections_collapsed.push(`rag_truncated(${rag.length - 3})`); rag = rag.slice(0, 3); }
  rag = rag.map((c, i) => {
    if (c.length > 400) { sections_collapsed.push(`rag_chunk_${i}_shrunk`); return c.slice(0, 400) + "…"; }
    return c;
  });

  const tokens_out = approxTokens(input.guardrails)
    + conv.reduce((a, m) => a + approxTokens(m.content), 0)
    + tools.reduce((a, t) => a + approxTokens(t), 0)
    + rag.reduce((a, t) => a + approxTokens(t), 0);
  const ratio = tokens_in > 0 ? tokens_out / tokens_in : 1;

  try {
    await supa().from("igreen_prompt_compression").insert({
      correlation_id: input.correlation_id, account_id: input.account_id,
      tokens_in, tokens_out, ratio, sections_collapsed,
    });
  } catch (e) { console.error("[prompt-compression] persist failed", e); }

  await trace({
    account_id: input.account_id, step: "prompt.compressed", level: "standard",
    payload: { tokens_in, tokens_out, ratio, sections_collapsed },
    correlation_id: input.correlation_id,
  });

  return { guardrails: input.guardrails, conversation: conv, tool_outputs: tools, rag_chunks: rag, tokens_in, tokens_out, ratio, sections_collapsed };
}
