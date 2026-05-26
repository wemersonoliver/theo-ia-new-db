// Phase 5 — Memory summarizer.
// Comprime 8 mensagens antigas em ≤400 tokens. Usa Gemini Flash via REST.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { estimateTokens } from "../cost-governor/token-budget.ts";
import { maskAll } from "./pii-guard.ts";
import type { MemoryMessage } from "./short-term.ts";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

const MAX_SUMMARY_TOKENS = 400;

export async function summarize(messages: MemoryMessage[]): Promise<string> {
  if (messages.length === 0) return "";
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  const compact = messages.map((m) => `${m.role}: ${maskAll(m.content)}`).join("\n");
  if (!apiKey) {
    // Fallback: truncate
    return compact.slice(0, MAX_SUMMARY_TOKENS * 4);
  }
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: `Resuma a conversa abaixo em PT-BR com no máximo ${MAX_SUMMARY_TOKENS} tokens, preservando fatos relevantes (intenções, dados informados, decisões). Não invente dados.\n\n${compact}`,
            }],
          }],
          generationConfig: { maxOutputTokens: MAX_SUMMARY_TOKENS, temperature: 0.2 },
        }),
      },
    );
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text || compact.slice(0, MAX_SUMMARY_TOKENS * 4);
  } catch (e) {
    console.error("[summarizer] fallback truncate", e);
    return compact.slice(0, MAX_SUMMARY_TOKENS * 4);
  }
}

export async function persistSummary(args: {
  account_id: string;
  phone: string;
  summary: string;
  source_message_count: number;
  correlation_id?: string | null;
}) {
  try {
    await svc().from("igreen_memory_summaries").insert({
      account_id: args.account_id,
      phone: args.phone,
      summary: args.summary,
      token_count: estimateTokens(args.summary),
      source_message_count: args.source_message_count,
      correlation_id: args.correlation_id ?? null,
    });
  } catch (e) {
    console.error("[summarizer] persist failed", e);
  }
}

export async function getLatestSummary(account_id: string, phone: string): Promise<string | null> {
  try {
    const { data } = await svc()
      .from("igreen_memory_summaries")
      .select("summary")
      .eq("account_id", account_id)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { summary: string } | null)?.summary ?? null;
  } catch {
    return null;
  }
}