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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;

    if (authError || !callerId || typeof callerId !== "string") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, userId, password, subscriptionData, profileData } = await req.json();

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
          feature_keyword_triggers: profile?.feature_keyword_triggers || false,
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

    if (action === "toggle_feature_keyword_triggers") {
      if (!userId) throw new Error("userId required");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("feature_keyword_triggers")
        .eq("user_id", userId)
        .maybeSingle();

      const newStatus = !(profile?.feature_keyword_triggers || false);

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ feature_keyword_triggers: newStatus })
        .eq("user_id", userId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, feature_keyword_triggers: newStatus }), {
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

    if (action === "update_profile") {
      if (!userId || !profileData) throw new Error("userId and profileData required");
      
      const updates: Record<string, unknown> = {};
      if (profileData.full_name !== undefined) updates.full_name = profileData.full_name;
      if (profileData.phone !== undefined) updates.phone = profileData.phone;
      if (profileData.email !== undefined) updates.email = profileData.email;
      
      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update(updates)
          .eq("user_id", userId);
        if (error) throw error;
      }

      // Also update email in auth if changed
      if (profileData.email) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { email: profileData.email });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      if (!userId) throw new Error("userId required");
      
      // Prevent deleting super_admins
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();
      
      if (targetRole) {
        throw new Error("Não é possível excluir um super administrador");
      }

      // Delete related data in order
      await supabaseAdmin.from("subscriptions").delete().eq("user_id", userId);
      await supabaseAdmin.from("whatsapp_ai_sessions").delete().eq("user_id", userId);
      await supabaseAdmin.from("whatsapp_pending_responses").delete().eq("user_id", userId);
      await supabaseAdmin.from("whatsapp_conversations").delete().eq("user_id", userId);
      await supabaseAdmin.from("whatsapp_ai_config").delete().eq("user_id", userId);
      await supabaseAdmin.from("whatsapp_instances").delete().eq("user_id", userId);
      await supabaseAdmin.from("notification_contacts").delete().eq("user_id", userId);
      await supabaseAdmin.from("knowledge_base_documents").delete().eq("user_id", userId);
      await supabaseAdmin.from("platform_settings").delete().eq("user_id", userId);
      await supabaseAdmin.from("contacts").delete().eq("user_id", userId);
      await supabaseAdmin.from("followup_config").delete().eq("user_id", userId);
      await supabaseAdmin.from("followup_tracking").delete().eq("user_id", userId);
      await supabaseAdmin.from("entrevistas_config").delete().eq("user_id", userId);
      await supabaseAdmin.from("appointment_slots").delete().eq("user_id", userId);
      await supabaseAdmin.from("appointment_types").delete().eq("user_id", userId);
      await supabaseAdmin.from("appointments").delete().eq("user_id", userId);
      await supabaseAdmin.from("products").delete().eq("user_id", userId);
      
      // Delete CRM data
      const { data: deals } = await supabaseAdmin.from("crm_deals").select("id").eq("user_id", userId);
      if (deals && deals.length > 0) {
        const dealIds = deals.map(d => d.id);
        await supabaseAdmin.from("crm_deal_products").delete().in("deal_id", dealIds);
        await supabaseAdmin.from("crm_activities").delete().in("deal_id", dealIds);
      }
      await supabaseAdmin.from("crm_deals").delete().eq("user_id", userId);
      await supabaseAdmin.from("crm_stages").delete().eq("user_id", userId);
      await supabaseAdmin.from("crm_pipelines").delete().eq("user_id", userId);

      // Delete admin CRM deal referencing this user
      await supabaseAdmin.from("admin_crm_deals").delete().eq("user_ref_id", userId);

      // Delete support tickets
      const { data: tickets } = await supabaseAdmin.from("support_tickets").select("id").eq("user_id", userId);
      if (tickets && tickets.length > 0) {
        const ticketIds = tickets.map(t => t.id);
        await supabaseAdmin.from("support_ticket_messages").delete().in("ticket_id", ticketIds);
      }
      await supabaseAdmin.from("support_tickets").delete().eq("user_id", userId);

      // Delete role and profile
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

      // Finally delete auth user
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
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
