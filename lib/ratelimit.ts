import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Per-user rate limiting via the Cloudflare Workers Rate Limiting binding `RL_GENERAL`
 * (a sliding window, configured in wrangler.jsonc). Falls back to "allow" in local dev
 * where the binding is not present.
 */
export async function rateLimit(key: string): Promise<boolean> {
  const ctx = getCloudflareContext();
  const binding = ctx?.env?.RL_GENERAL as
    | { limit(opts: { key: string }): Promise<{ success: boolean }> }
    | undefined;

  if (!binding) return true;

  const { success } = await binding.limit({ key });
  return success;
}