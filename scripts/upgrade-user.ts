/**
 * Upgrade a user to pro (or whale) by email.
 *
 * Usage:
 *   npx tsx scripts/upgrade-user.ts user@example.com
 *   npx tsx scripts/upgrade-user.ts user@example.com whale
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const { users, subscriptions } = schema;

async function main() {
  const email = process.argv[2];
  const plan = (process.argv[3] ?? "pro") as "pro" | "whale";

  if (!email) {
    console.error("Usage: npx tsx scripts/upgrade-user.ts <email> [pro|whale]");
    process.exit(1);
  }

  if (!["pro", "whale"].includes(plan)) {
    console.error("Plan must be 'pro' or 'whale'");
    process.exit(1);
  }

  const db = drizzle(postgres(process.env.DATABASE_URL!), { schema });

  // Find or create user
  let user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });

  if (!user) {
    console.log(`User ${email} not found — creating...`);
    const [inserted] = await db
      .insert(users)
      .values({ email: email.toLowerCase() })
      .returning();
    user = inserted;
    console.log(`Created user: ${user.id}`);
  } else {
    console.log(`Found user: ${user.id}`);
  }

  // Upsert subscription
  await db
    .insert(subscriptions)
    .values({ userId: user.id, plan, status: "active" })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { plan, status: "active", updatedAt: new Date() },
    });

  console.log(`✓ ${email} upgraded to ${plan}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
