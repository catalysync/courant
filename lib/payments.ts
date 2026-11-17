import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Stripe integration (raw REST — no SDK dependency).
 *
 * Everything is dormant (fail-closed) until `STRIPE_SECRET_KEY` is set, so the
 * Cloudflare-native stack keeps working with no payment provider. When keys are
 * provided, video rentals/purchases and channel memberships become available.
 */

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const payments = {
  isConfigured(): boolean {
    return !!STRIPE_SECRET;
  },

  async createCheckoutSession(input: {
    amountCents: number;
    currency?: string;
    name: string;
    mode: "payment" | "subscription";
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    interval?: "month" | "year";
  }): Promise<{ url: string; sessionId: string }> {
    if (!STRIPE_SECRET) throw new Error("Stripe is not configured");

    const body = new URLSearchParams();
    body.set("mode", input.mode);
    body.set("success_url", input.successUrl);
    body.set("cancel_url", input.cancelUrl);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", input.currency ?? "usd");
    body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
    body.set("line_items[0][price_data][product_data][name]", input.name);
    if (input.mode === "subscription") {
      body.set("line_items[0][price_data][recurring][interval]", input.interval ?? "month");
    }
    for (const [k, v] of Object.entries(input.metadata)) {
      body.set(`metadata[${k}]`, v);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const json = (await res.json()) as {
      url?: string;
      id?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.url) {
      throw new Error(json.error?.message ?? "Stripe checkout failed");
    }
    return { url: json.url, sessionId: json.id! };
  },

  /** Verify a Stripe webhook signature (`Stripe-Signature: t=...,v1=...`). */
  verifyWebhook(rawBody: string, signature: string | null): boolean {
    if (!STRIPE_WEBHOOK_SECRET || !signature) return false;
    const parts = Object.fromEntries(
      signature.split(",").map((pair) => {
        const i = pair.indexOf("=");
        return [pair.slice(0, i), pair.slice(i + 1)];
      }),
    );
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return false;
    const mac = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
      .update(`${t}.${rawBody}`)
      .digest("hex");
    try {
      return timingSafeEqual(Buffer.from(mac), Buffer.from(v1));
    } catch {
      return false;
    }
  },
};