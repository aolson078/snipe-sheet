import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Shared connection for caching and rate limiting
export function createRedisClient() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
  });
}

// BullMQ requires its own connection config
const url = new URL(REDIS_URL);
export const redisConnection = {
  host: url.hostname,
  port: parseInt(url.port || "6379"),
  password: url.password || undefined,
  username: url.username || undefined,
  tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
};
