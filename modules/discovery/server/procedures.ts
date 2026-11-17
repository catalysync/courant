import { and, desc, eq, getTableColumns, inArray, lt, or } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { subscriptions, user, videos } from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

/** Discovery surface: featured carousel + "new from your subscriptions" on the home. */
export const discoveryRouter = createTRPCRouter({
  /** Admin/creator featured videos for the hero carousel (public). */
  getFeatured: baseProcedure.query(async () => {
    return database
      .select({ ...getTableColumns(videos), user })
      .from(videos)
      .innerJoin(user, eq(videos.userId, user.id))
      .where(and(eq(videos.visibility, "public"), eq(videos.isUnlisted, false), eq(videos.isFeatured, true)))
      .orderBy(desc(videos.updatedAt))
      .limit(20);
  }),

  /** New uploads from the channels the viewer subscribes to (home shelf). */
  getSubscriptionsFeed: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({ id: z.string().uuid(), updatedAt: z.date() })
          .nullish(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const creatorIds = database
        .select({ creatorId: subscriptions.creatorId })
        .from(subscriptions)
        .where(eq(subscriptions.viewerId, ctx.user.id));

      const items = await database
        .select({ ...getTableColumns(videos), user })
        .from(videos)
        .innerJoin(user, eq(videos.userId, user.id))
        .where(
          and(
            eq(videos.visibility, "public"),
            inArray(videos.userId, creatorIds),
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

      const hasMore = items.length > limit;
      const list = hasMore ? items.slice(0, -1) : items;
      const last = list[list.length - 1];
      return { items: list, nextCursor: hasMore ? { id: last.id, updatedAt: last.updatedAt } : null };
    }),
});