import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export { hlsUrl, thumbnailUrl, previewUrl, STREAM_CUSTOMER_CODE } from "./stream-urls";

/**
 * Minimal Cloudflare Stream client (REST API) + webhook verification. Server-only.
 *
 * Requires:
 *  - CF_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID)
 *  - CF_API_TOKEN (or STREAM_API_TOKEN / CLOUDFLARE_API_TOKEN)
 */

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN =
  process.env.STREAM_API_TOKEN ?? process.env.CF_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;

export type StreamUpload = {
  uploadURL: string;
  uid: string;
};

export type StreamVideo = {
  uid: string;
  status?: {
    state: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  duration?: number;
  thumbnail?: string;
  thumbnailTimestampPct?: number;
  playback?: { hls?: string };
  creator?: string | null;
};

async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error("Cloudflare Stream is not configured (CF_ACCOUNT_ID / CF_API_TOKEN).");
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    },
  );
  const body = (await res.json()) as { success: boolean; errors: unknown[]; result: unknown };
  if (!res.ok || body.success !== true) {
    throw new Error(`Stream API ${path} failed: ${JSON.stringify(body.errors)}`);
  }
  return body.result;
}

export const stream = {
  /** Create a TUS direct-upload session. Returns a one-time uploadURL and the video uid. */
  async directUpload(input: { maxDurationSeconds?: number; creator?: string } = {}) {
    const result = (await api("/direct_upload", {
      method: "POST",
      body: JSON.stringify({
        maxDurationSeconds: input.maxDurationSeconds ?? 3600,
        creator: input.creator,
      }),
    })) as StreamUpload;
    return result;
  },

  async getVideo(uid: string): Promise<StreamVideo | null> {
    try {
      return (await api(`/${uid}`)) as StreamVideo;
    } catch {
      return null;
    }
  },

  async deleteVideo(uid: string): Promise<void> {
    await api(`/${uid}`, { method: "DELETE" });
  },
};

/** Verify a Cloudflare Stream webhook signature (`Webhook-Signature: time=...,sig1=...`). */
export function verifyStreamWebhook(
  rawBody: string,
  headerValue: string | null,
  secret: string,
): boolean {
  if (!headerValue) return false;
  const parts = Object.fromEntries(
    headerValue.split(",").map((pair) => {
      const i = pair.indexOf("=");
      return [pair.slice(0, i).trim(), pair.slice(i + 1).trim()];
    }),
  );
  const time = parts.time;
  const sig = parts.sig1;
  if (!time || !sig) return false;

  const mac = createHmac("sha256", secret).update(`${time}.${rawBody}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(mac), Buffer.from(sig));
  } catch {
    return false;
  }
}