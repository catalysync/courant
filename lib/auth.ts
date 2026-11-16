import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDatabase } from "@/database";
import * as schema from "@/database/schema";

/**
 * Better Auth (self-hosted) on D1. Replaces Clerk. There is no webhook-sync; users, sessions
 * and accounts live directly in this D1 database via the Drizzle adapter.
 */

const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const socialProviders: Record<string, unknown> = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    prompt: "select_account",
  };
}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

/** Comma/space-separated list of emails promoted to admin at account creation. */
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+$/.test(e)),
);

export const auth = betterAuth({
  appName: "Courant",
  baseURL: appOrigin,
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: [appOrigin],
  // Lazy: getDatabase() resolves the D1 binding via getCloudflareContext(), which is only
  // available at request time (not during `next build` page-data collection).
  database: () => drizzleAdapter(getDatabase(), { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  socialProviders,
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: true },
      role: { type: "string", required: false, defaultValue: "user", input: false },
      bannerUrl: { type: "string", required: false, input: false },
      bannerKey: { type: "string", required: false, input: false },
    },
    deleteUser: { enabled: true },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = String(user.email ?? "").toLowerCase();
          return {
            data: {
              ...user,
              email,
              // Never admin at creation unless the email is in ADMIN_EMAILS.
              role: adminEmails.has(email) ? "admin" : "user",
            },
          };
        },
      },
    },
  },
  advanced: {
    // Cookies survive the Next.js -> Workers boundary; Secure is forced in production.
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
});