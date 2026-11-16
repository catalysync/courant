import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * D1 + Drizzle, resolved lazily. In Cloudflare Workers the D1 binding is only available
 * inside request handling (via OpenNext's `getCloudflareContext`), so we memoise the client
 * on first use instead of at module load. `database` is a Proxy that delegates to the real
 * client, so existing `database.select()...` call sites keep working unchanged.
 */

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;

export function getDatabase(): Database {
  if (instance) return instance;
  const ctx = getCloudflareContext();
  const binding = (ctx?.env?.DB ?? (process.env as Record<string, unknown>).DB) as
    | D1Database
    | undefined;
  if (!binding) {
    throw new Error(
      "D1 binding `DB` is not available. Ensure the `DB` binding is defined in wrangler.jsonc.",
    );
  }
  instance = drizzle(binding, { schema });
  return instance;
}

export const database = new Proxy({} as Database, {
  get(_target, prop) {
    const db = getDatabase();
    const value = Reflect.get(db, prop, db) as unknown;
    return typeof value === "function" ? value.bind(db) : value;
  },
});

export { schema };