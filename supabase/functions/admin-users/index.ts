import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) throw new Error("Unauthorized");

    // Check super_admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, userId, password, subscriptionData } = await req.json();

    if (action === "list_users") {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      // Get profiles, roles and subscriptions
      const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
      const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
      const { data: subscriptions } = await supabaseAdmin.from("subscriptions").select("*");

      const enrichedUsers = users.map((u) => {
        const profile = profiles?.find((p) => p.user_id === u.id);
        const userRoles = roles?.filter((r) => r.user_id === u.id).map((r) => r.role) || [];
        const userSub = subscriptions?.find((s) => s.user_id === u.id && s.status === "active");
        return {
          id: u.id,
          email: u.email,
          full_name: profile?.full_name || "",
          phone: profile?.phone || "",
          user_code: profile?.user_code || null,
          is_blocked: profile?.is_blocked || false,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          roles: userRoles,
          subscription: userSub ? {
            id: userSub.id,
            status: userSub.status,
            plan_type: userSub.plan_type,
            product_name: userSub.product_name,
            expires_at: userSub.expires_at,
          } : null,
        };
      });

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_password") {
      if (!userId || !password) throw new Error("userId and password required");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_block") {
      if (!userId) throw new Error("userId required");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("is_blocked")
        .eq("user_id", userId)
        .maybeSingle();

      const newStatus = !(profile?.is_blocked || false);

      await supabaseAdmin
        .from("profiles")
        .update({ is_blocked: newStatus })
        .eq("user_id", userId);

      // Also ban/unban in auth
      if (newStatus) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "876600h" });
      } else {
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      }

      return new Response(JSON.stringify({ success: true, is_blocked: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "grant_subscription") {
      if (!userId || !subscriptionData) throw new Error("userId and subscriptionData required");
      
      // Deactivate existing active subscriptions
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "inactive" })
        .eq("user_id", userId)
        .eq("status", "active");

      // Get user email
      const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          user_id: userId,
          status: "active",
          plan_type: subscriptionData.plan_type || "tester",
          product_name: subscriptionData.product_name || "Acesso Tester",
          customer_email: targetUser?.email || "",
          customer_name: subscriptionData.customer_name || "",
          started_at: new Date().toISOString(),
          expires_at: subscriptionData.expires_at || null,
          amount_cents: 0,
        });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "revoke_subscription") {
      if (!userId) throw new Error("userId required");
      
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ status: "inactive", cancelled_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "active");
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
