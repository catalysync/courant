import { getCloudflareContext } from "@opennextjs/cloudflare";

/** R2 binding (`USER_FILES`) resolved lazily via OpenNext. */

function getBucket(): R2Bucket {
  const ctx = getCloudflareContext();
  const bucket = ctx?.env?.USER_FILES;
  if (!bucket) throw new Error("R2 `USER_FILES` binding is not available");
  return bucket;
}

export async function r2Put(
  key: string,
  value: ArrayBuffer | Uint8Array | ReadableStream,
  contentType: string,
): Promise<void> {
  await getBucket().put(key, value, { httpMetadata: { contentType } });
}

export async function r2Get(key: string): Promise<R2ObjectBody | null> {
  return getBucket().get(key);
}

export async function r2Delete(key: string): Promise<void> {
  await getBucket().delete(key);
}