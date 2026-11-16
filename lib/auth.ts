import { betterAuth, type BetterAuthOptions } from "better-auth";
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

// ---------------------------------------------------------------------------
// PBKDF2 password hashing via WebCrypto. Better Auth's default `scrypt` resolves
// to `node:crypto scrypt` under the `workerd` export condition, which Cloudflare
// Workers does not implement, so we provide a Workers-safe hasher here.
// ---------------------------------------------------------------------------
const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000;

function toB64(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(encoder.encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}:${toB64(salt)}:${toB64(hash)}`;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const [iterations, saltB64, hashB64] = hash.split(":");
  const iters = Number(iterations);
  if (!iters || !saltB64 || !hashB64) return false;
  const salt = fromB64(saltB64);
  const expected = fromB64(hashB64);
  const actual = await derive(password, salt, iters);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export const auth = betterAuth({
  appName: "Courant",
  baseURL: appOrigin,
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: [appOrigin],
  // Lazy: getDatabase() resolves the D1 binding via getCloudflareContext(), which is only
  // available at request time (not during `next build` page-data collection).
  // NOTE: drizzleAdapter(db, config) returns a *function* `(options) => adapter` in
  // better-auth >= 1.7.15, so we invoke it with the options Better Auth passes in.
  database: (options: BetterAuthOptions) =>
    drizzleAdapter(getDatabase(), { provider: "sqlite", schema })(options),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
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