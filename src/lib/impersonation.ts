import { supabase } from "@/integrations/supabase/client";
import { clearAccountContextCache } from "@/lib/account-context";

const BACKUP_KEY = "impersonation_admin_backup";
const TARGET_KEY = "impersonation_target";

export interface ImpersonationTarget {
  user_id: string;
  email: string;
  full_name: string | null;
  started_at: string;
}

interface AdminBackup {
  access_token: string;
  refresh_token: string;
  admin_user_id: string;
  admin_email: string | null;
}

export function getImpersonationTarget(): ImpersonationTarget | null {
  try {
    const raw = localStorage.getItem(TARGET_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationTarget) : null;
  } catch {
    return null;
  }
}

export function isImpersonating(): boolean {
  return !!localStorage.getItem(TARGET_KEY) && !!localStorage.getItem(BACKUP_KEY);
}

/**
 * Inicia a impersonação:
 * 1. Faz backup da sessão atual do super admin.
 * 2. Pede um hashed_token ao backend.
 * 3. Verifica o token e troca a sessão para o usuário alvo.
 */
export async function startImpersonation(targetUserId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const current = sessionData.session;
  if (!current) throw new Error("Você precisa estar logado como super admin.");

  const { data, error } = await supabase.functions.invoke("admin-impersonate", {
    body: { userId: targetUserId },
  });
  if (error) throw new Error(error.message || "Falha ao iniciar acesso");
  if (!data?.hashed_token || !data?.email) throw new Error("Resposta inválida do servidor");

  // Backup ANTES de trocar a sessão
  const backup: AdminBackup = {
    access_token: current.access_token,
    refresh_token: current.refresh_token,
    admin_user_id: current.user.id,
    admin_email: current.user.email ?? null,
  };
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));

  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.hashed_token,
  });

  if (verifyErr) {
    localStorage.removeItem(BACKUP_KEY);
    throw new Error(verifyErr.message || "Falha ao trocar sessão");
  }

  const target: ImpersonationTarget = {
    user_id: data.target_user_id,
    email: data.email,
    full_name: data.target_full_name ?? null,
    started_at: new Date().toISOString(),
  };
  localStorage.setItem(TARGET_KEY, JSON.stringify(target));
  clearAccountContextCache();
}

/**
 * Encerra a impersonação e restaura a sessão original do super admin.
 */
export async function stopImpersonation(): Promise<void> {
  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw) {
    // Sem backup: apenas faz signOut.
    localStorage.removeItem(TARGET_KEY);
    await supabase.auth.signOut();
    return;
  }

  const backup = JSON.parse(raw) as AdminBackup;
  localStorage.removeItem(TARGET_KEY);
  localStorage.removeItem(BACKUP_KEY);
  clearAccountContextCache();

  const { error } = await supabase.auth.setSession({
    access_token: backup.access_token,
    refresh_token: backup.refresh_token,
  });

  if (error) {
    // Se a sessão original expirou, faz logout completo
    await supabase.auth.signOut();
    throw new Error("Sua sessão de admin expirou. Faça login novamente.");
  }
}