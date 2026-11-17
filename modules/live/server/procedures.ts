import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, getTableColumns, ne } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { liveStreams, simulcastDestinations, subscriptions, user } from "@/database/schema";
import { stream } from "@/lib/stream";
import { createNotification } from "@/modules/notifications/server/procedures";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

async function notifySubscribers(creatorId: string) {
  const followers = await database
    .select({ viewerId: subscriptions.viewerId })
    .from(subscriptions)
    .where(eq(subscriptions.creatorId, creatorId));
  for (const f of followers) {
    await createNotification({
      userId: f.viewerId,
      actorId: creatorId,
      type: "live_started",
    }).catch(() => {});
  }
}

export const liveRouter = createTRPCRouter({
  /** Currently-streaming live streams (for the "Live now" shelf). */
  getActive: baseProcedure.query(async () => {
    return database
      .select({ ...getTableColumns(liveStreams), creator: user })
      .from(liveStreams)
      .innerJoin(user, eq(liveStreams.creatorId, user.id))
      .where(eq(liveStreams.status, "streaming"))
      .orderBy(desc(liveStreams.startedAt))
      .limit(20);
  }),

  /** A single live stream by id (watch page). */
  getLive: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await database
        .select({ ...getTableColumns(liveStreams), creator: user })
        .from(liveStreams)
        .innerJoin(user, eq(liveStreams.creatorId, user.id))
        .where(eq(liveStreams.id, input.id));
      return row ?? null;
    }),

  /** The authenticated creator's active (non-ended) live stream, if any. */
  getMyLive: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await database
      .select()
      .from(liveStreams)
      .where(and(eq(liveStreams.creatorId, ctx.user.id), ne(liveStreams.status, "ended")))
      .orderBy(desc(liveStreams.createdAt));
    return row ?? null;
  }),

  /** Create a Stream live input and register a live stream. Returns RTMP ingest details. */
  startLive: protectedProcedure
    .input(z.object({ title: z.string().max(120).nullish() }))
    .mutation(async ({ ctx, input }) => {
      const created = await stream.createLiveInput({ name: input.title ?? "Courant live" });

      const [row] = await database
        .insert(liveStreams)
        .values({
          creatorId: ctx.user.id,
          streamInputId: created.uid,
          rtmpUrl: created.rtmps?.url ?? null,
          streamKey: created.rtmps?.streamKey ?? null,
          playbackUrl: created.playback?.hls ?? null,
          title: input.title ?? `${ctx.user.name} is live`,
          status: "ready",
        })
        .returning();

      notifySubscribers(ctx.user.id).catch(() => {});

      return row;
    }),

  /** Mark a live stream as streaming (called when the creator actually starts RTMP). */
  setStreaming: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await database
        .update(liveStreams)
        .set({ status: "streaming", startedAt: new Date() })
        .where(and(eq(liveStreams.id, input.id), eq(liveStreams.creatorId, ctx.user.id)))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  /** End a live stream: delete the Stream input and mark ended. */
  endLive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await database
        .select()
        .from(liveStreams)
        .where(and(eq(liveStreams.id, input.id), eq(liveStreams.creatorId, ctx.user.id)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        await stream.deleteLiveInput(row.streamInputId);
      } catch {
        /* Stream may not be configured */
      }

      const [updated] = await database
        .update(liveStreams)
        .set({ status: "ended", endedAt: new Date() })
        .where(eq(liveStreams.id, input.id))
        .returning();
      return updated;
    }),

  // ---- simulcasting (Vimeo multi-destination) ----

  getSimulcast: baseProcedure
    .input(z.object({ liveId: z.string().uuid() }))
    .query(async ({ input }) => {
      return database
        .select()
        .from(simulcastDestinations)
        .where(eq(simulcastDestinations.liveStreamId, input.liveId))
        .orderBy(asc(simulcastDestinations.name));
    }),

  addSimulcast: protectedProcedure
    .input(
      z.object({
        liveId: z.string().uuid(),
        name: z.string().min(1).max(60),
        rtmpUrl: z.string().min(1),
        streamKey: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await database
        .select()
        .from(liveStreams)
        .where(and(eq(liveStreams.id, input.liveId), eq(liveStreams.creatorId, ctx.user.id)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const [d] = await database
        .insert(simulcastDestinations)
        .values({
          liveStreamId: input.liveId,
          name: input.name,
          rtmpUrl: input.rtmpUrl,
          streamKey: input.streamKey,
        })
        .returning();
      return d;
    }),

  removeSimulcast: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await database.delete(simulcastDestinations).where(eq(simulcastDestinations.id, input.id));
      return { ok: true };
    }),
});