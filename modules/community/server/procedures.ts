import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, getTableColumns, inArray, lt, or } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import {
  clips,
  postReactions,
  posts,
  subscriptions,
  user,
  videos,
} from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

// ---- Community posts (YouTube community tab) ----

export const communityRouter = createTRPCRouter({
  // posts
  createPost: protectedProcedure
    .input(
      z.object({
        type: z.enum(["text", "poll", "image"]).default("text"),
        text: z.string().max(2000).nullish(),
        imageKey: z.string().nullish(),
        pollOptions: z.array(z.string().min(1).max(120)).max(6).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [post] = await database
        .insert(posts)
        .values({
          userId: ctx.user.id,
          type: input.type,
          text: input.text ?? null,
          imageKey: input.imageKey ?? null,
          pollOptions: input.pollOptions?.length ? JSON.stringify(input.pollOptions) : null,
        })
        .returning();
      return post;
    }),

  getChannelPosts: baseProcedure
    .input(
      z.object({
        userId: z.string(),
        cursor: z.object({ id: z.string().uuid(), createdAt: z.date() }).nullish(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, limit } = input;
      const items = await database
        .select({
          ...getTableColumns(posts),
          author: user,
          likeCount: database.$count(postReactions, and(eq(postReactions.postId, posts.id), eq(postReactions.type, "like"))),
        })
        .from(posts)
        .innerJoin(user, eq(posts.userId, user.id))
        .where(
          and(
            eq(posts.userId, input.userId),
            cursor
              ? or(
                  lt(posts.createdAt, cursor.createdAt),
                  and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(limit + 1);

      const hasMore = items.length > limit;
      const list = hasMore ? items.slice(0, -1) : items;
      const last = list[list.length - 1];
      return { items: list, nextCursor: hasMore ? { id: last.id, createdAt: last.createdAt } : null };
    }),

  getFollowingFeed: protectedProcedure
    .input(
      z.object({
        cursor: z.object({ id: z.string().uuid(), createdAt: z.date() }).nullish(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const creatorIds = database
        .select({ creatorId: subscriptions.creatorId })
        .from(subscriptions)
        .where(eq(subscriptions.viewerId, ctx.user.id));

      const items = await database
        .select({ ...getTableColumns(posts), author: user })
        .from(posts)
        .innerJoin(user, eq(posts.userId, user.id))
        .where(
          and(
            inArray(posts.userId, creatorIds),
            cursor
              ? or(
                  lt(posts.createdAt, cursor.createdAt),
                  and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(limit + 1);

      const hasMore = items.length > limit;
      const list = hasMore ? items.slice(0, -1) : items;
      const last = list[list.length - 1];
      return { items: list, nextCursor: hasMore ? { id: last.id, createdAt: last.createdAt } : null };
    }),

  reactPost: protectedProcedure
    .input(z.object({ postId: z.string().uuid(), type: z.enum(["like", "dislike"]) }))
    .mutation(async ({ ctx, input }) => {
      await database
        .insert(postReactions)
        .values({ postId: input.postId, userId: ctx.user.id, type: input.type })
        .onConflictDoUpdate({
          target: [postReactions.userId, postReactions.postId],
          set: { type: input.type },
        });
      return { ok: true };
    }),

  deletePost: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await database.delete(posts).where(and(eq(posts.id, input.id), eq(posts.userId, ctx.user.id)));
      return { ok: true };
    }),

  // ---- Clips (YouTube Clips) ----

  createClip: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        startSec: z.number().min(0),
        endSec: z.number().min(0),
        title: z.string().max(120).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.endSec - input.startSec < 1 || input.endSec - input.startSec > 60) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Clip must be 1–60 seconds" });
      }
      const [clip] = await database
        .insert(clips)
        .values({
          videoId: input.videoId,
          creatorId: ctx.user.id,
          startSec: input.startSec,
          endSec: input.endSec,
          title: input.title ?? null,
        })
        .returning();
      return clip;
    }),

  getClip: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [clip] = await database
        .select({ ...getTableColumns(clips), video: videos })
        .from(clips)
        .innerJoin(videos, eq(clips.videoId, videos.id))
        .where(eq(clips.id, input.id));
      return clip ?? null;
    }),

  getClips: baseProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .query(async ({ input }) => {
      return database
        .select({ ...getTableColumns(clips), creator: user })
        .from(clips)
        .innerJoin(user, eq(clips.creatorId, user.id))
        .where(eq(clips.videoId, input.videoId))
        .orderBy(asc(clips.startSec), desc(clips.createdAt))
        .limit(100);
    }),

  /** Auto-generate shareable clips from a video's chapters (Wistia social clips). */
  generateClips: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { chapters } = await import("@/database/schema");
      const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
      if (!video || video.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const chaps = await database
        .select()
        .from(chapters)
        .where(eq(chapters.videoId, input.videoId))
        .orderBy(asc(chapters.order));

      if (!chaps.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Generate chapters first" });

      const created: typeof clips.$inferSelect[] = [];
      for (let i = 0; i < chaps.length; i++) {
        const c = chaps[i];
        const start = c.startSec;
        const end = chaps[i + 1]?.startSec ?? (video.duration || c.startSec + 30);
        if (end - start < 5 || end - start > 60) continue;
        const [clip] = await database
          .insert(clips)
          .values({
            videoId: input.videoId,
            creatorId: ctx.user.id,
            startSec: start,
            endSec: end,
            title: c.title,
          })
          .returning();
        created.push(clip);
      }
      return created;
    }),
});