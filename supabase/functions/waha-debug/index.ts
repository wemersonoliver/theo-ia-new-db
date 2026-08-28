import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveInstanceContext } from "../_wa_provider.ts";
import { wahaRequest } from "../_waha.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone, send } = await req.json();
    const digits = String(phone || "").replace(/\D/g, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ctx = await resolveInstanceContext(supabase, { system: true });
    if (!ctx || ctx.provider !== "waha") {
      return new Response(JSON.stringify({ error: "no waha ctx", ctx: ctx?.provider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = ctx.wahaSession;
    const out: any = { session, tests: {} };

    const paths: Record<string, string> = {
      version: `/api/version`,
      sessionInfo: `/api/sessions/${encodeURIComponent(session)}`,
      checkExists: `/api/contacts/check-exists?session=${encodeURIComponent(session)}&phone=${digits}`,
      lidByPn: `/api/${encodeURIComponent(session)}/lids/pn/${digits}`,
      lidByPnCus: `/api/${encodeURIComponent(session)}/lids/pn/${digits}@c.us`,
    };

    for (const [name, path] of Object.entries(paths)) {
      const res = await wahaRequest({
        wahaUrl: ctx.wahaUrl!,
        wahaKey: ctx.wahaKey!,
        path,
        method: "GET",
      }).catch((e) => ({ ok: false, status: 0, text: String(e) } as any));
      out.tests[name] = { status: res.status, body: (res.text || "").slice(0, 500) };
    }

    if (send) {
      const variants: string[] = [`${digits}@c.us`];
      const lidBody = out.tests.lidByPn?.body || out.tests.lidByPnCus?.body || "";
      const lidMatch = lidBody.match(/(\d{6,})@lid/) || lidBody.match(/"lid"\s*:\s*"?(\d{6,})/);
      if (lidMatch) variants.push(`${lidMatch[1]}@lid`);

      out.sends = [];
      for (const chatId of variants) {
        const res = await wahaRequest({
          wahaUrl: ctx.wahaUrl!,
          wahaKey: ctx.wahaKey!,
          path: "/api/sendText",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, chatId, text: "Teste de notificação Theo IA" }),
        }).catch((e) => ({ ok: false, status: 0, text: String(e) } as any));
        out.sends.push({ chatId, status: res.status, body: (res.text || "").slice(0, 500) });
        if (res.ok) break;
      }
    }

    return new Response(JSON.stringify(out, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
