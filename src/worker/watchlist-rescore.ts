import { db } from "../lib/db/client";
import { watchlistItems, tokens, tokenScores } from "../lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { scoreToken } from "../lib/scoring/engine";
import type { Chain } from "../lib/scoring/types";

// ── Watchlist Re-Scoring Cron ──────────────────────
//
//  Periodically re-scores all tokens that appear on any user's watchlist.
//  If the new score has drifted past a user's alertThreshold, flag it
//  (Phase 2.1: log to console, future: push notification / email).
//
//  De-duplicates: if multiple users watch the same token, it's only
//  scored once per cycle.
//
//  Safety:
//  - Scores one token at a time to avoid hammering GoPlus / DexScreener
//  - Capped at 50 tokens per cycle to bound runtime
//  - 2s pause between each token to stay within rate limits
//

const RESCORE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TOKENS_PER_CYCLE = 50;
const PAUSE_BETWEEN_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rescoreWatchedTokens() {
  console.log("[watchlist-rescore] Starting cycle...");

  try {
    // Get distinct tokens on any user's watchlist
    const watchedTokens = await db
      .selectDistinctOn([watchlistItems.tokenId], {
        tokenId: watchlistItems.tokenId,
        tokenAddress: tokens.address,
        tokenChain: tokens.chain,
        tokenName: tokens.name,
        tokenSymbol: tokens.symbol,
      })
      .from(watchlistItems)
      .innerJoin(tokens, eq(watchlistItems.tokenId, tokens.id))
      .limit(MAX_TOKENS_PER_CYCLE);

    if (watchedTokens.length === 0) {
      console.log("[watchlist-rescore] No watched tokens. Skipping.");
      return;
    }

    console.log(
      `[watchlist-rescore] Re-scoring ${watchedTokens.length} tokens...`
    );

    let scored = 0;
    let errors = 0;

    for (const wt of watchedTokens) {
      try {
        // Re-score
        const result = await scoreToken(
          wt.tokenAddress,
          wt.tokenChain as Chain,
          wt.tokenName,
          wt.tokenSymbol
        );

        // Persist the new score
        const [newScore] = await db
          .insert(tokenScores)
          .values({
            tokenId: wt.tokenId,
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

        // Check alert thresholds for all users watching this token
        const watchers = await db
          .select({
            itemId: watchlistItems.id,
            userId: watchlistItems.userId,
            scoreAtAdd: watchlistItems.scoreAtAdd,
            alertThreshold: watchlistItems.alertThreshold,
            lastAlertAt: watchlistItems.lastAlertAt,
          })
          .from(watchlistItems)
          .where(eq(watchlistItems.tokenId, wt.tokenId));

        for (const watcher of watchers) {
          const threshold = watcher.alertThreshold
            ? parseFloat(watcher.alertThreshold)
            : 2.0;
          const delta = Math.abs(result.score - parseFloat(watcher.scoreAtAdd));

          if (delta >= threshold) {
            // Throttle alerts: skip if alerted within the last hour
            if (
              watcher.lastAlertAt &&
              Date.now() - watcher.lastAlertAt.getTime() < 60 * 60 * 1000
            ) {
              continue;
            }

            console.log(
              `[watchlist-rescore] ALERT: ${wt.tokenAddress} on ${wt.tokenChain} ` +
                `moved ${delta.toFixed(1)} pts for user ${watcher.userId} ` +
                `(was ${watcher.scoreAtAdd}, now ${result.score.toFixed(1)})`
            );

            // Update lastAlertAt to throttle future alerts
            await db
              .update(watchlistItems)
              .set({ lastAlertAt: new Date() })
              .where(eq(watchlistItems.id, watcher.itemId));

            // TODO (Phase 2.1): send push notification / email / Telegram alert
          }
        }

        scored++;
        console.log(
          `[watchlist-rescore] ${wt.tokenAddress} → ${result.score.toFixed(1)} (${result.verdict}) [${newScore.id}]`
        );
      } catch (err) {
        errors++;
        console.error(
          `[watchlist-rescore] Failed to re-score ${wt.tokenAddress}:`,
          err
        );
      }

      // Pause between tokens to respect rate limits
      if (scored + errors < watchedTokens.length) {
        await sleep(PAUSE_BETWEEN_MS);
      }
    }

    console.log(
      `[watchlist-rescore] Cycle complete: ${scored} scored, ${errors} errors`
    );
  } catch (err) {
    console.error("[watchlist-rescore] Cycle failed:", err);
  }
}

export function startWatchlistRescore(): NodeJS.Timeout {
  console.log(
    `[watchlist-rescore] Started (every ${RESCORE_INTERVAL_MS / 60000} min, max ${MAX_TOKENS_PER_CYCLE} tokens/cycle)`
  );

  // Initial run after a short delay (let other workers start first)
  setTimeout(rescoreWatchedTokens, 5000);

  // Recurring
  return setInterval(rescoreWatchedTokens, RESCORE_INTERVAL_MS);
}
