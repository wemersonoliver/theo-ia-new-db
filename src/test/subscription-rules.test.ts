import { describe, expect, it } from "vitest";
import { isActiveSubscription, preferSubscription, normalizePaymentEmail, paymentStatus, kiwifySignature } from "../../supabase/functions/_subscription_rules";

describe("payment access rules", () => {
  const now = Date.parse("2026-11-15T00:35:00Z");
  it("recognizes a paid order", () => expect(paymentStatus("order_approved")).toBe("active"));
  it("never treats an unknown event as a cancellation", () => expect(paymentStatus("test" )).toBeNull());
  it("normalizes only casing and spaces, never merges different emails", () => {
    expect(normalizePaymentEmail(" Marcio@Example.com ")).toBe("marcio@example.com");
    expect(normalizePaymentEmail("marcio@hotmail.com")).not.toBe(normalizePaymentEmail("marcio@gmail.com"));
  });
  it("keeps manual access with no expiry valid", () => expect(isActiveSubscription({ status: "active", expires_at: null }, now)).toBe(true));
  it("does not recognize an expired active record", () => expect(isActiveSubscription({ status: "active", expires_at: "2026-11-14T00:00:00Z" }, now)).toBe(false));
  it("does not let a newer pending order hide paid access", () => {
    expect(preferSubscription([{ status: "active", created_at: "2026-11-01" }, { status: "pending", created_at: "2026-11-14" }], now)?.status).toBe("active");
  });
  it("matches the official Kiwify HMAC-SHA1 test vector", async () => {
    const body = '{"order_id":"9b1c2d3e-0000-4000-8000-000000000001","order_status":"paid","webhook_event_type":"order_approved"}';
    expect(await kiwifySignature("kiwify-token-de-teste", body)).toBe("bf18f352a4f981b91dfa3f6d8742a81080ab8c86");
  });
});