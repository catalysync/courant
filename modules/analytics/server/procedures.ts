import { database } from "@/database";
import {
  comments,
  subscriptions,
  user,
  videoReactions,
  videos,
  videoViews,
  videoWatchEvents,
} from "@/database/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { and, count, desc, eq, getTableColumns, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Creator analytics for the authenticated user's channel. */
export const analyticsRouter = createTRPCRouter({
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId } = ctx.user;

    const [[videoCount], [views], [likes], [cmts], [subs], [watch]] = await Promise.all([
      database.select({ count: count() }).from(videos).where(eq(videos.userId, userId)),
      database
        .select({ count: count() })
        .from(videoViews)
        .innerJoin(videos, eq(videoViews.videoId, videos.id))
        .where(eq(videos.userId, userId)),
      database
        .select({ count: count() })
        .from(videoReactions)
        .innerJoin(videos, eq(videoReactions.videoId, videos.id))
        .where(and(eq(videos.userId, userId), eq(videoReactions.type, "like"))),
      database
        .select({ count: count() })
        .from(comments)
        .innerJoin(videos, eq(comments.videoId, videos.id))
        .where(eq(videos.userId, userId)),
      database
        .select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.creatorId, userId)),
      database
        .select({
          seconds: sql<number>`COALESCE(SUM(${videoWatchEvents.watchSeconds}), 0)`,
        })
        .from(videoWatchEvents)
        .innerJoin(videos, eq(videoWatchEvents.videoId, videos.id))
        .where(eq(videos.userId, userId)),
    ]);

    return {
      videos: videoCount.count,
      views: views.count,
      likes: likes.count,
      comments: cmts.count,
      subscribers: subs.count,
      watchSeconds: watch.seconds,
    };
  }),

  getTopVideos: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId } = ctx.user;

    const viewCount = database.$count(videoViews, eq(videoViews.videoId, videos.id));

    const items = await database
      .select({
        ...getTableColumns(videos),
        viewCount,
        likeCount: database.$count(
          videoReactions,
          and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "like")),
        ),
        commentCount: database.$count(comments, eq(comments.videoId, videos.id)),
      })
      .from(videos)
      .where(eq(videos.userId, userId))
      .orderBy(desc(viewCount))
      .limit(10);

    return items;
  }),

  getViewsOverTime: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const rows = await database
        .select({ createdAt: videoViews.createdAt })
        .from(videoViews)
        .innerJoin(videos, eq(videoViews.videoId, videos.id))
        .where(and(eq(videos.userId, userId), gte(videoViews.createdAt, since)));

      const buckets = new Map<string, number>();
      for (let i = 0; i < input.days; i++) {
        const d = new Date(Date.now() - (input.days - 1 - i) * 24 * 60 * 60 * 1000);
        buckets.set(dayKey(d), 0);
      }
      for (const row of rows) {
        const key = dayKey(row.createdAt);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
    }),

  getRecentComments: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId } = ctx.user;

    const items = await database
      .select({
        ...getTableColumns(comments),
        commenter: user,
        video: videos,
      })
      .from(comments)
      .innerJoin(videos, eq(comments.videoId, videos.id))
      .innerJoin(user, eq(comments.userId, user.id))
      .where(eq(videos.userId, userId))
      .orderBy(desc(comments.createdAt))
      .limit(10);

    return items;
  }),

  /** Retention curve: % of viewers still watching at each 10% point. */
  getRetention: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
      if (!video || video.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const rows = await database
        .select({ maxWatch: sql<number>`MAX(${videoWatchEvents.watchSeconds})` })
        .from(videoWatchEvents)
        .where(eq(videoWatchEvents.videoId, input.videoId))
        .groupBy(videoWatchEvents.userId);

      const total = rows.length;
      const duration = video.duration || 0;
      const points = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      return points.map((percent) => {
        const sec = duration ? (duration * percent) / 100 : 0;
        const viewers = rows.filter((r) => Number(r.maxWatch) >= sec).length;
        return {
          percent,
          viewers,
          retentionPct: total ? Math.round((viewers / total) * 100) : 0,
        };
      });
    }),

  /** Watch events grouped by country. */
  getGeography: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid().nullish(),
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.videoId) {
        const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
        if (!video || video.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await database
        .select({ key: videoWatchEvents.country, n: count() })
        .from(videoWatchEvents)
        .innerJoin(videos, eq(videoWatchEvents.videoId, videos.id))
        .where(
          and(
            eq(videos.userId, ctx.user.id),
            gte(videoWatchEvents.createdAt, since),
            input.videoId ? eq(videoWatchEvents.videoId, input.videoId) : undefined,
          ),
        )
        .groupBy(videoWatchEvents.country);
      return rows
        .filter((r): r is { key: string; n: number } => r.key !== null)
        .sort((a, b) => b.n - a.n);
    }),

  /** Watch events grouped by device type. */
  getDevices: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid().nullish(),
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.videoId) {
        const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
        if (!video || video.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await database
        .select({ key: videoWatchEvents.device, n: count() })
        .from(videoWatchEvents)
        .innerJoin(videos, eq(videoWatchEvents.videoId, videos.id))
        .where(
          and(
            eq(videos.userId, ctx.user.id),
            gte(videoWatchEvents.createdAt, since),
            input.videoId ? eq(videoWatchEvents.videoId, input.videoId) : undefined,
          ),
        )
        .groupBy(videoWatchEvents.device);
      return rows
        .filter((r): r is { key: string; n: number } => r.key !== null)
        .sort((a, b) => b.n - a.n);
    }),

  /** Watch events grouped by referrer hostname. */
  getReferrers: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid().nullish(),
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.videoId) {
        const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
        if (!video || video.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await database
        .select({ key: videoWatchEvents.referrer, n: count() })
        .from(videoWatchEvents)
        .innerJoin(videos, eq(videoWatchEvents.videoId, videos.id))
        .where(
          and(
            eq(videos.userId, ctx.user.id),
            gte(videoWatchEvents.createdAt, since),
            input.videoId ? eq(videoWatchEvents.videoId, input.videoId) : undefined,
          ),
        )
        .groupBy(videoWatchEvents.referrer);
      return rows
        .filter((r): r is { key: string; n: number } => r.key !== null)
        .sort((a, b) => b.n - a.n);
    }),
});