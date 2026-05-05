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

    // Check if the scheduled time has passed (with 500ms tolerance)
    const scheduledAt = new Date(pending.scheduled_at).getTime();
    const now = Date.now();
    
    if (scheduledAt > now + 500) {
      console.log("Pending response not yet due:", phone, "scheduled:", pending.scheduled_at);
      return new Response(JSON.stringify({ skipped: true, reason: "Not yet due" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Mark as processed immediately to prevent duplicate processing
    const { error: updateError } = await supabase
      .from("whatsapp_pending_responses")
      .update({ processed: true, updated_at: new Date().toISOString() })
      .eq("id", pending.id);

    if (updateError) {
      console.error("Error marking pending as processed:", updateError);
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

    // Get the last few incoming messages to provide context
    const messages = conversation.messages || [];
    const recentIncoming = messages
      .filter((m: any) => !m.from_me)
      .slice(-5)
      .map((m: any) => m.content)
      .join("\n");

    if (!recentIncoming) {
      console.log("No incoming messages to respond to:", phone);
      return new Response(JSON.stringify({ skipped: true, reason: "No incoming messages" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get contact name from conversation
    const { data: convForName } = await supabase
      .from("whatsapp_conversations")
      .select("contact_name")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    const contactName = convForName?.contact_name || null;

    // Now trigger the AI agent
    console.log("Triggering AI for:", phone, "with combined messages, contactName:", contactName);
    
    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        userId,
        phone,
        messageContent: recentIncoming,
        contactName,
      }),
    });

    const aiResult = await aiResponse.json();
    console.log("AI response result:", aiResult);

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
