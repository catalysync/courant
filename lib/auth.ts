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

export const auth = betterAuth({
  appName: "Courant",
  baseURL: appOrigin,
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: [appOrigin],
  database: drizzleAdapter(getDatabase(), { provider: "sqlite", schema }),
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
  advanced: {
    // Cookies survive the Next.js -> Workers boundary; Secure is forced in production.
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
});