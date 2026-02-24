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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = claimsData.user.id;
    const { phone, content } = await req.json();

    if (!phone || !content) {
      return new Response(JSON.stringify({ error: "Phone and content required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get user's instance
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instance || instance.status !== "connected") {
      return new Response(JSON.stringify({ error: "WhatsApp não está conectado" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get Evolution API from global secrets
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured in secrets");
      return new Response(JSON.stringify({ error: "Erro de configuração do servidor" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Send message via Evolution API
    const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        text: content,
      }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("Evolution send error:", errorText);
      return new Response(JSON.stringify({ error: "Erro ao enviar mensagem" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    await sendResponse.text(); // Consume response

    // Save message to conversation
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    const newMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from_me: true,
      content,
      type: "text",
      sent_by: "human",
    };

    if (conversation) {
      const existingMessages = conversation.messages || [];
      const updatedMessages = [...existingMessages, newMessage];

      await supabase
        .from("whatsapp_conversations")
        .update({
          messages: updatedMessages,
          last_message_at: new Date().toISOString(),
          total_messages: updatedMessages.length,
          ai_active: false, // Disable AI when human sends
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);
    } else {
      await supabase
        .from("whatsapp_conversations")
        .insert({
          user_id: userId,
          phone,
          messages: [newMessage],
          last_message_at: new Date().toISOString(),
          total_messages: 1,
          ai_active: false,
        });
    }

    // Mark AI session as handed off
    await supabase
      .from("whatsapp_ai_sessions")
      .upsert({
        user_id: userId,
        phone,
        status: "handed_off",
        last_human_message_at: new Date().toISOString(),
        handed_off_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,phone" });

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
