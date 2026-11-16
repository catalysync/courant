import { r2Get } from "@/lib/r2";

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) => {
  const { path } = await params;
  const key = path.join("/");

  const object = await r2Get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";

  return new Response(object.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};