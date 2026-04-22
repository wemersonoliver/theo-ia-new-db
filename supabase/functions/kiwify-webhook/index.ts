import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAccountId } from "../_account.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    console.log("Kiwify webhook received:", JSON.stringify(body));

    // Kiwify webhook payload fields
    const orderId = body.order_id || body.subscription_id || body.id;
    const eventType = body.webhook_event_type || body.order_status;
    const customerEmail = body.Customer?.email || body.customer?.email;
    const customerName = body.Customer?.full_name || body.customer?.full_name || body.customer?.name;
    const customerPhone = body.Customer?.mobile || body.customer?.mobile;
    const productId = body.Product?.id || body.product?.id;
    const productName = body.Product?.name || body.product?.name;
    // Kiwify pode enviar valor em reais ("97.00") OU já em centavos ("9700").
    // Heurística: se não tem ponto/vírgula E é >= 1000, já é centavo.
    const parseKiwifyAmount = (raw: unknown): number | null => {
      if (raw === null || raw === undefined) return null;
      const str = String(raw).trim();
      if (!str) return null;
      const hasDecimal = str.includes(".") || str.includes(",");
      const normalized = str.replace(",", ".");
      const num = parseFloat(normalized);
      if (!isFinite(num)) return null;
      // Se já vem com decimal (ex: "97.00"), multiplica por 100
      if (hasDecimal) return Math.round(num * 100);
      // Inteiro: se >= 1000, assume que já está em centavos (ex: "9700" = R$97)
      // Caso contrário trata como reais (ex: "97" = R$97 = 9700 centavos)
      return num >= 1000 ? Math.round(num) : Math.round(num * 100);
    };
    const amountCents =
      parseKiwifyAmount(body.Commissions?.charge_amount) ??
      parseKiwifyAmount(body.sale_amount);
    const planType = body.plan?.name || body.subscription_plan || null;

    if (!orderId) {
      console.error("No order_id in webhook payload");
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Kiwify event/status to our subscription status
    let status = "inactive";
    let cancelledAt: string | null = null;
    let refundedAt: string | null = null;
    let startedAt: string | null = null;

    const normalizedEvent = (eventType || "").toLowerCase();

    if (
      normalizedEvent === "order_approved" ||
      normalizedEvent === "approved" ||
      normalizedEvent === "paid" ||
      normalizedEvent === "subscription_renewed"
    ) {
      status = "active";
      startedAt = new Date().toISOString();
    } else if (
      normalizedEvent === "order_refunded" ||
      normalizedEvent === "refunded" ||
      normalizedEvent === "chargedback"
    ) {
      status = "refunded";
      refundedAt = new Date().toISOString();
    } else if (
      normalizedEvent === "subscription_canceled" ||
      normalizedEvent === "canceled" ||
      normalizedEvent === "cancelled"
    ) {
      status = "cancelled";
      cancelledAt = new Date().toISOString();
    } else if (
      normalizedEvent === "waiting_payment" ||
      normalizedEvent === "pending"
    ) {
      status = "pending";
    }

    // Find user by email
    let userId: string | null = null;
    let accountId: string | null = null;
    if (customerEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", customerEmail)
        .maybeSingle();

      if (profile) {
        userId = profile.user_id;
        accountId = await resolveAccountId(supabase, userId);
      }
    }

    // Upsert subscription
    const subscriptionData: Record<string, unknown> = {
      kiwify_order_id: orderId,
      kiwify_product_id: productId,
      product_name: productName,
      customer_email: customerEmail,
      customer_name: customerName,
      customer_phone: customerPhone,
      status,
      plan_type: planType,
      amount_cents: amountCents,
      raw_data: body,
    };

    if (userId) subscriptionData.user_id = userId;
    if (accountId) subscriptionData.account_id = accountId;
    if (startedAt) subscriptionData.started_at = startedAt;
    if (cancelledAt) subscriptionData.cancelled_at = cancelledAt;
    if (refundedAt) subscriptionData.refunded_at = refundedAt;

    // Check if subscription exists
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id, user_id")
      .eq("kiwify_order_id", orderId)
      .maybeSingle();

    if (existing) {
      // Don't overwrite user_id if already set
      if (!userId && existing.user_id) {
        delete subscriptionData.user_id;
      }
      const { error } = await supabase
        .from("subscriptions")
        .update(subscriptionData)
        .eq("kiwify_order_id", orderId);

      if (error) {
        console.error("Error updating subscription:", error);
        throw error;
      }
      console.log("Subscription updated:", orderId, status);
    } else {
      // For new subscriptions, user_id is required
      if (!userId) {
        // Create with a placeholder - will be linked later via sync or manual
        console.warn("No user found for email:", customerEmail);
        subscriptionData.user_id = "00000000-0000-0000-0000-000000000000";
      }
      const { error } = await supabase
        .from("subscriptions")
        .insert(subscriptionData);

      if (error) {
        console.error("Error inserting subscription:", error);
        throw error;
      }
      console.log("Subscription created:", orderId, status);
    }

    // If user found and status is not active, block access
    if (userId && (status === "cancelled" || status === "refunded")) {
      await supabase
        .from("profiles")
        .update({ is_blocked: true })
        .eq("user_id", userId);
      console.log("User blocked:", userId);
    }

    // If user found and status is active, unblock
    if (userId && status === "active") {
      await supabase
        .from("profiles")
        .update({ is_blocked: false })
        .eq("user_id", userId);
      console.log("User unblocked:", userId);
    }

    return new Response(JSON.stringify({ success: true, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
