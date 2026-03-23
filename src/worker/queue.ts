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

export const scoreQueue = new Queue<ScoreJobData>("score", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export async function enqueueScore(data: ScoreJobData): Promise<string> {
  // Deterministic job ID to prevent duplicates
  const jobId = `score-${data.chain}-${data.address.toLowerCase()}`;
  const job = await scoreQueue.add("score-token", data, { jobId });
  return job.id ?? jobId;
}
