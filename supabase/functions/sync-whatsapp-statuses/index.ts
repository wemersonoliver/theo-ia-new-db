import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function pickStatus(item: any): string {
  // Detecta logout silencioso: Evolution mantém connectionStatus "open" mesmo após
  // o WhatsApp invalidar a sessão (Baileys recebe 401). Mas se houve reconexão
  // posterior (updatedAt > disconnectionAt + tolerância), a sessão é válida.
  const disconnectionCode = item?.disconnectionReasonCode ?? item?.instance?.disconnectionReasonCode;
  const disconnectionAt = item?.disconnectionAt ?? item?.instance?.disconnectionAt;
  const updatedAt = item?.updatedAt ?? item?.instance?.updatedAt;
  const rawState = String(
    item?.connectionStatus ??
      item?.status ??
      item?.state ??
      item?.instance?.state ??
      item?.instance?.status ??
      "",
  ).toLowerCase();

  if ((disconnectionCode === 401 || disconnectionCode === 403) && disconnectionAt) {
    // Se houve reconexão (updatedAt mais recente que disconnectionAt + 30s) E o estado é "open",
    // a sessão foi reestabelecida. Caso contrário, tratamos como desconectado.
    const reconnected =
      rawState === "open" &&
      updatedAt &&
      new Date(updatedAt).getTime() > new Date(disconnectionAt).getTime() + 30 * 1000;
    if (!reconnected) return "disconnected";
  }

  if (rawState === "open" || rawState === "connected") return "connected";
  if (rawState === "connecting" || rawState === "qr" || rawState === "qrcode") return "qr_ready";
  if (rawState === "close" || rawState === "closed" || rawState === "disconnected" || rawState === "logout") return "disconnected";
  return rawState || "unknown";
}

function pickName(item: any): string | null {
  return (
    item?.name ??
    item?.instanceName ??
    item?.instance?.instanceName ??
    item?.instance?.name ??
    null
  );
}

function pickPhone(item: any): string | null {
  const owner = item?.ownerJid ?? item?.owner ?? item?.instance?.owner ?? item?.number ?? null;
  if (!owner) return null;
  return String(owner).split("@")[0] || null;
}

function pickProfile(item: any): string | null {
  return item?.profileName ?? item?.instance?.profileName ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      return json({ error: "Evolution API not configured" }, 500);
    }

    const result = await evolutionRequest({
      evolutionUrl,
      evolutionKey,
      path: "/instance/fetchInstances",
      method: "GET",
    });

    if (!result.ok) {
      return json({ error: "Failed to fetch from Evolution", status: result.status, body: result.text?.slice(0, 400) }, 502);
    }

    const list: any[] = Array.isArray(result.data) ? result.data : (result.data?.instances ?? []);
    const byName = new Map<string, { status: string; phone: string | null; profile: string | null }>();

    for (const item of list) {
      const name = pickName(item);
      if (!name) continue;
      byName.set(name, {
        status: pickStatus(item),
        phone: pickPhone(item),
        profile: pickProfile(item),
      });
    }

    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, status");

    let updated = 0;
    const updates: Array<{ name: string; from: string | null; to: string }> = [];

    for (const inst of instances ?? []) {
      const evo = byName.get(inst.instance_name);
      const newStatus = evo?.status ?? "disconnected";
      const newPhone = evo?.phone ?? null;
      const newProfile = evo?.profile ?? null;
      if (newStatus && newStatus !== inst.status) {
        const patch: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
        };
        if (newPhone) patch.phone_number = newPhone;
        if (newProfile) patch.profile_name = newProfile;
        await supabase.from("whatsapp_instances").update(patch).eq("id", inst.id);
        updates.push({ name: inst.instance_name, from: inst.status, to: newStatus });
        updated++;
      } else if (evo && (evo.phone || evo.profile)) {
        const patch: Record<string, unknown> = { last_sync_at: new Date().toISOString() };
        if (evo.phone) patch.phone_number = evo.phone;
        if (evo.profile) patch.profile_name = evo.profile;
        await supabase.from("whatsapp_instances").update(patch).eq("id", inst.id);
      }
    }

    return json({
      ok: true,
      total_db: instances?.length ?? 0,
      total_evolution: list.length,
      updated,
      updates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});