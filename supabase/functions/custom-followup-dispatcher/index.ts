import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_RUN = 30;
const WORKER_ID = crypto.randomUUID();

interface QueueItem {
  id: string;
  account_id: string;
  flow_id: string;
  enrollment_id: string;
  step_id: string;
  step_position: number;
  instance_id: string | null;
  phone: string;
  scheduled_at: string;
  attempts: number;
}

interface FlowRow {
  id: string;
  account_id: string;
  enabled: boolean;
  exclude_handoff: boolean;
  stop_on_reply: boolean;
  throttle_seconds: number;
  window_config: any;
}

interface StepRow {
  id: string;
  flow_id: string;
  position: number;
  type: string;
  content: string | null;
  caption: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_filename: string | null;
  delay_value: number;
  delay_unit: string;
  variants?: any;
  conditions?: any;
}

interface Variant {
  id?: string;
  weight?: number;
  type?: string;
  content?: string | null;
  caption?: string | null;
  media_url?: string | null;
  media_mime?: string | null;
  media_filename?: string | null;
}

function pickVariant(step: StepRow): { type: string; content: string | null; caption: string | null; media_url: string | null; media_mime: string | null; media_filename: string | null; variant_id: string | null } {
  const list = Array.isArray(step.variants) ? (step.variants as Variant[]) : [];
  if (!list.length) {
    return { type: step.type, content: step.content, caption: step.caption, media_url: step.media_url, media_mime: step.media_mime, media_filename: step.media_filename, variant_id: null };
  }
  const total = list.reduce((s, v) => s + (Number(v.weight) > 0 ? Number(v.weight) : 1), 0);
  let r = Math.random() * total;
  let chosen: Variant = list[0];
  for (const v of list) {
    const w = Number(v.weight) > 0 ? Number(v.weight) : 1;
    if (r < w) { chosen = v; break; }
    r -= w;
  }
  return {
    type: chosen.type || step.type,
    content: chosen.content ?? step.content,
    caption: chosen.caption ?? step.caption,
    media_url: chosen.media_url ?? step.media_url,
    media_mime: chosen.media_mime ?? step.media_mime,
    media_filename: chosen.media_filename ?? step.media_filename,
    variant_id: chosen.id || null,
  };
}

function isoNow() { return new Date().toISOString(); }

function brtParts(d = new Date()) {
  const local = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return {
    local,
    minutes: local.getHours() * 60 + local.getMinutes(),
    weekday: local.getDay(),
    tzOffsetMs: local.getTime() - d.getTime(),
  };
}

