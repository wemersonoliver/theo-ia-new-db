import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const session = url.searchParams.get("session") || "biz1053_principal";
  const phone = url.searchParams.get("phone");
  const wahaUrl = (Deno.env.get("WAHA_API_URL") || "").replace(/\/+$/, "");
  const wahaKey = Deno.env.get("WAHA_API_KEY") || "";
  const h = { "X-Api-Key": wahaKey, "Content-Type": "application/json", Accept: "application/json" };

  const out: any = {};

  const statusRes = await fetch(`${wahaUrl}/api/sessions/${encodeURIComponent(session)}`, { headers: h });
  out.status = { code: statusRes.status, body: await statusRes.text() };

  if (phone) {
    const reqRes = await fetch(`${wahaUrl}/api/${encodeURIComponent(session)}/auth/request-code`, {
      method: "POST", headers: h,
      body: JSON.stringify({ phoneNumber: phone.replace(/\D/g, "") }),
    });
    out.requestCode = { code: reqRes.status, body: await reqRes.text() };
  }

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});