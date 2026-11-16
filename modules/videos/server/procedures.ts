import { database } from "@/database";
import {
  subscriptions,
  user,
  videoReactions,
  videos,
  videoUpdateSchema,
} from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { videoViews } from "../../../database/schema";
import { stream } from "@/lib/stream";
import { createNotification } from "@/modules/notifications/server/procedures";

export const videosRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().nullish(),
        userId: z.string().nullish(),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, limit, categoryId, userId } = input;

      const videosList = await database
        .select({
          ...getTableColumns(videos),
          user,
          viewCount: database.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "like")),
          ),
          dislikeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "dislike")),
          ),
        })
        .from(videos)
        .where(
          and(
            eq(videos.visibility, "public"),
            categoryId ? eq(videos.categoryId, categoryId) : undefined,
            userId ? eq(videos.userId, userId) : undefined,
            cursor
              ? or(
                  lt(videos.updatedAt, cursor.updatedAt),
                  and(eq(videos.updatedAt, cursor.updatedAt), lt(videos.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .innerJoin(user, eq(videos.userId, user.id))
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = videosList.length > limit;
      const items = hasMore ? videosList.slice(0, -1) : videosList;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
        : null;

      return { items, nextCursor };
    }),

  getManyTrending: baseProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            viewCount: z.number(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, limit } = input;

      const viewCountSubquery = database.$count(videoViews, eq(videoViews.videoId, videos.id));

      const videosList = await database
        .select({
          ...getTableColumns(videos),
          user,
          viewCount: viewCountSubquery,
          likeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "like")),
          ),
          dislikeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "dislike")),
          ),
        })
        .from(videos)
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? or(
                  lt(viewCountSubquery, cursor.viewCount),
                  and(eq(viewCountSubquery, cursor.viewCount), lt(videos.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .innerJoin(user, eq(videos.userId, user.id))
        .orderBy(desc(viewCountSubquery), desc(videos.id))
        .limit(limit + 1);

      const hasMore = videosList.length > limit;
      const items = hasMore ? videosList.slice(0, -1) : videosList;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, viewCount: lastItem.viewCount }
        : null;

      return { items, nextCursor };
    }),

  getManySubscribed: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { id: userId } = ctx.user;
      const { cursor, limit } = input;

      const viewerSubscriptions = database.$with("subscriptions").as(
        database
          .select({ userId: subscriptions.creatorId })
          .from(subscriptions)
          .where(eq(subscriptions.viewerId, userId)),
      );

      const videosList = await database
        .select({
          ...getTableColumns(videos),
          user,
          viewCount: database.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "like")),
          ),
          dislikeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "dislike")),
          ),
        })
        .from(videos)
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? or(
                  lt(videos.updatedAt, cursor.updatedAt),
                  and(eq(videos.updatedAt, cursor.updatedAt), lt(videos.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .innerJoin(user, eq(videos.userId, user.id))
        .innerJoin(viewerSubscriptions, eq(viewerSubscriptions.userId, user.id))
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = videosList.length > limit;
      const items = hasMore ? videosList.slice(0, -1) : videosList;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
        : null;

      return { items, nextCursor };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [deletedVideo] = await database
        .delete(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      if (!deletedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Best-effort cleanup of the Stream asset.
      if (deletedVideo.streamUid) {
        try {
          await stream.deleteVideo(deletedVideo.streamUid);
        } catch {
          /* non-fatal */
        }
      }

      return deletedVideo;
    }),

  update: protectedProcedure
    .input(videoUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      if (!input.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [existing] = await database
        .select({ visibility: videos.visibility })
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updatedVideo] = await database
        .update(videos)
        .set({
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          visibility: input.visibility,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      if (!updatedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Notify subscribers when a video is first published.
      if (existing.visibility === "private" && input.visibility === "public") {
        try {
          const subs = await database
            .select({ viewerId: subscriptions.viewerId })
            .from(subscriptions)
            .where(eq(subscriptions.creatorId, userId));
          for (const s of subs) {
            await createNotification({
              userId: s.viewerId,
              actorId: userId,
              type: "new_video",
              videoId: updatedVideo.id,
            });
          }
        } catch {
          /* non-fatal */
        }
      }

      return updatedVideo;
    }),

  /** Set a custom thumbnail (url from R2 via /api/uploads). */
  updateThumbnail: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        url: z.string().min(1),
        key: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [updatedVideo] = await database
        .update(videos)
        .set({
          thumbnailUrl: input.url,
          thumbnailKey: input.key ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.id, input.videoId), eq(videos.userId, userId)))
        .returning();

      if (!updatedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updatedVideo;
    }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.user;

    const upload = await stream.directUpload({ creator: userId });

    const [video] = await database
      .insert(videos)
      .values({
        userId,
        title: "Untitled video",
        streamStatus: "pendingupload",
        streamUid: upload.uid,
      })
      .returning();

    return { video, url: upload.uploadURL };
  }),

  getOne: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;

      const viewerReactions = database.$with("viewer_reactions").as(
        database
          .select({
            videoId: videoReactions.videoId,
            type: videoReactions.type,
          })
          .from(videoReactions)
          .where(userId ? eq(videoReactions.userId, userId) : sql`0`),
      );

      const viewerSubscriptions = database.$with("subscriptions").as(
        database
          .select()
          .from(subscriptions)
          .where(userId ? eq(subscriptions.viewerId, userId) : sql`0`),
      );

      const [existingVideo] = await database
        .with(viewerReactions)
        .select({
          ...getTableColumns(videos),
          user: {
            ...getTableColumns(user),
            subscriberCount: database.$count(subscriptions, eq(subscriptions.creatorId, user.id)),
            viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(Boolean),
          },
          videoViews: database.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "like")),
          ),
          dislikeCount: database.$count(
            videoReactions,
            and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "dislike")),
          ),
          viewerReaction: viewerReactions.type,
        })
        .from(videos)
        .innerJoin(user, eq(videos.userId, user.id))
        .leftJoin(viewerReactions, eq(viewerReactions.videoId, videos.id))
        .leftJoin(viewerSubscriptions, eq(viewerSubscriptions.creatorId, user.id))
        .where(eq(videos.id, input.id));

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return existingVideo;
    }),

  revalidate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [existingVideo] = await database
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (!existingVideo.streamUid) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const asset = await stream.getVideo(existingVideo.streamUid);

      if (!asset) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const duration = asset.duration ? Math.round(asset.duration * 1000) : 0;

      const [updatedVideo] = await database
        .update(videos)
        .set({
          streamStatus: asset.status?.state ?? existingVideo.streamStatus,
          duration,
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      return updatedVideo;
    }),
});