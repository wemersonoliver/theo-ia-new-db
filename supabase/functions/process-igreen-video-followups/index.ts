import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  const nowIso = new Date().toISOString();
  const { data: pending, error } = await supabase
    .from("igreen_product_video_followups")
    .select("id, account_id, user_id, phone, message, scheduled_at, created_at")
    .is("sent_at", null)
    .is("cancelled_at", null)
    .lte("scheduled_at", nowIso)
    .limit(50);

  if (error) {
    console.error("query error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let sent = 0, cancelled = 0;
  for (const row of pending || []) {
    try {
      // Verifica se cliente respondeu após o envio do vídeo
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("messages, instance_id")
        .eq("user_id", row.user_id)
        .eq("phone", row.phone)
        .maybeSingle();

      const msgs = (conv as any)?.messages || [];
      const repliedAfter = msgs.some((m: any) => !m.from_me && m.timestamp && new Date(m.timestamp).getTime() > new Date(row.created_at).getTime());
      if (repliedAfter) {
        await supabase.from("igreen_product_video_followups")
          .update({ cancelled_at: nowIso, cancel_reason: "client_replied" })
          .eq("id", row.id);
        cancelled++;
        continue;
      }

      // Envia a mensagem
      let instance: any = null;
      if (conv?.instance_id) {
        const { data } = await supabase.from("whatsapp_instances").select("instance_name").eq("id", conv.instance_id).maybeSingle();
        instance = data;
      }
      if (!instance) {
        const { data } = await supabase.from("whatsapp_instances")
          .select("instance_name, is_primary")
          .eq("user_id", row.user_id)
          .order("is_primary", { ascending: false })
          .limit(1).maybeSingle();
        instance = data;
      }
      if (!instance || !evolutionUrl || !evolutionKey) {
        console.error("missing instance/evolution config for", row.id);
        continue;
      }

      const res = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: row.phone, text: row.message }),
      });
      if (!res.ok) {
        console.error("send error", row.id, await res.text());
        continue;
      }
      const parsed = await res.json().catch(() => ({}));
      const wid = parsed?.key?.id || parsed?.messageId || null;

      // Persiste no histórico
      const newMsg = {
        id: wid || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        from_me: true,
        content: row.message,
        type: "text",
        sent_by: "ai",
      };
      if (conv) {
        const updated = [...msgs, newMsg];
        await supabase.from("whatsapp_conversations")
          .update({ messages: updated, last_message_at: newMsg.timestamp, updated_at: newMsg.timestamp })
          .eq("user_id", row.user_id).eq("phone", row.phone);
      }

      await supabase.from("igreen_product_video_followups")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      console.error("row error", row.id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, cancelled, total: pending?.length || 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
