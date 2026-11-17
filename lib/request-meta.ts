import "server-only";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Extract viewer geo/device/referrer for analytics, from CF headers + UA. */
export async function getRequestMeta(): Promise<{
  country: string | null;
  device: string | null;
  referrer: string | null;
}> {
  const h = await headers();

  let country: string | null = null;
  try {
    const ctx = getCloudflareContext();
    country = ctx?.cf?.country ?? h.get("cf-ipcountry") ?? null;
  } catch {
    country = h.get("cf-ipcountry") ?? null;
  }

  const referrerRaw = h.get("referer") ?? null;
  let referrer: string | null = null;
  if (referrerRaw) {
    try {
      referrer = new URL(referrerRaw).hostname || null;
    } catch {
      referrer = null;
    }
  }

  return { country, device: deviceFromUA(h.get("user-agent")), referrer };
}

function deviceFromUA(ua: string | null): string {
  if (!ua) return "unknown";
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "tablet";
  if (/mobile|iphone|android|windows phone/.test(u)) return "mobile";
  if (/bot|crawl|spider|headless/.test(u)) return "bot";
  return "desktop";
}