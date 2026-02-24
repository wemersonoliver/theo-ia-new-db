import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, phone } = await req.json();

    if (!userId || !phone) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
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

    // Now trigger the AI agent
    console.log("Triggering AI for:", phone, "with combined messages");
    
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
