/**
 * Post the launch thread to X/Twitter.
 *
 * Setup:
 *   1. Go to developer.twitter.com → create a project/app → get keys
 *   2. Add to .env.local:
 *        TWITTER_API_KEY=...
 *        TWITTER_API_SECRET=...
 *        TWITTER_ACCESS_TOKEN=...
 *        TWITTER_ACCESS_SECRET=...
 *   3. npm install twitter-api-v2
 *   4. Fill in the FILL_IN sections below
 *   5. npx tsx scripts/post-launch-thread.ts
 *
 * To do a dry run without posting:
 *   npx tsx scripts/post-launch-thread.ts --dry-run
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// ─── FILL IN THESE BEFORE RUNNING ────────────────────────────────────────────

const TOKEN_NAME = "FILL_IN";          // e.g. "$BALD"
const TOKEN_ADDRESS = "FILL_IN";       // e.g. "0x27d2..."
const CHAIN = "FILL_IN";              // "ethereum" or "base"
const HOURS_BEFORE_RUG = "FILL_IN";   // e.g. "4 hours"
const SCORE = "FILL_IN";              // e.g. "2.1 / 10"
const VERDICT = "FILL_IN";            // e.g. "HIGH RISK"
const RED_FLAG_1 = "FILL_IN";         // e.g. "Honeypot detected"
const RED_FLAG_2 = "FILL_IN";         // e.g. "Top holder owned 41%"
const RED_FLAG_3 = "FILL_IN";         // e.g. "Liquidity unlocked"
const SHARE_CARD_URL = "FILL_IN";     // e.g. "https://snipesheet.com/share/abc123"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "FILL_IN"; // e.g. "https://snipesheet.com"

// ─────────────────────────────────────────────────────────────────────────────

const THREAD: string[] = [
  // Tweet 1 — Hook
  `${TOKEN_NAME} rugged ${HOURS_BEFORE_RUG} before it happened.

Here's what the score said.`,

  // Tweet 2 — The score
  `Snipe Sheet scored ${TOKEN_NAME} at ${SCORE} — ${VERDICT}.

Contract: ⛔
Liquidity: ⚠️
Holders: ⛔
Social: ⚠️
Age: ⛔

This was visible before anyone got hurt.`,

  // Tweet 3 — The red flags
  `The red flags that were already there:

🚩 ${RED_FLAG_1}
🚩 ${RED_FLAG_2}
🚩 ${RED_FLAG_3}

Not hindsight. This is what on-chain data looks like before a rug.

${SHARE_CARD_URL}`,

  // Tweet 4 — CTA
  `I built Snipe Sheet so you don't have to open 4 tabs to catch this.

Paste any address → get a risk score in 10 seconds.

5 free checks/day. Pro unlocks unlimited.

${APP_URL}`,
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("─── DRY RUN — thread that would be posted ───\n");
    THREAD.forEach((tweet, i) => {
      console.log(`Tweet ${i + 1} (${tweet.length} chars):\n${tweet}\n${"─".repeat(50)}\n`);
    });
    return;
  }

  // Check for unfilled placeholders
  const allText = THREAD.join(" ");
  if (allText.includes("FILL_IN")) {
    console.error("❌ You have unfilled FILL_IN placeholders. Edit the script before posting.");
    process.exit(1);
  }

  const { TwitterApi } = await import("twitter-api-v2");

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });

  console.log("Posting thread...");
  let replyToId: string | undefined;

  for (let i = 0; i < THREAD.length; i++) {
    const params: Record<string, unknown> = { text: THREAD[i] };
    if (replyToId) params.reply = { in_reply_to_tweet_id: replyToId };

    const { data } = await client.v2.tweet(params as Parameters<typeof client.v2.tweet>[0]);
    replyToId = data.id;
    console.log(`✓ Tweet ${i + 1}/${THREAD.length} posted — https://x.com/i/web/status/${data.id}`);
  }

  console.log("\n✓ Thread posted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
