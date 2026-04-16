import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function firstName(full?: string | null): string {
  if (!full) return "tudo bem";
  return full.trim().split(/\s+/)[0] || full;
}

function applyVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

async function sendSystemMessage(phone: string, message: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ phone, message, system: true }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`send-whatsapp-message ${res.status}: ${text}`);
  return text;
}

async function processOne(
  supabase: ReturnType<typeof createClient>,
  item: any,
  cfg: any,
) {
  const phone: string = item.phone;
  const fullName: string | null = item.full_name;
  const delaySec: number = cfg?.welcome_message_delay_seconds ?? 4;
  const messages: string[] = Array.isArray(cfg?.welcome_messages) ? cfg.welcome_messages : [];

  if (messages.length === 0) {
    await supabase
      .from("system_welcome_queue")
      .update({ processed: true, processed_at: new Date().toISOString(), skipped_reason: "no_messages" })
      .eq("id", item.id);
    return;
  }

  // Anti-duplicidade: já existe conversa com mensagens?
  const { data: existing } = await supabase
    .from("system_whatsapp_conversations")
    .select("id, total_messages")
    .eq("phone", phone)
    .maybeSingle();

  if (existing && (existing.total_messages ?? 0) > 0) {
    await supabase
      .from("system_welcome_queue")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        skipped_reason: "existing_conversation",
      })
      .eq("id", item.id);
    return;
  }

  const vars = { primeiro_nome: firstName(fullName), nome: firstName(fullName) };

  for (let i = 0; i < messages.length; i++) {
    const text = applyVars(messages[i], vars);
    try {
      await sendSystemMessage(phone, text);
    } catch (e) {
      console.error("welcome send err", item.id, e);
      await supabase
        .from("system_welcome_queue")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          error_message: String((e as Error).message || e),
        })
        .eq("id", item.id);
      return;
    }
    if (i < messages.length - 1) {
      await new Promise((r) => setTimeout(r, delaySec * 1000));
    }
  }

  await supabase
    .from("system_welcome_queue")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("id", item.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: cfg } = await supabase
      .from("system_ai_config")
      .select("welcome_sequence_enabled, welcome_message_delay_seconds, welcome_messages")
      .limit(1)
      .maybeSingle();

    if (cfg && cfg.welcome_sequence_enabled === false) {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pending, error } = await supabase
      .from("system_welcome_queue")
      .select("*")
      .eq("processed", false)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5);
    if (error) throw error;

    let processed = 0;
    for (const item of pending || []) {
      try {
        await processOne(supabase, item, cfg);
        processed++;
      } catch (e) {
        console.error("welcome processOne err", item.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, total: pending?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-welcome-sequence error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
