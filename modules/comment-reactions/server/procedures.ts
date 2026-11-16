import { database } from "@/database";
import { commentReactions } from "@/database/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

export const commentReactionsRouter = createTRPCRouter({
  like: protectedProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { commentId } = input;
      const { id: userId } = ctx.user;

      const [existing] = await database
        .select()
        .from(commentReactions)
        .where(
          and(
            eq(commentReactions.commentId, commentId),
            eq(commentReactions.userId, userId),
            eq(commentReactions.type, "like"),
          ),
        );

      if (existing) {
        const [deleted] = await database
          .delete(commentReactions)
          .where(and(eq(commentReactions.userId, userId), eq(commentReactions.commentId, commentId)))
          .returning();
        return deleted;
      }

      const [created] = await database
        .insert(commentReactions)
        .values({ userId, commentId, type: "like" })
        .onConflictDoUpdate({
          target: [commentReactions.userId, commentReactions.commentId],
          set: { type: "like" },
        })
        .returning();

      return created;
    }),
  dislike: protectedProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { commentId } = input;
      const { id: userId } = ctx.user;

      const [existing] = await database
        .select()
        .from(commentReactions)
        .where(
          and(
            eq(commentReactions.commentId, commentId),
            eq(commentReactions.userId, userId),
            eq(commentReactions.type, "dislike"),
          ),
        );

      if (existing) {
        const [deleted] = await database
          .delete(commentReactions)
          .where(and(eq(commentReactions.userId, userId), eq(commentReactions.commentId, commentId)))
          .returning();
        return deleted;
      }

      const [created] = await database
        .insert(commentReactions)
        .values({ userId, commentId, type: "dislike" })
        .onConflictDoUpdate({
          target: [commentReactions.userId, commentReactions.commentId],
          set: { type: "dislike" },
        })
        .returning();

      return created;
    }),
});