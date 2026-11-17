import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { hotspots, playerPresets, videos } from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

async function assertVideoOwner(videoId: string, userId: string) {
  const [video] = await database.select().from(videos).where(eq(videos.id, videoId));
  if (!video) throw new TRPCError({ code: "NOT_FOUND" });
  if (video.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  return video;
}

/** In-video interactive hotspots + saved player presets. */
export const interactiveRouter = createTRPCRouter({
  // ---- hotspots ----

  getHotspots: baseProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .query(async ({ input }) => {
      return database
        .select()
        .from(hotspots)
        .where(eq(hotspots.videoId, input.videoId))
        .orderBy(asc(hotspots.startSec));
    }),

  createHotspot: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        startSec: z.number().min(0),
        endSec: z.number().nullish(),
        label: z.string().min(1).max(120),
        url: z.string().url().nullish(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertVideoOwner(input.videoId, ctx.user.id);
      const [h] = await database
        .insert(hotspots)
        .values({
          videoId: input.videoId,
          startSec: input.startSec,
          endSec: input.endSec ?? null,
          label: input.label,
          url: input.url ?? null,
          color: input.color ?? "#3b82f6",
        })
        .returning();
      return h;
    }),

  deleteHotspot: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await database.delete(hotspots).where(eq(hotspots.id, input.id));
      return { ok: true };
    }),

  // ---- player presets ----

  getPresets: protectedProcedure.query(async ({ ctx }) => {
    return database
      .select()
      .from(playerPresets)
      .where(eq(playerPresets.userId, ctx.user.id))
      .orderBy(asc(playerPresets.name));
  }),

  createPreset: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(60),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        watermarkText: z.string().max(60).nullish(),
        showWatermark: z.boolean().optional(),
        autoPlay: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [p] = await database
        .insert(playerPresets)
        .values({
          userId: ctx.user.id,
          name: input.name,
          primaryColor: input.primaryColor ?? "#3b82f6",
          watermarkText: input.watermarkText ?? null,
          showWatermark: input.showWatermark ?? false,
          autoPlay: input.autoPlay ?? false,
        })
        .returning();
      return p;
    }),

  deletePreset: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await database
        .delete(playerPresets)
        .where(and(eq(playerPresets.id, input.id), eq(playerPresets.userId, ctx.user.id)));
      return { ok: true };
    }),
});