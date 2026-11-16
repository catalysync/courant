import { database } from "@/database";
import { subscriptions, user, videos } from "@/database/schema";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
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

      const viewerSubscriptions = database.$with("subscriptions").as(
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
            and(eq(videos.userId, user.id), eq(videos.visibility, "public")),
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
});