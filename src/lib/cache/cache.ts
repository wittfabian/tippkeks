import "server-only";

import { getRedis } from "./redis";

const VALUE_PREFIX = "tk:cache:";
const TAG_PREFIX = "tk:tag:";

interface CacheOptions {
  /** Stable identifier for this entry (the VALUE_PREFIX is added internally). */
  key: string;
  /** Hard expiry in seconds — a backstop even if a tag is never invalidated. */
  ttlSeconds: number;
  /** Tags this entry belongs to; `invalidateTags` drops every member at once. */
  tags?: string[];
}

/**
 * Read-through cache for GLOBAL or tenant-uniform data only. Never wrap a
 * per-user / RLS-scoped read in this — the value is keyed solely by `key`, so
 * two users would share one entry and leak across the tenant boundary. Cache
 * only data that is identical for everyone who can see it (tournament schedule,
 * app settings, a tenant's leaderboard).
 *
 * Degrades to a direct `fetcher()` call when Valkey is unset or unreachable.
 */
export async function cached<T>(opts: CacheOptions, fetcher: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (!redis) return fetcher();

  const valueKey = VALUE_PREFIX + opts.key;
  try {
    const hit = await redis.get(valueKey);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    console.error("[cache] read failed:", (err as Error).message);
    return fetcher();
  }

  const value = await fetcher();

  try {
    const pipeline = redis.multi();
    pipeline.set(valueKey, JSON.stringify(value), "EX", opts.ttlSeconds);
    for (const tag of opts.tags ?? []) {
      const tagKey = TAG_PREFIX + tag;
      pipeline.sadd(tagKey, valueKey);
      // Keep the tag index from outliving its entries if it is never invalidated.
      pipeline.expire(tagKey, opts.ttlSeconds * 4);
    }
    await pipeline.exec();
  } catch (err) {
    console.error("[cache] write failed:", (err as Error).message);
  }

  return value;
}

/**
 * Drop every cache entry tagged with any of `tags`. Safe to call from the sync
 * job, the CLI, or Server Actions — it talks to the shared store, so
 * invalidation crosses process and instance boundaries (unlike revalidateTag).
 */
export async function invalidateTags(...tags: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || tags.length === 0) return;

  try {
    for (const tag of tags) {
      const tagKey = TAG_PREFIX + tag;
      const keys = await redis.smembers(tagKey);
      const pipeline = redis.multi();
      if (keys.length > 0) pipeline.del(...keys);
      pipeline.del(tagKey);
      await pipeline.exec();
    }
  } catch (err) {
    console.error("[cache] invalidate failed:", (err as Error).message);
  }
}
