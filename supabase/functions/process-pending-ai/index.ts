import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";
import { normalizeBrazilianPhone } from "../_phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function resolveInstanceName(supabase: any, userId: string, phone: string): Promise<string | null> {
  try {
    const normalizedPhone = normalizeBrazilianPhone(phone);
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("instance_id, account_id")
      .eq("user_id", userId)
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (conv?.instance_id) {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, status")
        .eq("id", conv.instance_id)
        .maybeSingle();
      if (inst?.status === "connected") return inst.instance_name;
    }

    let q = supabase
      .from("whatsapp_instances")
      .select("instance_name, status, is_primary")
      .order("is_primary", { ascending: false });
    q = conv?.account_id ? q.eq("account_id", conv.account_id) : q.eq("user_id", userId);
    const { data: inst2 } = await q.limit(1).maybeSingle();
    if (inst2?.status === "connected") return inst2.instance_name;
  } catch (e) {
    console.error("resolveInstanceName error:", e);
  }
  return null;
}

async function sendTypingPresence(instanceName: string, phone: string) {
  try {
    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) return;
    const normalizedPhone = normalizeBrazilianPhone(phone);
    await evolutionRequest({
      evolutionUrl,
      evolutionKey,
      path: `/chat/sendPresence/${instanceName}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: normalizedPhone, presence: "composing", delay: 25000 }),
    });
  } catch (e) {
    console.error("sendTypingPresence error:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, phone, delayMs } = await req.json();

    if (!userId || !phone) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Sleep for the configured delay before checking pending responses
    // This ensures the debounce window has passed
    const sleepTime = delayMs || 35000;
    console.log(`Sleeping ${sleepTime}ms before processing for: ${phone}`);

    // Send "typing..." presence to WhatsApp during the wait so the customer
    // sees that someone is composing a reply. Evolution presence expires
    // after ~25s, so we re-emit it every 20s while we wait.
    const instanceName = await resolveInstanceName(supabase, userId, phone);
    if (instanceName) {
      // Fire first presence immediately (don't await long)
      sendTypingPresence(instanceName, phone);
      const interval = setInterval(() => {
        sendTypingPresence(instanceName, phone);
      }, 20000);
      try {
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      } finally {
        clearInterval(interval);
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, sleepTime));
    }

    // Check if there's a pending response that should be processed now
    const { data: pending, error: pendingError } = await supabase
      .from("whatsapp_pending_responses")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .eq("processed", false)
      .maybeSingle();

    if (pendingError) {
      console.error("Error fetching pending response:", pendingError);
      return new Response(JSON.stringify({ error: pendingError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!pending) {
      console.log("No pending response found for:", phone);
      return new Response(JSON.stringify({ skipped: true, reason: "No pending response" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const scheduledAt = new Date(pending.scheduled_at).getTime();
    const nowMs = Date.now();

    if (scheduledAt > nowMs + 500) {
      console.log("Pending response not yet due:", phone, "scheduled:", pending.scheduled_at);
      return new Response(JSON.stringify({ skipped: true, reason: "Not yet due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ATOMIC CLAIM: only one worker can mark this row processed.
    // If another worker already claimed it, exit immediately to prevent
    // duplicate AI invocations producing parallel responses.
    const { data: claimed, error: claimError } = await supabase
      .from("whatsapp_pending_responses")
      .update({ processed: true, updated_at: new Date().toISOString() })
      .eq("id", pending.id)
      .eq("processed", false)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("Error claiming pending response:", claimError);
    }

    if (!claimed) {
      console.log("Pending response already claimed by another worker:", phone);
      return new Response(JSON.stringify({ skipped: true, reason: "Already claimed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get the latest message content from the conversation
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("messages, ai_active")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    if (!conversation) {
      console.log("No conversation found for:", phone);
      return new Response(JSON.stringify({ skipped: true, reason: "No conversation" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check if AI is still active for this conversation
    if (conversation.ai_active === false) {
      console.log("AI disabled for conversation:", phone);
      return new Response(JSON.stringify({ skipped: true, reason: "AI disabled" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get the latest incoming message. The AI agent already loads full
    // conversation history from the database; sending the last 5 user messages
    // as one text makes the Green flow confuse "Oi" with the client's name.
    const messages = conversation.messages || [];
    const latestIncoming = [...messages]
      .filter((m: any) => !m.from_me)
      .reverse()
      .find((m: any) => typeof (m.ai_content || m.content) === "string");
    const latestIncomingText = String(latestIncoming?.ai_content || latestIncoming?.content || "").trim();

    if (!latestIncomingText) {
      console.log("No incoming messages to respond to:", phone);
      return new Response(JSON.stringify({ skipped: true, reason: "No incoming messages" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get contact name from conversation
    const { data: convForName } = await supabase
      .from("whatsapp_conversations")
      .select("id, contact_name, ai_processing_until, account_id")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    const contactName = convForName?.contact_name || null;
    const conversationId = convForName?.id;

    // CONVERSATION-LEVEL LOCK: only one AI run per conversation at a time.
    // Prevents the AI from being invoked twice in parallel (which causes
    // duplicated responses and "I received the image again" hallucinations
    // when a new message arrives while the previous AI run is still in flight).
    if (conversationId) {
      const lockUntil = new Date(Date.now() + 90 * 1000).toISOString();
      const { data: lockAcquired, error: lockError } = await supabase
        .from("whatsapp_conversations")
        .update({ ai_processing_until: lockUntil })
        .eq("id", conversationId)
        .or(`ai_processing_until.is.null,ai_processing_until.lt.${new Date().toISOString()}`)
        .select("id")
        .maybeSingle();

      if (lockError) {
        console.error("Error acquiring AI lock:", lockError);
        // If the lock column is missing or PostgREST cache is stale, do NOT
        // treat this as "AI busy" — that would freeze the AI forever.
        // Proceed without the lock; the per-pending-row claim above already
        // prevents double-processing for the same (user_id, phone) entry.
      }

      if (!lockAcquired && !lockError) {
        // Another AI run is in progress. Re-queue this work so it runs
        // after the current one finishes, instead of running in parallel.
        const rescheduleAt = new Date(Date.now() + 30 * 1000).toISOString();
        await supabase
          .from("whatsapp_pending_responses")
          .upsert({
            user_id: userId,
            account_id: pending.account_id ?? null,
            phone,
            scheduled_at: rescheduleAt,
            processed: false,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,phone" });

        fetch(`${supabaseUrl}/functions/v1/process-pending-ai`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ userId, phone, delayMs: 30000 }),
        }).catch(err => console.error("Error re-queueing process-pending-ai:", err));

        console.log("AI busy for conversation, re-queued in 30s:", phone);
        return new Response(JSON.stringify({ skipped: true, reason: "AI busy, re-queued" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Now trigger the AI agent
    console.log("Triggering AI for:", phone, "with latest message, contactName:", contactName);

    let aiResult: any = null;
    try {
      // D13 routing — accounts with is_igreen=true go to the v2 pipeline (Phase 1–6).
      let targetFn = "whatsapp-ai-agent";
      const accountId = (pending as any).account_id ?? (convForName as any)?.account_id ?? null;
      if (accountId) {
        const { data: acc } = await supabase
          .from("accounts")
          .select("is_igreen")
          .eq("id", accountId)
          .maybeSingle();
        if (acc?.is_igreen === true) targetFn = "whatsapp-igreen-agent-v2";
      }
      console.log(`[router] account=${accountId} → ${targetFn}`);
      const aiResponse = await fetch(`${supabaseUrl}/functions/v1/${targetFn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          userId,
          accountId,
          phone,
          messageContent: latestIncomingText,
          contactName,
        }),
      });
      aiResult = await aiResponse.json();
      console.log("AI response result:", aiResult);
    } finally {
      // ALWAYS release the conversation lock, even if the AI call failed.
      if (conversationId) {
        await supabase
          .from("whatsapp_conversations")
          .update({ ai_processing_until: null })
          .eq("id", conversationId);
      }
    }

    return new Response(JSON.stringify({ success: true, aiResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Process pending AI error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
