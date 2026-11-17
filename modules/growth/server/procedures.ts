import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { experiments, feedSources, videos } from "@/database/schema";
import { stream } from "@/lib/stream";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/** Growth: A/B experiments, RSS ingestion, and cloud-to-cloud import. */
export const growthRouter = createTRPCRouter({
  // ---- A/B experiments (thumbnails/titles) ----

  createExperiment: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        title: z.string().min(1).max(120),
        variantA: z.record(z.string(), z.string().nullish()).nullish(),
        variantB: z.record(z.string(), z.string().nullish()).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
      if (!video || video.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const [e] = await database
        .insert(experiments)
        .values({
          videoId: input.videoId,
          title: input.title,
          variantA: input.variantA ? JSON.stringify(input.variantA) : null,
          variantB: input.variantB ? JSON.stringify(input.variantB) : null,
        })
        .returning();
      return e;
    }),

  getExperiments: protectedProcedure
    .input(z.object({ videoId: z.string().uuid().nullish() }))
    .query(async ({ ctx, input }) => {
      return database
        .select({ ...getTableColumns(experiments), video: videos })
        .from(experiments)
        .innerJoin(videos, eq(experiments.videoId, videos.id))
        .where(and(eq(videos.userId, ctx.user.id), input.videoId ? eq(experiments.videoId, input.videoId) : undefined))
        .orderBy(desc(experiments.createdAt))
        .limit(100);
    }),

  recordExperimentView: protectedProcedure
    .input(z.object({ id: z.string().uuid(), variant: z.enum(["A", "B"]) }))
    .mutation(async ({ input }) => {
      const col = input.variant === "A" ? experiments.viewsA : experiments.viewsB;
      await database
        .update(experiments)
        .set({ [input.variant === "A" ? "viewsA" : "viewsB"]: sql`${col} + 1` })
        .where(eq(experiments.id, input.id));
      return { ok: true };
    }),

  // ---- RSS / MRSS ingestion ----

  createFeed: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        url: z.string().url(),
        categoryId: z.string().uuid().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [f] = await database
        .insert(feedSources)
        .values({
          userId: ctx.user.id,
          name: input.name,
          url: input.url,
          categoryId: input.categoryId ?? null,
        })
        .returning();
      return f;
    }),

  getFeeds: protectedProcedure.query(async ({ ctx }) => {
    return database
      .select()
      .from(feedSources)
      .where(eq(feedSources.userId, ctx.user.id))
      .orderBy(asc(feedSources.name));
  }),

  deleteFeed: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await database
        .delete(feedSources)
        .where(and(eq(feedSources.id, input.id), eq(feedSources.userId, ctx.user.id)));
      return { ok: true };
    }),

  /** Fetch an RSS feed and import its items as videos (Cloudflare fetches each media URL). */
  importFeed: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feed] = await database
        .select()
        .from(feedSources)
        .where(and(eq(feedSources.id, input.id), eq(feedSources.userId, ctx.user.id)));
      if (!feed) throw new TRPCError({ code: "NOT_FOUND" });

      let xml: string;
      try {
        const res = await fetch(feed.url, { headers: { "user-agent": "Courant/1.0" } });
        if (!res.ok) throw new Error("feed fetch failed");
        xml = await res.text();
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not fetch feed" });
      }

      // Parse <item><title>…</title><enclosure url="…"> or <media:content url="…">.
      const items = [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)]
        .map((m) => m[0])
        .slice(0, 20);
      let imported = 0;
      for (const item of items) {
        const title = item.match(/<title>(?:<!\[CDATA\[)?([^<\]>]*)/)?.[1]?.trim() ?? "Untitled video";
        const url =
          item.match(/<enclosure[^>]+url="([^"]+)"/)?.[1] ??
          item.match(/<media:content[^>]+url="([^"]+)"/)?.[1];
        if (!url) continue;
        try {
          const uploaded = await stream.uploadFromUrl({ url, creator: ctx.user.id });
          await database.insert(videos).values({
            title: title.slice(0, 100),
            streamUid: uploaded.uid,
            streamStatus: "processing",
            userId: ctx.user.id,
            categoryId: feed.categoryId ?? null,
            visibility: "private",
          });
          imported++;
        } catch {
          /* skip failed items */
        }
      }

      await database
        .update(feedSources)
        .set({ lastFetchedAt: new Date() })
        .where(eq(feedSources.id, feed.id));

      return { imported };
    }),

  // ---- cloud-to-cloud import (from a direct download URL) ----

  importFromUrl: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        title: z.string().min(1).max(120).nullish(),
        categoryId: z.string().uuid().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const uploaded = await stream.uploadFromUrl({ url: input.url, creator: ctx.user.id });
      const [video] = await database
        .insert(videos)
        .values({
          title: input.title ?? "Imported video",
          streamUid: uploaded.uid,
          streamStatus: "processing",
          userId: ctx.user.id,
          categoryId: input.categoryId ?? null,
          visibility: "private",
        })
        .returning();
      return video;
    }),
});