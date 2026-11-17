import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { database } from "@/database";
import { memberships, purchases, videos } from "@/database/schema";
import { payments } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Stripe webhook. Marks a pending purchase as completed, or creates an active
 * membership, based on the checkout-session metadata we set at checkout time.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!payments.verifyWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type: string; data: { object: any } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const object = event.data?.object ?? {};

  if (event.type === "checkout.session.completed") {
    const meta = object.metadata ?? {};
    const sessionId = object.id as string | undefined;
    if (!sessionId) return NextResponse.json({ ok: true });

    if (meta.kind === "video") {
      await database
        .update(purchases)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(purchases.providerSessionId, sessionId));
    } else if (meta.kind === "membership") {
      const creatorId = meta.creatorId as string;
      const userId = meta.userId as string;
      if (creatorId && userId) {
        const [video] = await database
          .select({ priceCents: videos.priceCents })
          .from(videos)
          .where(eq(videos.userId, creatorId))
          .limit(1);
        await database
          .insert(memberships)
          .values({
            userId,
            creatorId,
            tierName: "Supporter",
            priceCents: object.amount_total ?? video?.priceCents ?? 0,
            currency: (object.currency as string) ?? "usd",
            providerCustomerId: object.customer ?? null,
            status: "active",
            currentPeriodEnd: object.current_period_end
              ? new Date((object.current_period_end as number) * 1000)
              : null,
          })
          .onConflictDoUpdate({
            target: [memberships.userId, memberships.creatorId],
            set: {
              status: "active",
              currentPeriodEnd: object.current_period_end
                ? new Date((object.current_period_end as number) * 1000)
                : null,
              updatedAt: new Date(),
            },
          });
      }
    }
  } else if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    // Deactivate membership if the subscription ended.
    const status = object.status as string | undefined;
    if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
      const customerId = object.customer as string | undefined;
      if (customerId) {
        await database
          .update(memberships)
          .set({ status: "inactive", updatedAt: new Date() })
          .where(eq(memberships.providerCustomerId, customerId));
      }
    }
  }

  return NextResponse.json({ ok: true });
}