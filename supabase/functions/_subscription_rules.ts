export interface AccessSubscription {
  status: string;
  expires_at?: string | null;
  created_at?: string | null;
}

export function isActiveSubscription(subscription: AccessSubscription, now = Date.now()): boolean {
  return subscription.status === "active" &&
    (!subscription.expires_at || Date.parse(subscription.expires_at) > now);
}

export function preferSubscription<T extends AccessSubscription>(rows: T[], now = Date.now()): T | null {
  return [...rows].sort((a, b) =>
    Number(isActiveSubscription(b, now)) - Number(isActiveSubscription(a, now)) ||
    Date.parse(b.created_at || "1970-01-01") - Date.parse(a.created_at || "1970-01-01")
  )[0] ?? null;
}

export function normalizePaymentEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function paymentStatus(event: unknown): string | null {
  const value = String(event || "").toLowerCase();
  if (["order_approved", "approved", "paid", "completed", "subscription_renewed"].includes(value)) return "active";
  if (["order_refunded", "refunded", "chargedback", "chargeback"].includes(value)) return "refunded";
  if (["subscription_canceled", "canceled", "cancelled"].includes(value)) return "cancelled";
  if (["waiting_payment", "pending", "pix_created", "billet_created"].includes(value)) return "pending";
  return null;
}

export async function kiwifySignature(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}