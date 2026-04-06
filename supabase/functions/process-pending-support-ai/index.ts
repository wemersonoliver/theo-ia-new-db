import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, delayMs } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Missing phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sleepTime = delayMs || 35000;
    console.log(`Sleeping ${sleepTime}ms before processing support AI for: ${phone}`);
    await new Promise(resolve => setTimeout(resolve, sleepTime));

    // Check if there's a pending response
    const { data: pending, error: pendingError } = await supabase
      .from("system_pending_responses")
      .select("*")
      .eq("phone", phone)
      .eq("processed", false)
      .maybeSingle();

    if (pendingError) {
      console.error("Error fetching pending:", pendingError);
      return new Response(JSON.stringify({ error: pendingError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pending) {
      console.log("No pending support response for:", phone);
      return new Response(JSON.stringify({ skipped: true, reason: "No pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if scheduled time has passed
    const scheduledAt = new Date(pending.scheduled_at).getTime();
    if (scheduledAt > Date.now() + 500) {
      console.log("Not yet due:", phone);
      return new Response(JSON.stringify({ skipped: true, reason: "Not yet due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as processed
    await supabase
      .from("system_pending_responses")
      .update({ processed: true, updated_at: new Date().toISOString() })
      .eq("id", pending.id);

    // Get conversation
    const { data: conversation } = await supabase
      .from("system_whatsapp_conversations")
      .select("messages, ai_active, contact_name")
      .eq("phone", phone)
      .maybeSingle();

    if (!conversation) {
      return new Response(JSON.stringify({ skipped: true, reason: "No conversation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (conversation.ai_active === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = conversation.messages || [];
    const recentIncoming = messages
      .filter((m: any) => !m.from_me)
      .slice(-5)
      .map((m: any) => m.content)
      .join("\n");

    if (!recentIncoming) {
      return new Response(JSON.stringify({ skipped: true, reason: "No incoming messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Triggering support AI for:", phone);

    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/support-ai-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ phone, messageContent: recentIncoming }),
    });

    const aiResult = await aiResponse.json();
    console.log("Support AI result:", aiResult);

    return new Response(JSON.stringify({ success: true, aiResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Process pending support AI error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
