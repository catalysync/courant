import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { offlineDownloads, playlistMembers, playlists, user, videos } from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

/** Collaborative playlists + viewer offline queue. */
export const collabRouter = createTRPCRouter({
  // ---- collaborative playlists ----

  getMembers: baseProcedure
    .input(z.object({ playlistId: z.string().uuid() }))
    .query(async ({ input }) => {
      return database
        .select({ ...getTableColumns(playlistMembers), member: user })
        .from(playlistMembers)
        .innerJoin(user, eq(playlistMembers.userId, user.id))
        .where(eq(playlistMembers.playlistId, input.playlistId));
    }),

  invite: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["editor", "viewer"]).default("editor"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [playlist] = await database
        .select()
        .from(playlists)
        .where(eq(playlists.id, input.playlistId));
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });
      if (playlist.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const [target] = await database
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.email));
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "No user with that email" });

      await database
        .insert(playlistMembers)
        .values({ playlistId: input.playlistId, userId: target.id, role: input.role })
        .onConflictDoNothing();
      return { ok: true };
    }),

  removeMember: protectedProcedure
    .input(z.object({ playlistId: z.string().uuid(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await database
        .delete(playlistMembers)
        .where(
          and(eq(playlistMembers.playlistId, input.playlistId), eq(playlistMembers.userId, input.userId)),
        );
      return { ok: true };
    }),

  // ---- offline downloads (saved-for-offline) ----

  getOffline: protectedProcedure.query(async ({ ctx }) => {
    return database
      .select({ ...getTableColumns(videos) })
      .from(offlineDownloads)
      .innerJoin(videos, eq(offlineDownloads.videoId, videos.id))
      .where(eq(offlineDownloads.userId, ctx.user.id))
      .orderBy(desc(offlineDownloads.createdAt))
      .limit(100);
  }),

  saveOffline: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await database
        .insert(offlineDownloads)
        .values({ userId: ctx.user.id, videoId: input.videoId })
        .onConflictDoNothing();
      return { ok: true };
    }),

  removeOffline: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await database
        .delete(offlineDownloads)
        .where(and(eq(offlineDownloads.userId, ctx.user.id), eq(offlineDownloads.videoId, input.videoId)));
      return { ok: true };
    }),
});