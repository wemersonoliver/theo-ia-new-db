import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const session = url.searchParams.get("session") || "biz1053_principal";
  const phone = url.searchParams.get("phone");
  const create = url.searchParams.get("create") === "1";
  const del = url.searchParams.get("delete") === "1";
  const engine = url.searchParams.get("engine") || "NOWEB";
  const wahaUrl = (Deno.env.get("WAHA_API_URL") || "").replace(/\/+$/, "");
  const wahaKey = Deno.env.get("WAHA_API_KEY") || "";
  const h = { "X-Api-Key": wahaKey, "Content-Type": "application/json", Accept: "application/json" };

  const out: any = {};

  if (del) {
    const r = await fetch(`${wahaUrl}/api/sessions/${encodeURIComponent(session)}`, { method: "DELETE", headers: h });
    out.delete = { code: r.status, body: (await r.text()).slice(0, 400) };
  }

  if (create) {
    const body: any = { name: session, start: true, config: { metadata: {}, debug: false } };
    if (phone) body.config.metadata = { phoneNumber: phone.replace(/\D/g, "") };
    body.config.engine = engine;
    const r = await fetch(`${wahaUrl}/api/sessions`, { method: "POST", headers: h, body: JSON.stringify(body) });
    out.create = { code: r.status, body: (await r.text()).slice(0, 600) };
    // wait for STARTED / SCAN_QR_CODE
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const s = await fetch(`${wahaUrl}/api/sessions/${encodeURIComponent(session)}`, { headers: h });
      const t = await s.text();
      out[`status_${i}`] = { code: s.status, body: t.slice(0, 300) };
      if (/SCAN_QR_CODE|WORKING|STARTED/.test(t)) break;
    }
  }

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