import type { IgreenEvent, AutomationResult } from "../types.ts";
import { withIdempotency } from "./_idempotency.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;
function svc() {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _client;
}

function normalizeBR(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

async function notifyOperators(account_id: string, phone: string, reason: string) {
  try {
    const supabase = svc();

    // Resolve display name + summary
    let displayName = "Desconhecido";
    let summary = "";
    try {
      const { data: contact } = await supabase
        .from("contacts")
        .select("name")
        .eq("account_id", account_id)
        .eq("phone", phone)
        .maybeSingle();
      if ((contact as any)?.name) displayName = (contact as any).name;
    } catch { /* noop */ }
    try {
      const { data: lead } = await supabase
        .from("igreen_lead_data")
        .select("nome_cliente, nome_titular_fatura, distribuidora, valor_fatura_estimado")
        .eq("account_id", account_id)
        .eq("phone", phone)
        .maybeSingle();
      if (lead) {
        if ((lead as any).nome_cliente && displayName === "Desconhecido") displayName = (lead as any).nome_cliente;
        const parts: string[] = [];
        if ((lead as any).nome_titular_fatura) parts.push(`titular ${(lead as any).nome_titular_fatura}`);
        if ((lead as any).distribuidora) parts.push(`distribuidora ${(lead as any).distribuidora}`);
        if ((lead as any).valor_fatura_estimado) parts.push(`fatura ~R$${(lead as any).valor_fatura_estimado}`);
        if (parts.length) summary = parts.join(" • ");
      }
    } catch { /* noop */ }

    // Recipients: notification_contacts + owner profile
    const recipients = new Map<string, string>();
    try {
      const { data: nc } = await supabase
        .from("notification_contacts")
        .select("phone, name")
        .eq("account_id", account_id)
        .eq("notify_handoffs", true);
      for (const c of (nc || []) as any[]) {
        const k = normalizeBR(c.phone);
        if (k && !recipients.has(k)) recipients.set(k, c.name || "");
      }
    } catch { /* noop */ }
    try {
      const { data: acc } = await supabase
        .from("accounts")
        .select("owner_user_id")
        .eq("id", account_id)
        .maybeSingle();
      const ownerId = (acc as any)?.owner_user_id;
      if (ownerId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("phone, full_name")
          .eq("user_id", ownerId)
          .maybeSingle();
        const k = normalizeBR((prof as any)?.phone || "");
        if (k && !recipients.has(k)) recipients.set(k, (prof as any)?.full_name || "Dono da conta");
      }
    } catch { /* noop */ }

    if (recipients.size === 0) {
      console.log("[igreen handoff notify] no recipients", { account_id, phone });
      return { sent: 0, total: 0 };
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) return { sent: 0, total: recipients.size, error: "evolution_not_configured" };

    const { data: sysInstance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .limit(1)
      .maybeSingle();
    if (!sysInstance || (sysInstance as any).status !== "connected") {
      console.error("[igreen handoff notify] system instance not connected");
      return { sent: 0, total: recipients.size, error: "system_instance_offline" };
    }
    const instanceName = (sysInstance as any).instance_name;

    const horario = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    });
    const summaryBlock = summary ? `\n📝 *Resumo:* ${summary}` : "";
    const message = `🔔 *Atendimento iGreen pronto para você assumir*\n\nO cliente concluiu o envio de fatura e documento — pode iniciar o cadastro.\n\n👤 *Nome:* ${displayName}\n📱 *Telefone:* ${phone}\n⏰ *Horário:* ${horario}\n🔄 *Motivo:* ${reason}${summaryBlock}`;

    let sent = 0;
    for (const [num] of recipients) {
      try {
        const resp = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: num, text: message }),
        });
        if (resp.ok) sent++;
        else console.error(`[igreen handoff notify] failed ${num}: ${resp.status}`);
      } catch (e) {
        console.error(`[igreen handoff notify] error ${num}:`, e);
      }
    }
    return { sent, total: recipients.size };
  } catch (e) {
    console.error("[igreen handoff notify] fatal", e);
    return { sent: 0, error: (e as Error).message };
  }
}

export async function handoffAutomation(args: {
  account_id: string;
  phone: string;
  reason: string;
  correlation_id?: string | null;
}): Promise<AutomationResult> {
  return withIdempotency(
    {
      account_id: args.account_id,
      phone: args.phone,
      automation: "handoff",
      idempotency_key: `handoff:${args.account_id}:${args.phone}:${args.reason}`,
      correlation_id: args.correlation_id ?? null,
    },
    async () => {
      const notif = await notifyOperators(args.account_id, args.phone, args.reason);
      const events: IgreenEvent[] = [{
        type: "handoff_triggered", priority: "critical", source: "automation",
        payload: { reason: args.reason, notified: notif.sent, recipients: notif.total ?? 0 },
      }];
      return {
        success: true,
        events,
        suggested_state_patch: { handoff_ativo: true, specialist: "failsafe" },
      };
    },
  );
}