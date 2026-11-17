import { database } from "@/database";
import {
  categories,
  comments,
  subscriptions,
  user,
  videoReactions,
  videos,
  videoViews,
  videoWatchEvents,
} from "@/database/schema";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, getTableColumns, like, or, sql } from "drizzle-orm";
import { stream } from "@/lib/stream";

/**
 * Internal admin (Vimeo-style) surface. All procedures are admin-only.
 */

export const adminRouter = createTRPCRouter({
  getStats: adminProcedure.query(async () => {
    const [[users], [vids], [views], [cmts], [reactions], [subs], [watch]] = await Promise.all([
      database.select({ count: count() }).from(user),
      database.select({ count: count() }).from(videos),
      database.select({ count: count() }).from(videoViews),
      database.select({ count: count() }).from(comments),
      database.select({ count: count() }).from(videoReactions),
      database.select({ count: count() }).from(subscriptions),
      database
        .select({ seconds: sql<number>`COALESCE(SUM(${videoWatchEvents.watchSeconds}), 0)` })
        .from(videoWatchEvents),
    ]);

    return {
      users: users.count,
      videos: vids.count,
      views: views.count,
      comments: cmts.count,
      reactions: reactions.count,
      subscriptions: subs.count,
      watchSeconds: watch.seconds,
    };
  }),

  listUsers: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        query: z.string().nullish(),
      }),
    )
    .query(async ({ input }) => {
      const { limit, offset, query } = input;

      const where = query
        ? or(like(user.name, `%${query}%`), like(user.email, `%${query}%`))
        : undefined;

      const [total] = await database
        .select({ count: count() })
        .from(user)
        .where(where);

      const items = await database
        .select({
          ...getTableColumns(user),
          subscriberCount: database.$count(subscriptions, eq(subscriptions.creatorId, user.id)),
          videoCount: database.$count(videos, eq(videos.userId, user.id)),
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset);

      return { items, total: total.count };
    }),

  setUserRole: adminProcedure
    .input(z.object({ userId: z.string().min(1), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      const [updated] = await database
        .update(user)
        .set({ role: input.role })
        .where(eq(user.id, input.userId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const [deleted] = await database
        .delete(user)
        .where(eq(user.id, input.userId))
        .returning();

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return deleted;
    }),

  listVideos: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        query: z.string().nullish(),
      }),
    )
    .query(async ({ input }) => {
      const { limit, offset, query } = input;

      const where = query ? like(videos.title, `%${query}%`) : undefined;

      const [total] = await database
        .select({ count: count() })
        .from(videos)
        .where(where);

      const items = await database
        .select({
          ...getTableColumns(videos),
          user,
          category: categories,
          viewCount: database.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "like")),
          ),
          commentCount: database.$count(comments, eq(comments.videoId, videos.id)),
        })
        .from(videos)
        .where(where)
        .innerJoin(user, eq(videos.userId, user.id))
        .leftJoin(categories, eq(videos.categoryId, categories.id))
        .orderBy(desc(videos.createdAt))
        .limit(limit)
        .offset(offset);

      return { items, total: total.count };
    }),

  setVideoVisibility: adminProcedure
    .input(z.object({ videoId: z.string().uuid(), visibility: z.enum(["public", "private"]) }))
    .mutation(async ({ input }) => {
      const [updated] = await database
        .update(videos)
        .set({ visibility: input.visibility })
        .where(eq(videos.id, input.videoId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /** Toggle a video's featured flag (powers the home hero carousel). */
  setFeatured: adminProcedure
    .input(z.object({ videoId: z.string().uuid(), featured: z.boolean() }))
    .mutation(async ({ input }) => {
      const [updated] = await database
        .update(videos)
        .set({ isFeatured: input.featured })
        .where(eq(videos.id, input.videoId))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  removeVideo: adminProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [deleted] = await database
        .delete(videos)
        .where(eq(videos.id, input.videoId))
        .returning();

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });

      if (deleted.streamUid) {
        try {
          await stream.deleteVideo(deleted.streamUid);
        } catch {
          /* non-fatal */
        }
      }

      return deleted;
    }),

  removeComment: adminProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [deleted] = await database
        .delete(comments)
        .where(eq(comments.id, input.commentId))
        .returning();

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return deleted;
    }),
});