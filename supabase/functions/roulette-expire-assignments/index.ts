// Cron: expira assignments pendentes da Roleta e reatribui ao próximo da fila
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeBR(digits: string): string {
  const d = (digits || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

async function notify(
  supabase: any,
  evolutionUrl: string | undefined,
  evolutionKey: string | undefined,
  toUserId: string,
  text: string,
) {
  try {
    if (!evolutionUrl || !evolutionKey) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("phone")
      .eq("user_id", toUserId)
      .maybeSingle();
    const number = normalizeBR(String(prof?.phone || ""));
    if (!number) return;
    const { data: sys } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .limit(1)
      .maybeSingle();
    if (!sys || sys.status !== "connected") return;
    await fetch(`${evolutionUrl}/message/sendText/${sys.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number, text }),
    });
  } catch (e) {
    console.error("notify error", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

  const { data: pending, error } = await supabase
    .from("roulette_assignments")
    .select("*")
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let reassigned = 0;
  let dropped = 0;

  for (const a of pending || []) {
    processed++;
    const skipped: string[] = Array.from(new Set([...(a.skipped_user_ids || []), a.user_id]));

    // Marca como expirado
    await supabase
      .from("roulette_assignments")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", a.id);

    // Pega config para timeout e require_online
    const { data: cfg } = await supabase
      .from("roulette_config")
      .select("accept_timeout_minutes, require_online")
      .eq("account_id", a.account_id)
      .maybeSingle();

    const timeoutMin = cfg?.accept_timeout_minutes ?? 5;

    // Sorteia próximo excluindo quem já passou da vez
    const { data: nextUserId } = await supabase.rpc("roulette_pick_next", {
      _account_id: a.account_id,
      _exclude_user_ids: skipped,
      _only_online: cfg?.require_online ?? null,
    });

    // Avisa quem perdeu a vez
    await notify(
      supabase,
      evolutionUrl,
      evolutionKey,
      a.user_id,
      `⏰ Você não iniciou o atendimento de ${a.contact_name || "cliente"} (${a.phone}) em ${timeoutMin} min. A vez foi passada ao próximo da roleta.`,
    );

    if (!nextUserId) {
      dropped++;
      // Notifica dono da conta
      await notify(
        supabase,
        evolutionUrl,
        evolutionKey,
        a.owner_user_id,
        `⚠️ *Roleta sem atendente disponível*\n\nO atendimento de ${a.contact_name || "cliente"} (${a.phone}) não pôde ser distribuído. Verifique se há atendentes online ou desabilite a exigência de presença.`,
      );
      continue;
    }

    // Cria nova atribuição
    const newExpires = new Date(Date.now() + timeoutMin * 60_000).toISOString();
    await supabase.from("roulette_assignments").insert({
      account_id: a.account_id,
      owner_user_id: a.owner_user_id,
      user_id: nextUserId,
      phone: a.phone,
      contact_name: a.contact_name,
      status: "pending",
      attempts: (a.attempts || 1) + 1,
      skipped_user_ids: skipped,
      expires_at: newExpires,
    });

    // Reatribui conversa/contato/deal
    await supabase
      .from("whatsapp_conversations")
      .update({ assigned_to: nextUserId, updated_at: new Date().toISOString() })
      .eq("user_id", a.owner_user_id)
      .eq("phone", a.phone);

    await supabase
      .from("contacts")
      .update({ assigned_to: nextUserId, updated_at: new Date().toISOString() })
      .eq("user_id", a.owner_user_id)
      .eq("phone", a.phone);

    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", a.owner_user_id)
      .eq("phone", a.phone)
      .maybeSingle();

    if (contact?.id) {
      await supabase
        .from("crm_deals")
        .update({ assigned_to: nextUserId, updated_at: new Date().toISOString() })
        .eq("contact_id", contact.id)
        .is("won_at", null)
        .is("lost_at", null);
    }

    await supabase
      .from("roulette_assignments")
      .update({ status: "reassigned", updated_at: new Date().toISOString() })
      .eq("id", a.id);

    // Avisa novo atendente
    await notify(
      supabase,
      evolutionUrl,
      evolutionKey,
      nextUserId,
      `🎯 *Roleta de Atendimento*\n\nVocê recebeu um atendimento (reatribuído):\n\n👤 *Cliente:* ${a.contact_name || "Desconhecido"}\n📱 *Telefone:* ${a.phone}\n⏱️ *Inicie em até ${timeoutMin} min*, ou a vez será passada adiante.`,
    );

    reassigned++;
  }

  return new Response(
    JSON.stringify({ processed, reassigned, dropped }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});