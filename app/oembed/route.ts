import { database } from "@/database";
import { videos } from "@/database/schema";
import { eq } from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://courant.nagara.cloud";

export const dynamic = "force-dynamic";

function normalizeHost(h: string): string {
  return h
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoUrl = url.searchParams.get("url");
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const host = url.searchParams.get("domain") ?? req.headers.get("referer") ?? "";

  if (!videoUrl) {
    return Response.json({ error: "Missing url param" }, { status: 400 });
  }

  const match =
    videoUrl.match(/\/videos\/([a-f0-9-]+)/i) ?? videoUrl.match(/\/embed\/([a-f0-9-]+)/i);
  if (!match) {
    return Response.json({ error: "Not a Courant video" }, { status: 404 });
  }
  const videoId = match[1];

  const [video] = await database
    .select({
      title: videos.title,
      thumbnailUrl: videos.thumbnailUrl,
      allowedDomains: videos.allowedDomains,
      visibility: videos.visibility,
    })
    .from(videos)
    .where(eq(videos.id, videoId));

  if (!video || video.visibility === "private") {
    return Response.json({ error: "Video not found" }, { status: 404 });
  }

  // Domain restriction: if an allow-list is set, the requesting host must match.
  if (video.allowedDomains && host) {
    let domains: string[] = [];
    try {
      domains = JSON.parse(video.allowedDomains);
    } catch {
      domains = [];
    }
    const hostNorm = normalizeHost(host);
    const allowed = domains.some((d) => {
      const dn = normalizeHost(d).replace(/^www\./, "");
      return hostNorm === dn || hostNorm.endsWith(`.${dn}`);
    });
    if (!allowed) {
      return Response.json({ error: "Embedding not allowed for this domain" }, { status: 403 });
    }
  }

  const html = `<iframe src="${APP_URL}/embed/${videoId}" width="640" height="360" style="border:0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  const base = {
    version: "1.0",
    type: "video",
    provider_name: "Courant",
    provider_url: APP_URL,
    author_name: "Courant",
    title: video.title,
    thumbnail_url: video.thumbnailUrl ?? undefined,
    width: 640,
    height: 360,
  };

  if (format === "xml") {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<oembed>${Object.entries(base)
      .map(([k, v]) => `<${k.replace(/_/g, "-")}>${v ?? ""}</${k.replace(/_/g, "-")}>`)
      .join("")}
<html>${html}</html>
</oembed>`;
    return new Response(xml, { headers: { "content-type": "text/xml; charset=utf-8" } });
  }

  return Response.json({ ...base, html });
}
