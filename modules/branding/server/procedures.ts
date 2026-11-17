import { eq } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { channelBranding } from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

const defaults = {
  brandName: null as string | null,
  brandColor: "#3b82f6",
  tagline: null as string | null,
  logoKey: null as string | null,
};

/** Per-creator channel branding (OTT-style branded channel). */
export const brandingRouter = createTRPCRouter({
  get: baseProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const [row] = await database
        .select()
        .from(channelBranding)
        .where(eq(channelBranding.userId, input.userId));
      return row ?? { ...defaults, userId: input.userId };
    }),

  getMine: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await database
      .select()
      .from(channelBranding)
      .where(eq(channelBranding.userId, ctx.user.id));
    return row ?? { ...defaults, userId: ctx.user.id };
  }),

  update: protectedProcedure
    .input(
      z.object({
        brandName: z.string().max(80).nullish(),
        brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        tagline: z.string().max(200).nullish(),
        logoKey: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await database
        .insert(channelBranding)
        .values({
          userId: ctx.user.id,
          brandName: input.brandName ?? null,
          brandColor: input.brandColor ?? "#3b82f6",
          tagline: input.tagline ?? null,
          logoKey: input.logoKey ?? null,
        })
        .onConflictDoUpdate({
          target: channelBranding.userId,
          set: {
            brandName: input.brandName ?? null,
            ...(input.brandColor ? { brandColor: input.brandColor } : {}),
            tagline: input.tagline ?? null,
            logoKey: input.logoKey ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    }),
});