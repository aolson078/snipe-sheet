import Stripe from "stripe";
import { db } from "./db/client";
import { subscriptions } from "./db/schema";
import { eq } from "drizzle-orm";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil",
});

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  priceId: string
) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: userEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/feed?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
    metadata: { userId },
  });
  return session;
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const plan =
    session.amount_total && session.amount_total >= 9900 ? "whale" : "pro";

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      plan,
      status: "active",
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        plan,
        status: "active",
        updatedAt: new Date(),
      },
    });
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  await db
    .update(subscriptions)
    .set({ plan: "free", status: "canceled", updatedAt: new Date() })
    .where(
      eq(subscriptions.stripeSubscriptionId, subscription.id)
    );
}

export async function getUserPlan(
  userId: string
): Promise<"free" | "pro" | "whale"> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!sub || sub.status !== "active") return "free";
  return sub.plan;
}
