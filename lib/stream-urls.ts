/**
 * Client-safe Cloudflare Stream URL helpers. Kept separate from lib/stream.ts (which imports
 * `node:crypto` and is server-only) so the player can build into the client bundle.
 */

export const STREAM_CUSTOMER_CODE = process.env.NEXT_PUBLIC_STREAM_CUSTOMER_CODE ?? "";

export function hlsUrl(uid: string): string {
  return `https://customer-${STREAM_CUSTOMER_CODE}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

export function thumbnailUrl(uid: string, time = "0s"): string {
  return `https://customer-${STREAM_CUSTOMER_CODE}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=${time}`;
}

export function previewUrl(uid: string): string {
  return `https://customer-${STREAM_CUSTOMER_CODE}.cloudflarestream.com/${uid}/thumbnails/thumbnail.gif`;
}