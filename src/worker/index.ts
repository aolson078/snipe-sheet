import "dotenv/config";
import { startScoreWorker } from "./score-processor";
import { startLaunchMonitor } from "./launch-monitor";
import { startWatchlistRescore } from "./watchlist-rescore";

// ── Worker Entry Point ─────────────────────────────
// Runs on Railway as a long-lived process, separate from Vercel.
//
// Responsibilities:
// 1. Score processor (BullMQ consumer)
// 2. Launch monitor (factory contract event polling)
// 3. Watchlist re-scoring cron (Phase 2)
// 4. Rug detection cron (Phase 3)

console.log("[worker] Starting Snipe Sheet worker...");

const scoreWorker = startScoreWorker();
const launchMonitorInterval = startLaunchMonitor();
const watchlistRescoreInterval = startWatchlistRescore();

// Graceful shutdown
async function shutdown() {
  console.log("[worker] Shutting down...");
  clearInterval(launchMonitorInterval);
  clearInterval(watchlistRescoreInterval);
  await scoreWorker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
