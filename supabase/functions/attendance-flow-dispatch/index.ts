import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "").replace(/\/manager$/i, "")!;
const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;

function normalizePhone(raw: string): string {
  let p = String(raw || "").replace(/\D/g, "");
  if (p.length === 10 || p.length === 11) p = "55" + p;
  return p;
}

async function sendPresence(instanceName: string, phone: string, presence: "composing" | "recording", delayMs: number) {
  try {
    await fetch(`${evolutionUrl}/chat/sendPresence/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: phone, delay: Math.floor(delayMs), presence }),
    });
  } catch (_) { /* ignore */ }
}

async function sendText(instanceName: string, phone: string, text: string) {
  return await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: evolutionKey },
    body: JSON.stringify({ number: phone, text }),
  });
}

async function sendMedia(
  instanceName: string,
  phone: string,
  mediatype: "image" | "video" | "document",
  base64OrUrl: string,
  caption?: string,
  fileName?: string,
) {
  return await fetch(`${evolutionUrl}/message/sendMedia/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: evolutionKey },
    body: JSON.stringify({
      number: phone,
      mediatype,
      media: base64OrUrl,
      caption: caption || undefined,
      fileName: fileName || `media.${mediatype === "image" ? "jpg" : mediatype === "video" ? "mp4" : "bin"}`,
    }),
  });
}

async function sendAudio(instanceName: string, phone: string, base64OrUrl: string) {
  return await fetch(`${evolutionUrl}/message/sendWhatsAppAudio/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: evolutionKey },
    body: JSON.stringify({ number: phone, audio: base64OrUrl }),
  });
}

async function fetchMediaBase64(supabase: any, mediaPath: string | null, mediaUrl: string | null): Promise<string | null> {
  if (mediaPath) {
    const { data, error } = await supabase.storage.from("attendance-flow-media").download(mediaPath);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
    }
    return btoa(binary);
  }
  if (mediaUrl) return mediaUrl;
  return null;
}

async function appendSystemConversationMessage(supabase: any, phone: string, content: string, type: string, mediaUrl?: string) {
  const { data: conv } = await supabase
    .from("system_whatsapp_conversations")
    .select("id, messages")
    .eq("phone", phone)
    .maybeSingle();
  const newMsg: any = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    from_me: true,
    content,
    type,
    sent_by: "attendance_flow",
  };
  if (mediaUrl) newMsg.media_url = mediaUrl;

  if (conv) {
    const messages = (conv.messages as any[]) || [];
    await supabase.from("system_whatsapp_conversations").update({
      messages: [...messages, newMsg],
      last_message_at: new Date().toISOString(),
      total_messages: messages.length + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", conv.id);
  } else {
    await supabase.from("system_whatsapp_conversations").insert({
      phone,
      messages: [newMsg],
      last_message_at: new Date().toISOString(),
      total_messages: 1,
      ai_active: false,
    });
  }
}

async function processRun(supabase: any, instanceName: string, run: any) {
  // Carrega passos
  const { data: steps } = await supabase
    .from("attendance_flow_steps")
    .select("*")
    .eq("flow_id", run.flow_id)
    .order("position", { ascending: true });

  if (!steps || steps.length === 0) {
    await supabase.from("attendance_flow_runs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return;
  }

  if (run.current_step >= steps.length) {
    await supabase.from("attendance_flow_runs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return;
  }

  const step = steps[run.current_step];
  const phone = normalizePhone(run.phone);

  try {
    // Indicadores
    if (step.type === "text" || step.type === "link") {
      if (step.typing_indicator) {
        const txt = step.content || "";
        const composingMs = Math.min(6000, Math.max(1500, txt.length * 40));
        await sendPresence(instanceName, phone, "composing", composingMs);
        await new Promise(r => setTimeout(r, Math.min(composingMs, 2500)));
      }
      const r = await sendText(instanceName, phone, step.content || "");
      if (!r.ok) throw new Error(`sendText ${r.status}: ${await r.text()}`);
      await appendSystemConversationMessage(supabase, phone, step.content || "", "text");
    } else if (step.type === "audio") {
      if (step.recording_indicator) {
        const recMs = 3500;
        await sendPresence(instanceName, phone, "recording", recMs);
        await new Promise(r => setTimeout(r, 2500));
      }
      const audio = await fetchMediaBase64(supabase, step.media_path, step.media_url);
      if (!audio) throw new Error("Áudio sem mídia configurada");
      const r = await sendAudio(instanceName, phone, audio);
      if (!r.ok) throw new Error(`sendAudio ${r.status}: ${await r.text()}`);
      await appendSystemConversationMessage(supabase, phone, "[áudio]", "audio");
    } else if (step.type === "image" || step.type === "video") {
      const media = await fetchMediaBase64(supabase, step.media_path, step.media_url);
      if (!media) throw new Error("Mídia não configurada");
      const r = await sendMedia(instanceName, phone, step.type as any, media, step.caption || undefined);
      if (!r.ok) throw new Error(`sendMedia ${r.status}: ${await r.text()}`);
      await appendSystemConversationMessage(supabase, phone, step.caption || `[${step.type}]`, step.type);
    } else if (step.type === "delay") {
      // sem ação — só avança
    }

    // Avançar passo
    const nextIndex = run.current_step + 1;
    if (nextIndex >= steps.length) {
      await supabase.from("attendance_flow_runs")
        .update({ status: "done", finished_at: new Date().toISOString(), current_step: nextIndex })
        .eq("id", run.id);
    } else {
      const nextDelay = steps[nextIndex].delay_before_seconds || 0;
      const nextAt = new Date(Date.now() + nextDelay * 1000).toISOString();
      await supabase.from("attendance_flow_runs")
        .update({ current_step: nextIndex, next_run_at: nextAt, last_error: null })
        .eq("id", run.id);
    }
  } catch (err: any) {
    console.error(`Run ${run.id} step ${run.current_step} error:`, err?.message || err);
    await supabase.from("attendance_flow_runs")
      .update({ last_error: String(err?.message || err), next_run_at: new Date(Date.now() + 60_000).toISOString() })
      .eq("id", run.id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceKey);

  // Carrega instância do sistema (única)
  const { data: sysInstance } = await supabase
    .from("system_whatsapp_instance")
    .select("instance_name, status")
    .limit(1)
    .maybeSingle();

  if (!sysInstance || sysInstance.status !== "connected") {
    return new Response(JSON.stringify({ ok: false, reason: "system instance not connected" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pega runs prontos para processar
  const { data: runs } = await supabase
    .from("attendance_flow_runs")
    .select("*")
    .eq("status", "running")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(20);

  let processed = 0;
  for (const run of runs || []) {
    await processRun(supabase, sysInstance.instance_name, run);
    processed++;
  }

  return new Response(JSON.stringify({ ok: true, processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});