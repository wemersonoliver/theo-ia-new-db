import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractPictureUrl(data: Record<string, unknown> | null | undefined) {
  const candidates = [
    data?.profilePictureUrl,
    data?.url,
    data?.picture,
    (data?.response as Record<string, unknown> | undefined)?.profilePictureUrl,
    (data?.response as Record<string, unknown> | undefined)?.url,
    (data?.response as Record<string, unknown> | undefined)?.picture,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

/**
 * Sync WhatsApp profile pictures for contacts/conversations.
 *
 * Modes:
 *  - { phone, instanceName }                    → fetch single number
 *  - { accountId, instanceName }                → batch all stale rows for this account
 *  - { mode: "cron" }                           → batch all accounts, only stale (>7d) entries
 *
 * For each phone we resolve the WhatsApp profile picture URL via Evolution API and
 * persist it in `contacts.profile_picture_url` and `whatsapp_conversations.profile_picture_url`.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return new Response(
        JSON.stringify({ error: "Evolution API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const { phone, instanceName, accountId, mode } = body || {};

    // ── Build target list ────────────────────────────────────────────────
    type Target = { phone: string; instance: string; accountId: string | null; userId: string | null };
    const targets: Target[] = [];

    const STALE_MS = 7 * 24 * 60 * 60 * 1000;
    const staleCutoff = new Date(Date.now() - STALE_MS).toISOString();

    if (phone && instanceName) {
      const { data: convData } = await supabase
        .from("whatsapp_conversations")
        .select("user_id, account_id")
        .eq("phone", phone)
        .maybeSingle();
      targets.push({
        phone,
        instance: instanceName,
        accountId: convData?.account_id ?? null,
        userId: convData?.user_id ?? null,
      });
    } else if (accountId && instanceName) {
      const { data: rows } = await supabase
        .from("whatsapp_conversations")
        .select("phone, user_id, account_id, profile_picture_updated_at")
        .eq("account_id", accountId)
        .or(`profile_picture_updated_at.is.null,profile_picture_updated_at.lt.${staleCutoff}`)
        .limit(200);
      for (const r of rows || []) {
        targets.push({ phone: r.phone, instance: instanceName, accountId: r.account_id, userId: r.user_id });
      }
    } else if (mode === "cron") {
      // Batch all instances with stale conversations
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("user_id, instance_name, status")
        .eq("status", "connected");
      for (const inst of instances || []) {
        const { data: rows } = await supabase
          .from("whatsapp_conversations")
          .select("phone, user_id, account_id, profile_picture_updated_at")
          .eq("user_id", inst.user_id)
          .or(`profile_picture_updated_at.is.null,profile_picture_updated_at.lt.${staleCutoff}`)
          .limit(50); // Cap per user per run
        for (const r of rows || []) {
          targets.push({ phone: r.phone, instance: inst.instance_name, accountId: r.account_id, userId: r.user_id });
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Provide { phone, instanceName } | { accountId, instanceName } | { mode: 'cron' }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Fetching profile pictures for ${targets.length} targets`);

    let updated = 0;
    let failed = 0;

    for (const t of targets) {
      try {
        const numberCandidates = Array.from(
          new Set([
            t.phone,
            t.phone.includes("@") ? t.phone : `${t.phone}@s.whatsapp.net`,
          ]),
        );

        let pictureUrl: string | null = null;
        let lastPayload: unknown = null;

        for (const number of numberCandidates) {
          const result = await evolutionRequest({
            evolutionUrl,
            evolutionKey,
            path: `/chat/fetchProfilePictureUrl/${t.instance}`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ number }),
          });

          lastPayload = result.data;

          if (!result.ok) {
            console.warn(`Profile picture lookup failed for ${t.phone} using ${number}: ${result.status} ${result.text}`);
            continue;
          }

          pictureUrl = extractPictureUrl(result.data as Record<string, unknown> | null | undefined);
          if (pictureUrl) break;
        }

        if (!pictureUrl) {
          failed++;
          console.warn(`No profile picture URL returned for ${t.phone}`, lastPayload);
          continue;
        }

        const now = new Date().toISOString();

        // Update conversations (account-scoped)
        const convQuery = supabase
          .from("whatsapp_conversations")
          .update({ profile_picture_url: pictureUrl, profile_picture_updated_at: now })
          .eq("phone", t.phone);
        if (t.accountId) convQuery.eq("account_id", t.accountId);
        await convQuery;

        // Update contacts
        const contactQuery = supabase
          .from("contacts")
          .update({ profile_picture_url: pictureUrl, profile_picture_updated_at: now })
          .eq("phone", t.phone);
        if (t.accountId) contactQuery.eq("account_id", t.accountId);
        await contactQuery;

        updated++;
      } catch (err) {
        failed++;
        console.error(`Error fetching picture for ${t.phone}:`, err);
      }
    }

    console.log(`Profile picture sync done: ${updated} updated, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, updated, failed, total: targets.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
