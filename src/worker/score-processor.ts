import { Worker, type Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { scoreToken } from "../lib/scoring/engine";
import { db } from "../lib/db/client";
import { tokens, tokenScores } from "../lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ScoreJobData } from "./queue";

async function processScoreJob(job: Job<ScoreJobData>) {
  const { address, chain, tokenName, tokenSymbol } = job.data;
  const normalizedAddress = address.toLowerCase();

  console.log(`[score] Processing ${normalizedAddress} on ${chain}`);

  // 1. Upsert token record
  const existing = await db.query.tokens.findFirst({
    where: and(
      eq(tokens.address, normalizedAddress),
      eq(tokens.chain, chain)
    ),
  });

  let tokenId: string;
  if (existing) {
    tokenId = existing.id;
    // Update name/symbol if we have new data
    if (tokenName || tokenSymbol) {
      await db
        .update(tokens)
        .set({
          name: tokenName ?? existing.name,
          symbol: tokenSymbol ?? existing.symbol,
        })
        .where(eq(tokens.id, tokenId));
    }
  } else {
    const [inserted] = await db
      .insert(tokens)
      .values({
        address: normalizedAddress,
        chain,
        name: tokenName,
        symbol: tokenSymbol,
      })
      .onConflictDoNothing()
      .returning({ id: tokens.id });

    if (inserted) {
      tokenId = inserted.id;
    } else {
      // Race condition: another job inserted it
      const found = await db.query.tokens.findFirst({
        where: and(
          eq(tokens.address, normalizedAddress),
          eq(tokens.chain, chain)
        ),
      });
      tokenId = found!.id;
    }
  }

  // 2. Run the scoring engine
  const result = await scoreToken(normalizedAddress, chain, tokenName, tokenSymbol);

  // 3. Persist the score
  const [score] = await db
    .insert(tokenScores)
    .values({
      tokenId,
      score: result.score.toString(),
      verdict: result.verdict,
      confidence: result.confidence,
      summary: result.summary,
      redFlags: result.redFlags,
      greenFlags: result.greenFlags,
      rawSignals: result.signals as unknown as Record<string, unknown>,
      goplusAvailable: result.goplusAvailable,
      socialAvailable: result.socialAvailable,
      modelVersion: result.modelVersion,
      promptHash: result.promptHash,
    })
    .returning({ id: tokenScores.id });

  console.log(
    `[score] Done: ${normalizedAddress} → ${result.score} (${result.verdict}) [${score.id}]`
  );

  return { scoreId: score.id, ...result };
}

export function startScoreWorker() {
  const worker = new Worker<ScoreJobData>("score", processScoreJob, {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 25, // GoPlus rate limit safety: 25/min
      duration: 60_000,
    },
  });

  worker.on("completed", (job) => {
    console.log(`[worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err.message);
  });

  console.log("[worker] Score processor started (concurrency: 5)");
  return worker;
}
