import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";
import { extractPersonName, cleanRenderedTemplate } from "../_person-name.ts";
import { isWithinWindow, generateScheduleSequence } from "../_followup-window.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ENROLLMENTS = 25;

function isoNow() { return new Date().toISOString(); }

/**
 * Clampa um timestamp UTC para dentro da janela 08:00–19:00 BRT, seg-sáb.
 * - Se cair antes das 08:00 BRT → 08:00 + jitter (até 30 min) do mesmo dia.
 * - Se cair depois das 19:00 BRT → 08:00 + jitter do próximo dia útil.
 * - Se cair em domingo BRT → pula para segunda 08:00 + jitter.
 */
function clampToWindow(target: Date): Date {
  const local = new Date(target.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const tzOffset = local.getTime() - target.getTime();
  const startMin = 8 * 60;
  const endMin = 19 * 60;
  const curMin = local.getHours() * 60 + local.getMinutes();

  const moveToMorning = (d: Date) => {
    const jitter = Math.floor(Math.random() * 30); // 0-29 min de jitter
    d.setHours(8, jitter, Math.floor(Math.random() * 60), 0);
  };

  if (local.getDay() === 0) {
    // domingo → segunda
    local.setDate(local.getDate() + 1);
    moveToMorning(local);
  } else if (curMin < startMin) {
    moveToMorning(local);
  } else if (curMin > endMin) {
    local.setDate(local.getDate() + 1);
    if (local.getDay() === 0) local.setDate(local.getDate() + 1);
    moveToMorning(local);
  }
  return new Date(local.getTime() - tzOffset);
}

/**
 * Renders template variables in a scenario item text.
 * Supported tokens: {{primeiro_nome}}, {{nome}}.
 * If no valid human name is available, tokens are replaced with empty
 * and orphan punctuation is cleaned (e.g. "Oi {{primeiro_nome}}, tudo bem?" → "Oi, tudo bem?" → "Oi tudo bem?").
 * Returns the original text untouched when there are no tokens.
 */
function renderItemText(text: string | null | undefined, contact: { name?: string | null; person_name?: string | null } | null): string {
  const raw = text ?? "";
  if (!raw) return "";
  if (!/\{\{\s*(primeiro_nome|nome)\s*\}\}/i.test(raw)) return raw;

  const candidate = (contact?.person_name || contact?.name || "").trim();
  const parsed = extractPersonName(candidate);
  const firstName = parsed?.firstName ?? "";
  const fullName = parsed?.fullName ?? "";

  let out = raw.replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName);
  out = out.replace(/\{\{\s*nome\s*\}\}/gi, fullName || firstName);

  // If we substituted with empty, clean orphan punctuation/spaces.
  if (!firstName) out = cleanRenderedTemplate(out);
  return out;
}

function addDelay(from: Date, value: number, unit: string): Date {
  const ms =
    unit === "days" ? value * 86_400_000 :
    unit === "hours" ? value * 3_600_000 :
    unit === "seconds" ? value * 1_000 :
    value * 60_000;
  return new Date(from.getTime() + ms);
}

