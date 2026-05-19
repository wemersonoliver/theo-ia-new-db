/**
 * Adiciona dados do usuário como query params na URL de checkout da Kiwify,
 * para que o formulário já venha pré-preenchido.
 * Campos suportados pela Kiwify: email, name, phone_number.
 */
export function buildCheckoutUrl(
  url: string | null | undefined,
  user?: { email?: string | null; user_metadata?: { full_name?: string | null; phone?: string | null } | null } | null
): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const email = user?.email;
    const name = user?.user_metadata?.full_name;
    const phone = user?.user_metadata?.phone;
    if (email && !u.searchParams.get("email")) u.searchParams.set("email", email);
    if (name && !u.searchParams.get("name")) u.searchParams.set("name", name);
    if (phone && !u.searchParams.get("phone_number")) u.searchParams.set("phone_number", phone);
    return u.toString();
  } catch {
    return url;
  }
}
