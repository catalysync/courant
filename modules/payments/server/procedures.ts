import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { database } from "@/database";
import {
  creatorSettings,
  memberships,
  monetizationType,
  purchases,
  videos,
} from "@/database/schema";
import { payments } from "@/lib/payments";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const monetization = z.enum(monetizationType);

async function hasPaidAccess(viewerId: string | undefined, video: typeof videos.$inferSelect) {
  if (!viewerId) return false;
  if (video.userId === viewerId) return true;

  if (video.monetizationType === "rental") {
    const [p] = await database
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.videoId, video.id),
          eq(purchases.userId, viewerId),
          eq(purchases.status, "completed"),
          or(isNull(purchases.expiresAt), gte(purchases.expiresAt, new Date())),
        ),
      )
      .limit(1);
    return !!p;
  }

  if (video.monetizationType === "purchase") {
    const [p] = await database
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.videoId, video.id),
          eq(purchases.userId, viewerId),
          eq(purchases.status, "completed"),
        ),
      )
      .limit(1);
    return !!p;
  }

  if (video.monetizationType === "membership") {
    const [m] = await database
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.creatorId, video.userId),
          eq(memberships.userId, viewerId),
          eq(memberships.status, "active"),
        ),
      )
      .limit(1);
    return !!m;
  }

  return true;
}

export const paymentsRouter = createTRPCRouter({
  /** Viewer access + monetization info for a video. */
  getVideoAccess: baseProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
      if (!video) throw new TRPCError({ code: "NOT_FOUND" });

      const viewerId = ctx.session?.user?.id;
      return {
        monetizationType: video.monetizationType,
        priceCents: video.priceCents,
        hasAccess: await hasPaidAccess(viewerId, video),
      };
    }),

  /** Creator sets monetization on their video. */
  setVideoMonetization: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        monetizationType: monetization,
        priceCents: z.number().int().min(0).max(1_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await database
        .update(videos)
        .set({
          monetizationType: input.monetizationType,
          priceCents: input.monetizationType === "free" ? 0 : input.priceCents,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.id, input.videoId), eq(videos.userId, ctx.user.id)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /** Start a Stripe checkout for a rental/purchase. */
  createVideoCheckout: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!payments.isConfigured()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payments are not configured" });
      }
      const [video] = await database.select().from(videos).where(eq(videos.id, input.videoId));
      if (!video) throw new TRPCError({ code: "NOT_FOUND" });
      if (video.monetizationType === "free" || video.monetizationType === "membership") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Video does not require purchase" });
      }

      const session = await payments.createCheckoutSession({
        amountCents: video.priceCents,
        name: `Video: ${video.title}`,
        mode: "payment",
        successUrl: `${APP_URL}/videos/${video.id}?paid=1`,
        cancelUrl: `${APP_URL}/videos/${video.id}`,
        metadata: {
          kind: "video",
          videoId: video.id,
          userId: ctx.user.id,
          type: video.monetizationType,
        },
      });

      await database.insert(purchases).values({
        userId: ctx.user.id,
        videoId: video.id,
        type: video.monetizationType,
        amountCents: video.priceCents,
        currency: "usd",
        providerSessionId: session.sessionId,
        status: "pending",
        expiresAt:
          video.monetizationType === "rental"
            ? new Date(Date.now() + 72 * 60 * 60 * 1000)
            : null,
      });

      return { url: session.url };
    }),

  /** A creator's membership settings + the viewer's active membership. */
  getMembershipSettings: baseProcedure
    .input(z.object({ creatorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [settings] = await database
        .select()
        .from(creatorSettings)
        .where(eq(creatorSettings.userId, input.creatorId));

      let active = false;
      const viewerId = ctx.session?.user?.id;
      if (viewerId) {
        const [m] = await database
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.creatorId, input.creatorId),
              eq(memberships.userId, viewerId),
              eq(memberships.status, "active"),
            ),
          )
          .limit(1);
        active = !!m;
      }

      return {
        enabled: settings?.membershipEnabled ?? false,
        priceCents: settings?.membershipPriceCents ?? 500,
        tierName: settings?.membershipTierName ?? "Supporter",
        active,
        paymentsConfigured: payments.isConfigured(),
      };
    }),

  /** Creator sets their membership tier. */
  setMembershipSettings: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        priceCents: z.number().int().min(100).max(1_000_000),
        tierName: z.string().min(1).max(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await database
        .insert(creatorSettings)
        .values({
          userId: ctx.user.id,
          membershipEnabled: input.enabled,
          membershipPriceCents: input.priceCents,
          membershipTierName: input.tierName,
        })
        .onConflictDoUpdate({
          target: creatorSettings.userId,
          set: {
            membershipEnabled: input.enabled,
            membershipPriceCents: input.priceCents,
            membershipTierName: input.tierName,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    }),

  /** Start a Stripe subscription checkout for a channel membership. */
  createMembershipCheckout: protectedProcedure
    .input(z.object({ creatorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!payments.isConfigured()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payments are not configured" });
      }
      const [settings] = await database
        .select()
        .from(creatorSettings)
        .where(eq(creatorSettings.userId, input.creatorId));
      if (!settings?.membershipEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Membership is not enabled" });
      }

      const session = await payments.createCheckoutSession({
        amountCents: settings.membershipPriceCents,
        name: `Membership: ${settings.membershipTierName}`,
        mode: "subscription",
        successUrl: `${APP_URL}/users/${input.creatorId}?membership=1`,
        cancelUrl: `${APP_URL}/users/${input.creatorId}`,
        metadata: { kind: "membership", creatorId: input.creatorId, userId: ctx.user.id },
      });

      return { url: session.url };
    }),

  getMyPurchases: protectedProcedure.query(async ({ ctx }) => {
    return database
      .select()
      .from(purchases)
      .where(eq(purchases.userId, ctx.user.id))
      .orderBy(desc(purchases.createdAt))
      .limit(100);
  }),

  getMyMemberships: protectedProcedure.query(async ({ ctx }) => {
    return database
      .select()
      .from(memberships)
      .where(eq(memberships.userId, ctx.user.id))
      .orderBy(desc(memberships.createdAt))
      .limit(100);
  }),
});