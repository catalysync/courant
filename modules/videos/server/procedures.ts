import { database } from "@/database";
import {
  subscriptions,
  user,
  videoReactions,
  videoVersions,
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
import { hlsUrl } from "@/lib/stream-urls";
import { hashPassword, verifyPassword } from "@/lib/auth";
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
            eq(videos.isUnlisted, false),
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
            eq(videos.isUnlisted, false),
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

      // CTE name must not collide with the `subscriptions` table.
      const viewerSubscriptions = database.$with("viewer_subscriptions").as(
        database
          .select({ userId: subscriptions.creatorId })
          .from(subscriptions)
          .where(eq(subscriptions.viewerId, userId)),
      );

      const videosList = await database
        .with(viewerSubscriptions)
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
            eq(videos.isUnlisted, false),
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

      const set: Record<string, unknown> = {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        visibility: input.visibility,
        updatedAt: new Date(),
      };
      if (input.requireEmail !== undefined) set.requireEmail = input.requireEmail;
      if (input.allowDownload !== undefined) set.allowDownload = input.allowDownload;
      if (input.endScreenType !== undefined) set.endScreenType = input.endScreenType;
      if (input.endScreenUrl !== undefined) set.endScreenUrl = input.endScreenUrl;
      if (input.endScreenCta !== undefined) set.endScreenCta = input.endScreenCta;
      if (input.maturityRating !== undefined) set.maturityRating = input.maturityRating;
      if (input.audioQuality !== undefined) set.audioQuality = input.audioQuality;

      const [updatedVideo] = await database
        .update(videos)
        .set(set)
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

      // CTE name must not collide with the `subscriptions` table.
      const viewerSubscriptions = database.$with("viewer_subscriptions").as(
        database
          .select()
          .from(subscriptions)
          .where(userId ? eq(subscriptions.viewerId, userId) : sql`0`),
      );

      const [existingVideo] = await database
        .with(viewerReactions, viewerSubscriptions)
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

      // Determine what the viewer is allowed to do.
      const isOwner = userId === existingVideo.userId;
      const isAdmin = ctx.session?.user?.role === "admin";
      let viewerAccess: "owner" | "full" | "needsPassword" | "denied";
      if (isOwner || isAdmin) viewerAccess = "owner";
      else if (existingVideo.visibility === "private") viewerAccess = "denied";
      else if (existingVideo.passwordHash) viewerAccess = "needsPassword";
      else viewerAccess = "full";

      // Never leak the password hash to the client.
      return { ...existingVideo, passwordHash: null, viewerAccess };
    }),

  /** Verify a video password; on success returns the playable HLS URL. */
  verifyPassword: baseProcedure
    .input(z.object({ videoId: z.string().uuid(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;

      const [video] = await database
        .select({
          userId: videos.userId,
          visibility: videos.visibility,
          passwordHash: videos.passwordHash,
          streamUid: videos.streamUid,
        })
        .from(videos)
        .where(eq(videos.id, input.videoId));

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const isOwner = userId === video.userId;
      const isAdmin = ctx.session?.user?.role === "admin";
      if (isOwner || isAdmin || !video.passwordHash) {
        return { ok: true, hlsUrl: video.streamUid ? hlsUrl(video.streamUid) : null };
      }

      const valid = await verifyPassword(video.passwordHash, input.password);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect password" });
      }

      return { ok: true, hlsUrl: video.streamUid ? hlsUrl(video.streamUid) : null };
    }),

  /** Update privacy & access settings (owner only). */
  updatePrivacy: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        isUnlisted: z.boolean().nullish(),
        password: z.string().min(1).max(200).nullish(),
        clearPassword: z.boolean().nullish(),
        allowedDomains: z.array(z.string().min(1)).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.isUnlisted !== undefined) set.isUnlisted = input.isUnlisted;
      if (input.password) set.passwordHash = await hashPassword(input.password);
      if (input.clearPassword) set.passwordHash = null;
      if (input.allowedDomains != null) {
        set.allowedDomains = input.allowedDomains.length ? JSON.stringify(input.allowedDomains) : null;
      }

      const [updated] = await database
        .update(videos)
        .set(set)
        .where(and(eq(videos.id, input.videoId), eq(videos.userId, userId)))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ...updated, passwordHash: null };
    }),

  /** Start replacing a video's source (owner only). Keeps the same id/URL; records
   *  the current asset as a version, then points the video at a fresh upload. */
  replaceVideo: protectedProcedure
    .input(z.object({ videoId: z.string().uuid(), note: z.string().max(200).nullish() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [video] = await database
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.videoId), eq(videos.userId, userId)));

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const upload = await stream.directUpload({ creator: userId });

      const [countRow] = await database
        .select({ n: sql<number>`count(*)` })
        .from(videoVersions)
        .where(eq(videoVersions.videoId, video.id));

      await database.insert(videoVersions).values({
        videoId: video.id,
        version: (countRow?.n ?? 0) + 1,
        streamUid: video.streamUid,
        thumbnailUrl: video.thumbnailUrl,
        thumbnailKey: video.thumbnailKey,
        duration: video.duration,
        note: input.note ?? "Replaced",
      });

      const [updated] = await database
        .update(videos)
        .set({ streamUid: upload.uid, streamStatus: "pendingupload", updatedAt: new Date() })
        .where(eq(videos.id, video.id))
        .returning();

      return { video: { ...updated, passwordHash: null }, uploadURL: upload.uploadURL };
    }),

  /** Restore a previous version (owner only). */
  restoreVersion: protectedProcedure
    .input(z.object({ videoId: z.string().uuid(), versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [video] = await database
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.videoId), eq(videos.userId, userId)));

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [version] = await database
        .select()
        .from(videoVersions)
        .where(and(eq(videoVersions.id, input.versionId), eq(videoVersions.videoId, input.videoId)));

      if (!version || !version.streamUid) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updated] = await database
        .update(videos)
        .set({
          streamUid: version.streamUid,
          thumbnailUrl: version.thumbnailUrl ?? video.thumbnailUrl,
          thumbnailKey: version.thumbnailKey ?? video.thumbnailKey,
          duration: version.duration || video.duration,
          streamStatus: "processed",
          updatedAt: new Date(),
        })
        .where(eq(videos.id, video.id))
        .returning();

      return { ...updated, passwordHash: null };
    }),

  /** List a video's version history (owner only). */
  getVersions: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [video] = await database
        .select({ userId: videos.userId })
        .from(videos)
        .where(eq(videos.id, input.videoId));

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (video.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return database
        .select()
        .from(videoVersions)
        .where(eq(videoVersions.videoId, input.videoId))
        .orderBy(desc(videoVersions.version), desc(videoVersions.id));
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