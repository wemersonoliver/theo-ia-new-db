import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const inst = url.searchParams.get("inst") ?? "biz1049_principal";
  const base = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/+$/, "").replace(/\/manager$/i, "");
  const key = Deno.env.get("EVOLUTION_API_KEY") ?? "";

  async function call(p: string) {
    const r = await fetch(`${base}${p}`, { headers: { apikey: key } });
    const t = await r.text();
    try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
  }

  const state = await call(`/instance/connectionState/${inst}`);
  const webhook = await call(`/webhook/find/${inst}`);
  const fetchAll = await call(`/instance/fetchInstances?instanceName=${inst}`);
  return new Response(JSON.stringify({ base, inst, state, webhook, fetchAll }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});