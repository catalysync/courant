import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import { comments, reports, user, videos } from "@/database/schema";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

const REASONS = [
  "spam",
  "harassment",
  "hateful_or_abusive",
  "explicit_content",
  "copyright",
  "misleading",
  "other",
] as const;

/** Trust & safety: report content + admin moderation queue. */
export const reportsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid().nullish(),
        commentId: z.string().uuid().nullish(),
        targetUserId: z.string().nullish(),
        reason: z.enum(REASONS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.videoId && !input.commentId && !input.targetUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to report" });
      }
      const [report] = await database
        .insert(reports)
        .values({
          reporterId: ctx.user.id,
          videoId: input.videoId ?? null,
          commentId: input.commentId ?? null,
          targetUserId: input.targetUserId ?? null,
          reason: input.reason,
          status: "open",
        })
        .returning();
      return report;
    }),

  /** Admin: open reports with joined target info. */
  getMany: adminProcedure.query(async () => {
    return database
      .select({
        ...getTableColumns(reports),
        reporter: user,
        video: videos,
        comment: comments,
      })
      .from(reports)
      .leftJoin(user, eq(reports.reporterId, user.id))
      .leftJoin(videos, eq(reports.videoId, videos.id))
      .leftJoin(comments, eq(reports.commentId, comments.id))
      .where(eq(reports.status, "open"))
      .orderBy(desc(reports.createdAt))
      .limit(100);
  }),

  resolve: adminProcedure
    .input(z.object({ id: z.string().uuid(), status: z.enum(["resolved", "dismissed"]) }))
    .mutation(async ({ input }) => {
      const [updated] = await database
        .update(reports)
        .set({ status: input.status })
        .where(and(eq(reports.id, input.id)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),
});