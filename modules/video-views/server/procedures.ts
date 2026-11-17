import { database } from "@/database";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { videoViews, videoWatchEvents, videos } from "@/database/schema";
import { z } from "zod";
import { and, desc, eq, getTableColumns, inArray, lt, sql } from "drizzle-orm";
import { getRequestMeta } from "@/lib/request-meta";
import { user } from "@/database/schema";

export const videoViewsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id: userId } = ctx.user;
      const { videoId } = input;

      const [existingVideoView] = await database
        .select()
        .from(videoViews)
        .where(and(eq(videoViews.videoId, videoId), eq(videoViews.userId, userId)));

      if (existingVideoView) {
        return existingVideoView;
      }

      const [newVideoView] = await database
        .insert(videoViews)
        .values({ userId, videoId })
        .returning();

      return newVideoView;
    }),

  /** Record a watch-progress heartbeat (powers creator watch-time analytics). */
  recordWatch: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        watchSeconds: z.number().min(0),
        totalSeconds: z.number().min(0),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id: userId } = ctx.user;
      const { videoId, watchSeconds, totalSeconds } = input;

      const meta = await getRequestMeta();

      const [event] = await database
        .insert(videoWatchEvents)
        .values({
          userId,
          videoId,
          watchSeconds: Math.round(watchSeconds),
          totalSeconds: Math.round(totalSeconds),
          country: meta.country,
          device: meta.device,
          referrer: meta.referrer,
        })
        .returning();

      return event;
    }),

  /** The viewer's last playback position for a video (seconds), for resume. */
  getResumePosition: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await database
        .select({ last: sql<number>`MAX(${videoWatchEvents.watchSeconds})` })
        .from(videoWatchEvents)
        .where(and(eq(videoWatchEvents.userId, ctx.user.id), eq(videoWatchEvents.videoId, input.videoId)));
      return Math.max(0, Math.floor(row?.last ?? 0));
    }),

  /** In-progress videos for the "Continue watching" rail. */
  getContinueWatching: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(20) }))
    .query(async ({ ctx, input }) => {
      const rows = await database
        .select({
          videoId: videoWatchEvents.videoId,
          watchSeconds: sql<number>`MAX(${videoWatchEvents.watchSeconds})`,
          totalSeconds: sql<number>`MAX(${videoWatchEvents.totalSeconds})`,
          lastWatchedAt: sql<number>`MAX(${videoWatchEvents.createdAt})`,
        })
        .from(videoWatchEvents)
        .where(eq(videoWatchEvents.userId, ctx.user.id))
        .groupBy(videoWatchEvents.videoId)
        .orderBy(desc(sql`MAX(${videoWatchEvents.createdAt})`))
        .limit(input.limit * 2);

      const inProgress = rows.filter(
        (r) => Number(r.watchSeconds) >= 5 && Number(r.watchSeconds) < Number(r.totalSeconds) * 0.95,
      );
      if (!inProgress.length) return { items: [] };

      const ids = inProgress.map((r) => r.videoId);
      const vids = await database
        .select({ ...getTableColumns(videos), user })
        .from(videos)
        .innerJoin(user, eq(videos.userId, user.id))
        .where(and(inArray(videos.id, ids), eq(videos.visibility, "public")));

      const byId = new Map(vids.map((v) => [v.id, v]));
      const items = inProgress
        .map((r) => {
          const v = byId.get(r.videoId);
          return v ? { ...v, resumeSeconds: Number(r.watchSeconds), totalSeconds: Number(r.totalSeconds) } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, input.limit);

      return { items };
    }),

  /** The viewer's recently-watched videos, newest first (History page). */
  getHistory: protectedProcedure
    .input(
      z.object({
        cursor: z.object({ lastWatchedAt: z.number() }).nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;

      // One row per video: its latest watch event and the furthest position reached.
      const viewerHistory = database.$with("viewer_history").as(
        database
          .select({
            videoId: videoWatchEvents.videoId,
            watchSeconds: sql<number>`MAX(${videoWatchEvents.watchSeconds})`,
            lastWatchedAt: sql<number>`MAX(${videoWatchEvents.createdAt})`,
          })
          .from(videoWatchEvents)
          .where(eq(videoWatchEvents.userId, ctx.user.id))
          .groupBy(videoWatchEvents.videoId),
      );

      const rows = await database
        .with(viewerHistory)
        .select({
          ...getTableColumns(videos),
          user,
          lastWatchedAt: viewerHistory.lastWatchedAt,
        })
        .from(videos)
        .innerJoin(viewerHistory, eq(viewerHistory.videoId, videos.id))
        .innerJoin(user, eq(videos.userId, user.id))
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? lt(viewerHistory.lastWatchedAt, cursor.lastWatchedAt)
              : undefined,
          ),
        )
        .orderBy(desc(viewerHistory.lastWatchedAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { lastWatchedAt: lastItem.lastWatchedAt }
        : null;

      return { items, nextCursor };
    }),
});