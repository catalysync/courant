import { database } from "@/database";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { videoViews, videoWatchEvents } from "@/database/schema";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getRequestMeta } from "@/lib/request-meta";

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
});