import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KIWIFY_API_BASE = "https://public-api.kiwify.com/v1";

async function getKiwifyToken(): Promise<string> {
  const clientId = Deno.env.get("KIWIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("KIWIFY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("KIWIFY_CLIENT_ID ou KIWIFY_CLIENT_SECRET não configurados");
  }

  const response = await fetch(`${KIWIFY_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Kiwify OAuth error: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function fetchKiwifySales(
  token: string,
  accountId: string,
  startDate: string,
  endDate: string,
  pageNumber = 1
) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    page_number: String(pageNumber),
    page_size: "100",
  });

  const response = await fetch(`${KIWIFY_API_BASE}/sales?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-kiwify-account-id": accountId,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Kiwify API error: ${JSON.stringify(data)}`);
  }

  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const accountId = Deno.env.get("KIWIFY_ACCOUNT_ID");

    if (!accountId) {
      throw new Error("KIWIFY_ACCOUNT_ID não configurado");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const token = await getKiwifyToken();

    // Sync last 30 days
    const endDate = new Date().toISOString().split("T")[0] + " 23:59:59";
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - 30);
    const startDate = startDateObj.toISOString().split("T")[0] + " 00:00:00";

    console.log(`Syncing Kiwify sales from ${startDate} to ${endDate}`);

    let page = 1;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      const salesData = await fetchKiwifySales(token, accountId, startDate, endDate, page);
      const sales = salesData.data || salesData.results || [];

      if (sales.length === 0) {
        hasMore = false;
        break;
      }

      for (const sale of sales) {
        const orderId = sale.order_id || sale.id;
        const customerEmail = sale.Customer?.email || sale.customer?.email;
        const customerName = sale.Customer?.full_name || sale.customer?.full_name;
        const customerPhone = sale.Customer?.mobile || sale.customer?.mobile;
        const productId = sale.Product?.id || sale.product?.id;
        const productName = sale.Product?.name || sale.product?.name;
        const saleStatus = (sale.order_status || sale.status || "").toLowerCase();

        let status = "inactive";
        if (saleStatus === "paid" || saleStatus === "approved" || saleStatus === "completed") {
          status = "active";
        } else if (saleStatus === "refunded" || saleStatus === "chargedback") {
          status = "refunded";
        } else if (saleStatus === "canceled" || saleStatus === "cancelled") {
          status = "cancelled";
        } else if (saleStatus === "waiting_payment" || saleStatus === "pending") {
          status = "pending";
        }

        // Find user by email
        let userId = "00000000-0000-0000-0000-000000000000";
        if (customerEmail) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", customerEmail)
            .maybeSingle();
          if (profile) userId = profile.user_id;
        }

        const amountCents = sale.Commissions?.charge_amount
          ? Math.round(parseFloat(sale.Commissions.charge_amount) * 100)
          : null;

        // Upsert
        const { data: existing } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("kiwify_order_id", orderId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("subscriptions")
            .update({
              status,
              product_name: productName,
              customer_email: customerEmail,
              customer_name: customerName,
              customer_phone: customerPhone,
              raw_data: sale,
              ...(userId !== "00000000-0000-0000-0000-000000000000" && { user_id: userId }),
            })
            .eq("kiwify_order_id", orderId);
        } else {
          await supabase.from("subscriptions").insert({
            user_id: userId,
            kiwify_order_id: orderId,
            kiwify_product_id: productId,
            product_name: productName,
            customer_email: customerEmail,
            customer_name: customerName,
            customer_phone: customerPhone,
            status,
            amount_cents: amountCents,
            raw_data: sale,
            started_at: status === "active" ? sale.created_at || new Date().toISOString() : null,
          });
        }

        // Update profile blocked status
        if (userId !== "00000000-0000-0000-0000-000000000000") {
          const isBlocked = status !== "active" && status !== "pending";
          await supabase
            .from("profiles")
            .update({ is_blocked: isBlocked })
            .eq("user_id", userId);
        }

        totalSynced++;
      }

      // Check pagination
      const pagination = salesData.pagination || {};
      if (pagination.next_page || sales.length >= 100) {
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`Sync complete. ${totalSynced} sales processed.`);

    return new Response(
      JSON.stringify({ success: true, total_synced: totalSynced }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
