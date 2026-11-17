import { database } from "@/database";
import { subscriptions, user, videos } from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, eq, getTableColumns, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

export const usersRouter = createTRPCRouter({
  getOne: baseProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const viewerId = ctx.session?.user?.id;

      // NOTE: CTE name must NOT collide with the `subscriptions` table — SQLite
      // raises "circular reference" when a non-recursive CTE references a base
      // table of the same name in its own definition (Postgres tolerates this).
      const viewerSubscriptions = database.$with("viewer_subscriptions").as(
        database
          .select()
          .from(subscriptions)
          .where(viewerId ? eq(subscriptions.viewerId, viewerId) : sql`0`),
      );

      const [existingUser] = await database
        .with(viewerSubscriptions)
        .select({
          ...getTableColumns(user),
          subscriberCount: database.$count(
            subscriptions,
            eq(subscriptions.creatorId, user.id),
          ),
          videoCount: database.$count(
            videos,
            and(eq(videos.userId, user.id), eq(videos.visibility, "public"), eq(videos.isUnlisted, false)),
          ),
          viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(Boolean),
        })
        .from(user)
        .leftJoin(viewerSubscriptions, eq(viewerSubscriptions.creatorId, user.id))
        .where(eq(user.id, input.id));

      if (!existingUser) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return existingUser;
    }),

  /** Update the current user's channel banner (url comes from R2 via /api/uploads). */
  updateBanner: protectedProcedure
    .input(
      z.object({
        url: z.string().min(1),
        key: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await database
        .update(user)
        .set({
          bannerUrl: input.url,
          bannerKey: input.key ?? null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.user.id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /** Update the current user's avatar (url comes from R2 via /api/uploads). */
  updateAvatar: protectedProcedure
    .input(
      z.object({
        url: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await database
        .update(user)
        .set({ image: input.url, updatedAt: new Date() })
        .where(eq(user.id, ctx.user.id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),
});