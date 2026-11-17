import { eq } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { playerSettings } from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

const defaults = {
  primaryColor: "#3b82f6",
  watermarkText: null as string | null,
  showWatermark: false,
  autoPlay: false,
};

export const playerRouter = createTRPCRouter({
  /** A creator's player settings (used on the watch/embed pages). */
  get: baseProcedure
    .input(z.object({ creatorId: z.string() }))
    .query(async ({ input }) => {
      const [row] = await database
        .select()
        .from(playerSettings)
        .where(eq(playerSettings.userId, input.creatorId));
      return row ? { ...row, passwordHash: undefined } : { ...defaults, userId: input.creatorId };
    }),

  /** The authenticated user's player settings (studio). */
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await database
      .select()
      .from(playerSettings)
      .where(eq(playerSettings.userId, ctx.user.id));
    return row ?? { ...defaults, userId: ctx.user.id };
  }),

  update: protectedProcedure
    .input(
      z.object({
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        watermarkText: z.string().max(60).nullish(),
        showWatermark: z.boolean().optional(),
        autoPlay: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await database
        .insert(playerSettings)
        .values({
          userId: ctx.user.id,
          primaryColor: input.primaryColor ?? "#3b82f6",
          watermarkText: input.watermarkText ?? null,
          showWatermark: input.showWatermark ?? false,
          autoPlay: input.autoPlay ?? false,
        })
        .onConflictDoUpdate({
          target: playerSettings.userId,
          set: {
            ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
            watermarkText: input.watermarkText ?? null,
            ...(input.showWatermark !== undefined ? { showWatermark: input.showWatermark } : {}),
            ...(input.autoPlay !== undefined ? { autoPlay: input.autoPlay } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    }),
});