import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import type { Chain } from "../lib/scoring/types";

export interface ScoreJobData {
  address: string;
  chain: Chain;
  tokenName?: string | null;
  tokenSymbol?: string | null;
  source: "user" | "launch_monitor";
}

// Lazy init — avoids connecting to Redis at build time
let _scoreQueue: Queue<ScoreJobData> | null = null;

export function getScoreQueue(): Queue<ScoreJobData> {
  if (!_scoreQueue) {
    _scoreQueue = new Queue<ScoreJobData>("score", {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return _scoreQueue;
}

export async function enqueueScore(data: ScoreJobData): Promise<string> {
  const queue = getScoreQueue();
  const jobId = `score-${data.chain}-${data.address.toLowerCase()}`;
  const job = await queue.add("score-token", data, { jobId });
  return job.id ?? jobId;
}
