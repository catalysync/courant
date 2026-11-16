import { database } from "@/database";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns, lt, or, sql } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  playlists,
  playlistVideos,
  user,
  videoReactions,
  videos,
  videoViews,
} from "@/database/schema";

export const playlistsRouter = createTRPCRouter({
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [deletedPlaylist] = await database
        .delete(playlists)
        .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
        .returning();

      if (!deletedPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return deletedPlaylist;
    }),
  getOne: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await database
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, id), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return existingPlaylist;
    }),
  getVideos: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
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
      const { cursor, limit, playlistId } = input;

      const [existingPlaylist] = await database
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const videosFromPlaylist = database.$with("playlist_videos").as(
        database
          .select({ videoId: playlistVideos.videoId })
          .from(playlistVideos)
          .where(eq(playlistVideos.playlistId, playlistId)),
      );

      const data = await database
        .with(videosFromPlaylist)
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
        .innerJoin(user, eq(videos.userId, user.id))
        .innerJoin(videosFromPlaylist, eq(videos.id, videosFromPlaylist.videoId))
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
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore ? { id: lastItem.id, updatedAt: lastItem.updatedAt } : null;

      return { items, nextCursor };
    }),
  removeVideo: protectedProcedure
    .input(z.object({ playlistId: z.string().uuid(), videoId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { playlistId, videoId } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await database
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [deletedPlaylistVideo] = await database
        .delete(playlistVideos)
        .where(
          and(eq(playlistVideos.playlistId, playlistId), eq(playlistVideos.videoId, videoId)),
        )
        .returning();

      if (!deletedPlaylistVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return deletedPlaylistVideo;
    }),
  addVideo: protectedProcedure
    .input(z.object({ playlistId: z.string().uuid(), videoId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { playlistId, videoId } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await database
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [existingPlaylistVideo] = await database
        .select()
        .from(playlistVideos)
        .where(
          and(eq(playlistVideos.playlistId, playlistId), eq(playlistVideos.videoId, videoId)),
        );

      if (existingPlaylistVideo) {
        throw new TRPCError({ code: "CONFLICT" });
      }

      const [createdPlaylistVideo] = await database
        .insert(playlistVideos)
        .values({ playlistId, videoId })
        .returning();

      return createdPlaylistVideo;
    }),
  getManyForVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
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
      const { cursor, limit, videoId } = input;

      const data = await database
        .select({
          ...getTableColumns(playlists),
          videoCount: database.$count(playlistVideos, eq(playlists.id, playlistVideos.playlistId)),
          user,
          containsVideo: sql<boolean>`(
            SELECT EXISTS (
              SELECT 1 FROM ${playlistVideos} pv
              WHERE pv.playlist_id = ${playlists.id} AND pv.video_id = ${videoId}
            )
          )`,
        })
        .from(playlists)
        .innerJoin(user, eq(playlists.userId, user.id))
        .where(
          and(
            eq(playlists.userId, userId),
            cursor
              ? or(
                  lt(playlists.updatedAt, cursor.updatedAt),
                  and(eq(playlists.updatedAt, cursor.updatedAt), lt(playlists.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(playlists.updatedAt), desc(playlists.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore ? { id: lastItem.id, updatedAt: lastItem.updatedAt } : null;

      return { items, nextCursor };
    }),
  getMany: protectedProcedure
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

      const data = await database
        .select({
          ...getTableColumns(playlists),
          videoCount: database.$count(playlistVideos, eq(playlists.id, playlistVideos.playlistId)),
          user,
          thumbnailUrl: sql<string | null>`(
            SELECT v.thumbnail_url
            FROM ${playlistVideos} pv
            JOIN ${videos} v ON v.id = pv.video_id
            WHERE pv.playlist_id = ${playlists.id}
            ORDER BY pv.updated_at DESC
            LIMIT 1
          )`,
        })
        .from(playlists)
        .innerJoin(user, eq(playlists.userId, user.id))
        .where(
          and(
            eq(playlists.userId, userId),
            cursor
              ? or(
                  lt(playlists.updatedAt, cursor.updatedAt),
                  and(eq(playlists.updatedAt, cursor.updatedAt), lt(playlists.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(playlists.updatedAt), desc(playlists.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore ? { id: lastItem.id, updatedAt: lastItem.updatedAt } : null;

      return { items, nextCursor };
    }),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const { name } = input;
      const { id: userId } = ctx.user;

      const [createdPlaylist] = await database
        .insert(playlists)
        .values({ userId, name })
        .returning();

      if (!createdPlaylist) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      return createdPlaylist;
    }),
  getLiked: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            likedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { id: userId } = ctx.user;
      const { cursor, limit } = input;

      const viewerVideoReactions = database.$with("viewer_video_reactions").as(
        database
          .select({
            videoId: videoReactions.videoId,
            likedAt: videoReactions.updatedAt,
          })
          .from(videoReactions)
          .where(and(eq(videoReactions.userId, userId), eq(videoReactions.type, "like"))),
      );

      const data = await database
        .with(viewerVideoReactions)
        .select({
          ...getTableColumns(videos),
          user,
          likedAt: viewerVideoReactions.likedAt,
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
        .innerJoin(user, eq(videos.userId, user.id))
        .innerJoin(viewerVideoReactions, eq(videos.id, viewerVideoReactions.videoId))
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? or(
                  lt(viewerVideoReactions.likedAt, cursor.likedAt),
                  and(eq(viewerVideoReactions.likedAt, cursor.likedAt), lt(videos.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(viewerVideoReactions.likedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore ? { id: lastItem.id, likedAt: lastItem.likedAt } : null;

      return { items, nextCursor };
    }),
  getHistory: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            viewedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { id: userId } = ctx.user;
      const { cursor, limit } = input;

      const viewerVideoViews = database.$with("viewer_video_views").as(
        database
          .select({
            videoId: videoViews.videoId,
            viewedAt: videoViews.updatedAt,
          })
          .from(videoViews)
          .where(eq(videoViews.userId, userId)),
      );

      const data = await database
        .with(viewerVideoViews)
        .select({
          ...getTableColumns(videos),
          user,
          viewedAt: viewerVideoViews.viewedAt,
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
        .innerJoin(user, eq(videos.userId, user.id))
        .innerJoin(viewerVideoViews, eq(videos.id, viewerVideoViews.videoId))
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? or(
                  lt(viewerVideoViews.viewedAt, cursor.viewedAt),
                  and(eq(viewerVideoViews.viewedAt, cursor.viewedAt), lt(videos.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(viewerVideoViews.viewedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore ? { id: lastItem.id, viewedAt: lastItem.viewedAt } : null;

      return { items, nextCursor };
    }),
});