/** Random datetime inside BRT window for given period. If `forDay` is provided, uses that date in BRT. */
function slotForPeriod(period: "morning" | "evening", forDay?: Date): Date {
  const base = forDay ?? new Date();
  const local = new Date(base.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const tzOffset = local.getTime() - base.getTime();
  const startH = period === "morning" ? 8 : 12;
  const endH = period === "morning" ? 12 : 19;
  const endM = period === "morning" ? 0 : 55;
  const startMin = startH * 60;
  const endMin = endH * 60 + endM;
  const slot = startMin + Math.floor(Math.random() * Math.max(1, endMin - startMin));
  local.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
  const result = new Date(local.getTime() - tzOffset);
  // Nunca retornar passado: se já passou (ou domingo), joga para a próxima janela válida.
  if (result.getTime() <= Date.now() || local.getDay() === 0) {
    const tomorrow = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    return clampToWindow(tomorrow);
  }
  return clampToWindow(result);
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nowIso = isoNow();
  const { data: due, error: dueErr } = await supabase
    .from("igreen_scenario_enrollments")
    .select("*")
    .in("status", ["active", "pending_tag"])
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(MAX_ENROLLMENTS);

  if (dueErr) {
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, skipped = 0, failed = 0, advanced = 0, completed = 0, tagged = 0;
  const processedContacts = new Set<string>();

  for (const enrollment of due ?? []) {
    try {
      // Guard global: nunca enviar fora da janela 08-19 BRT (seg-sáb).
      if (!isWithinWindow({})) {
        const next = generateScheduleSequence({}, 1)[0];
        await supabase.from("igreen_scenario_enrollments").update({
          next_run_at: next,
          updated_at: isoNow(),
        }).eq("id", enrollment.id);
        skipped++;
        continue;
      }

      // Cap por contato/run: 1 envio por contato por tick.
      const contactKey = `${enrollment.account_id}:${enrollment.contact_phone}`;
      if (processedContacts.has(contactKey)) {
        const next = clampToWindow(new Date(Date.now() + 10 * 60_000));
        await supabase.from("igreen_scenario_enrollments").update({
          next_run_at: next.toISOString(),
          updated_at: isoNow(),
        }).eq("id", enrollment.id);
        skipped++;
        continue;
      }

      // ===== Handle pending final-tag application =====
      if (enrollment.status === "pending_tag") {
        const res = await applyFinalTag(supabase, enrollment);
        if (res.ok) { tagged++; completed++; }
        else { failed++; }
        continue;
      }

      // Stop on reply
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("messages")
        .eq("account_id", enrollment.account_id)
        .eq("phone", enrollment.contact_phone)
        .maybeSingle();
      if (conv) {
        const msgs = (conv.messages as any[]) || [];
        const lastInbound = [...msgs].reverse().find((m: any) => !m.from_me);
        if (lastInbound?.timestamp && new Date(lastInbound.timestamp) > new Date(enrollment.started_at)) {
          await supabase.rpc("igreen_stop_for_phone", {
            p_account_id: enrollment.account_id,
            p_phone: enrollment.contact_phone,
            p_reason: "replied",
          });
          skipped++;
          continue;
        }
      }

      // Resolve current day row
      const { data: dayRow } = await supabase
        .from("igreen_scenario_days")
        .select("id, enabled, day_number")
        .eq("scenario_id", enrollment.scenario_id)
        .eq("day_number", enrollment.current_day)
        .maybeSingle();

      if (!dayRow || !dayRow.enabled) {
        await advanceToNext(supabase, enrollment, "day_disabled_or_missing");
        advanced++;
        continue;
      }

      // Resolve message bundle (day + period)
      const { data: msgRow } = await supabase
        .from("igreen_scenario_messages")
        .select("id")
        .eq("day_id", dayRow.id)
        .eq("period", enrollment.current_period)
        .maybeSingle();

      if (!msgRow) {
        await advanceToNext(supabase, enrollment, "no_message_for_period");
        advanced++;
        continue;
      }

      // Items to send (ordered)
      const { data: items } = await supabase
        .from("igreen_scenario_items")
        .select("*")
        .eq("message_id", msgRow.id)
        .order("position", { ascending: true });

      if (!items || items.length === 0) {
        await advanceToNext(supabase, enrollment, "empty_items");
        advanced++;
        continue;
      }

      // Locate next item to send
      // Se o bloco ainda não enviou nada (last_sent_at não bate com esse bundle),
      // começa pela menor position (geralmente 0). Caso contrário, próximo > atual.
      const hasStarted = items.some((it) => it.position === enrollment.current_item_position)
        && (enrollment.current_item_position ?? 0) > 0;
      const nextItem = hasStarted
        ? (items.find((it) => it.position > (enrollment.current_item_position ?? 0)) ?? null)
        : items[0];

      if (!nextItem) {
        // bundle finished → advance to next period/day
        await advanceToNext(supabase, enrollment, "items_done");
        advanced++;
        continue;
      }

      // Lock otimista — só processa quem conseguir reservar (CAS no next_run_at).
      // Empurra next_run_at para 5min à frente ANTES de qualquer envio.
      const { data: claim } = await supabase
        .from("igreen_scenario_enrollments")
        .update({
          next_run_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          updated_at: isoNow(),
        })
        .eq("id", enrollment.id)
        .eq("next_run_at", enrollment.next_run_at)
        .select("id")
        .maybeSingle();
      if (!claim) { skipped++; continue; }

      // Resolve a connected instance for the account
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, status, is_primary")
        .eq("account_id", enrollment.account_id)
        .order("is_primary", { ascending: false })
        .limit(1).maybeSingle();

      if (!inst || inst.status !== "connected") {
        // re-schedule in 5 min
        await supabase.from("igreen_scenario_enrollments").update({
          next_run_at: clampToWindow(new Date(Date.now() + 5 * 60_000)).toISOString(),
          updated_at: isoNow(),
        }).eq("id", enrollment.id);
        skipped++;
        continue;
      }
      const instanceName = inst.instance_name;

      // Resolve contact name (used to render {{primeiro_nome}}/{{nome}})
      const { data: contactRow } = await supabase
        .from("contacts")
        .select("name, person_name")
        .eq("account_id", enrollment.account_id)
        .eq("phone", enrollment.contact_phone)
        .maybeSingle();

      // Render template variables in text/caption with safe fallback (empty + cleanup)
      const renderedItem = {
        ...nextItem,
        content: nextItem.type === "text" ? renderItemText(nextItem.content, contactRow) : nextItem.content,
        caption: nextItem.caption ? renderItemText(nextItem.caption, contactRow) : nextItem.caption,
      };

      // Send item
      const sendRes = await sendItem(evolutionUrl, evolutionKey, instanceName, enrollment.contact_phone, renderedItem);

      // Log event
      await supabase.from("igreen_scenario_events").insert({
        enrollment_id: enrollment.id,
        day_number: enrollment.current_day,
        period: enrollment.current_period,
        message_id: msgRow.id,
        status: sendRes.ok ? "sent" : "failed",
        error: sendRes.ok ? null : (sendRes.error || "").slice(0, 500),
        sent_at: isoNow(),
      });

      if (!sendRes.ok) {
        // retry in 2 min
        await supabase.from("igreen_scenario_enrollments").update({
          next_run_at: clampToWindow(new Date(Date.now() + 2 * 60_000)).toISOString(),
          updated_at: isoNow(),
        }).eq("id", enrollment.id);
        failed++;
        continue;
      }

      // Append to conversation history (best effort)
      try {
        if (conv) {
          const existing = (conv.messages as any[]) || [];
          const msg = {
            id: crypto.randomUUID(),
            timestamp: isoNow(),
            from_me: true,
            type: nextItem.type,
            content: renderedItem.type === "text" ? (renderedItem.content || "") : (renderedItem.caption || ""),
            media_url: nextItem.media_url || undefined,
            media_mime: nextItem.media_mime || undefined,
            sent_by: "igreen_scenario",
          };
          await supabase.from("whatsapp_conversations").update({
            messages: [...existing, msg],
            last_message_at: isoNow(),
            updated_at: isoNow(),
          }).eq("account_id", enrollment.account_id).eq("phone", enrollment.contact_phone);
        }
      } catch (_) {}

      // Determine if more items remain in bundle
      const moreItems = items.filter((it) => it.position > nextItem.position);

      if (moreItems.length > 0) {
        const upcoming = moreItems[0];
        const next = addDelay(new Date(), upcoming.delay_value || 0, upcoming.delay_unit || "minutes");
        const safeNext = clampToWindow(next);
        await supabase.from("igreen_scenario_enrollments").update({
          current_item_position: nextItem.position,
          last_sent_at: isoNow(),
          next_run_at: safeNext.toISOString(),
          updated_at: isoNow(),
        }).eq("id", enrollment.id);
      } else {
        // bundle done → advance period/day
        await advanceToNext(supabase, { ...enrollment, current_item_position: nextItem.position }, "items_done");
      }

      sent++;
      processedContacts.add(contactKey);
    } catch (e) {
      console.error("igreen dispatch error", e);
      await supabase.from("igreen_scenario_enrollments").update({
        next_run_at: clampToWindow(new Date(Date.now() + 5 * 60_000)).toISOString(),
        updated_at: isoNow(),
      }).eq("id", enrollment.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ sent, skipped, failed, advanced, completed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function applyFinalTag(supabase: any, enrollment: any): Promise<{ ok: boolean }> {
  try {
    const { data: sc } = await supabase
      .from("igreen_scenarios")
      .select("final_tag")
      .eq("id", enrollment.scenario_id)
      .maybeSingle();
    const tag = (sc?.final_tag || "").trim();
    if (tag) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, tags")
        .eq("account_id", enrollment.account_id)
        .eq("phone", enrollment.contact_phone)
        .maybeSingle();
      if (contact) {
        const current: string[] = Array.isArray(contact.tags) ? contact.tags : [];
        if (!current.includes(tag)) {
          await supabase.from("contacts")
            .update({ tags: [...current, tag], updated_at: isoNow() })
            .eq("id", contact.id);
        }
      }
    }
    await supabase.from("igreen_scenario_enrollments").update({
      status: "completed",
      next_run_at: null,
      final_tag_applied_at: isoNow(),
      updated_at: isoNow(),
    }).eq("id", enrollment.id);
    return { ok: true };
  } catch (e) {
    console.error("applyFinalTag error", e);
    await supabase.from("igreen_scenario_enrollments").update({
      next_run_at: clampToWindow(new Date(Date.now() + 10 * 60_000)).toISOString(),
      updated_at: isoNow(),
    }).eq("id", enrollment.id);
    return { ok: false };
  }
}

async function sendItem(
  evolutionUrl: string,
  evolutionKey: string,
  instanceName: string,
  phone: string,
  item: any,
): Promise<{ ok: boolean; error?: string }> {
  const number = phone;
  try {
    if (item.type === "text") {
      const r = await evolutionRequest({
        evolutionUrl, evolutionKey,
        path: `/message/sendText/${instanceName}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, text: item.content || "" }),
      });
      return { ok: r.ok, error: r.ok ? undefined : r.text };
    }
    if (item.type === "audio") {
      const r = await evolutionRequest({
        evolutionUrl, evolutionKey,
        path: `/message/sendWhatsAppAudio/${instanceName}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, audio: item.media_url }),
      });
      return { ok: r.ok, error: r.ok ? undefined : r.text };
    }
    if (item.type === "image" || item.type === "video" || item.type === "document") {
      const r = await evolutionRequest({
        evolutionUrl, evolutionKey,
        path: `/message/sendMedia/${instanceName}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number,
          mediatype: item.type,
          mimetype: item.media_mime || undefined,
          caption: item.caption || undefined,
          media: item.media_url,
          fileName: item.media_filename || undefined,
        }),
      });
      return { ok: r.ok, error: r.ok ? undefined : r.text };
    }
    if (item.type === "sticker") {
      const r = await evolutionRequest({
        evolutionUrl, evolutionKey,
        path: `/message/sendSticker/${instanceName}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, sticker: item.media_url }),
      });
      return { ok: r.ok, error: r.ok ? undefined : r.text };
    }
    return { ok: false, error: `unsupported type: ${item.type}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function advanceToNext(supabase: any, enrollment: any, _reason: string) {
  try {
  // morning → evening (same day); evening → next enabled day, morning
  if (enrollment.current_period === "morning") {
    const next = slotForPeriod("evening");
    await supabase.from("igreen_scenario_enrollments").update({
      current_period: "evening",
      current_item_position: 0,
      next_run_at: next.toISOString(),
      last_sent_at: isoNow(),
      updated_at: isoNow(),
    }).eq("id", enrollment.id);
    return;
  }

  // find next enabled day_number > current_day
  const { data: nextDay } = await supabase
    .from("igreen_scenario_days")
    .select("day_number")
    .eq("scenario_id", enrollment.scenario_id)
    .eq("enabled", true)
    .gt("day_number", enrollment.current_day)
    .order("day_number", { ascending: true })
    .limit(1).maybeSingle();

  if (!nextDay) {
    // Check if scenario has a final tag → schedule pending_tag after delay
    const { data: sc } = await supabase
      .from("igreen_scenarios")
      .select("final_tag, final_tag_delay_hours")
      .eq("id", enrollment.scenario_id)
      .maybeSingle();
    const tag = (sc?.final_tag || "").trim();
    if (tag) {
      const delayH = Math.max(0, Number(sc?.final_tag_delay_hours ?? 24));
      const due = new Date(Date.now() + delayH * 3_600_000).toISOString();
      await supabase.from("igreen_scenario_enrollments").update({
        status: "pending_tag",
        current_item_position: 0,
        next_run_at: due,
        last_sent_at: isoNow(),
        updated_at: isoNow(),
      }).eq("id", enrollment.id);
    } else {
      await supabase.from("igreen_scenario_enrollments").update({
        status: "completed",
        next_run_at: null,
        current_item_position: 0,
        last_sent_at: isoNow(),
        updated_at: isoNow(),
      }).eq("id", enrollment.id);
    }
    return;
  }

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const next = slotForPeriod("morning", tomorrow);
  await supabase.from("igreen_scenario_enrollments").update({
    current_day: nextDay.day_number,
    current_period: "morning",
    current_item_position: 0,
    next_run_at: next.toISOString(),
    last_sent_at: isoNow(),
    updated_at: isoNow(),
  }).eq("id", enrollment.id);
  } catch (e) {
    console.error("[advanceToNext] failed", enrollment.id, e);
    // Reagenda para 1h à frente, mas dentro da janela, para impedir loop por minuto.
    await supabase.from("igreen_scenario_enrollments").update({
      next_run_at: clampToWindow(new Date(Date.now() + 60 * 60_000)).toISOString(),
      updated_at: isoNow(),
    }).eq("id", enrollment.id);
  }
}