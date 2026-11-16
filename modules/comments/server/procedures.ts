import { database } from "@/database";
import {
  commentReactions,
  comments,
  user,
  videos,
} from "@/database/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { createNotification } from "@/modules/notifications/server/procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

export const commentsRouter = createTRPCRouter({
  remove: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [deletedComment] = await database
        .delete(comments)
        .where(and(eq(comments.id, id), eq(comments.userId, userId)))
        .returning();

      if (!deletedComment) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return deletedComment;
    }),
  create: protectedProcedure
    .input(
      z.object({
        parentId: z.string().uuid().nullish(),
        videoId: z.string().uuid(),
        value: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { parentId, videoId, value } = input;
      const { id: userId } = ctx.user;

      const [existingComment] = await database
        .select()
        .from(comments)
        .where(parentId ? eq(comments.id, parentId) : sql`0`);

      if (!existingComment && parentId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (existingComment?.parentId && parentId) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [createdComment] = await database
        .insert(comments)
        .values({ userId, videoId, parentId, value })
        .returning();

      // Notify the recipient (video owner for top-level, parent author for replies).
      try {
        if (parentId && existingComment && existingComment.userId !== userId) {
          await createNotification({
            userId: existingComment.userId,
            actorId: userId,
            type: "comment_reply",
            videoId,
            commentId: createdComment.id,
          });
        } else if (!parentId) {
          const [video] = await database
            .select({ userId: videos.userId })
            .from(videos)
            .where(eq(videos.id, videoId));
          if (video && video.userId !== userId) {
            await createNotification({
              userId: video.userId,
              actorId: userId,
              type: "new_comment",
              videoId,
              commentId: createdComment.id,
            });
          }
        }
      } catch {
        /* non-fatal */
      }

      return createdComment;
    }),
  getMany: baseProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        parentId: z.string().uuid().nullish(),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { parentId, videoId, cursor, limit } = input;
      const userId = ctx.session?.user?.id;

      const viewerReactions = database.$with("viewer_reactions").as(
        database
          .select({
            commentId: commentReactions.commentId,
            type: commentReactions.type,
          })
          .from(commentReactions)
          .where(userId ? eq(commentReactions.userId, userId) : sql`0`),
      );

      const replies = database.$with("replies").as(
        database
          .select({
            parentId: comments.parentId,
            count: count(comments.id).as("count"),
          })
          .from(comments)
          .where(isNotNull(comments.parentId))
          .groupBy(comments.parentId),
      );

      const [totalData, data] = await Promise.all([
        database
          .select({ count: count() })
          .from(comments)
          .where(eq(comments.videoId, videoId)),
        database
          .with(viewerReactions, replies)
          .select({
            ...getTableColumns(comments),
            user,
            viewerReaction: viewerReactions.type,
            replyCount: replies.count,
            likeCount: database.$count(
              commentReactions,
              and(eq(commentReactions.type, "like"), eq(commentReactions.commentId, comments.id)),
            ),
            dislikeCount: database.$count(
              commentReactions,
              and(
                eq(commentReactions.type, "dislike"),
                eq(commentReactions.commentId, comments.id),
              ),
            ),
          })
          .from(comments)
          .where(
            and(
              eq(comments.videoId, videoId),
              parentId ? eq(comments.parentId, parentId) : isNull(comments.parentId),
              cursor
                ? or(
                    lt(comments.updatedAt, cursor.updatedAt),
                    and(eq(comments.updatedAt, cursor.updatedAt), lt(comments.id, cursor.id)),
                  )
                : undefined,
            ),
          )
          .innerJoin(user, eq(comments.userId, user.id))
          .leftJoin(viewerReactions, eq(comments.id, viewerReactions.commentId))
          .leftJoin(replies, eq(comments.id, replies.parentId))
          .orderBy(desc(comments.updatedAt), desc(comments.id))
          .limit(limit + 1),
      ]);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
        : null;

      return {
        totalCount: totalData[0].count,
        items,
        nextCursor,
      };
    }),
});