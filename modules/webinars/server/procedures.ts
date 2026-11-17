import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { liveStreams, user, webinarRegistrations, webinars } from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

/** Webinars (scheduled live + registration + recording). */
export const webinarsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(160),
        description: z.string().max(2000).nullish(),
        scheduledAt: z.date().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [w] = await database
        .insert(webinars)
        .values({
          userId: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
          scheduledAt: input.scheduledAt ?? null,
          status: "scheduled",
        })
        .returning();
      return w;
    }),

  getMyWebinars: protectedProcedure.query(async ({ ctx }) => {
    return database
      .select({ ...getTableColumns(webinars), registrationCount: database.$count(webinarRegistrations, eq(webinarRegistrations.webinarId, webinars.id)) })
      .from(webinars)
      .where(eq(webinars.userId, ctx.user.id))
      .orderBy(desc(webinars.createdAt))
      .limit(50);
  }),

  getOne: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [w] = await database
        .select({ ...getTableColumns(webinars), host: user, live: liveStreams })
        .from(webinars)
        .innerJoin(user, eq(webinars.userId, user.id))
        .leftJoin(liveStreams, eq(webinars.liveStreamId, liveStreams.id))
        .where(eq(webinars.id, input.id));
      return w ?? null;
    }),

  register: baseProcedure
    .input(
      z.object({
        webinarId: z.string().uuid(),
        email: z.string().email().max(200),
        name: z.string().max(120).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      await database
        .insert(webinarRegistrations)
        .values({ webinarId: input.webinarId, email: input.email, name: input.name ?? null })
        .onConflictDoNothing();
      return { ok: true };
    }),

  getRegistrations: protectedProcedure
    .input(z.object({ webinarId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [w] = await database.select().from(webinars).where(eq(webinars.id, input.webinarId));
      if (!w || w.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return database
        .select()
        .from(webinarRegistrations)
        .where(eq(webinarRegistrations.webinarId, input.webinarId))
        .orderBy(asc(webinarRegistrations.createdAt))
        .limit(500);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await database
        .delete(webinars)
        .where(and(eq(webinars.id, input.id), eq(webinars.userId, ctx.user.id)));
      return { ok: true };
    }),
});