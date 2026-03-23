import { createRedisClient } from "./redis";

const redis = createRedisClient();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * Rate limiting:
 * - Free: 5 checks/day (resets at UTC midnight)
 * - Pro: 60 req/min
 * - Whale: 120 req/min
 */
export async function checkRateLimit(
  userId: string,
  plan: "free" | "pro" | "whale"
): Promise<RateLimitResult> {
  try {
    if (plan === "free") {
      return checkDailyLimit(userId, 5);
    } else if (plan === "pro") {
      return checkMinuteLimit(userId, 60);
    } else {
      return checkMinuteLimit(userId, 120);
    }
  } catch {
    // Redis down — fail open
    console.warn("Rate limit check failed — allowing request (fail open)");
    return { allowed: true, remaining: 999, limit: 999 };
  }
}

async function checkDailyLimit(
  userId: string,
  limit: number
): Promise<RateLimitResult> {
  const key = `rl:daily:${userId}`;
  const count = await redis.incr(key);

  if (count === 1) {
    // Set expiry to next UTC midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const ttl = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
    await redis.expire(key, ttl);
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
  };
}

async function checkMinuteLimit(
  userId: string,
  limit: number
): Promise<RateLimitResult> {
  const key = `rl:min:${userId}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60);
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
  };
}

/** Rate limit for anonymous Telegram users by chat_id */
export async function checkTelegramRateLimit(
  chatId: string
): Promise<RateLimitResult> {
  return checkDailyLimit(`tg:${chatId}`, 5);
}
