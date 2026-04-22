import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Verifica que quem chama é super_admin
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

    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      throw new Error("userId is required");
    }

    if (userId === callerId) {
      throw new Error("Não é necessário impersonar a si mesmo");
    }

    // Busca dados do alvo
    const { data: target, error: targetErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (targetErr || !target?.user?.email) {
      throw new Error("Usuário alvo não encontrado ou sem email");
    }

    const targetEmail = target.user.email;

    // Gera magic link e extrai hashed_token (não envia email; só usamos o token)
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      throw new Error(linkErr?.message || "Falha ao gerar token de acesso");
    }

    // Log de auditoria simples no console (visível em logs da função)
    console.log(
      JSON.stringify({
        event: "impersonation_started",
        admin_user_id: callerId,
        target_user_id: userId,
        target_email: targetEmail,
        at: new Date().toISOString(),
      }),
    );

    return new Response(
      JSON.stringify({
        hashed_token: linkData.properties.hashed_token,
        email: targetEmail,
        target_user_id: userId,
        target_full_name: (target.user.user_metadata as Record<string, unknown> | null)?.full_name ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});