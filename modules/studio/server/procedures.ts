import { database } from "@/database";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { videoReactions, videos, videoViews } from "@/database/schema";
import { and, desc, eq, getTableColumns, lt, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateText, generateImage } from "@/lib/ai";
import { r2Put } from "@/lib/r2";

export const studioRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [video] = await database
        .select()
        .from(videos)
        .where(and(eq(videos.id, id), eq(videos.userId, userId)));

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return video;
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
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      const videosList = await database
        .select({
          ...getTableColumns(videos),
          videoViews: database.$count(videoViews, eq(videoViews.videoId, videos.id)),
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
            eq(videos.userId, userId),
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

      const hasMore = videosList.length > limit;
      const items = hasMore ? videosList.slice(0, -1) : videosList;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore ? { id: lastItem.id, updatedAt: lastItem.updatedAt } : null;

      return { items, nextCursor };
    }),

  /** Generate a video title from a description (Workers AI). */
  generateTitle: protectedProcedure
    .input(z.object({ description: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const title = await generateText(
        "You are a video title editor. Write a short, compelling, click-worthy title (max 10 words). Return only the title text.",
        `Description: ${input.description}`,
      );
      return { title };
    }),

  /** Generate a video description from a title (Workers AI). */
  generateDescription: protectedProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const description = await generateText(
        "You are a video description writer. Write a clear 2-3 sentence description for a video. Return only the description text.",
        `Title: ${input.title}`,
      );
      return { description };
    }),

  /** Generate a custom thumbnail image and attach it to a video (Workers AI + R2). */
  generateThumbnail: protectedProcedure
    .input(z.object({ videoId: z.string().uuid(), prompt: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { videoId, prompt } = input;

      const [video] = await database
        .select()
        .from(videos)
        .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));

      if (!video) throw new TRPCError({ code: "NOT_FOUND" });

      const bytes = await generateImage(prompt);
      const key = `thumbnails/ai-${crypto.randomUUID()}.png`;
      await r2Put(key, bytes, "image/png");

      const [updated] = await database
        .update(videos)
        .set({ thumbnailUrl: `/api/files/${key}`, thumbnailKey: key, updatedAt: new Date() })
        .where(eq(videos.id, videoId))
        .returning();

      return updated;
    }),
});