import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth";

/**
 * Cloudflare Turnstile bot protection for email sign-in / sign-up.
 *
 * - No-op unless the `TURNSTILE_SECRET` worker secret is set, so it can never
 *   break authentication in dev / before the key is configured.
 * - When a secret IS set and the request carries a `turnstileToken`, the token
 *   is verified server-side via the Turnstile verify endpoint. An invalid token
 *   rejects the request; verification network errors fail open (MVP).
 */
export const turnstilePlugin: BetterAuthPlugin = {
  id: "turnstile",
  hooks: {
    before: [
      {
        matcher: (ctx: any) =>
          ctx.path === "/sign-in/email" || ctx.path === "/sign-up/email",
        handler: async (ctx: any) => {
          const secret = process.env.TURNSTILE_SECRET;
          const token: string | undefined = ctx?.body?.turnstileToken;
          if (!secret || !token) return; // not configured / no token -> allow
          try {
            const res = await fetch(
              "https://challenges.cloudflare.com/turnstile/v0/verify",
              {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
              },
            );
            const data = (await res.json()) as { success?: boolean };
            if (!data?.success) {
              throw new APIError("UNAUTHORIZED", {
                message: "Turnstile verification failed",
              });
            }
          } catch (e) {
            if (e instanceof APIError) throw e;
            // network / other errors: fail open for MVP
          }
        },
      },
    ],
  },
};