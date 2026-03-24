/**
 * Generate an invite code that auto-upgrades anyone who uses it.
 *
 * Usage:
 *   npx tsx scripts/generate-invite.ts
 *   npx tsx scripts/generate-invite.ts --uses 10
 *   npx tsx scripts/generate-invite.ts --uses 10 --plan whale --days 7
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { randomBytes } from "crypto";

const { inviteCodes } = schema;

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { uses: 1, plan: "pro" as "pro" | "whale", days: null as number | null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--uses") result.uses = parseInt(args[++i]);
    if (args[i] === "--plan") result.plan = args[++i] as "pro" | "whale";
    if (args[i] === "--days") result.days = parseInt(args[++i]);
  }
  return result;
}

async function main() {
  const { uses, plan, days } = parseArgs();

  const code = randomBytes(4).toString("hex").toUpperCase(); // e.g. A3F2B1C4
  const expiresAt = days ? new Date(Date.now() + days * 86_400_000) : null;

  const db = drizzle(postgres(process.env.DATABASE_URL!), { schema });

  await db.insert(inviteCodes).values({ code, plan, maxUses: uses, expiresAt });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log(`✓ Invite code created`);
  console.log(`  Code:    ${code}`);
  console.log(`  Plan:    ${plan}`);
  console.log(`  Uses:    ${uses}`);
  console.log(`  Expires: ${expiresAt ? expiresAt.toISOString() : "never"}`);
  console.log(`  Link:    ${appUrl}/invite/${code}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
