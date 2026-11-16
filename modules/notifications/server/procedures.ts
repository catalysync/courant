import { database } from "@/database";
import { notifications, user, videos, comments } from "@/database/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { and, count, desc, eq, getTableColumns, isNull, lt, or } from "drizzle-orm";
import type { notificationType } from "@/database/schema";

/** Create a notification for a recipient. Fire-and-forget; caller handles errors. */
export async function createNotification(input: {
  userId: string;
  actorId?: string | null;
  type: (typeof notificationType)[number];
  videoId?: string | null;
  commentId?: string | null;
}) {
  await database.insert(notifications).values({
    userId: input.userId,
    actorId: input.actorId ?? null,
    type: input.type,
    videoId: input.videoId ?? null,
    commentId: input.commentId ?? null,
  });
}

export const notificationsRouter = createTRPCRouter({
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await database
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));

    return row?.count ?? 0;
  }),

  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({ id: z.string().uuid(), createdAt: z.date() })
          .nullish(),
        limit: z.number().min(1).max(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      const items = await database
        .select({
          ...getTableColumns(notifications),
          actor: user,
          video: videos,
          comment: comments,
        })
        .from(notifications)
        .leftJoin(user, eq(notifications.actorId, user.id))
        .leftJoin(videos, eq(notifications.videoId, videos.id))
        .leftJoin(comments, eq(notifications.commentId, comments.id))
        .where(
          and(
            eq(notifications.userId, userId),
            cursor
              ? or(
                  lt(notifications.createdAt, cursor.createdAt),
                  and(
                    eq(notifications.createdAt, cursor.createdAt),
                    lt(notifications.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit + 1);

      const hasMore = items.length > limit;
      const list = hasMore ? items.slice(0, -1) : items;
      const last = list[list.length - 1];
      const nextCursor = hasMore
        ? { id: last.id, createdAt: last.createdAt }
        : null;

      return { items: list, nextCursor };
    }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await database
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)))
        .returning();

      return updated;
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await database
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));

    return { ok: true };
  }),
});