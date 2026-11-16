import { database } from "@/database";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { subscriptions, user, videos } from "@/database/schema";
import { z } from "zod";
import { and, desc, eq, getTableColumns, lt, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createNotification } from "@/modules/notifications/server/procedures";

export const subscriptionsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            creatorId: z.string(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      const subscriptionsList = await database
        .select({
          ...getTableColumns(subscriptions),
          user: {
            ...getTableColumns(user),
            subscriberCount: database.$count(
              subscriptions,
              eq(subscriptions.creatorId, user.id),
            ),
          },
        })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.viewerId, userId),
            cursor
              ? or(
                  lt(subscriptions.updatedAt, cursor.updatedAt),
                  and(
                    eq(subscriptions.updatedAt, cursor.updatedAt),
                    lt(subscriptions.creatorId, cursor.creatorId),
                  ),
                )
              : undefined,
          ),
        )
        .innerJoin(user, eq(subscriptions.creatorId, user.id))
        .orderBy(desc(subscriptions.updatedAt))
        .limit(limit + 1);

      const hasMore = subscriptionsList.length > limit;
      const items = hasMore ? subscriptionsList.slice(0, -1) : subscriptionsList;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { creatorId: lastItem.creatorId, updatedAt: lastItem.updatedAt }
        : null;

      return { items, nextCursor };
    }),
  // SUBSCRIBE
  create: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [createdSubscription] = await database
        .insert(subscriptions)
        .values({
          viewerId: ctx.user.id,
          creatorId: userId,
        })
        .returning();

      try {
        await createNotification({
          userId,
          actorId: ctx.user.id,
          type: "new_subscriber",
        });
      } catch {
        /* non-fatal */
      }

      return createdSubscription;
    }),
  remove: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [deletedSubscription] = await database
        .delete(subscriptions)
        .where(
          and(eq(subscriptions.viewerId, ctx.user.id), eq(subscriptions.creatorId, userId)),
        )
        .returning();

      return deletedSubscription;
    }),
});