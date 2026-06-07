// Shared helper to authenticate internal/cron callers.
// The pg_cron jobs and trusted edge functions pass `x-internal-key: <INTERNAL_CRON_SECRET>`.
// If the secret is not configured on the project, the check is bypassed so the
// platform keeps working until the operator finishes the migration.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

/**
 * Returns a 401 Response when the caller is not authorized.
 * Returns null when the caller is allowed (either the secret matches or no
 * INTERNAL_CRON_SECRET is configured yet — fail-open during rollout).
 */
export function requireInternalKey(req: Request): Response | null {
  const expected = Deno.env.get("INTERNAL_CRON_SECRET");
  if (!expected) return null; // not configured yet → allow
  const provided = req.headers.get("x-internal-key");
  if (provided && timingSafeEqual(provided, expected)) return null;
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Allows the caller if EITHER a valid internal key is provided OR the request
 * carries a valid Supabase JWT (any signed-in user). Used by functions that
 * are called both from pg_cron and from the authenticated frontend (e.g. kiwify-sync).
 */
export async function requireInternalKeyOrJwt(req: Request): Promise<Response | null> {
  const expected = Deno.env.get("INTERNAL_CRON_SECRET");
  if (expected) {
    const provided = req.headers.get("x-internal-key");
    if (provided && timingSafeEqual(provided, expected)) return null;
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const client = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data, error } = await client.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (!error && data?.claims?.sub) return null;
    } catch (_) { /* fall through */ }
  }

  if (!expected) return null; // nothing configured, fail-open
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}