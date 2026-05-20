import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password, full_name, phone, business_name } = await req.json();
    if (!email || !password || !full_name || !phone) {
      return json({ error: "email, password, full_name, phone obrigatórios" }, 400);
    }
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      return json({ error: "Telefone deve ter 10 ou 11 dígitos (DDD + número)" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Create user (email already confirmed since verification is disabled)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message || "Falha ao criar usuário" }, 400);
    }
    const userId = created.user.id;

    // Set phone & business_name on profile (triggers will create account etc.)
    await admin.from("profiles").update({
      phone: digits,
      business_name: business_name || full_name,
      onboarding_completed: false,
    }).eq("user_id", userId);

    // Locate the account
    let accountId: string | null = null;
    for (let i = 0; i < 5; i++) {
      const { data: acc } = await admin
        .from("accounts")
        .select("id")
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (acc) { accountId = acc.id; break; }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!accountId) {
      return json({ error: "Conta não foi provisionada — tente fazer login" }, 500);
    }

    // 2. Get Igreen monthly plan id
    const { data: plan } = await admin
      .from("plans")
      .select("id, name")
      .eq("slug", "igreen-monthly")
      .maybeSingle();

    // 3. Insert 7-day trial subscription
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await admin.from("subscriptions").insert({
      user_id: userId,
      account_id: accountId,
      plan_id: plan?.id ?? null,
      plan_type: "igreen-trial",
      product_name: "Plano Igreen Energy — Trial 7 dias",
      status: "active",
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
      customer_email: email,
      customer_name: full_name,
      customer_phone: digits,
      amount_cents: 0,
      currency: "BRL",
      raw_data: { source: "igreen-trial-register" },
    });

    // 4. Provision Igreen scenarios for account
    try {
      await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/provision-igreen-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify({ account_id: accountId }),
        },
      );
    } catch (e) {
      console.warn("provision failed", e);
    }

    return json({ ok: true, user_id: userId, account_id: accountId, expires_at: expires.toISOString() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}