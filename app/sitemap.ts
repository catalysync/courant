import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";

import { database } from "@/database";
import { categories, user, videos } from "@/database/schema";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://courant.nagara.cloud";

  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/feed/trending`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/feed/subscriptions`, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/sign-in`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/sign-up`, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const [publicVideos, publicUsers, cats] = await Promise.all([
      database
        .select({ id: videos.id, updatedAt: videos.updatedAt })
        .from(videos)
        .where(and(eq(videos.visibility, "public"), eq(videos.isUnlisted, false)))
        .limit(5000),
      database
        .select({ id: user.id })
        .from(user)
        .limit(5000),
      database.select({ id: categories.id }).from(categories).limit(200),
    ]);

    for (const v of publicVideos) {
      entries.push({
        url: `${base}/videos/${v.id}`,
        lastModified: v.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    for (const u of publicUsers) {
      entries.push({ url: `${base}/users/${u.id}`, changeFrequency: "weekly", priority: 0.6 });
    }
    for (const c of cats) {
      entries.push({ url: `${base}/search?categoryId=${c.id}`, changeFrequency: "weekly", priority: 0.4 });
    }
  } catch {
    /* DB unavailable (build-time) — return static entries */
  }

  return entries;
}