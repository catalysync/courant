import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { leads, user, videos } from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

/** Email-gate lead capture (Wistia Turnstile). */
export const leadsRouter = createTRPCRouter({
  /** Viewers submit an email to unlock a gated video. */
  capture: baseProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        email: z.string().email().max(200),
        name: z.string().max(120).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
      if (!video) throw new TRPCError({ code: "NOT_FOUND" });

      await database
        .insert(leads)
        .values({
          videoId: input.videoId,
          userId: video.userId,
          email: input.email,
          name: input.name ?? null,
        })
        .onConflictDoNothing();

      return { ok: true };
    }),

  /** Creator lists captured leads for their videos. */
  getMany: protectedProcedure
    .input(z.object({ videoId: z.string().uuid().nullish() }))
    .query(async ({ ctx, input }) => {
      return database
        .select({ ...getTableColumns(leads), video: videos })
        .from(leads)
        .innerJoin(videos, eq(leads.videoId, videos.id))
        .where(
          and(eq(leads.userId, ctx.user.id), input.videoId ? eq(leads.videoId, input.videoId) : undefined),
        )
        .orderBy(desc(leads.createdAt))
        .limit(500);
    }),

  /** CSV export (client renders the file). */
  exportCsv: protectedProcedure
    .input(z.object({ videoId: z.string().uuid().nullish() }))
    .query(async ({ ctx, input }) => {
      const rows = await database
        .select({ email: leads.email, name: leads.name, createdAt: leads.createdAt, title: videos.title })
        .from(leads)
        .innerJoin(videos, eq(leads.videoId, videos.id))
        .where(
          and(eq(leads.userId, ctx.user.id), input.videoId ? eq(leads.videoId, input.videoId) : undefined),
        )
        .orderBy(desc(leads.createdAt))
        .limit(5000);
      return rows;
    }),
});