function parseHM(s: string | undefined, fb: string): number {
  const [h, m] = (s || fb).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function ymdBRT(d: Date): string {
  const local = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isHoliday(dateYmd: string, holidays: { date: string; recurring: boolean }[]): boolean {
  const md = dateYmd.slice(5);
  return holidays.some((h) => h.date === dateYmd || (h.recurring && h.date.slice(5) === md));
}

/** Returns the next allowed UTC time inside window (08:00–19:00 BRT, skip Sundays/holidays by default). */
function nextWindowedUtc(from: Date, win: any, holidays: { date: string; recurring: boolean }[] = []): Date {
  const skipSundays = win?.skip_sundays !== false;
  const skipHolidays = win?.skip_holidays !== false;
  const startMin = parseHM(win?.morning_start, "08:00");
  const endMin = parseHM(win?.evening_end, "19:00");
  const { local, minutes, weekday, tzOffsetMs } = brtParts(from);
  let cursor = new Date(local);
  let curMin = minutes;
  let curWd = weekday;

  // helper: dia "atual do cursor" é inválido?
  const cursorBlocked = () => {
    const wd = cursor.getDay();
    if (skipSundays && wd === 0) return true;
    if (skipHolidays && isHoliday(ymdBRT(new Date(cursor.getTime() - tzOffsetMs)), holidays)) return true;
    return false;
  };

  // Se hoje fora da janela ou bloqueado → pular
  if (cursorBlocked() || curMin > endMin) {
    do {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    } while (cursorBlocked());
    return new Date(cursor.getTime() - tzOffsetMs);
  }
  if (curMin < startMin) {
    cursor.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    return new Date(cursor.getTime() - tzOffsetMs);
  }
  return from;
}

function addDelay(from: Date, value: number, unit: string): Date {
  const ms =
    unit === "days" ? value * 86_400_000 :
    unit === "hours" ? value * 3_600_000 :
    unit === "seconds" ? value * 1_000 :
    value * 60_000;
  return new Date(from.getTime() + ms);
}

function isWithinWindowNow(win: any, holidays: { date: string; recurring: boolean }[] = []): boolean {
  const skipSundays = win?.skip_sundays !== false;
  const skipHolidays = win?.skip_holidays !== false;
  const { minutes, weekday } = brtParts();
  if (skipSundays && weekday === 0) return false;
  if (skipHolidays && isHoliday(ymdBRT(new Date()), holidays)) return false;
  const startMin = parseHM(win?.morning_start, "08:00");
  const endMin = parseHM(win?.evening_end, "19:00");
  return minutes >= startMin && minutes <= endMin;
}

// ===== Events & Webhooks =====
async function logEvent(supabase: any, payload: {
  account_id: string; flow_id?: string | null; enrollment_id?: string | null;
  step_id?: string | null; step_position?: number | null; variant_id?: string | null;
  phone?: string | null; event_type: string; meta?: any;
}) {
  try {
    await supabase.from("custom_followup_events").insert({
      account_id: payload.account_id,
      flow_id: payload.flow_id ?? null,
      enrollment_id: payload.enrollment_id ?? null,
      step_id: payload.step_id ?? null,
      step_position: payload.step_position ?? null,
      variant_id: payload.variant_id ?? null,
      phone: payload.phone ?? null,
      event_type: payload.event_type,
      meta: payload.meta ?? {},
    });
    fireWebhooks(supabase, payload).catch((e) => console.warn("webhook fire error", e));
  } catch (e) {
    console.warn("logEvent failed", e);
  }
}

async function fireWebhooks(supabase: any, payload: any) {
  const { data: hooks } = await supabase
    .from("custom_followup_webhooks")
    .select("id, url, events, headers, secret, flow_id, enabled")
    .eq("account_id", payload.account_id)
    .eq("enabled", true);
  if (!hooks?.length) return;
  const body = JSON.stringify({ ...payload, fired_at: new Date().toISOString() });
  await Promise.all(hooks.map(async (h: any) => {
    if (h.flow_id && h.flow_id !== payload.flow_id) return;
    if (Array.isArray(h.events) && h.events.length && !h.events.includes(payload.event_type)) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-followup-event": payload.event_type,
      ...(h.headers && typeof h.headers === "object" ? h.headers : {}),
    };
    if (h.secret) headers["x-followup-secret"] = String(h.secret);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      const r = await fetch(h.url, { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(t);
      await supabase.from("custom_followup_webhooks").update({
        last_status: r.status, last_error: r.ok ? null : `HTTP ${r.status}`, last_fired_at: new Date().toISOString(),
      }).eq("id", h.id);
    } catch (e) {
      await supabase.from("custom_followup_webhooks").update({
        last_status: 0, last_error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        last_fired_at: new Date().toISOString(),
      }).eq("id", h.id);
    }
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;

  if (!evolutionUrl || !evolutionKey) {
    return new Response(JSON.stringify({ error: "Evolution not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Pick due items, lock them atomically per item
  const nowIso = isoNow();

  // get candidates
  const { data: candidates, error: pickErr } = await supabase
    .from("custom_followup_queue")
    .select("id, account_id, flow_id, enrollment_id, step_id, step_position, instance_id, phone, scheduled_at, attempts")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (pickErr) {
    console.error("pick error", pickErr);
    return new Response(JSON.stringify({ error: pickErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, skipped = 0, failed = 0;

  // Track per-instance last send time within this run for throttle
  const instanceLastSent = new Map<string, number>();
  // cache de feriados por conta
  const holidaysByAccount = new Map<string, { date: string; recurring: boolean }[]>();
  async function getHolidays(accountId: string) {
    if (holidaysByAccount.has(accountId)) return holidaysByAccount.get(accountId)!;
    const { data } = await supabase
      .from("custom_followup_holidays")
      .select("date, recurring")
      .eq("account_id", accountId);
    const list = (data || []) as any[];
    holidaysByAccount.set(accountId, list);
    return list;
  }

  for (const item of candidates as QueueItem[]) {
    try {
      // Try to claim the row
      const { data: claimed, error: claimErr } = await supabase
        .from("custom_followup_queue")
        .update({ status: "sending", locked_at: isoNow(), locked_by: WORKER_ID, attempts: item.attempts + 1 })
        .eq("id", item.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (claimErr || !claimed) { skipped++; continue; }

      // Load flow
      const { data: flow } = await supabase
        .from("custom_followup_flows")
        .select("id, account_id, enabled, exclude_handoff, stop_on_reply, throttle_seconds, window_config")
        .eq("id", item.flow_id)
        .maybeSingle();
      const f = flow as FlowRow | null;

      if (!f || !f.enabled) {
        await supabase.from("custom_followup_queue")
          .update({ status: "skipped", last_error: "flow disabled or missing" }).eq("id", item.id);
        skipped++; continue;
      }

      // Window check (com feriados)
      const holidays = await getHolidays(f.account_id);
      if (!isWithinWindowNow(f.window_config, holidays)) {
        const next = nextWindowedUtc(new Date(), f.window_config, holidays);
        await supabase.from("custom_followup_queue")
          .update({ status: "pending", scheduled_at: next.toISOString(), locked_at: null, locked_by: null })
          .eq("id", item.id);
        skipped++; continue;
      }

      // Load enrollment
      const { data: enrollment } = await supabase
        .from("custom_followup_enrollments")
        .select("id, status, last_sent_at, started_at, account_id, phone")
        .eq("id", item.enrollment_id)
        .maybeSingle();
      if (!enrollment || enrollment.status !== "active") {
        await supabase.from("custom_followup_queue")
          .update({ status: "skipped", last_error: "enrollment not active" }).eq("id", item.id);
        skipped++; continue;
      }

      // Stop on reply: check whatsapp_conversations for any incoming message after started_at
      if (f.stop_on_reply) {
        const { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select("messages, ai_active")
          .eq("account_id", f.account_id)
          .eq("phone", item.phone)
          .maybeSingle();
        if (conv) {
          const msgs = (conv.messages as any[]) || [];
          const lastInbound = [...msgs].reverse().find((m: any) => !m.from_me);
          if (lastInbound && lastInbound.timestamp && new Date(lastInbound.timestamp) > new Date(enrollment.started_at)) {
            await supabase.rpc("custom_followup_stop_for_phone", {
              _account_id: f.account_id, _phone: item.phone, _reason: "replied"
            });
            await logEvent(supabase, {
              account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
              phone: item.phone, event_type: "stopped", meta: { reason: "replied" },
            });
            skipped++; continue;
          }
          if (f.exclude_handoff && conv.ai_active === false) {
            await supabase.rpc("custom_followup_stop_for_phone", {
              _account_id: f.account_id, _phone: item.phone, _reason: "handoff"
            });
            await logEvent(supabase, {
              account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
              phone: item.phone, event_type: "stopped", meta: { reason: "handoff" },
            });
            skipped++; continue;
          }
        }
      }

      // Load step
      const { data: step } = await supabase
        .from("custom_followup_steps")
        .select("id, flow_id, position, type, content, caption, media_url, media_mime, media_filename, delay_value, delay_unit, variants, conditions")
        .eq("id", item.step_id)
        .maybeSingle();
      const s = step as StepRow | null;
      if (!s) {
        await supabase.from("custom_followup_queue")
          .update({ status: "failed", last_error: "step missing" }).eq("id", item.id);
        failed++; continue;
      }

      // ===== Step-level conditions (tag based) =====
      const cond: any = s.conditions || {};
      const condInc: string[] = Array.isArray(cond.tags_include) ? cond.tags_include.map((t: string) => String(t).toLowerCase()) : [];
      const condExc: string[] = Array.isArray(cond.tags_exclude) ? cond.tags_exclude.map((t: string) => String(t).toLowerCase()) : [];
      const onFail: string = cond.on_fail === "stop" ? "stop" : "skip"; // skip step | stop enrollment
      if (condInc.length || condExc.length) {
        const { data: contactRow } = await supabase
          .from("contacts").select("tags")
          .eq("account_id", f.account_id).eq("phone", item.phone).maybeSingle();
        const ctags = (Array.isArray(contactRow?.tags) ? contactRow!.tags : []).map((t: string) => String(t).toLowerCase());
        const incOk = condInc.length === 0 || condInc.some((t) => ctags.includes(t));
        const excOk = !condExc.some((t) => ctags.includes(t));
        if (!incOk || !excOk) {
          if (onFail === "stop") {
            await supabase.from("custom_followup_queue")
              .update({ status: "skipped", last_error: "step condition failed (stop)" }).eq("id", item.id);
            await supabase.rpc("custom_followup_stop_for_phone", {
              _account_id: f.account_id, _phone: item.phone, _reason: "condition_failed"
            });
            await logEvent(supabase, {
              account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
              step_id: s.id, step_position: s.position,
              phone: item.phone, event_type: "stopped", meta: { reason: "condition_failed" },
            });
            skipped++; continue;
          }
          // Skip step → schedule next step (if any) without "send"
          await supabase.from("custom_followup_queue")
            .update({ status: "skipped", last_error: "step condition failed (skipped)" }).eq("id", item.id);
          await logEvent(supabase, {
            account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
            step_id: s.id, step_position: s.position,
            phone: item.phone, event_type: "skipped", meta: { reason: "condition_failed" },
          });
          const { data: nextStep } = await supabase
            .from("custom_followup_steps")
            .select("id, position, delay_value, delay_unit")
            .eq("flow_id", f.id)
            .gt("position", s.position)
            .order("position", { ascending: true })
            .limit(1).maybeSingle();
          if (nextStep) {
            const baseTime = addDelay(new Date(), nextStep.delay_value || 0, nextStep.delay_unit || "minutes");
            const scheduled = nextWindowedUtc(baseTime, f.window_config, holidays);
            await supabase.from("custom_followup_queue").insert({
              account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
              step_id: nextStep.id, step_position: nextStep.position,
              instance_id: item.instance_id, phone: item.phone,
              scheduled_at: scheduled.toISOString(),
            });
            await supabase.from("custom_followup_enrollments").update({
              current_step: s.position,
              next_scheduled_at: scheduled.toISOString(),
              updated_at: isoNow(),
            }).eq("id", item.enrollment_id);
          } else {
            await supabase.from("custom_followup_enrollments").update({
              current_step: s.position, next_scheduled_at: null,
              status: "completed", updated_at: isoNow(),
            }).eq("id", item.enrollment_id);
            await logEvent(supabase, {
              account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
              phone: item.phone, event_type: "completed", meta: {},
            });
          }
          skipped++; continue;
        }
      }

      // Pick variant (A/B testing). If no variants, returns the step itself.
      const chosen = pickVariant(s);

      // Resolve instance to use
      let instanceName: string | null = null;
      let instanceId: string | null = item.instance_id;
      if (instanceId) {
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("instance_name, status")
          .eq("id", instanceId).maybeSingle();
        if (inst?.status === "connected") instanceName = inst.instance_name;
      }
      if (!instanceName) {
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("id, instance_name, status, is_primary")
          .eq("account_id", f.account_id)
          .order("is_primary", { ascending: false })
          .limit(1).maybeSingle();
        if (!inst || inst.status !== "connected") {
          await supabase.from("custom_followup_queue")
            .update({ status: "pending", scheduled_at: new Date(Date.now() + 5 * 60_000).toISOString(),
                     locked_at: null, locked_by: null, last_error: "no connected instance" })
            .eq("id", item.id);
          skipped++; continue;
        }
        instanceName = inst.instance_name;
        instanceId = inst.id;
      }

      // Throttle per instance (only inside this run; cross-run protection via scheduled_at gap)
      const last = instanceLastSent.get(instanceName) || 0;
      const wait = (f.throttle_seconds || 7) * 1000 - (Date.now() - last);
      if (last && wait > 0) await new Promise((r) => setTimeout(r, wait));

      // Send
      const variables = await loadVariables(supabase, f.account_id, item.phone);
      const renderedText = renderTemplate(chosen.content || "", variables);
      const renderedCaption = renderTemplate(chosen.caption || "", variables);

      let sendOk = false;
      let sendErr = "";
      try {
        // Presence indicator
        const presence = chosen.type === "audio" ? "recording" : "composing";
        const delayMs = 1500 + Math.floor(Math.random() * 1500);
        fetch(`${evolutionUrl}/chat/presence/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: item.phone, delay: delayMs, presence }),
        }).catch(() => {});
        await new Promise((r) => setTimeout(r, Math.min(delayMs, 1500)));

        if (chosen.type === "text") {
          const r = await evolutionRequest({
            evolutionUrl, evolutionKey,
            path: `/message/sendText/${instanceName}`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ number: item.phone, text: renderedText }),
          });
          sendOk = r.ok; sendErr = r.ok ? "" : (r.text || "send failed");
        } else if (chosen.type === "audio") {
          const r = await evolutionRequest({
            evolutionUrl, evolutionKey,
            path: `/message/sendWhatsAppAudio/${instanceName}`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ number: item.phone, audio: chosen.media_url }),
          });
          sendOk = r.ok; sendErr = r.ok ? "" : (r.text || "send failed");
        } else if (chosen.type === "image" || chosen.type === "video" || chosen.type === "document") {
          const r = await evolutionRequest({
            evolutionUrl, evolutionKey,
            path: `/message/sendMedia/${instanceName}`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              number: item.phone,
              mediatype: chosen.type,
              mimetype: chosen.media_mime || undefined,
              caption: renderedCaption || undefined,
              media: chosen.media_url,
              fileName: chosen.media_filename || undefined,
            }),
          });
          sendOk = r.ok; sendErr = r.ok ? "" : (r.text || "send failed");
        } else if (chosen.type === "sticker") {
          const r = await evolutionRequest({
            evolutionUrl, evolutionKey,
            path: `/message/sendSticker/${instanceName}`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ number: item.phone, sticker: chosen.media_url }),
          });
          sendOk = r.ok; sendErr = r.ok ? "" : (r.text || "send failed");
        } else {
          sendErr = `unsupported step type: ${chosen.type}`;
        }
      } catch (e) {
        sendErr = e instanceof Error ? e.message : String(e);
      }

      instanceLastSent.set(instanceName, Date.now());

      if (!sendOk) {
        const giveUp = item.attempts + 1 >= 3;
        await supabase.from("custom_followup_queue").update({
          status: giveUp ? "failed" : "pending",
          scheduled_at: giveUp ? item.scheduled_at : new Date(Date.now() + 60_000 * (item.attempts + 1)).toISOString(),
          locked_at: null, locked_by: null,
          last_error: sendErr.slice(0, 500),
        }).eq("id", item.id);
        if (giveUp) {
          await logEvent(supabase, {
            account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
            step_id: s.id, step_position: s.position, variant_id: chosen.variant_id,
            phone: item.phone, event_type: "failed", meta: { error: sendErr.slice(0, 300) },
          });
        }
        failed++; continue;
      }

      // Mark sent
      await supabase.from("custom_followup_queue")
        .update({ status: "sent", sent_at: isoNow() }).eq("id", item.id);
      await logEvent(supabase, {
        account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
        step_id: s.id, step_position: s.position, variant_id: chosen.variant_id,
        phone: item.phone, event_type: "sent", meta: { type: chosen.type },
      });

      // Append message to whatsapp_conversations history
      try {
        const { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select("id, messages, total_messages")
          .eq("account_id", f.account_id).eq("phone", item.phone).maybeSingle();
        const msg = {
          id: crypto.randomUUID(),
          timestamp: isoNow(),
          from_me: true,
          content: chosen.type === "text" ? renderedText : renderedCaption,
          type: chosen.type,
          sent_by: "custom_followup",
          media_url: chosen.media_url || undefined,
          media_mime: chosen.media_mime || undefined,
          variant_id: chosen.variant_id || undefined,
        };
        if (conv) {
          const existing = (conv.messages as any[]) || [];
          await supabase.from("whatsapp_conversations").update({
            messages: [...existing, msg],
            last_message_at: isoNow(),
            total_messages: (conv.total_messages || existing.length) + 1,
            updated_at: isoNow(),
          }).eq("id", conv.id);
        }
      } catch (e) { console.warn("history append failed", e); }

      // Schedule next step (if any)
      const { data: nextStep } = await supabase
        .from("custom_followup_steps")
        .select("id, position, delay_value, delay_unit")
        .eq("flow_id", f.id)
        .gt("position", s.position)
        .order("position", { ascending: true })
        .limit(1).maybeSingle();

      if (nextStep) {
        const baseTime = addDelay(new Date(), nextStep.delay_value || 0, nextStep.delay_unit || "minutes");
        const scheduled = nextWindowedUtc(baseTime, f.window_config, holidays);
        await supabase.from("custom_followup_queue").insert({
          account_id: f.account_id,
          flow_id: f.id,
          enrollment_id: item.enrollment_id,
          step_id: nextStep.id,
          step_position: nextStep.position,
          instance_id: instanceId,
          phone: item.phone,
          scheduled_at: scheduled.toISOString(),
        });
        await supabase.from("custom_followup_enrollments").update({
          current_step: s.position,
          last_sent_at: isoNow(),
          next_scheduled_at: scheduled.toISOString(),
          updated_at: isoNow(),
        }).eq("id", item.enrollment_id);
      } else {
        await supabase.from("custom_followup_enrollments").update({
          current_step: s.position,
          last_sent_at: isoNow(),
          next_scheduled_at: null,
          status: "completed",
          updated_at: isoNow(),
        }).eq("id", item.enrollment_id);
        await logEvent(supabase, {
          account_id: f.account_id, flow_id: f.id, enrollment_id: item.enrollment_id,
          phone: item.phone, event_type: "completed", meta: {},
        });
      }
      sent++;
    } catch (e) {
      console.error("dispatch loop error", e);
      await supabase.from("custom_followup_queue").update({
        status: "pending", locked_at: null, locked_by: null,
        last_error: e instanceof Error ? e.message : String(e),
      }).eq("id", item.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ sent, skipped, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// ----------- helpers ------------

async function loadVariables(supabase: any, accountId: string, phone: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = { telefone: phone };
  try {
    const { data: contact } = await supabase
      .from("contacts")
      .select("name, person_name, email, business_name, tags, custom_fields")
      .eq("account_id", accountId).eq("phone", phone).maybeSingle();
    if (contact) {
      // Prioriza person_name (validado). Cai para name só se name passar no validador.
      let chosen = (contact.person_name || "").trim();
      if (!chosen && contact.name) {
        const v = extractPersonName(contact.name);
        if (v) chosen = v.fullName;
      }
      vars.nome = chosen;
      vars.primeiro_nome = chosen ? chosen.split(" ")[0] : "";
      vars.email = contact.email || "";
      vars.empresa = contact.business_name || "";
    }
  } catch (_) {}
  return vars;
}

function renderTemplate(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  // Variables: {{nome}}
  let out = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) => vars[k.toLowerCase()] ?? "");
  // Spintax: {a|b|c}
  out = out.replace(/\{([^{}]+)\}/g, (m, body) => {
    if (!body.includes("|")) return m;
    const opts = body.split("|");
    return opts[Math.floor(Math.random() * opts.length)];
  });
  return cleanRenderedTemplate(out);
}