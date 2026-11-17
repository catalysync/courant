import { database } from "@/database";
import { ledger, tips, user } from "@/database/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createNotification } from "@/modules/notifications/server/procedures";

export const tipsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        toUserId: z.string().uuid(),
        videoId: z.string().uuid().nullish(),
        amountCents: z.number().int().min(1).max(1_000_000),
        note: z.string().max(280).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: fromUserId } = ctx.user;

      if (fromUserId === input.toUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't tip yourself" });
      }

      const [recipient] = await database
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, input.toUserId));
      if (!recipient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [tip] = await database
        .insert(tips)
        .values({
          fromUserId,
          toUserId: input.toUserId,
          videoId: input.videoId ?? null,
          amountCents: input.amountCents,
          note: input.note ?? null,
        })
        .returning();

      // Credit the recipient's running ledger balance.
      const [bal] = await database
        .select({ balanceCents: ledger.balanceCents })
        .from(ledger)
        .where(eq(ledger.userId, input.toUserId))
        .orderBy(desc(ledger.createdAt), desc(ledger.id))
        .limit(1);
      const newBalance = (bal?.balanceCents ?? 0) + input.amountCents;
      await database.insert(ledger).values({
        userId: input.toUserId,
        type: "tip_received",
        amountCents: input.amountCents,
        balanceCents: newBalance,
        refType: "tip",
        refId: tip.id,
        note: input.note ?? null,
      });

      // Notify the recipient.
      await createNotification({
        userId: input.toUserId,
        actorId: fromUserId,
        type: "tip_received",
        videoId: input.videoId ?? null,
        commentId: null,
      }).catch(() => {});

      return tip;
    }),

  getMany: protectedProcedure
    .input(z.object({ direction: z.enum(["received", "sent"]).default("received") }))
    .query(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      // For "received" show the sender; for "sent" show the recipient.
      const peerCol = input.direction === "received" ? tips.fromUserId : tips.toUserId;

      return database
        .select({
          id: tips.id,
          amountCents: tips.amountCents,
          currency: tips.currency,
          note: tips.note,
          videoId: tips.videoId,
          createdAt: tips.createdAt,
          user,
        })
        .from(tips)
        .innerJoin(user, eq(peerCol, user.id))
        .where(eq(input.direction === "received" ? tips.toUserId : tips.fromUserId, userId))
        .orderBy(desc(tips.createdAt), desc(tips.id))
        .limit(100);
    }),

  getLedger: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId } = ctx.user;
    const entries = await database
      .select()
      .from(ledger)
      .where(eq(ledger.userId, userId))
      .orderBy(desc(ledger.createdAt), desc(ledger.id))
      .limit(200);
    const balanceCents = entries[0]?.balanceCents ?? 0;
    return { balanceCents, entries };
  }),
});
