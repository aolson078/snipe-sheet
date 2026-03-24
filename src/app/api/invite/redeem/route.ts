import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { inviteCodes, users, subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const { code } = await request.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const invite = await db.query.inviteCodes.findFirst({
    where: eq(inviteCodes.code, code.toUpperCase().trim()),
  });

  if (!invite) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }
  if (invite.uses >= invite.maxUses) {
    return NextResponse.json({ error: "Code already used" }, { status: 410 });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Code expired" }, { status: 410 });
  }

  // Find or create the user record
  let user = await db.query.users.findFirst({
    where: eq(users.email, session.user.email.toLowerCase()),
  });
  if (!user) {
    const [inserted] = await db
      .insert(users)
      .values({ email: session.user.email.toLowerCase() })
      .onConflictDoNothing()
      .returning();
    user = inserted;
  }
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 500 });
  }

  // Upgrade subscription
  await db
    .insert(subscriptions)
    .values({ userId: user.id, plan: invite.plan, status: "active" })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { plan: invite.plan, status: "active", updatedAt: new Date() },
    });

  // Increment use count
  await db
    .update(inviteCodes)
    .set({ uses: invite.uses + 1 })
    .where(eq(inviteCodes.id, invite.id));

  return NextResponse.json({ plan: invite.plan });
}
