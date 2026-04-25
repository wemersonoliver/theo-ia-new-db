import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd + "!9";
}

// Padrão: primeiro nome (minúsculo, sem acentos) + @ + 4 últimos dígitos do telefone
function buildMemberPassword(fullName: string, phoneDigits: string): string {
  const first = (fullName || "user")
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase() || "user";
  const digits = (phoneDigits || "").replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "0");
  return `${first}@${last4}`;
}

async function sendSystemWhatsApp(admin: any, phone: string, text: string): Promise<void> {
  const { data: sysInstance } = await admin
    .from("system_whatsapp_instance")
    .select("instance_name, status")
    .maybeSingle();

  if (!sysInstance || sysInstance.status !== "connected") {
    console.error("[team-manage] system whatsapp not connected");
    return;
  }

  const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

  if (!evolutionUrl || !evolutionKey) {
    console.error("[team-manage] Evolution API not configured");
    return;
  }

  const res = await evolutionRequest({
    evolutionUrl,
    evolutionKey,
    path: `/message/sendText/${sysInstance.instance_name}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, text }),
  });

  if (!res.ok) {
    console.error(`[team-manage] evolution send failed: status=${res.status} body=${res.text}`);
  } else {
    console.log(`[team-manage] whatsapp enviado para ${phone}`);
  }
}

async function getPlanLimit(admin: any, accountId: string): Promise<number> {
  // Limite por assinatura ativa da conta
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan_type, status")
    .eq("account_id", accountId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = (sub?.plan_type || "trial").toLowerCase();
  if (plan.includes("anual") || plan.includes("annual")) return 10;
  if (plan.includes("mensal") || plan.includes("monthly")) return 3;
  // trial / sem assinatura
  return 2;
}

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
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

    const body = await req.json();
    const { action } = body;

    // Resolve account: o caller precisa ser owner de uma account
    const { data: account, error: accErr } = await admin
      .from("accounts")
      .select("id, owner_user_id, name")
      .eq("owner_user_id", callerId)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(JSON.stringify({ error: "Você não é dono de nenhuma conta." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== INVITE ==========
    if (action === "invite") {
      const { full_name, phone, email, role, permissions } = body;
      if (!full_name || !phone || !role || !email) {
        return new Response(JSON.stringify({ error: "Nome, telefone, email e papel são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Valida formato de email
      const emailTrimmed = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        return new Response(JSON.stringify({ error: "Informe um email válido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (emailTrimmed.endsWith(".theoia.local")) {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["manager", "seller", "agent"].includes(role)) {
        return new Response(JSON.stringify({ error: "Papel inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Checar limite do plano
      const limit = await getPlanLimit(admin, account.id);
      const { count } = await admin
        .from("account_members")
        .select("id", { count: "exact", head: true })
        .eq("account_id", account.id)
        .neq("role", "owner")
        .neq("status", "removed");

      if ((count ?? 0) >= limit) {
        return new Response(
          JSON.stringify({
            error: `Limite do plano atingido (${limit} membros). Faça upgrade para adicionar mais.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const normalizedPhone = normalizePhone(phone);
      const memberEmail = emailTrimmed;
      const provisionalPassword = buildMemberPassword(full_name, normalizedPhone);

      // Marca o email como convite de equipe ANTES de criar no Auth
      // para que o trigger notify_admins_on_new_user pule esse cadastro
      await admin.from("team_invite_markers").upsert(
        { email: memberEmail, created_at: new Date().toISOString() },
        { onConflict: "email" }
      );

      // Cria usuário no Auth
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: memberEmail,
        password: provisionalPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message || "Erro ao criar usuário" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newUserId = created.user.id;

      // Atualiza profile com phone (e remove a account criada automaticamente para esse user, se houver)
      await admin.from("profiles").update({ phone: normalizedPhone, full_name }).eq("user_id", newUserId);
      // Remove account própria do convidado (criada pelo trigger) e seu vínculo de owner
      const { data: ownAcc } = await admin
        .from("accounts")
        .select("id")
        .eq("owner_user_id", newUserId)
        .maybeSingle();
      if (ownAcc) {
        await admin.from("account_members").delete().eq("account_id", ownAcc.id);
        await admin.from("accounts").delete().eq("id", ownAcc.id);
      }

      // Cria vínculo na conta do owner
      const { error: memberErr } = await admin.from("account_members").insert({
        account_id: account.id,
        user_id: newUserId,
        role,
        permissions: permissions || {},
        status: "active",
        invited_by: callerId,
        must_change_password: true,
      });

      if (memberErr) {
        await admin.auth.admin.deleteUser(newUserId);
        return new Response(JSON.stringify({ error: memberErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Tenta enviar mensagem por WhatsApp com credenciais
      try {
        const message =
          `Olá ${full_name}! 👋\n\n` +
          `Você foi convidado(a) para fazer parte da equipe *${account.name}* no Theo IA.\n\n` +
          `🔑 *Acesse:* https://theoia.com.br/login\n` +
          `📧 *Email:* ${memberEmail}\n` +
          `🔒 *Senha provisória:* ${provisionalPassword}\n\n` +
          `🔐 No primeiro acesso, você será solicitado(a) a *criar uma nova senha*.`;

        await sendSystemWhatsApp(admin, normalizedPhone, message);
      } catch (e) {
        console.error("[team-manage] erro ao enviar whatsapp", e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUserId,
          email: memberEmail,
          provisional_password: provisionalPassword,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== UPDATE ==========
    if (action === "update") {
      const { member_id, role, permissions, status, full_name, phone, email } = body;
      if (!member_id) {
        return new Response(JSON.stringify({ error: "member_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: m } = await admin
        .from("account_members")
        .select("id, account_id, role, user_id")
        .eq("id", member_id)
        .maybeSingle();

      if (!m || m.account_id !== account.id) {
        return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (m.role === "owner") {
        return new Response(JSON.stringify({ error: "Não é possível alterar o dono" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, unknown> = {};
      if (role && ["manager", "seller", "agent"].includes(role)) updates.role = role;
      if (permissions !== undefined) updates.permissions = permissions;
      if (status && ["active", "suspended"].includes(status)) updates.status = status;

      if (Object.keys(updates).length > 0) {
        const { error } = await admin.from("account_members").update(updates).eq("id", member_id);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Atualiza profile (nome / telefone)
      const profileUpdates: Record<string, unknown> = {};
      if (typeof full_name === "string" && full_name.trim().length > 0) {
        profileUpdates.full_name = full_name.trim();
      }
      if (typeof phone === "string" && phone.trim().length > 0) {
        profileUpdates.phone = normalizePhone(phone);
      }
      if (Object.keys(profileUpdates).length > 0) {
        await admin.from("profiles").update(profileUpdates).eq("user_id", m.user_id);
        if (profileUpdates.full_name) {
          await admin.auth.admin.updateUserById(m.user_id, {
            user_metadata: { full_name: profileUpdates.full_name },
          });
        }
      }

      // Atualiza email no auth + profile
      if (typeof email === "string" && email.trim().length > 0) {
        const emailTrimmed = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrimmed) || emailTrimmed.endsWith(".theoia.local")) {
          return new Response(JSON.stringify({ error: "Informe um email válido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: emailErr } = await admin.auth.admin.updateUserById(m.user_id, {
          email: emailTrimmed,
          email_confirm: true,
        });
        if (emailErr) {
          return new Response(JSON.stringify({ error: emailErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await admin.from("profiles").update({ email: emailTrimmed }).eq("user_id", m.user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== REMOVE ==========
    if (action === "remove") {
      const { member_id } = body;
      if (!member_id) {
        return new Response(JSON.stringify({ error: "member_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: m } = await admin
        .from("account_members")
        .select("id, account_id, user_id, role")
        .eq("id", member_id)
        .maybeSingle();

      if (!m || m.account_id !== account.id) {
        return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (m.role === "owner") {
        return new Response(JSON.stringify({ error: "Não é possível remover o dono" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("account_members").update({ status: "removed" }).eq("id", member_id);
      // Bane o usuário no auth para impedir login
      await admin.auth.admin.updateUserById(m.user_id, { ban_duration: "876600h" });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== RESET PASSWORD ==========
    if (action === "reset_password") {
      const { member_id } = body;
      const { data: m } = await admin
        .from("account_members")
        .select("id, account_id, user_id, role")
        .eq("id", member_id)
        .maybeSingle();

      if (!m || m.account_id !== account.id || m.role === "owner") {
        return new Response(JSON.stringify({ error: "Membro inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newPwd = randomPassword();
      await admin.auth.admin.updateUserById(m.user_id, { password: newPwd });

      // Marca para forçar troca de senha no próximo acesso
      await admin
        .from("account_members")
        .update({ must_change_password: true })
        .eq("id", member_id);

      // Envia nova senha via WhatsApp
      const { data: prof } = await admin
        .from("profiles")
        .select("phone, full_name, email")
        .eq("user_id", m.user_id)
        .maybeSingle();

      if (prof?.phone) {
        try {
          const msg = `🔒 *Nova senha provisória*\n\nOlá ${prof.full_name || ""}! Sua nova senha de acesso ao Theo IA é:\n\n*${newPwd}*\n\nAcesse em https://theoia.com.br/login`;
          await sendSystemWhatsApp(admin, normalizePhone(prof.phone), msg);
        } catch (e) {
          console.error("[team-manage] erro whatsapp reset", e);
        }
      }

      return new Response(JSON.stringify({ success: true, new_password: newPwd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[team-manage] erro", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});