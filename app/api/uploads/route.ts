import { auth } from "@/lib/auth";
import { r2Put } from "@/lib/r2";
import { headers } from "next/headers";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export const POST = async (req: Request) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const kind = (req.headers.get("x-upload-kind") ?? "misc").replace(/[^a-z-]/g, "") || "misc";
  const contentType = (req.headers.get("content-type") ?? "application/octet-stream").split(";")[0];
  if (!ALLOWED.has(contentType)) {
    return new Response("Unsupported file type", { status: 415 });
  }

  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_BYTES) {
    return new Response("File too large", { status: 413 });
  }

  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const key = `${kind}/${crypto.randomUUID()}.${ext}`;

  await r2Put(key, body, contentType);

  return Response.json({ url: `/api/files/${key}`, key });
};