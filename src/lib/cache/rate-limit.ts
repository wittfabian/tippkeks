import "server-only";

import { getRedis } from "./redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets. */
  resetSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Valkey. `key` should already be namespaced
 * by purpose + subject (e.g. `pwreset:ip:1.2.3.4`). Fails OPEN when Valkey is
 * unset or unreachable: availability beats enforcement for a friends' app, and
 * Supabase Auth applies its own server-side limits as a second layer.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true, remaining: limit, resetSeconds: windowSeconds };

  const redisKey = `tk:rl:${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    const ttl = await redis.ttl(redisKey);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: ttl >= 0 ? ttl : windowSeconds,
    };
  } catch (err) {
    console.error("[rate-limit] failed:", (err as Error).message);
    return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
  }
}
